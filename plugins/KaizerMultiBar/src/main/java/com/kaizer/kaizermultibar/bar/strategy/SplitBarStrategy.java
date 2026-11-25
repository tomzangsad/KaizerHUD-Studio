package com.kaizer.kaizermultibar.bar.strategy;

import com.google.common.collect.HashBasedTable;
import com.google.common.collect.Table;
import com.kaizer.kaizermultibar.KaizerMultiBarCore;
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
import java.util.UUID;

/**
 * Strategy for split mode — one BossBar per configured bar key per player.
 * Uses Guava {@link Table} (barKey × playerUUID → BossBar) instead of nested Maps.
 */
public class SplitBarStrategy extends AbstractBarStrategy {

    private final KaizerMultiBarCore plugin;
    private final Table<String, UUID, BossBar> bars = HashBasedTable.create();

    public SplitBarStrategy(KaizerMultiBarCore plugin) {
        this.plugin = plugin;
    }

    @Override
    public void initPlayer(Player player) {
        removePlayer(player); // clean up any stale bars + UUIDs before re-initialising

        ConfigurationSection barsSection = plugin.getConfig().getConfigurationSection("bossbar.bars");
        if (barsSection == null) return;

        for (String key : barsSection.getKeys(false)) {
            BossBar bar = Bukkit.createBossBar("", BarColor.WHITE, BarStyle.SOLID);
            trackBarUuid(bar);      // register UUID before sending ADD packet to client
            trySetPriority(bar);
            bars.put(key, player.getUniqueId(), bar);  // must be BEFORE addPlayer so hasBarsFor() = true during packet listener
            bar.addPlayer(player);  // sends ADD packet — UUID is already in managedBarUuids
        }
    }

    @Override
    public void updatePlayer(Player player) {
        ConfigurationSection barsSection = plugin.getConfig().getConfigurationSection("bossbar.bars");
        if (barsSection == null) return;

        for (String key : barsSection.getKeys(false)) {
            BossBar bar = bars.get(key, player.getUniqueId());
            if (bar == null) continue;

            String raw = barsSection.getString(key + ".text", "");
            String parsed = TextFormatter.format(KaizerMultiBarCore.isPapiPresent() ? PapiHelper.setPlaceholders(player, raw) : raw);

            bar.setTitle(PrefixBuilder.PREFIX + parsed);
            bar.setProgress(0.0);
        }
    }

    @Override
    public void removePlayer(Player player) {
        // Copy to avoid ConcurrentModificationException when clearing the column view
        new ArrayList<>(bars.column(player.getUniqueId()).values()).forEach(bar -> {
            bar.removeAll();
            untrackBarUuid(bar);
        });
        bars.column(player.getUniqueId()).clear();
    }

    @Override
    public void removeAll() {
        bars.values().forEach(bar -> {
            untrackBarUuid(bar); // untrack before removeAll so MONITOR sees correct state
            bar.removeAll();
        });
        bars.clear();
    }

    @Override
    public void toggleVisibility(Player player) {
        bars.column(player.getUniqueId()).values()
                .forEach(bar -> bar.setVisible(!bar.isVisible()));
    }

    @Override
    public boolean hasBarsFor(Player player) {
        return bars.containsColumn(player.getUniqueId());
    }
}
