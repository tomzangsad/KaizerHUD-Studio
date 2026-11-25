package com.kaizer.kaizermultibar.bar;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import me.clip.placeholderapi.PlaceholderAPI;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Manages visibility conditions for UI elements.
 * Checks PlaceholderAPI values against configured conditions and returns
 * which visibility prefixes should be active for a player.
 */
public class VisibilityConditionManager {

    private final KaizerMultiBarCore plugin;
    private final Map<String, VisibilityCondition> conditions = new HashMap<>();

    public VisibilityConditionManager(KaizerMultiBarCore plugin) {
        this.plugin = plugin;
        loadConditions();
    }

    /**
     * Load visibility conditions from config
     */
    public void loadConditions() {
        conditions.clear();
        ConfigurationSection section = plugin.getConfig().getConfigurationSection("visibility-conditions");
        if (section == null) return;

        for (String prefix : section.getKeys(false)) {
            String papi = section.getString(prefix + ".papi", "");
            String operator = section.getString(prefix + ".operator", "==");
            String value = section.getString(prefix + ".value", "");
            boolean invert = section.getBoolean(prefix + ".invert", false);

            if (!papi.isEmpty()) {
                conditions.put(prefix, new VisibilityCondition(papi, operator, value, invert));
            }
        }

        plugin.getLogger().info("Loaded " + conditions.size() + " visibility conditions");
    }

    /**
     * Get all active visibility prefixes for a player
     * @param player The player to check
     * @return Set of prefixes that should be visible (e.g. "vc_rust_health_bar")
     */
    public Set<String> getActiveConditions(Player player) {
        Set<String> active = new HashSet<>();
        
        if (!KaizerMultiBarCore.isPapiPresent()) {
            return active;
        }

        for (Map.Entry<String, VisibilityCondition> entry : conditions.entrySet()) {
            String prefix = entry.getKey();
            VisibilityCondition condition = entry.getValue();

            if (condition.evaluate(player)) {
                active.add(prefix);
            }
        }

        return active;
    }

    /**
     * Reload conditions from config
     */
    public void reload() {
        loadConditions();
    }

    /**
     * Inner class representing a single visibility condition
     */
    private static class VisibilityCondition {
        private final String papi;
        private final String operator;
        private final String value;
        private final boolean invert;

        public VisibilityCondition(String papi, String operator, String value, boolean invert) {
            this.papi = papi;
            this.operator = operator;
            this.value = value;
            this.invert = invert;
        }

        /**
         * Evaluate this condition for a player
         * @param player The player to check
         * @return true if condition is met (after applying invert)
         */
        public boolean evaluate(Player player) {
            String result = PlaceholderAPI.setPlaceholders(player, papi);
            boolean conditionMet = checkCondition(result, operator, value);
            return invert ? !conditionMet : conditionMet;
        }

        /**
         * Check if actual value meets the condition
         */
        private boolean checkCondition(String actual, String operator, String expected) {
            if ("in".equals(operator)) {
                String[] parts = expected.split(",");
                for (String part : parts) {
                    if (actual.equals(part.trim())) return true;
                }
                return false;
            }

            // Try numeric comparison first
            try {
                double actualNum = Double.parseDouble(actual);
                double expectedNum = Double.parseDouble(expected);

                switch (operator) {
                    case "==": return Math.abs(actualNum - expectedNum) < 0.0001;
                    case "!=": return Math.abs(actualNum - expectedNum) >= 0.0001;
                    case ">": return actualNum > expectedNum;
                    case "<": return actualNum < expectedNum;
                    case ">=": return actualNum >= expectedNum;
                    case "<=": return actualNum <= expectedNum;
                    default: return false;
                }
            } catch (NumberFormatException e) {
                // Fall back to string comparison
                switch (operator) {
                    case "==": return actual.equals(expected);
                    case "!=": return !actual.equals(expected);
                    case ">": return actual.compareTo(expected) > 0;
                    case "<": return actual.compareTo(expected) < 0;
                    case ">=": return actual.compareTo(expected) >= 0;
                    case "<=": return actual.compareTo(expected) <= 0;
                    default: return false;
                }
            }
        }
    }
}
