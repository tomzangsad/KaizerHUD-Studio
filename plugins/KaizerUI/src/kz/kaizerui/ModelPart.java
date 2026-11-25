package kz.kaizerui;

import io.papermc.paper.datacomponent.item.ResolvableProfile;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Mannequin;
import org.bukkit.entity.Player;
import org.bukkit.entity.Pose;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

/**
 * Player Model on Java as a real 3D player: a Mannequin (Minecraft 1.21.9+) standing in the
 * menu scene, seen only by the menu's player, wearing what that player wears.
 * All Mannequin code is in this class so the plugin still loads on older servers
 * ({@link #available()} is false there and the model is drawn flat instead).
 */
final class ModelPart {
    /** Model size in blocks at scale 1: 16 × 32 skin px × 0.9375 / 16 */
    static final double MODEL_W = 0.9375, MODEL_H = 1.875;

    private static Boolean available;

    static boolean available() {
        if (available == null) {
            try {
                Class.forName("org.bukkit.entity.Mannequin");
                Class.forName("io.papermc.paper.datacomponent.item.ResolvableProfile");
                available = true;
            } catch (Throwable t) {
                available = false;
            }
        }
        return available;
    }

    final Mannequin entity;
    final float baseYaw;
    private final String skinOf;
    private final boolean viewerSkin, outfit;

    /**
     * @param feet  where the feet go (bottom centre of the element, pulled towards the camera)
     * @param scale model scale (1 = normal player)
     * @param yaw   yaw that faces the camera
     */
    ModelPart(Plugin plugin, Player viewer, World world, Location feet, double scale, float yaw,
              String skinOf, boolean viewerSkin, boolean outfit, boolean crouch) {
        this.baseYaw = yaw;
        this.skinOf = skinOf;
        this.viewerSkin = viewerSkin;
        this.outfit = outfit;
        Location at = feet.clone();
        at.setYaw(yaw);
        at.setPitch(0);
        Player wearer = viewerSkin ? viewer : org.bukkit.Bukkit.getPlayerExact(skinOf);
        this.entity = world.spawn(at, Mannequin.class, m -> {
            m.setVisibleByDefault(false);
            m.setPersistent(false);
            m.setInvulnerable(true);
            m.setSilent(true);
            m.setGravity(false);
            m.setCollidable(false);
            m.setImmovable(true);
            m.setDescription(null);           // no "NPC" line under it
            m.setCustomNameVisible(false);
            m.setProfile(wearer != null
                    ? ResolvableProfile.resolvableProfile(wearer.getPlayerProfile())
                    : ResolvableProfile.resolvableProfile().name(skinOf).build());   // the client fetches the skin
            AttributeInstance sc = m.getAttribute(Attribute.SCALE);
            if (sc != null) sc.setBaseValue(Math.max(0.0625, Math.min(16, scale)));
            if (crouch) m.setPose(Pose.SNEAKING, true);
            m.setBodyYaw(yaw);
            if (outfit && wearer != null) copyOutfit(wearer, m);
        });
        viewer.showEntity(plugin, entity);
    }

    private static void copyOutfit(Player from, Mannequin to) {
        EntityEquipment a = from.getEquipment(), b = to.getEquipment();
        if (a == null || b == null) return;
        b.setHelmet(copy(a.getHelmet()));
        b.setChestplate(copy(a.getChestplate()));
        b.setLeggings(copy(a.getLeggings()));
        b.setBoots(copy(a.getBoots()));
        b.setItemInMainHand(copy(a.getItemInMainHand()));
        b.setItemInOffHand(copy(a.getItemInOffHand()));
    }

    private static ItemStack copy(ItemStack s) { return s == null ? null : s.clone(); }

    /** Puts on again what the player wears now (after a wardrobe button, etc.) */
    void refreshOutfit(Player viewer) {
        if (!outfit || !entity.isValid()) return;
        Player wearer = viewerSkin ? viewer : org.bukkit.Bukkit.getPlayerExact(skinOf);
        if (wearer != null) copyOutfit(wearer, entity);
    }

    /** Turns the body (yaw) and the head (yaw / pitch) */
    void look(float bodyYaw, float headYaw, float pitch) {
        if (!entity.isValid()) return;
        entity.setRotation(headYaw, pitch);
        entity.setBodyYaw(bodyYaw);
    }

    Entity handle() { return entity; }
}
