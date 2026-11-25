package com.kaizer.kaizermultibar.geyser;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import org.geysermc.event.subscribe.Subscribe;
import org.geysermc.geyser.api.event.bedrock.SessionDisconnectEvent;
import org.geysermc.geyser.api.event.lifecycle.GeyserPostInitializeEvent;
import org.geysermc.geyser.api.extension.Extension;
import org.geysermc.geyser.registry.Registries;
import org.geysermc.geyser.session.GeyserSession;
import org.geysermc.geyser.session.cache.BossBar;
import org.geysermc.geyser.translator.protocol.PacketTranslator;
import org.geysermc.mcprotocollib.protocol.data.game.BossBarAction;
import org.geysermc.mcprotocollib.protocol.packet.ingame.clientbound.ClientboundBossEventPacket;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Geyser extension for KaizerMultiBar.
 *
 * Bedrock draws bossbars in the order they were created. Geyser keeps bossbars in an
 * unordered map and forwards them as they arrive, so the KaizerMultiBar HUD bar can end
 * up below other plugins' bars. This extension wraps Geyser's bossbar translator and,
 * whenever our bar (title starting with {@value #PREFIX}) appears, re-creates every
 * bar that sits above it on the Bedrock client so they drop below ours.
 *
 * Works at the Geyser layer, so it also covers bars sent by proxy plugins and only ever
 * affects Bedrock players. Uses Geyser internals; if they change, it switches itself off
 * and Geyser keeps working normally.
 */
public class KaizerMultiBarGeyser implements Extension {

    static final String PREFIX = "@zelisce/custom_bossbars:";

    /** Per session: bars in the order the Bedrock client created them. */
    private final Map<GeyserSession, List<UUID>> order = new ConcurrentHashMap<>();
    /** Per session: which of those bars are ours. */
    private final Map<GeyserSession, Set<UUID>> ours = new ConcurrentHashMap<>();
    private volatile boolean broken;

    @Subscribe
    public void onPostInitialize(GeyserPostInitializeEvent event) {
        try {
            @SuppressWarnings("unchecked")
            PacketTranslator<ClientboundBossEventPacket> original =
                    (PacketTranslator<ClientboundBossEventPacket>) Registries.JAVA_PACKET_TRANSLATORS.get(ClientboundBossEventPacket.class);
            if (original == null) {
                logger().warning("Geyser's bossbar translator was not found - KaizerMultiBar bar order is not managed.");
                return;
            }
            Registries.JAVA_PACKET_TRANSLATORS.register(ClientboundBossEventPacket.class, new Wrapper(original));
            logger().info("Keeping the KaizerMultiBar HUD bossbar first for Bedrock players.");
        } catch (Throwable t) {
            logger().warning("Could not hook Geyser's bossbar translator (" + t + ") - bar order is not managed.");
        }
    }

    @Subscribe
    public void onDisconnect(SessionDisconnectEvent event) {
        if (event.connection() instanceof GeyserSession s) {
            order.remove(s);
            ours.remove(s);
        }
    }

    private final class Wrapper extends PacketTranslator<ClientboundBossEventPacket> {
        private final PacketTranslator<ClientboundBossEventPacket> original;

        Wrapper(PacketTranslator<ClientboundBossEventPacket> original) {
            this.original = original;
        }

        @Override
        public boolean shouldExecuteInEventLoop() {
            return original.shouldExecuteInEventLoop();
        }

        @Override
        public void translate(GeyserSession session, ClientboundBossEventPacket packet) {
            original.translate(session, packet);
            if (broken) return;
            try {
                track(session, packet);
            } catch (LinkageError e) {
                broken = true; // Geyser internals changed: stop touching them
                logger().warning("Geyser internals changed (" + e + ") - KaizerMultiBar bar order is no longer managed. Please update the extension.");
            } catch (Throwable ignored) {
                // never break the Bedrock connection over bar order
            }
        }
    }

    private void track(GeyserSession session, ClientboundBossEventPacket packet) {
        UUID id = packet.getUuid();
        BossBarAction action = packet.getAction();
        List<UUID> list = order.computeIfAbsent(session, k -> new ArrayList<>());
        Set<UUID> mine = ours.computeIfAbsent(session, k -> ConcurrentHashMap.newKeySet());

        switch (action) {
            case ADD -> {
                list.remove(id);
                list.add(id);
                if (isOurs(packet.getTitle())) markOurs(session, id, list, mine);
            }
            case REMOVE -> {
                list.remove(id);
                mine.remove(id);
            }
            case UPDATE_TITLE -> {
                // KaizerMultiBar creates its bar with an empty title and fills it right after
                if (!mine.contains(id) && isOurs(packet.getTitle())) markOurs(session, id, list, mine);
            }
            default -> { }
        }
    }

    /** Our bar is known: re-create the bars above it so they end up below it. */
    private void markOurs(GeyserSession session, UUID id, List<UUID> list, Set<UUID> mine) {
        mine.add(id);
        int at = list.indexOf(id);
        if (at <= 0) return;
        List<UUID> above = new ArrayList<>();
        for (UUID other : list.subList(0, at)) {
            if (!mine.contains(other)) above.add(other);
        }
        for (UUID other : above) {
            BossBar bar = session.getEntityCache().getBossBar(other);
            if (bar == null) continue;
            bar.removeBossBar();
            bar.addBossBar();
            list.remove(other);
            list.add(other);
        }
    }

    static boolean isOurs(Component title) {
        if (title == null) return false;
        StringBuilder sb = new StringBuilder();
        plain(title, sb);
        return sb.toString().startsWith(PREFIX);
    }

    /** Plain text of a component, stopping once enough characters for the prefix check exist. */
    private static void plain(Component c, StringBuilder sb) {
        if (sb.length() >= PREFIX.length()) return;
        if (c instanceof TextComponent t) sb.append(t.content());
        for (Component child : c.children()) {
            if (sb.length() >= PREFIX.length()) return;
            plain(child, sb);
        }
    }
}
