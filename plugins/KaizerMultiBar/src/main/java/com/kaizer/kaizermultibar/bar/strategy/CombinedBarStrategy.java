package com.kaizer.kaizermultibar.bar.strategy;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import com.kaizer.kaizermultibar.bar.VisibilityConditionManager;
import com.kaizer.kaizermultibar.util.PapiHelper;
import com.kaizer.kaizermultibar.util.PrefixBuilder;
import com.kaizer.kaizermultibar.util.TextFormatter;
import org.bukkit.Bukkit;
import org.bukkit.boss.BarColor;
import org.bukkit.boss.BarStyle;
import org.bukkit.boss.BossBar;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Strategy for combined mode — one BossBar per player containing all slots.
 */
public class CombinedBarStrategy extends AbstractBarStrategy {

    /** Bars-section length used by packs exported before `bossbar.bars-length` existed. */
    private static final int DEFAULT_BARS_LENGTH = 100;

    private final KaizerMultiBarCore plugin;
    private final Map<UUID, BossBar> bars = new HashMap<>();
    private final VisibilityConditionManager visibilityManager;

    public CombinedBarStrategy(KaizerMultiBarCore plugin) {
        this.plugin = plugin;
        this.visibilityManager = new VisibilityConditionManager(plugin);
    }

    @Override
    public void initPlayer(Player player) {
        BossBar existing = bars.get(player.getUniqueId());
        if (existing != null) {
            untrackBarUuid(existing); // must untrack before removeAll so UUID leaves managedBarUuids
            existing.removeAll();
        }

        BossBar bar = Bukkit.createBossBar("", BarColor.WHITE, BarStyle.SOLID);
        trackBarUuid(bar);      // register UUID before sending ADD packet to client
        trySetPriority(bar);
        bars.put(player.getUniqueId(), bar);  // must be BEFORE addPlayer so hasBarsFor() = true during packet listener
        bar.addPlayer(player);  // sends ADD packet — UUID is already in managedBarUuids
    }

    @Override
    public void updatePlayer(Player player) {
        BossBar bar = bars.get(player.getUniqueId());
        if (bar == null) return;

        String title = buildTitle(player);
        if (title == null) return;
        bar.setTitle(title);
        bar.setProgress(0.0);
    }

    /**
     * The whole HUD data string for {@code player}: prefix + bars section + slots + visibility
     * markers. Also used by {@link ChannelBarStrategy} (action bar / title), so every channel
     * sends exactly the same text. Returns null when {@code bossbar.bars} is missing.
     */
    public String buildTitle(Player player) {
        ConfigurationSection barsSection = plugin.getConfig().getConfigurationSection("bossbar.bars");
        if (barsSection == null) return null;

        // Lengths are raw (formatting codes count) in the unit the HUD pack slices with.
        TextFormatter.LengthUnit unit = TextFormatter.LengthUnit.parse(plugin.getConfig().getString("bossbar.length-unit", "bytes"));
        int barsLength = plugin.getConfig().getInt("bossbar.bars-length", DEFAULT_BARS_LENGTH);

        // Right section: bar markers, each padded to its configured length, total padded to bars-length
        StringBuilder right = new StringBuilder();
        for (String key : barsSection.getKeys(false)) {
            String raw = barsSection.getString(key + ".text", "");
            int pad = barsSection.getInt(key + ".pad-length", 5);
            String parsed = TextFormatter.format(KaizerMultiBarCore.isPapiPresent() ? PapiHelper.setPlaceholders(player, raw) : raw);
            right.append(TextFormatter.padRight(parsed, pad, unit));
        }
        String rightPadded = TextFormatter.padRight(right.toString(), barsLength, unit);

        // Left section: slot entries ordered by slot index
        StringBuilder left = new StringBuilder();
        ConfigurationSection slotsSection = plugin.getConfig().getConfigurationSection("bossbar.slots");
        if (slotsSection != null) {
            List<String> keys = new ArrayList<>(slotsSection.getKeys(false));
            keys.sort((a, b) -> Integer.compare(slotIndex(a), slotIndex(b)));
            for (String key : keys) {
                String raw = slotsSection.getString(key + ".text", "");
                int pad = slotsSection.getInt(key + ".pad-length", 30);
                String parsed = TextFormatter.format(KaizerMultiBarCore.isPapiPresent() ? PapiHelper.setPlaceholders(player, raw) : raw);
                left.append(TextFormatter.padRight(parsed, pad, unit));
            }
        }

        // Visibility conditions part - append to title like slots
        StringBuilder visibilityPart = new StringBuilder();
        Set<String> activeConditions = visibilityManager.getActiveConditions(player);
        for (String cond : activeConditions) {
            visibilityPart.append("@").append(cond);
        }

        return PrefixBuilder.PREFIX + rightPadded + left + visibilityPart;
    }

    @Override
    public void removePlayer(Player player) {
        BossBar bar = bars.remove(player.getUniqueId());
        if (bar != null) {
            bar.removeAll();
            untrackBarUuid(bar);
        }
    }

    @Override
    public void removeAll() {
        bars.values().forEach(bar -> {
            untrackBarUuid(bar);
            bar.removeAll();
        });
        bars.clear();
        
        // Reload visibility manager
        visibilityManager.reload();
    }

    @Override
    public void toggleVisibility(Player player) {
        BossBar bar = bars.get(player.getUniqueId());
        if (bar != null) bar.setVisible(!bar.isVisible());
    }

    @Override
    public boolean hasBarsFor(Player player) {
        return bars.containsKey(player.getUniqueId());
    }

    private int slotIndex(String key) {
        if (key != null && key.startsWith("slot_")) {
            try {
                return Integer.parseInt(key.substring(5));
            } catch (NumberFormatException ignored) {}
        }
        return Integer.MAX_VALUE;
    }
}
