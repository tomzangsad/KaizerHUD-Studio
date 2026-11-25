package com.kaizer.kaizermultibar.service;

import com.google.common.base.Supplier;
import com.google.common.base.Suppliers;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Service that encapsulates FloodGate-based Bedrock detection and
 * per-player BossBar visibility rules.
 *
 * Extracted from KaizerMultiBar (Facade) to keep business logic
 * out of the plugin entry point.
 */
public class PlayerVisibilityService {

    /** Lazily resolved FloodGate API instance — null when FloodGate is not installed. */
    @SuppressWarnings("UnstableApiUsage")
    private final Supplier<Object> floodgateApiCache;

    public PlayerVisibilityService() {
        if (Bukkit.getPluginManager().getPlugin("floodgate") != null) {
            floodgateApiCache = Suppliers.memoize(() -> {
                try {
                    Class<?> c = Class.forName("org.geysermc.floodgate.api.FloodgateApi");
                    return c.getMethod("getInstance").invoke(null);
                } catch (Throwable ignored) {
                    return null;
                }
            });
        } else {
            floodgateApiCache = null;
        }
        if (Bukkit.getPluginManager().getPlugin("Geyser-Spigot") != null) {
            geyserApiCache = Suppliers.memoize(() -> {
                try {
                    Class<?> c = Class.forName("org.geysermc.geyser.api.GeyserApi");
                    return c.getMethod("api").invoke(null);
                } catch (Throwable ignored) {
                    return null;
                }
            });
        } else {
            geyserApiCache = null;
        }
    }

    /** Lazily resolved Geyser API instance — null when Geyser is not on this server. */
    @SuppressWarnings("UnstableApiUsage")
    private final Supplier<Object> geyserApiCache;

    /**
     * Returns true if the player should see the BossBar.
     * Only Bedrock players (via Geyser/Floodgate) should see the custom HUD bars.
     * Java players must NOT receive these packets to avoid "Network Protocol Error".
     */
    public boolean canSeeBossBar(Player player) {
        if (player == null) return false;
        return player.hasPermission("kaizermultibar.show") || isBedrockPlayer(player);
    }

    /** Bedrock = Floodgate player, or (servers running Geyser without Floodgate) a Geyser session. */
    @SuppressWarnings("UnstableApiUsage")
    public boolean isBedrockPlayer(Player player) {
        if (player == null) return false;
        UUID id = player.getUniqueId();
        if (floodgateApiCache != null && call(floodgateApiCache.get(), "isFloodgatePlayer", id)) return true;
        return geyserApiCache != null && call(geyserApiCache.get(), "isBedrockPlayer", id);
    }

    private static boolean call(Object api, String method, UUID id) {
        if (api == null) return false;
        try {
            Method m = api.getClass().getMethod(method, UUID.class);
            Object result = m.invoke(api, id);
            return result instanceof Boolean && (Boolean) result;
        } catch (Throwable ignored) {
            return false;
        }
    }
}
