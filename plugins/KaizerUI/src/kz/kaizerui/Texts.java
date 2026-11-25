package kz.kaizerui;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

/** Placeholders and &amp; colour codes. */
public final class Texts {
    private Texts() {}

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.builder()
            .character('&').hexColors().useUnusualXRepeatedCharacterHexFormat().build();

    private static Boolean papi;

    static void reset() { papi = null; }

    private static boolean hasPapi() {
        if (papi == null) papi = Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI");
        return papi;
    }

    /** %placeholders% for this player (PlaceholderAPI if installed, %player_name% always) */
    public static String papi(Player p, String s) {
        if (s == null || s.isEmpty()) return "";
        String out = s.replace("%player_name%", p.getName()).replace("%player%", p.getName());
        if (hasPapi() && out.indexOf('%') >= 0) {
            try {
                out = PapiHook.apply(p, out);
            } catch (Throwable t) {
                papi = false;
            }
        }
        return out;
    }

    /** &amp;-coded text to a component, with a default colour */
    public static Component component(String s, String hexColor) {
        Component c = LEGACY.deserialize(s == null ? "" : s.replace('§', '&'));
        TextColor col = hexColor == null ? null : TextColor.fromHexString(hexColor.startsWith("#") ? hexColor : "#" + hexColor);
        return col == null ? c : c.colorIfAbsent(col);
    }

    public static Component component(String s) { return component(s, null); }

    /** &amp; codes to § codes (Bedrock forms) */
    public static String section(String s) {
        return s == null ? "" : s.replaceAll("&([0-9a-fk-orA-FK-OR])", "§$1");
    }

    /** Kept in its own class so PlaceholderAPI classes load only when it is installed */
    private static final class PapiHook {
        static String apply(Player p, String s) {
            return me.clip.placeholderapi.PlaceholderAPI.setPlaceholders(p, s);
        }
    }
}
