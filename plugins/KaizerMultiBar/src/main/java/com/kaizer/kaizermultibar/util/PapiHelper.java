package com.kaizer.kaizermultibar.util;

import me.clip.placeholderapi.PlaceholderAPI;
import org.bukkit.entity.Player;

/**
 * Wrapper for PlaceholderAPI calls.
 *
 * PlaceholderAPI is a softdepend — this class must only be called when PAPI is
 * confirmed to be installed (check {@code KaizerMultiBar.isPapiPresent()} first).
 * Placing the reference in its own class means the JVM does not attempt to load
 * the PlaceholderAPI class until this method is actually invoked.
 */
public final class PapiHelper {

    private PapiHelper() {}

    public static String setPlaceholders(Player player, String text) {
        return PlaceholderAPI.setPlaceholders(player, text);
    }
}
