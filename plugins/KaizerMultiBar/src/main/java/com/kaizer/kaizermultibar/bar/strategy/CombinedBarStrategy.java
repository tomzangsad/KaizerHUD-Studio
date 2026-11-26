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
 * Strategy for combined mode — one primary BossBar plus optional overflow bank BossBars
 * (`bossbar.banks`) when a HUD exceeds the 255-byte single-title budget.
 */
public class CombinedBarStrategy extends AbstractBarStrategy {

    /** Bars-section length used by packs exported before `bossbar.bars-length` existed. */
    private static final int DEFAULT_BARS_LENGTH = 100;

    private final KaizerMultiBarCore plugin;
    private final Map<UUID, List<BossBar>> bars = new HashMap<>();
    private final VisibilityConditionManager visibilityManager;

    public CombinedBarStrategy(KaizerMultiBarCore plugin) {
        this.plugin = plugin;
        this.visibilityManager = new VisibilityConditionManager(plugin);
    }

    @Override
    public void initPlayer(Player player) {
        List<BossBar> existing = bars.get(player.getUniqueId());
        if (existing != null) {
            for (BossBar old : existing) {
                untrackBarUuid(old); // must untrack before removeAll so UUID leaves managedBarUuids
                old.removeAll();
            }
        }

        int count = 1 + getExtraBankKeys().size();
        List<BossBar> created = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            BossBar bar = Bukkit.createBossBar("", BarColor.WHITE, BarStyle.SOLID);
            trackBarUuid(bar);      // register UUID before sending ADD packet to client
            trySetPriority(bar);
            created.add(bar);
        }
        bars.put(player.getUniqueId(), created); // must be BEFORE addPlayer so hasBarsFor() = true during packet listener
        for (BossBar bar : created) {
            bar.addPlayer(player);
        }
    }

    @Override
    public void updatePlayer(Player player) {
        List<BossBar> playerBars = bars.get(player.getUniqueId());
        if (playerBars == null || playerBars.isEmpty()) return;

        List<String> titles = buildBankTitles(player);
        if (titles.isEmpty()) return;
        int n = Math.min(playerBars.size(), titles.size());
        for (int i = 0; i < n; i++) {
            BossBar bar = playerBars.get(i);
            String title = titles.get(i);
            if (title == null) continue;
            bar.setTitle(title);
            bar.setProgress(0.0);
        }
    }

    /**
     * Bank 0 HUD data string for {@code player}: prefix + bars section + Bank 0 slots + visibility
     * markers. Returns null when {@code bossbar.bars} is missing.
     */
    public String buildTitle(Player player) {
        ConfigurationSection barsSection = plugin.getConfig().getConfigurationSection("bossbar.bars");
        if (barsSection == null) return null;

        TextFormatter.LengthUnit unit = TextFormatter.LengthUnit.parse(plugin.getConfig().getString("bossbar.length-unit", "bytes"));
        int barsLength = plugin.getConfig().getInt("bossbar.bars-length", DEFAULT_BARS_LENGTH);

        StringBuilder right = new StringBuilder();
        for (String key : barsSection.getKeys(false)) {
            String raw = barsSection.getString(key + ".text", "");
            int pad = barsSection.getInt(key + ".pad-length", 5);
            String parsed = TextFormatter.format(KaizerMultiBarCore.isPapiPresent() ? PapiHelper.setPlaceholders(player, raw) : raw);
            right.append(TextFormatter.padRight(parsed, pad, unit));
        }
        String rightPadded = TextFormatter.padRight(right.toString(), barsLength, unit);

        StringBuilder left = new StringBuilder();
        ConfigurationSection slotsSection = plugin.getConfig().getConfigurationSection("bossbar.slots");
        if (slotsSection != null) {
            List<String> keys = new ArrayList<>(slotsSection.getKeys(false));
            keys.sort((a, b) -> Integer.compare(slotOrderKey(a), slotOrderKey(b)));
            for (String key : keys) {
                String raw = slotsSection.getString(key + ".text", "");
                int pad = slotsSection.getInt(key + ".pad-length", 30);
                String parsed = TextFormatter.format(KaizerMultiBarCore.isPapiPresent() ? PapiHelper.setPlaceholders(player, raw) : raw);
                left.append(TextFormatter.padRight(parsed, pad, unit));
            }
        }

        StringBuilder visibilityPart = new StringBuilder();
        Set<String> activeConditions = visibilityManager.getActiveConditions(player);
        for (String cond : activeConditions) {
            visibilityPart.append("@").append(cond);
        }

        return PrefixBuilder.PREFIX + rightPadded + left + visibilityPart;
    }

    /**
     * Returns all bank prefixes in order: index 0 is primary, indices 1..N come from {@code bossbar.banks}.
     */
    public List<String> getBankPrefixes() {
        List<String> out = new ArrayList<>();
        out.add(PrefixBuilder.PREFIX);
        ConfigurationSection banksSection = plugin.getConfig().getConfigurationSection("bossbar.banks");
        if (banksSection != null) {
            for (String bankKey : getExtraBankKeys()) {
                out.add(banksSection.getString(bankKey + ".prefix", "@kz" + out.size() + ":"));
            }
        }
        return out;
    }

    /**
     * Builds one payload string per bank for {@code player}. Index 0 equals {@link #buildTitle(Player)}.
     */
    public List<String> buildBankTitles(Player player) {
        String bank0 = buildTitle(player);
        if (bank0 == null) return List.of();
        List<String> result = new ArrayList<>();
        result.add(bank0);

        ConfigurationSection banksSection = plugin.getConfig().getConfigurationSection("bossbar.banks");
        if (banksSection == null) return result;

        TextFormatter.LengthUnit unit = TextFormatter.LengthUnit.parse(plugin.getConfig().getString("bossbar.length-unit", "bytes"));
        int bankIdx = 1;
        for (String bankKey : getExtraBankKeys()) {
            ConfigurationSection bankSec = banksSection.getConfigurationSection(bankKey);
            if (bankSec == null) continue;
            String prefix = bankSec.getString("prefix", "@kz" + bankIdx + ":");
            StringBuilder sb = new StringBuilder(prefix);
            ConfigurationSection slotsSec = bankSec.getConfigurationSection("slots");
            if (slotsSec != null) {
                for (String key : slotsSec.getKeys(false)) {
                    String raw = slotsSec.getString(key + ".text", "");
                    int pad = slotsSec.getInt(key + ".pad-length", 30);
                    String parsed = TextFormatter.format(KaizerMultiBarCore.isPapiPresent() ? PapiHelper.setPlaceholders(player, raw) : raw);
                    sb.append(TextFormatter.padRight(parsed, pad, unit));
                }
            }
            result.add(sb.toString());
            bankIdx++;
        }
        return result;
    }

    private List<String> getExtraBankKeys() {
        ConfigurationSection banksSection = plugin.getConfig().getConfigurationSection("bossbar.banks");
        if (banksSection == null) return List.of();
        List<String> keys = new ArrayList<>(banksSection.getKeys(false));
        keys.sort((a, b) -> Integer.compare(bankIndex(a), bankIndex(b)));
        return keys;
    }

    @Override
    public void removePlayer(Player player) {
        List<BossBar> playerBars = bars.remove(player.getUniqueId());
        if (playerBars != null) {
            for (BossBar bar : playerBars) {
                bar.removeAll();
                untrackBarUuid(bar);
            }
        }
    }

    @Override
    public void removeAll() {
        bars.values().forEach(list -> {
            for (BossBar bar : list) {
                untrackBarUuid(bar);
                bar.removeAll();
            }
        });
        bars.clear();
        visibilityManager.reload();
    }

    @Override
    public void toggleVisibility(Player player) {
        List<BossBar> playerBars = bars.get(player.getUniqueId());
        if (playerBars != null && !playerBars.isEmpty()) {
            boolean nextVisible = !playerBars.get(0).isVisible();
            for (BossBar bar : playerBars) {
                bar.setVisible(nextVisible);
            }
        }
    }

    @Override
    public boolean hasBarsFor(Player player) {
        List<BossBar> list = bars.get(player.getUniqueId());
        return list != null && !list.isEmpty();
    }

    private int slotOrderKey(String key) {
        if (key != null && key.startsWith("slot_")) {
            try {
                return Integer.parseInt(key.substring(5));
            } catch (NumberFormatException ignored) {}
        }
        if (key != null && key.startsWith("nameplate_slot_")) {
            try {
                return 1_000_000 + Integer.parseInt(key.substring("nameplate_slot_".length()));
            } catch (NumberFormatException ignored) {}
        }
        return Integer.MAX_VALUE;
    }

    private int bankIndex(String key) {
        if (key != null && key.startsWith("bank_")) {
            try {
                return Integer.parseInt(key.substring(5));
            } catch (NumberFormatException ignored) {}
        }
        return Integer.MAX_VALUE;
    }
}
