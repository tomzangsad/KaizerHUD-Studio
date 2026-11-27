package kz.kaizerui;

import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.lang.reflect.Method;
import java.util.Locale;
import java.util.Map;

/**
 * Item elements: an item id from GUI Studio → an ItemStack.
 * <ul>
 *   <li>{@code minecraft:diamond_sword} / {@code diamond_sword} — vanilla</li>
 *   <li>{@code itemsadder:namespace:id} (or {@code ia:}), {@code nexo:id}, {@code oraxen:id}, {@code craftengine:namespace:id} (or {@code ce:}) — plugin items (found by reflection, no hard dependency)</li>
 *   <li>{@code slot:head|chest|legs|feet|hand|offhand} — what the player wears / holds</li>
 * </ul>
 * Placeholders in the id are filled in first.
 */
final class Items {
    private Items() {}

    /** The item, or null when there is none (unknown id, empty slot) */
    static ItemStack resolve(Player p, String rawId, boolean glint) {
        return resolve(null, p, rawId, glint);
    }

    /** Resolves session variables + PAPI placeholders in {@code rawId}, then returns the ItemStack. */
    static ItemStack resolve(KaizerUIPlugin plugin, Player p, String rawId, boolean glint) {
        String pre = rawId == null ? "" : rawId;
        String id = (plugin != null ? plugin.resolveText(p, pre) : Texts.papi(p, pre)).trim();
        if (id.isEmpty()) return null;
        String low = id.toLowerCase(Locale.ROOT);
        ItemStack out = null;
        try {
            if (low.startsWith("slot:")) out = slot(p, low.substring(5));
            else if (low.startsWith("itemsadder:") || low.startsWith("ia:")) out = itemsAdder(id.substring(id.indexOf(':') + 1));
            else if (low.startsWith("nexo:")) out = nexo(id.substring(5));
            else if (low.startsWith("oraxen:")) out = oraxen(id.substring(7));
            else if (low.startsWith("craftengine:") || low.startsWith("ce:")) out = craftEngine(id.substring(id.indexOf(':') + 1));
            else if (low.startsWith("custom:")) out = customData(id.substring(7));
            else if (low.startsWith("model:")) out = customItemModel(id.substring(6));
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
        return s.startsWith("slot:") || s.indexOf('%') >= 0 || s.indexOf('{') >= 0;
    }

    private static ItemStack customData(String spec) {
        int c = spec.indexOf(':');
        if (c <= 0) return null;
        Material m = Material.matchMaterial(spec.substring(0, c).trim());
        if (m == null || !m.isItem() || m.isAir()) return null;
        ItemStack stack = new ItemStack(m);
        try {
            int cmd = Integer.parseInt(spec.substring(c + 1).trim());
            ItemMeta meta = stack.getItemMeta();
            if (meta != null) { meta.setCustomModelData(cmd); stack.setItemMeta(meta); }
        } catch (NumberFormatException ignored) {}
        return stack;
    }

    private static ItemStack customItemModel(String spec) {
        int c = spec.indexOf(':');
        if (c <= 0) return null;
        Material m = Material.matchMaterial(spec.substring(0, c).trim());
        if (m == null || !m.isItem() || m.isAir()) return null;
        ItemStack stack = new ItemStack(m);
        String keyStr = spec.substring(c + 1).trim();
        NamespacedKey nk = NamespacedKey.fromString(keyStr);
        if (nk != null) {
            ItemMeta meta = stack.getItemMeta();
            if (meta != null) {
                try {
                    meta.getClass().getMethod("setItemModel", NamespacedKey.class).invoke(meta, nk);
                    stack.setItemMeta(meta);
                } catch (Throwable ignored) {}
            }
        }
        return stack;
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

    /** net.momirealms.craftengine.bukkit.api.CraftEngineItems.byId(Key) */
    private static ItemStack craftEngine(String id) throws Exception {
        Class<?> keyCls = Class.forName("net.momirealms.craftengine.core.util.Key");
        Class<?> ceItems = Class.forName("net.momirealms.craftengine.bukkit.api.CraftEngineItems");
        int col = id.indexOf(':');
        String ns = col > 0 ? id.substring(0, col).trim() : "craftengine";
        String val = col > 0 ? id.substring(col + 1).trim() : id.trim();
        Object key = null;
        try {
            key = keyCls.getMethod("of", String.class, String.class).invoke(null, ns, val);
        } catch (NoSuchMethodException ignored) {}
        if (key == null) {
            try { key = keyCls.getMethod("from", String.class).invoke(null, ns + ":" + val); } catch (NoSuchMethodException ignored) {}
        }
        if (key == null) {
            try { key = keyCls.getMethod("of", String.class).invoke(null, ns + ":" + val); } catch (NoSuchMethodException ignored) {}
        }
        if (key == null) return null;
        Object customItem = ceItems.getMethod("byId", keyCls).invoke(null, key);
        if (customItem == null) return null;
        for (String mName : new String[]{"buildItemStack", "buildBukkitItem"}) {
            try {
                Object res = customItem.getClass().getMethod(mName).invoke(customItem);
                if (res instanceof ItemStack st) return st;
            } catch (NoSuchMethodException ignored) {}
        }
        for (Method m : customItem.getClass().getMethods()) {
            if ("buildItemStack".equals(m.getName()) && m.getParameterCount() == 1) {
                Object res = m.invoke(customItem, new Object[]{null});
                if (res instanceof ItemStack st) return st;
            }
        }
        return null;
    }

    private static ItemStack build(Object builder) throws Exception {
        Method m = builder.getClass().getMethod("build");
        Object o = m.invoke(builder);
        return o instanceof ItemStack s ? s : null;
    }

    private static final Map<String, String> BEDROCK_ITEMS = Map.ofEntries(
            Map.entry("golden_helmet", "gold_helmet"), Map.entry("golden_chestplate", "gold_chestplate"),
            Map.entry("golden_leggings", "gold_leggings"), Map.entry("golden_boots", "gold_boots"),
            Map.entry("golden_sword", "gold_sword"), Map.entry("golden_pickaxe", "gold_pickaxe"),
            Map.entry("golden_axe", "gold_axe"), Map.entry("golden_shovel", "gold_shovel"), Map.entry("golden_hoe", "gold_hoe"),
            Map.entry("wooden_sword", "wood_sword"), Map.entry("wooden_pickaxe", "wood_pickaxe"),
            Map.entry("wooden_axe", "wood_axe"), Map.entry("wooden_shovel", "wood_shovel"), Map.entry("wooden_hoe", "wood_hoe"),
            Map.entry("bow", "bow_standby"), Map.entry("crossbow", "crossbow_standby"),
            Map.entry("fishing_rod", "fishing_rod_uncast"), Map.entry("totem_of_undying", "totem"),
            Map.entry("golden_apple", "apple_golden"), Map.entry("enchanted_golden_apple", "apple_golden"),
            Map.entry("golden_carrot", "carrot_golden"), Map.entry("glistering_melon_slice", "melon_speckled"),
            Map.entry("enchanted_book", "book_enchanted"), Map.entry("written_book", "book_written"), Map.entry("writable_book", "book_writable"),
            Map.entry("firework_rocket", "fireworks"), Map.entry("compass", "compass_item"), Map.entry("clock", "clock_item"),
            Map.entry("potion", "potion_bottle_drinkable"), Map.entry("splash_potion", "potion_bottle_splash"),
            Map.entry("lingering_potion", "potion_bottle_lingering"), Map.entry("glass_bottle", "potion_bottle_empty"),
            Map.entry("bucket", "bucket_empty"), Map.entry("water_bucket", "bucket_water"),
            Map.entry("lava_bucket", "bucket_lava"), Map.entry("milk_bucket", "bucket_milk"),
            Map.entry("powder_snow_bucket", "bucket_powder_snow"),
            Map.entry("beef", "beef_raw"), Map.entry("cooked_beef", "beef_cooked"),
            Map.entry("porkchop", "porkchop_raw"), Map.entry("cooked_porkchop", "porkchop_cooked"),
            Map.entry("chicken", "chicken_raw"), Map.entry("cooked_chicken", "chicken_cooked"),
            Map.entry("mutton", "mutton_raw"), Map.entry("cooked_mutton", "mutton_cooked"),
            Map.entry("rabbit", "rabbit_raw"), Map.entry("cooked_rabbit", "rabbit_cooked"),
            Map.entry("cod", "fish_raw"), Map.entry("cooked_cod", "fish_cooked"),
            Map.entry("salmon", "fish_salmon_raw"), Map.entry("cooked_salmon", "fish_salmon_cooked"),
            Map.entry("tropical_fish", "fish_clownfish_raw"), Map.entry("pufferfish", "fish_pufferfish_raw"),
            Map.entry("baked_potato", "potato_baked"), Map.entry("poisonous_potato", "potato_poisonous"),
            Map.entry("melon_slice", "melon"), Map.entry("wheat_seeds", "seeds_wheat"),
            Map.entry("pumpkin_seeds", "seeds_pumpkin"), Map.entry("melon_seeds", "seeds_melon"),
            Map.entry("redstone", "redstone_dust"), Map.entry("slime_ball", "slimeball"), Map.entry("sugar_cane", "reeds"),
            Map.entry("lapis_lazuli", "dye_powder_blue_new"), Map.entry("bone_meal", "dye_powder_white_new"),
            Map.entry("ink_sac", "dye_powder_black"), Map.entry("cocoa_beans", "dye_powder_brown_new"),
            Map.entry("fire_charge", "fireball"), Map.entry("oak_door", "door_wood"), Map.entry("iron_door", "door_iron"),
            Map.entry("armor_stand", "wooden_armorstand"), Map.entry("heart_of_the_sea", "heartofthesea_closed"),
            Map.entry("minecart", "minecart_normal"), Map.entry("chest_minecart", "minecart_chest"),
            Map.entry("oak_boat", "boat_oak"), Map.entry("map", "map_empty"), Map.entry("filled_map", "map_filled"),
            Map.entry("music_disc_cat", "record_cat")
    );

    private static final Map<String, String> BEDROCK_BLOCKS = Map.ofEntries(
            Map.entry("grass_block", "grass_side_carried"),
            Map.entry("oak_log", "log_oak"), Map.entry("spruce_log", "log_spruce"),
            Map.entry("birch_log", "log_birch"), Map.entry("jungle_log", "log_jungle"),
            Map.entry("acacia_log", "log_acacia"), Map.entry("dark_oak_log", "log_big_oak"),
            Map.entry("oak_planks", "planks_oak"), Map.entry("spruce_planks", "planks_spruce"),
            Map.entry("birch_planks", "planks_birch"), Map.entry("stone_bricks", "stonebrick"),
            Map.entry("torch", "torch_on"), Map.entry("chest", "chest_front"),
            Map.entry("crafting_table", "crafting_table_front"), Map.entry("furnace", "furnace_front_off")
    );

    /**
     * Resolves an item (including {@code slot:head..feet}, {@code slot:hand}, {@code {item_id}},
     * custom plugin armor/items) into its Bedrock resource-pack texture path (no .png extension).
     */
    static String bedrockTextureOf(KaizerUIPlugin plugin, Player p, String rawId) {
        String pre = rawId == null ? "" : rawId;
        String resolvedId = (plugin != null ? plugin.resolveText(p, pre) : Texts.papi(p, pre)).trim();
        ItemStack stack = resolve(plugin, p, rawId, false);
        if (stack != null && !stack.getType().isAir()) {
            String customSlug = detectCustomSlugFromStack(stack);
            if (customSlug != null) return "textures/kaizerui/custom/" + customSlug;
            Material mat = stack.getType();
            String key = mat.getKey().getKey().toLowerCase(Locale.ROOT);
            if (BEDROCK_ITEMS.containsKey(key)) return "textures/items/" + BEDROCK_ITEMS.get(key);
            if (BEDROCK_BLOCKS.containsKey(key)) return "textures/blocks/" + BEDROCK_BLOCKS.get(key);
            if (mat.isBlock()) return "textures/blocks/" + key;
            return "textures/items/" + key;
        }
        String low = resolvedId.toLowerCase(Locale.ROOT);
        if (low.startsWith("itemsadder:") || low.startsWith("ia:") || low.startsWith("nexo:") || low.startsWith("oraxen:")
                || low.startsWith("craftengine:") || low.startsWith("ce:")) {
            String canonical = low.startsWith("ia:") ? "itemsadder:" + low.substring(3)
                    : (low.startsWith("ce:") ? "craftengine:" + low.substring(3) : low);
            return "textures/kaizerui/custom/" + slugify(canonical);
        }
        return null;
    }

    private static String detectCustomSlugFromStack(ItemStack stack) {
        try {
            Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomStack");
            Object cs = c.getMethod("byItemStack", ItemStack.class).invoke(null, stack);
            if (cs != null) {
                Object id = c.getMethod("getNamespacedID").invoke(cs);
                if (id != null && !id.toString().isBlank()) return slugify("itemsadder:" + id.toString());
            }
        } catch (Throwable ignored) {}
        try {
            Class<?> c = Class.forName("com.nexomc.nexo.api.NexoItems");
            Object id = c.getMethod("idFromItem", ItemStack.class).invoke(null, stack);
            if (id != null && !id.toString().isBlank()) return slugify("nexo:" + id.toString());
        } catch (Throwable ignored) {}
        try {
            Class<?> c = Class.forName("io.th0rgal.oraxen.api.OraxenItems");
            Object id = c.getMethod("getIdByItem", ItemStack.class).invoke(null, stack);
            if (id != null && !id.toString().isBlank()) return slugify("oraxen:" + id.toString());
        } catch (Throwable ignored) {}
        try {
            Class<?> c = Class.forName("net.momirealms.craftengine.bukkit.api.CraftEngineItems");
            try {
                Object id = c.getMethod("getCustomItemId", ItemStack.class).invoke(null, stack);
                if (id != null && !id.toString().isBlank()) return slugify("craftengine:" + id.toString());
            } catch (NoSuchMethodException ignored) {}
            try {
                Object ci = c.getMethod("byItemStack", ItemStack.class).invoke(null, stack);
                if (ci != null) {
                    Object id = ci.getClass().getMethod("id").invoke(ci);
                    if (id != null && !id.toString().isBlank()) return slugify("craftengine:" + id.toString());
                }
            } catch (NoSuchMethodException ignored) {}
        } catch (Throwable ignored) {}
        return null;
    }

    private static String slugify(String raw) {
        String s = String.valueOf(raw).trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9_]+", "_")
                .replaceAll("^_+|_+$", "");
        return s.isEmpty() ? "item" : s;
    }

    static boolean matches(ItemStack candidate, ItemStack template) {
        if (candidate == null || template == null || candidate.getType().isAir()) return false;
        if (candidate.getType() != template.getType()) return false;
        if (template.hasItemMeta()) return candidate.isSimilar(template);
        if (!candidate.hasItemMeta()) return true;
        ItemMeta cm = candidate.getItemMeta();
        return !cm.hasDisplayName() && !cm.hasCustomModelData();
    }

    static int count(Player p, ItemStack template) {
        if (p == null || template == null) return 0;
        int total = 0;
        for (ItemStack s : p.getInventory().getStorageContents()) {
            if (matches(s, template)) total += s.getAmount();
        }
        return total;
    }

    static boolean remove(Player p, ItemStack template, int amount) {
        if (p == null || template == null || amount <= 0) return amount <= 0;
        if (count(p, template) < amount) return false;
        int rem = amount;
        ItemStack[] contents = p.getInventory().getStorageContents();
        for (int i = 0; i < contents.length && rem > 0; i++) {
            ItemStack s = contents[i];
            if (!matches(s, template)) continue;
            int take = Math.min(rem, s.getAmount());
            if (take >= s.getAmount()) contents[i] = null;
            else s.setAmount(s.getAmount() - take);
            rem -= take;
        }
        p.getInventory().setStorageContents(contents);
        p.updateInventory();
        return true;
    }

    static void give(Player p, ItemStack template, int amount) {
        if (p == null || template == null || amount <= 0) return;
        int maxStack = Math.max(1, template.getMaxStackSize());
        int rem = amount;
        while (rem > 0) {
            int giveAmt = Math.min(maxStack, rem);
            ItemStack chunk = template.clone();
            chunk.setAmount(giveAmt);
            Map<Integer, ItemStack> overflow = p.getInventory().addItem(chunk);
            if (!overflow.isEmpty()) {
                for (ItemStack drop : overflow.values()) {
                    p.getWorld().dropItemNaturally(p.getLocation(), drop);
                }
            }
            rem -= giveAmt;
        }
        p.updateInventory();
    }
}
