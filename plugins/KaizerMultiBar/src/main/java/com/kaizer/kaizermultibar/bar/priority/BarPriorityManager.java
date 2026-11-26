package com.kaizer.kaizermultibar.bar.priority;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListener;
import com.github.retrooper.packetevents.event.PacketListenerCommon;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerBossBar;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerBossBar.Action;
import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import com.kaizer.kaizermultibar.bar.BossBarManager;
import com.kaizer.kaizermultibar.util.SchedulerUtil;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Keeps our bossbar above the bars of other plugins (clients draw bossbars in the order
 * they were added, and the HUD resource pack reads the first one).
 *
 * Uses PacketEvents (ProtocolLib has no release for Minecraft 26.x):
 *  - While a player's bars are not ready yet, other plugins' ADD packets are held back
 *    and sent right after ours, so they land below.
 *  - If another bar still ends up above ours, it is removed and re-added from its
 *    latest known state (title, progress, colour, style, flags — kept per player).
 *    A bar we have no state for is never removed, so other plugins' bars can't vanish.
 */
public class BarPriorityManager {

    private final KaizerMultiBarCore plugin;
    private final BossBarManager barManager;
    private PacketListenerCommon listener;

    /** Order of bar UUIDs as each client currently has them. */
    private final Map<UUID, List<UUID>> clientBarOrder = new ConcurrentHashMap<>();
    /** Latest state of every external bar, per player → per bar. */
    private final Map<UUID, Map<UUID, BarState>> externalBars = new ConcurrentHashMap<>();
    /** External bars held back until our bars exist (insertion order kept). */
    private final Map<UUID, Map<UUID, BarState>> pending = new ConcurrentHashMap<>();

    private final Set<UUID> playersNeedingRefresh = ConcurrentHashMap.newKeySet();
    private final AtomicBoolean refreshScheduled = new AtomicBoolean(false);

    public BarPriorityManager(KaizerMultiBarCore plugin, BossBarManager barManager) {
        this.plugin = plugin;
        this.barManager = barManager;
    }

    /** Everything a client needs to (re)create a bossbar. */
    private static final class BarState {
        volatile Component title = Component.empty();
        volatile float health;
        volatile BossBar.Color color = BossBar.Color.WHITE;
        volatile BossBar.Overlay overlay = BossBar.Overlay.PROGRESS;
        volatile EnumSet<BossBar.Flag> flags = EnumSet.noneOf(BossBar.Flag.class);

        static BarState of(WrapperPlayServerBossBar w) {
            BarState s = new BarState();
            s.title = w.getTitle() != null ? w.getTitle() : Component.empty();
            s.health = w.getHealth();
            if (w.getColor() != null) s.color = w.getColor();
            if (w.getOverlay() != null) s.overlay = w.getOverlay();
            if (w.getFlags() != null) s.flags = EnumSet.copyOf(w.getFlags().isEmpty() ? EnumSet.noneOf(BossBar.Flag.class) : w.getFlags());
            return s;
        }

        void apply(WrapperPlayServerBossBar w) {
            switch (w.getAction()) {
                case UPDATE_TITLE -> { if (w.getTitle() != null) title = w.getTitle(); }
                case UPDATE_HEALTH -> health = w.getHealth();
                case UPDATE_STYLE -> {
                    if (w.getColor() != null) color = w.getColor();
                    if (w.getOverlay() != null) overlay = w.getOverlay();
                }
                case UPDATE_FLAGS -> { if (w.getFlags() != null) flags = EnumSet.copyOf(w.getFlags().isEmpty() ? EnumSet.noneOf(BossBar.Flag.class) : w.getFlags()); }
                default -> { }
            }
        }

        WrapperPlayServerBossBar toAdd(UUID uuid) {
            WrapperPlayServerBossBar w = new WrapperPlayServerBossBar(uuid, Action.ADD);
            w.setTitle(title);
            w.setHealth(health);
            w.setColor(color);
            w.setOverlay(overlay);
            w.setFlags(EnumSet.copyOf(flags.isEmpty() ? EnumSet.noneOf(BossBar.Flag.class) : flags));
            return w;
        }
    }

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    public void setup() {
        listener = PacketEvents.getAPI().getEventManager().registerListener(new PacketListener() {
            @Override
            public void onPacketSend(PacketSendEvent event) {
                if (event.getPacketType() != PacketType.Play.Server.BOSS_BAR) return;
                try {
                    handle(event);
                } catch (Throwable ignored) {
                    // never break the connection over a bossbar
                }
            }
        }, PacketListenerPriority.HIGHEST);
    }

    public void shutdown() {
        if (listener != null) {
            try {
                PacketEvents.getAPI().getEventManager().unregisterListener(listener);
            } catch (Throwable ignored) {}
        }
    }

    // -----------------------------------------------------------------------
    // Packet handling (netty thread)
    // -----------------------------------------------------------------------

    private void handle(PacketSendEvent event) {
        if (event.isCancelled()) return;
        Object p = event.getPlayer();
        if (!(p instanceof Player player) || !player.isOnline()) return;
        if (!barManager.shouldManagePlayer(player)) return;

        WrapperPlayServerBossBar w = new WrapperPlayServerBossBar(event);
        UUID bar = w.getUUID();
        UUID pid = player.getUniqueId();
        boolean ours = barManager.getManagedBarUuids().contains(bar);

        Map<UUID, BarState> held = pending.get(pid);
        switch (w.getAction()) {
            case ADD -> {
                if (!ours) {
                    BarState state = BarState.of(w);
                    if (!barManager.hasBarsFor(player)) {
                        // our bars are not there yet: hold this one back
                        event.setCancelled(true);
                        pending.computeIfAbsent(pid, k -> new LinkedHashMap<>()).put(bar, state);
                        return;
                    }
                    externalBars.computeIfAbsent(pid, k -> new ConcurrentHashMap<>()).put(bar, state);
                }
                List<UUID> order = clientBarOrder.computeIfAbsent(pid, k -> new CopyOnWriteArrayList<>());
                order.remove(bar);
                order.add(bar);
                if (ours || needsReorder(order)) requestRefresh(player);
            }
            case REMOVE -> {
                if (held != null && held.remove(bar) != null) {
                    event.setCancelled(true); // the client never got it
                    return;
                }
                List<UUID> order = clientBarOrder.get(pid);
                if (order != null) order.remove(bar);
                Map<UUID, BarState> ext = externalBars.get(pid);
                if (ext != null) ext.remove(bar);
            }
            default -> {
                if (ours) return;
                if (held != null && held.containsKey(bar)) {
                    held.get(bar).apply(w);
                    event.setCancelled(true); // client doesn't know this bar yet
                    return;
                }
                Map<UUID, BarState> ext = externalBars.get(pid);
                BarState s = ext != null ? ext.get(bar) : null;
                if (s != null) s.apply(w);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Priority enforcement
    // -----------------------------------------------------------------------

    /** Safety net called on a timer: makes sure all of our bank bossbars stay at the top. */
    public void checkAndFix(Player player) {
        List<UUID> order = clientBarOrder.get(player.getUniqueId());
        if (order != null && needsReorder(order)) requestRefresh(player);
    }

    /** Batches fixes into one per tick. */
    private void requestRefresh(Player player) {
        if (player == null || !player.isOnline()) return;
        playersNeedingRefresh.add(player.getUniqueId());
        if (refreshScheduled.compareAndSet(false, true)) {
            SchedulerUtil.runTaskLater(plugin.getPlugin(), () -> {
                refreshScheduled.set(false);
                List<UUID> todo = new ArrayList<>(playersNeedingRefresh);
                playersNeedingRefresh.removeAll(todo);
                for (UUID uuid : todo) {
                    Player p = Bukkit.getPlayer(uuid);
                    if (p != null && p.isOnline()) SchedulerUtil.runTaskForPlayer(plugin.getPlugin(), p, () -> forceToTop(p));
                }
            }, 1L);
        }
    }

    /** Re-adds external bars that sit before our last managed bank so our banks occupy indices 0..K-1. */
    private void forceToTop(Player player) {
        UUID pid = player.getUniqueId();
        List<UUID> order = clientBarOrder.get(pid);
        if (order == null) return;
        int lastManaged = lastManagedIndex(order);
        if (lastManaged < 0) return;

        Set<UUID> managed = barManager.getManagedBarUuids();
        Map<UUID, BarState> ext = externalBars.getOrDefault(pid, Map.of());
        List<UUID> above = new ArrayList<>();
        for (int i = 0; i < lastManaged; i++) {
            UUID id = order.get(i);
            if (!managed.contains(id)) above.add(id);
        }
        if (above.isEmpty()) return;

        for (UUID id : above) {
            if (!ext.containsKey(id)) {
                return;
            }
        }
        for (UUID id : above) {
            BarState s = ext.get(id);
            send(player, new WrapperPlayServerBossBar(id, Action.REMOVE));
            send(player, s.toAdd(id));
        }
    }

    /** Sends the held-back external bars once our bars exist. */
    public void releasePendingPackets(Player player) {
        if (!player.isOnline()) return;
        Map<UUID, BarState> held = pending.remove(player.getUniqueId());
        if (held == null || held.isEmpty()) return;
        held.forEach((id, s) -> send(player, s.toAdd(id)));
    }

    public void clearPlayer(Player player) {
        UUID pid = player.getUniqueId();
        clientBarOrder.remove(pid);
        externalBars.remove(pid);
        pending.remove(pid);
        playersNeedingRefresh.remove(pid);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private void send(Player player, WrapperPlayServerBossBar packet) {
        try {
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, packet);
        } catch (Throwable ignored) {}
    }

    private int lastManagedIndex(List<UUID> order) {
        Set<UUID> managed = barManager.getManagedBarUuids();
        int last = -1;
        for (int i = 0; i < order.size(); i++) {
            if (managed.contains(order.get(i))) last = i;
        }
        return last;
    }

    private boolean needsReorder(List<UUID> order) {
        Set<UUID> managed = barManager.getManagedBarUuids();
        int last = lastManagedIndex(order);
        if (last < 0) return false;
        for (int i = 0; i < last; i++) {
            if (!managed.contains(order.get(i))) return true;
        }
        return false;
    }
}
