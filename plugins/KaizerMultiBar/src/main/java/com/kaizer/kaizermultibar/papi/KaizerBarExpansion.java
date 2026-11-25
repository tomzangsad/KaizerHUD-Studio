package com.kaizer.kaizermultibar.papi;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import me.clip.placeholderapi.PlaceholderAPI;
import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.NamespacedKey;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;


/**
 * PlaceholderAPI expansion migrated from KaizerBar.
 * Keeps identifier "kaizerbar" to preserve placeholders such as %kaizerbar_hp%.
 */
public class KaizerBarExpansion extends PlaceholderExpansion {

    private static final int DEFAULT_MAX_VALUE = 20;
    private static final String IDENTIFIER = "kaizerbar";
    private static final String AUTHOR = "KaizerMC";
    private static final String VERSION = "1.0";
    private static final BarCalculator barCalc = new BarCalculator();
    private final Map<String, Function<Player, String>> placeholderHandlers = new HashMap<>();

    private static final ThreadLocal<Set<String>> resolving = ThreadLocal.withInitial(HashSet::new);

    public KaizerBarExpansion() {
        addPlaceholder("maxhp", p -> {
            AttributeInstance maxHp = p.getAttribute(Attribute.MAX_HEALTH);
            return String.valueOf(maxHp != null ? maxHp.getValue() : DEFAULT_MAX_VALUE);
        });
        addPlaceholder("currenthp", p -> String.valueOf(p.getHealth()));
        addPlaceholder("maxfood", p -> String.valueOf(DEFAULT_MAX_VALUE));
        addPlaceholder("currentfood", p -> String.valueOf(p.getFoodLevel()));
        addPlaceholder("maxoxy", p -> String.valueOf(p.getMaximumAir()));
        addPlaceholder("currentoxy", p -> String.valueOf(p.getRemainingAir()));
        addPlaceholder("maxarmor", p -> String.valueOf(DEFAULT_MAX_VALUE));
        addPlaceholder("currentarmor", p -> {
            AttributeInstance armor = p.getAttribute(Attribute.ARMOR);
            return String.valueOf(armor == null ? 0 : armor.getValue());
        });

        addPlaceholder("hpprefix", this::getHealthPrefix);
        addPlaceholder("hp", barCalc::getBarHealth);
        addPlaceholder("foodprefix", this::getFoodPrefix);
        addPlaceholder("food", barCalc::getBarFood);
        addPlaceholder("oxy", barCalc::getBarOxy);
        addPlaceholder("armor", barCalc::getBarArmor);
    }

    private void addPlaceholder(String name, Function<Player, String> handler) {
        placeholderHandlers.put(name, handler);
    }

    /**
     * Guards against circular placeholder resolution using the per-thread {@code resolving} set.
     * Returns "0" immediately if {@code params} is already being resolved (recursive call).
     * Replaces the repeated inProgress.add / try / finally / remove pattern.
     */
    private String resolveGuarded(String params, Supplier<String> supplier) {
        Set<String> inProgress = resolving.get();
        if (!inProgress.add(params)) return "0"; // already resolving → circular reference
        try {
            return supplier.get();
        } finally {
            inProgress.remove(params);
        }
    }

    private String getHealthPrefix(Player player) {
        if (isSpecialPrefixEnabled("status-prefix.health.special.FREEZING") && isFreezing(player)) {
            return getConfiguredPrefix("status-prefix.health.special.FREEZING", "fz");
        }
        return getEffectBasedPrefix(player, "status-prefix.health", "h");
    }

    private String getFoodPrefix(Player player) {
        return getEffectBasedPrefix(player, "status-prefix.food", "f");
    }

    private String getEffectBasedPrefix(Player player, String configPath, String fallbackPrefix) {
        ConfigurationSection section = KaizerMultiBarCore.getInstance().getConfig().getConfigurationSection(configPath);
        if (section == null) {
            return fallbackPrefix;
        }

        String defaultPrefix = section.getString("default", fallbackPrefix);
        if (!isEffectsPrefixEnabled(configPath)) {
            return defaultPrefix;
        }

        ConfigurationSection effectsSection = section.getConfigurationSection("effects");
        if (effectsSection == null) {
            return defaultPrefix;
        }

        for (String effectName : effectsSection.getKeys(false)) {
            if (!isEffectEntryEnabled(effectsSection, effectName)) {
                continue;
            }
            if (hasEffect(player, effectName)) {
                return getConfiguredPrefix(configPath + ".effects." + effectName, defaultPrefix);
            }
        }

        return defaultPrefix;
    }

    private boolean isSpecialPrefixEnabled(String configPath) {
        return KaizerMultiBarCore.getInstance().getConfig().getBoolean(configPath + ".enabled", false);
    }

    private boolean isEffectsPrefixEnabled(String configPath) {
        return KaizerMultiBarCore.getInstance().getConfig().getBoolean(configPath + ".effects.enabled", true);
    }

    private boolean isEffectEntryEnabled(ConfigurationSection parentSection, String effectName) {
        ConfigurationSection effectSection = parentSection.getConfigurationSection(effectName);
        if (effectSection == null) {
            return false;
        }
        return effectSection.getBoolean("enabled", false);
    }

    private String getConfiguredPrefix(String configPath, String fallbackPrefix) {
        return KaizerMultiBarCore.getInstance().getConfig().getString(configPath + ".prefix", fallbackPrefix);
    }

    private boolean isFreezing(Player player) {
        return player.getFreezeTicks() > 0;
    }

    private boolean hasEffect(Player player, String effectName) {
        String normalizedEffect = effectName.toUpperCase(Locale.ROOT);
        return player.getActivePotionEffects().stream().anyMatch(effect -> {
            NamespacedKey key = effect.getType().getKey();
            if (key == null) {
                return false;
            }

            String keyName = key.getKey().toUpperCase(Locale.ROOT);
            String fullKeyName = key.toString().toUpperCase(Locale.ROOT);
            return keyName.equals(normalizedEffect) || fullKeyName.equals(normalizedEffect);
        });
    }

    @Override
    public @NotNull String getIdentifier() {
        return IDENTIFIER;
    }

    @Override
    public @NotNull String getAuthor() {
        return AUTHOR;
    }

    @Override
    public @NotNull String getVersion() {
        return VERSION;
    }

    @Override
    public boolean canRegister() {
        return true;
    }

    @Override
    public boolean persist() {
        return true;
    }

    @Override
    public @Nullable String onPlaceholderRequest(Player player, @NotNull String params) {
        if (player == null) return "";

        Function<Player, String> handler = placeholderHandlers.get(params);
        if (handler != null) {
            return resolveGuarded(params, () -> handler.apply(player));
        }

        ConfigurationSection customSection = KaizerMultiBarCore.getInstance().getConfig()
                .getConfigurationSection("custom_status");
        if (customSection != null) {
            if (params.startsWith("max")) {
                String key = params.substring(3);
                if (customSection.contains(key)) {
                    return resolveGuarded(params, () -> {
                        String maxVal = customSection.getString(key + ".max", "100");
                        return maxVal.contains("%") ? PlaceholderAPI.setPlaceholders(player, maxVal) : maxVal;
                    });
                }
            }

            if (params.startsWith("current")) {
                String key = params.substring(7);
                if (customSection.contains(key)) {
                    return resolveGuarded(params, () -> {
                        String papiPath = customSection.getString(key + ".papi", "0");
                        return papiPath.contains("%") ? PlaceholderAPI.setPlaceholders(player, papiPath) : papiPath;
                    });
                }
            }

            if (customSection.contains(params)) {
                return resolveGuarded(params, () -> barCalc.calculateBarValue(
                        player,
                        "custom_status." + params + ".max",
                        "custom_status." + params + ".current"));
            }
        }

        return null;
    }
}
