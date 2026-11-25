package com.kaizer.kaizermultibar.papi;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import com.kaizer.kaizermultibar.util.PapiHelper;
import me.clip.placeholderapi.PlaceholderAPI;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;

public class BarCalculator {

    private final Map<String, Long> lastLogTimes = new HashMap<>();
    private static final long LOG_COOLDOWN_MS = 2000;

    public String calculateBarValue(Player p, String maxPath, String currentPath) {
        boolean debug = KaizerMultiBarCore.getInstance().getConfig().getBoolean("debug", false);
        String logKey = p.getUniqueId() + "_" + currentPath;
        long now = System.currentTimeMillis();
        boolean shouldLog = debug && p != null;

        String maxConfig = KaizerMultiBarCore.getInstance().getConfig().getString(maxPath, "100");
        String curConfig = KaizerMultiBarCore.getInstance().getConfig().getString(currentPath, "0");

        if (shouldLog) {
            lastLogTimes.put(logKey, now); // Keep original logic for lastLogTimes
            KaizerMultiBarCore.getInstance().getLogger().info("[DEBUG] " + p.getName() + ": maxPath=" + maxPath + " -> raw=" + maxConfig);
            KaizerMultiBarCore.getInstance().getLogger().info("[DEBUG] " + p.getName() + ": curPath=" + currentPath + " -> raw=" + curConfig);
        }

        double max = 100.0;
        double current = 0.0;

        try {
            max = Double.parseDouble(PapiHelper.setPlaceholders(p, maxConfig));
            if (shouldLog) KaizerMultiBarCore.getInstance().getLogger().info("[DEBUG] parsedMax=" + max);
        } catch (Exception e) {
            max = 100.0;
            if (shouldLog) KaizerMultiBarCore.getInstance().getLogger().warning("[DEBUG] Failed to parse max: " + e.getMessage());
        }

        try {
            current = Double.parseDouble(PapiHelper.setPlaceholders(p, curConfig));
            if (shouldLog) KaizerMultiBarCore.getInstance().getLogger().info("[DEBUG] parsedCur=" + current);
        } catch (Exception e) {
            current = 0.0;
            if (shouldLog) KaizerMultiBarCore.getInstance().getLogger().warning("[DEBUG] Failed to parse current: " + e.getMessage());
        }

        if (max <= 0) max = 1.0;

        int steps = KaizerMultiBarCore.getInstance().getConfig().getInt("bar-steps", 16);
        double result = (current / max) * steps;
        int clamped = (int) Math.max(0, Math.min(steps, Math.round(result)));

        if (shouldLog) {
            KaizerMultiBarCore.getInstance().getLogger().info("[DEBUG] max=" + max + " current=" + current + " steps=" + steps + " result=" + result + " clamped=" + clamped);
        }

        return String.valueOf(clamped);
    }

    public String getBarHealth(Player p) {
        return calculateBarValue(p, "stats.health.max", "stats.health.current");
    }

    public String getBarFood(Player p) {
        return calculateBarValue(p, "stats.food.max", "stats.food.current");
    }

    public String getBarArmor(Player p) {
        return calculateBarValue(p, "stats.armor.max", "stats.armor.current");
    }

    public String getBarOxy(Player p) {
        return calculateBarValue(p, "stats.oxygen.max", "stats.oxygen.current");
    }
}
