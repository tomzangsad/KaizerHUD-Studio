package com.kaizer.kaizermultibar.bar.strategy;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import com.kaizer.kaizermultibar.util.PrefixBuilder;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sends the same HUD data string as {@link CombinedBarStrategy}, but through the title instead
 * of a boss bar ({@code bossbar.channel: title}).
 *
 * The HUD pack (exported with the same channel) keeps the last title that starts with our
 * prefix and hides it from the vanilla title, so the string only has to be sent when it
 * changes — plus every {@code bossbar.channel-resend-ticks} as a safety net (e.g. after the
 * client rebuilt its HUD). Sending less often also means other plugins' titles are replaced
 * less often.
 *
 * An action bar channel was tried and removed (2026-11-24): a Bedrock pack cannot keep action
 * bar data apart from other plugins' action bar messages.
 */
public class ChannelBarStrategy extends AbstractBarStrategy {

    public enum Channel {
        TITLE;

        /** null = boss bar (or unknown value, e.g. the removed "actionbar") */
        public static Channel parse(String value) {
            if (value == null) return null;
            return "title".equals(value.trim().toLowerCase(java.util.Locale.ROOT)) ? TITLE : null;
        }
    }

    /** Hides the HUD: the pack subtracts this whole string, so no prefix is left. */
    public static final String OFF_PAYLOAD = PrefixBuilder.PREFIX + "~off";
    /** How long a (hidden) title stays on the client. The pack keeps the data after it ends. */
    private static final int TITLE_STAY_TICKS = 40;

    private final Channel channel;
    private final long resendMillis;
    /** Only used to build the string (never creates a boss bar). */
    private final CombinedBarStrategy builder;

    private final Set<UUID> active = ConcurrentHashMap.newKeySet();
    private final Set<UUID> hidden = ConcurrentHashMap.newKeySet();
    private final Map<UUID, String> lastSent = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastSentAt = new ConcurrentHashMap<>();

    public ChannelBarStrategy(KaizerMultiBarCore plugin, Channel channel) {
        this.channel = channel;
        this.builder = new CombinedBarStrategy(plugin);
        long ticks = plugin.getConfig().getLong("bossbar.channel-resend-ticks", 100L);
        this.resendMillis = Math.max(0L, ticks) * 50L;
    }

    public Channel getChannel() {
        return channel;
    }

    @Override
    public void initPlayer(Player player) {
        UUID id = player.getUniqueId();
        active.add(id);
        forget(id); // send on the next update
    }

    @Override
    public void updatePlayer(Player player) {
        UUID id = player.getUniqueId();
        if (!active.contains(id)) return;

        String data = hidden.contains(id) ? OFF_PAYLOAD : builder.buildTitle(player);
        if (data == null) return;

        long now = System.currentTimeMillis();
        String last = lastSent.get(id);
        Long at = lastSentAt.get(id);
        boolean changed = !data.equals(last);
        boolean due = resendMillis > 0 && (at == null || now - at >= resendMillis);
        if (!changed && !due) return;

        send(player, data);
        lastSent.put(id, data);
        lastSentAt.put(id, now);
    }

    @Override
    public void removePlayer(Player player) {
        UUID id = player.getUniqueId();
        boolean wasActive = active.remove(id);
        if (wasActive && lastSent.containsKey(id) && player.isOnline()) {
            send(player, OFF_PAYLOAD); // the pack keeps the last data otherwise
        }
        forget(id);
        hidden.remove(id);
    }

    @Override
    public void removeAll() {
        for (UUID id : active) {
            Player p = Bukkit.getPlayer(id);
            if (p != null && p.isOnline() && lastSent.containsKey(id)) send(p, OFF_PAYLOAD);
        }
        active.clear();
        hidden.clear();
        lastSent.clear();
        lastSentAt.clear();
        builder.removeAll(); // reloads the visibility conditions
    }

    @Override
    public void toggleVisibility(Player player) {
        UUID id = player.getUniqueId();
        if (!hidden.remove(id)) hidden.add(id);
        forget(id);
        updatePlayer(player);
    }

    @Override
    public boolean hasBarsFor(Player player) {
        return active.contains(player.getUniqueId());
    }

    @Override
    public void refresh(Player player) {
        forget(player.getUniqueId());
    }

    private void forget(UUID id) {
        lastSent.remove(id);
        lastSentAt.remove(id);
    }

    @SuppressWarnings("deprecation")
    private void send(Player player, String data) {
        // String API = the same legacy-text conversion as BossBar#setTitle (CraftChatMessage),
        // so the byte layout the pack slices is identical to the boss bar channel.
        player.sendTitle(data, null, 0, TITLE_STAY_TICKS, 0);
    }
}
