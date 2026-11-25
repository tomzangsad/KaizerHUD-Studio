package kz.kaizerui;

import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.lang.reflect.Method;
import java.util.Locale;

/**
 * Item elements: an item id from GUI Studio → an ItemStack.
 * <ul>
 *   <li>{@code minecraft:diamond_sword} / {@code diamond_sword} — vanilla</li>
 *   <li>{@code itemsadder:namespace:id} (or {@code ia:}), {@code nexo:id}, {@code oraxen:id} — plugin items (found by reflection, no hard dependency)</li>
 *   <li>{@code slot:head|chest|legs|feet|hand|offhand} — what the player wears / holds</li>
 * </ul>
 * Placeholders in the id are filled in first.
 */
final class Items {
    private Items() {}

    /** The item, or null when there is none (unknown id, empty slot) */
    static ItemStack resolve(Player p, String rawId, boolean glint) {
        String id = Texts.papi(p, rawId == null ? "" : rawId).trim();
        if (id.isEmpty()) return null;
        String low = id.toLowerCase(Locale.ROOT);
        ItemStack out = null;
        try {
            if (low.startsWith("slot:")) out = slot(p, low.substring(5));
            else if (low.startsWith("itemsadder:") || low.startsWith("ia:")) out = itemsAdder(id.substring(id.indexOf(':') + 1));
            else if (low.startsWith("nexo:")) out = nexo(id.substring(5));
            else if (low.startsWith("oraxen:")) out = oraxen(id.substring(7));
            else {
                Material m = Material.matchMaterial(id);
                if (m != null && m.isItem() && !m.isAir()) out = new ItemStack(m);
            }
        } catch (Throwable t) {
            out = null;
        }
        if (out == null || out.getType().isAir()) return null;
        out = out.clone();
        out.setAmount(1);
        if (glint) {
            ItemMeta meta = out.getItemMeta();
            if (meta != null) { meta.setEnchantmentGlintOverride(true); out.setItemMeta(meta); }
        }
        return out;
    }

    static boolean dynamic(String rawId) {
        String s = rawId == null ? "" : rawId.trim().toLowerCase(Locale.ROOT);
        return s.startsWith("slot:") || s.indexOf('%') >= 0;
    }

    private static ItemStack slot(Player p, String which) {
        EntityEquipment eq = p.getEquipment();
        if (eq == null) return null;
        return switch (which) {
            case "head", "helmet" -> eq.getHelmet();
            case "chest", "chestplate" -> eq.getChestplate();
            case "legs", "leggings" -> eq.getLeggings();
            case "feet", "boots" -> eq.getBoots();
            case "hand", "mainhand", "main_hand" -> eq.getItemInMainHand();
            case "offhand", "off_hand" -> eq.getItemInOffHand();
            default -> null;
        };
    }

    /** dev.lone.itemsadder.api.CustomStack.getInstance(id).getItemStack() */
    private static ItemStack itemsAdder(String id) throws Exception {
        Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomStack");
        Object cs = c.getMethod("getInstance", String.class).invoke(null, id);
        return cs == null ? null : (ItemStack) c.getMethod("getItemStack").invoke(cs);
    }

    /** com.nexomc.nexo.api.NexoItems.itemFromId(id).build() */
    private static ItemStack nexo(String id) throws Exception {
        Class<?> c = Class.forName("com.nexomc.nexo.api.NexoItems");
        Object b = c.getMethod("itemFromId", String.class).invoke(null, id);
        return b == null ? null : build(b);
    }

    /** io.th0rgal.oraxen.api.OraxenItems.getItemById(id).build() */
    private static ItemStack oraxen(String id) throws Exception {
        Class<?> c = Class.forName("io.th0rgal.oraxen.api.OraxenItems");
        Object b = c.getMethod("getItemById", String.class).invoke(null, id);
        return b == null ? null : build(b);
    }

    private static ItemStack build(Object builder) throws Exception {
        Method m = builder.getClass().getMethod("build");
        Object o = m.invoke(builder);
        return o instanceof ItemStack s ? s : null;
    }
}
