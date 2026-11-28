package kz.kaizerui;

import net.kyori.adventure.text.Component;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.entity.TextDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.joml.AxisAngle4f;
import org.joml.Vector3f;

/**
 * Unified handle for a visual entity in a Java menu: either a zero-server-entity virtual
 * PacketEvents display ({@link PacketDisplays}), a Bukkit {@link Display} fallback when
 * PacketEvents is unavailable, or a real {@link Entity} such as a 3D player Mannequin or
 * ModelEngine host stand.
 *
 * <p>No PacketEvents classes may be referenced here so the plugin still loads without it.</p>
 */
interface DisplayHandle {

    Transformation IDENTITY_TF = new Transformation(
            new Vector3f(), new AxisAngle4f(), new Vector3f(1f, 1f, 1f), new AxisAngle4f());

    int entityId();

    boolean isValid();

    boolean isPacket();

    boolean isSpawned();

    void show();

    void hide();

    void destroy();

    void markDestroyedQuietly();

    void teleport(double x, double y, double z, float yaw, float pitch);

    void setTeleportDuration(int ticks);

    void setText(Component text);

    void setTextOpacity(byte opacity);

    void setBackgroundColor(Color argb);

    void setBackgroundColorAnimated(Color argb, int delay, int duration);

    void setItemStack(ItemStack stack);

    Transformation getTransformation();

    void setTransformation(Transformation tf);

    void setTransformationAnimated(Transformation tf, int delay, int duration);

    void setTransformationAndOpacity(Transformation tf, byte opacity, boolean opacityChanged, int delay, int duration);

    Location location();

    static DisplayHandle wrapEntity(KaizerUIPlugin plugin, Player viewer, Entity entity) {
        return new EntityVisual(plugin, viewer, entity);
    }

    /** Real non-Display server entity (Mannequin, ArmorStand host for ModelEngine/BetterModel). */
    final class EntityVisual implements DisplayHandle {
        private final KaizerUIPlugin plugin;
        private final Player viewer;
        private final Entity entity;
        private boolean spawned;

        EntityVisual(KaizerUIPlugin plugin, Player viewer, Entity entity) {
            this.plugin = plugin;
            this.viewer = viewer;
            this.entity = entity;
            this.spawned = true;
        }

        @Override public int entityId() { return entity.getEntityId(); }
        @Override public boolean isValid() { return entity.isValid(); }
        @Override public boolean isPacket() { return false; }
        @Override public boolean isSpawned() { return spawned && entity.isValid(); }

        @Override
        public void show() {
            if (!entity.isValid()) return;
            spawned = true;
            viewer.showEntity(plugin, entity);
        }

        @Override
        public void hide() {
            if (!entity.isValid()) return;
            spawned = false;
            viewer.hideEntity(plugin, entity);
        }

        @Override
        public void destroy() {
            spawned = false;
            if (entity.isValid()) entity.remove();
        }

        @Override public void markDestroyedQuietly() { spawned = false; }

        @Override
        public void teleport(double x, double y, double z, float yaw, float pitch) {
            if (!entity.isValid()) return;
            World w = entity.getWorld();
            entity.teleportAsync(new Location(w, x, y, z, yaw, pitch));
        }

        @Override public void setTeleportDuration(int ticks) {}
        @Override public void setText(Component text) {}
        @Override public void setTextOpacity(byte opacity) {}
        @Override public void setBackgroundColor(Color argb) {}
        @Override public void setBackgroundColorAnimated(Color argb, int delay, int duration) {}
        @Override public void setItemStack(ItemStack stack) {}
        @Override public Transformation getTransformation() { return IDENTITY_TF; }
        @Override public void setTransformation(Transformation tf) {}
        @Override public void setTransformationAnimated(Transformation tf, int delay, int duration) {}
        @Override public void setTransformationAndOpacity(Transformation tf, byte opacity, boolean opacityChanged, int delay, int duration) {}
        @Override public Location location() { return entity.getLocation(); }
    }

    /** Bukkit TextDisplay / ItemDisplay fallback when PacketEvents is absent or disabled. */
    final class BukkitDisplay implements DisplayHandle {
        private final KaizerUIPlugin plugin;
        private final Player viewer;
        private final Display display;
        private boolean destroyed;
        private boolean shown;

        BukkitDisplay(KaizerUIPlugin plugin, Player viewer, Display display, boolean shown) {
            this.plugin = plugin;
            this.viewer = viewer;
            this.display = display;
            this.shown = shown;
        }

        @Override public int entityId() { return display.getEntityId(); }
        @Override public boolean isValid() { return !destroyed && display.isValid(); }
        @Override public boolean isPacket() { return false; }
        @Override public boolean isSpawned() { return shown && isValid(); }

        @Override
        public void show() {
            if (!isValid()) return;
            shown = true;
            viewer.showEntity(plugin, display);
        }

        @Override
        public void hide() {
            if (!isValid()) return;
            shown = false;
            viewer.hideEntity(plugin, display);
        }

        @Override
        public void destroy() {
            destroyed = true;
            shown = false;
            if (display.isValid()) display.remove();
        }

        @Override
        public void markDestroyedQuietly() {
            destroyed = true;
            shown = false;
        }

        @Override
        public void teleport(double x, double y, double z, float yaw, float pitch) {
            if (!isValid()) return;
            display.teleportAsync(new Location(display.getWorld(), x, y, z, yaw, pitch));
        }

        @Override
        public void setTeleportDuration(int ticks) {
            if (isValid()) display.setTeleportDuration(ticks);
        }

        @Override
        public void setText(Component text) {
            if (isValid() && display instanceof TextDisplay td) td.text(text);
        }

        @Override
        public void setTextOpacity(byte opacity) {
            if (isValid() && display instanceof TextDisplay td) td.setTextOpacity(opacity);
        }

        @Override
        public void setBackgroundColor(Color argb) {
            if (isValid() && display instanceof TextDisplay td) td.setBackgroundColor(argb);
        }

        @Override
        public void setBackgroundColorAnimated(Color argb, int delay, int duration) {
            if (isValid() && display instanceof TextDisplay td) {
                td.setInterpolationDelay(delay);
                td.setInterpolationDuration(duration);
                td.setBackgroundColor(argb);
            }
        }

        @Override
        public void setItemStack(ItemStack stack) {
            if (isValid() && display instanceof ItemDisplay id) id.setItemStack(stack);
        }

        @Override
        public Transformation getTransformation() {
            return isValid() ? display.getTransformation() : IDENTITY_TF;
        }

        @Override
        public void setTransformation(Transformation tf) {
            if (isValid()) display.setTransformation(tf);
        }

        @Override
        public void setTransformationAnimated(Transformation tf, int delay, int duration) {
            if (isValid()) {
                display.setInterpolationDelay(delay);
                display.setInterpolationDuration(duration);
                display.setTransformation(tf);
            }
        }

        @Override
        public void setTransformationAndOpacity(Transformation tf, byte opacity, boolean opacityChanged, int delay, int duration) {
            if (!isValid()) return;
            display.setInterpolationDelay(delay);
            display.setInterpolationDuration(duration);
            display.setTransformation(tf);
            if (opacityChanged && display instanceof TextDisplay td) td.setTextOpacity(opacity);
        }

        @Override
        public Location location() {
            return display.getLocation();
        }
    }
}
