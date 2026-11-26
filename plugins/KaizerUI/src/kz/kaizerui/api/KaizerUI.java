package kz.kaizerui.api;

import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.Map;
import java.util.Set;

/**
 * Public Developer API for KaizerUI.
 * Obtain an instance via {@link #get()} or Bukkit's {@code ServicesManager}.
 */
public interface KaizerUI {

    /** Returns the active KaizerUI API instance. Throws if KaizerUI is not enabled. */
    static KaizerUI get() {
        KaizerUI api = Holder.instance;
        if (api == null) throw new IllegalStateException("KaizerUI is not enabled");
        return api;
    }

    static boolean isAvailable() {
        return Holder.instance != null;
    }

    /** Internal holder set by KaizerUIPlugin on enable/disable. */
    final class Holder {
        private static volatile KaizerUI instance;
        private Holder() {}
        public static void set(KaizerUI api) { instance = api; }
    }

    boolean open(Player player, String menuId);

    boolean open(Player player, String menuId, Map<String, String> placeholders);

    void close(Player player);

    boolean isOpen(Player player);

    /** Returns the active menu ID for this player, or null if none is open. */
    String currentMenuId(Player player);

    Set<String> menuIds();

    boolean hasMenu(String menuId);

    /** Immediately refreshes texts, placeholders, items, and outfits in an open Java menu. */
    void refresh(Player player);

    /** Sets a per-player placeholder (supports %key% and {key} in texts, labels, actions, tooltips). */
    void setPlaceholder(Player player, String key, String value);

    void clearPlaceholders(Player player);

    /** Overrides the text/label of a text or button element for this player. */
    void setDynamicText(Player player, String elementId, String text);

    /** Overrides the displayed ItemStack of an item element for this player (Java). */
    void setDynamicItem(Player player, String elementId, ItemStack item);

    void clearDynamicOverrides(Player player);

    int reload();
}
