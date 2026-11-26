package com.kaizer.kaizermultibar.bar.strategy;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import com.kaizer.kaizermultibar.util.PrefixBuilder;
import com.kaizer.kaizermultibar.util.SchedulerUtil;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sends HUD data strings through {@link Player#sendTitle} ({@code bossbar.channel: title}),
 * supporting both single-bank HUDs and Multi-Bank HUDs (>255 bytes across {@code bossbar.banks}).
 * Each bank has its own persistent store panel ({@code kz_hud_store}, {@code kz_hud_store_1}, ...),
 * so only banks whose data changed are transmitted (spaced 1 tick apart when multiple banks update).
 */
public class ChannelBarStrategy extends AbstractBarStrategy {

    public enum Channel {
        TITLE;

        public static Channel parse(String value) {
            if (value == null) return null;
            return "title".equals(value.trim().toLowerCase(java.util.Locale.ROOT)) ? TITLE : null;
        }
    }

    /** Primary off-payload kept for backward compatibility. */
    public static final String OFF_PAYLOAD = PrefixBuilder.PREFIX + "~off";
    /** How long a (hidden) title stays on the client. The pack keeps the data after it ends. */
    private static final int TITLE_STAY_TICKS = 40;

    private final KaizerMultiBarCore plugin;
    private final Channel channel;
    private final long resendMillis;
    private final CombinedBarStrategy builder;

    private final Set<UUID> active = ConcurrentHashMap.newKeySet();
    private final Set<UUID> hidden = ConcurrentHashMap.newKeySet();
    private final Map<UUID, Map<Integer, String>> lastSent = new ConcurrentHashMap<>();
    private final Map<UUID, Map<Integer, Long>> lastSentAt = new ConcurrentHashMap<>();

    public ChannelBarStrategy(KaizerMultiBarCore plugin, Channel channel) {
        this.plugin = plugin;
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
        forget(id);
    }

    @Override
    public void updatePlayer(Player player) {
        UUID id = player.getUniqueId();
        if (!active.contains(id)) return;

        List<String> payloads = hidden.contains(id)
                ? buildOffPayloads()
                : builder.buildBankTitles(player);
        if (payloads.isEmpty()) return;

        long now = System.currentTimeMillis();
        Map<Integer, String> sentMap = lastSent.computeIfAbsent(id, k -> new ConcurrentHashMap<>());
        Map<Integer, Long> atMap = lastSentAt.computeIfAbsent(id, k -> new ConcurrentHashMap<>());

        List<Integer> dirtyBanks = new ArrayList<>();
        for (int i = 0; i < payloads.size(); i++) {
            String data = payloads.get(i);
            if (data == null) continue;
            String last = sentMap.get(i);
            Long at = atMap.get(i);
            boolean changed = !data.equals(last);
            boolean due = resendMillis > 0 && (at == null || now - at >= resendMillis);
            if (changed || due) dirtyBanks.add(i);
        }
        if (dirtyBanks.isEmpty()) return;

        // Send the first dirty bank immediately; stagger extra dirty banks 2 ticks apart so each
        // persists into its own kz_hud_store_<k> without client/TCP tick coalescing dropping one.
        int firstBank = dirtyBanks.get(0);
        String firstData = payloads.get(firstBank);
        send(player, firstData);
        sentMap.put(firstBank, firstData);
        atMap.put(firstBank, now);

        for (int d = 1; d < dirtyBanks.size(); d++) {
            final int bankIdx = dirtyBanks.get(d);
            final String data = payloads.get(bankIdx);
            sentMap.put(bankIdx, data);
            atMap.put(bankIdx, now);
            SchedulerUtil.runTaskLaterForPlayer(plugin.getPlugin(), player, () -> {
                if (player.isOnline() && active.contains(id)) {
                    send(player, data);
                }
            }, d * 2L);
        }
    }

    private List<String> buildOffPayloads() {
        List<String> prefixes = builder.getBankPrefixes();
        List<String> off = new ArrayList<>(prefixes.size());
        for (String p : prefixes) {
            off.add(p + "~off");
        }
        return off;
    }

    @Override
    public void removePlayer(Player player) {
        UUID id = player.getUniqueId();
        boolean wasActive = active.remove(id);
        if (wasActive && lastSent.containsKey(id) && player.isOnline()) {
            List<String> offs = buildOffPayloads();
            for (int i = 0; i < offs.size(); i++) {
                final String p = offs.get(i);
                if (i == 0) send(player, p);
                else SchedulerUtil.runTaskLaterForPlayer(plugin.getPlugin(), player, () -> {
                    if (player.isOnline()) send(player, p);
                }, i * 2L);
            }
        }
        forget(id);
        hidden.remove(id);
    }

    @Override
    public void removeAll() {
        List<String> offs = buildOffPayloads();
        for (UUID id : active) {
            Player p = Bukkit.getPlayer(id);
            if (p != null && p.isOnline() && lastSent.containsKey(id)) {
                for (String off : offs) send(p, off);
            }
        }
        active.clear();
        hidden.clear();
        lastSent.clear();
        lastSentAt.clear();
        builder.removeAll();
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
        player.sendTitle(data, null, 0, TITLE_STAY_TICKS, 0);
    }
}
