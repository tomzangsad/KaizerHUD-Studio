package kz.kaizerui;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.protocol.entity.data.EntityData;
import com.github.retrooper.packetevents.protocol.entity.data.EntityDataTypes;
import com.github.retrooper.packetevents.protocol.entity.type.EntityType;
import com.github.retrooper.packetevents.protocol.entity.type.EntityTypes;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.util.Quaternion4f;
import com.github.retrooper.packetevents.util.Vector3d;
import com.github.retrooper.packetevents.wrapper.PacketWrapper;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerDestroyEntities;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityMetadata;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityTeleport;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSpawnEntity;
import io.github.retrooper.packetevents.util.SpigotConversionUtil;
import io.github.retrooper.packetevents.util.SpigotReflectionUtil;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.entity.TextDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.joml.AxisAngle4f;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Packet-only virtual {@code TextDisplay} and {@code ItemDisplay} backend powered by PacketEvents,
 * producing zero real server entities for Java menus. Falls back automatically to Bukkit entities
 * when PacketEvents is absent or {@code java.packet-displays: false}.
 *
 * <p>All PacketEvents imports are isolated inside {@link Impl} so the plugin still loads without
 * PacketEvents installed.</p>
 */
final class PacketDisplays {

    private PacketDisplays() {}

    static boolean enabled(KaizerUIPlugin plugin) {
        return plugin.packetDisplays() && CameraHook.available();
    }

    static void beginBatch(Player player) {
        if (!CameraHook.available() || player == null) return;
        try {
            Impl.beginBatch(player);
        } catch (Throwable ignored) {}
    }

    static void endBatch(Player player) {
        if (!CameraHook.available() || player == null) return;
        try {
            Impl.endBatch(player);
        } catch (Throwable ignored) {}
    }

    static void destroyBatch(Player player, List<Integer> entityIds) {
        if (!CameraHook.available() || player == null || entityIds == null || entityIds.isEmpty()) return;
        try {
            Impl.destroyBatch(player, entityIds);
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not destroy packet displays: " + t);
        }
    }

    static DisplayHandle spawnText(
            KaizerUIPlugin plugin,
            Player player,
            Location loc,
            Component text,
            Transformation tf,
            byte opacity,
            Color bgColor,
            boolean shadow,
            TextDisplay.TextAlignment align,
            int lineWidth,
            int teleportDuration,
            boolean showNow
    ) {
        if (enabled(plugin)) {
            try {
                return Impl.createText(player, loc, text, tf, opacity, bgColor, shadow, align, lineWidth, teleportDuration, showNow);
            } catch (Throwable t) {
                Bukkit.getLogger().warning("[KaizerUI] Packet display spawn failed, falling back to Bukkit entity: " + t);
            }
        }
        return spawnBukkitText(plugin, player, loc, text, tf, opacity, bgColor, shadow, align, lineWidth, teleportDuration, showNow);
    }

    static DisplayHandle spawnItem(
            KaizerUIPlugin plugin,
            Player player,
            Location loc,
            ItemStack stack,
            ItemDisplay.ItemDisplayTransform displayTransform,
            Transformation tf,
            int teleportDuration,
            boolean showNow
    ) {
        if (enabled(plugin)) {
            try {
                return Impl.createItem(player, loc, stack, displayTransform, tf, teleportDuration, showNow);
            } catch (Throwable t) {
                Bukkit.getLogger().warning("[KaizerUI] Packet item display spawn failed, falling back to Bukkit entity: " + t);
            }
        }
        return spawnBukkitItem(plugin, player, loc, stack, displayTransform, tf, teleportDuration, showNow);
    }

    static DisplayHandle spawnCameraAnchor(KaizerUIPlugin plugin, Player player, Location loc) {
        Transformation unit = new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(1f, 1f, 1f), new AxisAngle4f());
        return spawnItem(plugin, player, loc, null, ItemDisplay.ItemDisplayTransform.NONE, unit, 0, true);
    }

    private static DisplayHandle spawnBukkitText(
            KaizerUIPlugin plugin,
            Player player,
            Location loc,
            Component text,
            Transformation tf,
            byte opacity,
            Color bgColor,
            boolean shadow,
            TextDisplay.TextAlignment align,
            int lineWidth,
            int teleportDuration,
            boolean showNow
    ) {
        World w = loc.getWorld();
        TextDisplay t = w.spawn(loc, TextDisplay.class, d -> {
            d.setVisibleByDefault(false);
            d.setPersistent(false);
            d.text(text != null ? text : Component.empty());
            d.setBillboard(Display.Billboard.FIXED);
            d.setAlignment(align != null ? align : TextDisplay.TextAlignment.CENTER);
            d.setDefaultBackground(false);
            d.setBackgroundColor(bgColor != null ? bgColor : Color.fromARGB(0, 0, 0, 0));
            d.setShadowed(shadow);
            d.setSeeThrough(false);
            d.setLineWidth(lineWidth);
            d.setBrightness(new Display.Brightness(15, 15));
            d.setTextOpacity(opacity);
            d.setTransformation(tf != null ? tf : DisplayHandle.IDENTITY_TF);
            if (teleportDuration > 0) d.setTeleportDuration(teleportDuration);
        });
        if (showNow) player.showEntity(plugin, t);
        return new DisplayHandle.BukkitDisplay(plugin, player, t, showNow);
    }

    private static DisplayHandle spawnBukkitItem(
            KaizerUIPlugin plugin,
            Player player,
            Location loc,
            ItemStack stack,
            ItemDisplay.ItemDisplayTransform displayTransform,
            Transformation tf,
            int teleportDuration,
            boolean showNow
    ) {
        World w = loc.getWorld();
        ItemDisplay d = w.spawn(loc, ItemDisplay.class, x -> {
            x.setVisibleByDefault(false);
            x.setPersistent(false);
            if (stack != null) x.setItemStack(stack);
            x.setItemDisplayTransform(displayTransform != null ? displayTransform : ItemDisplay.ItemDisplayTransform.NONE);
            x.setBillboard(Display.Billboard.FIXED);
            x.setBrightness(new Display.Brightness(15, 15));
            x.setTransformation(tf != null ? tf : DisplayHandle.IDENTITY_TF);
            if (teleportDuration > 0) x.setTeleportDuration(teleportDuration);
        });
        if (showNow) player.showEntity(plugin, d);
        return new DisplayHandle.BukkitDisplay(plugin, player, d, showNow);
    }

    private static final class Impl {

        // Vanilla 1.19.4 - 1.21.11+ Display entity metadata indices
        private static final int IDX_INTERP_DELAY = 8;
        private static final int IDX_INTERP_DURATION = 9;
        private static final int IDX_TELEPORT_DURATION = 10;
        private static final int IDX_TRANSLATION = 11;
        private static final int IDX_SCALE = 12;
        private static final int IDX_LEFT_ROT = 13;
        private static final int IDX_RIGHT_ROT = 14;
        private static final int IDX_BILLBOARD = 15;
        private static final int IDX_BRIGHTNESS = 16;

        // TextDisplay metadata indices
        private static final int IDX_TEXT = 23;
        private static final int IDX_LINE_WIDTH = 24;
        private static final int IDX_BG_COLOR = 25;
        private static final int IDX_TEXT_OPACITY = 26;
        private static final int IDX_TEXT_FLAGS = 27;

        // ItemDisplay metadata indices
        private static final int IDX_ITEM = 23;
        private static final int IDX_ITEM_TRANSFORM = 24;

        private static final int FULL_BRIGHTNESS = (15 << 4) | (15 << 20);
        private static final AtomicInteger FALLBACK_IDS = new AtomicInteger(2_000_000_000);

        private static final class BatchState {
            User user;
            int depth;
        }

        private static final ThreadLocal<BatchState> BATCH = ThreadLocal.withInitial(BatchState::new);

        static void beginBatch(Player player) {
            User user = PacketEvents.getAPI().getPlayerManager().getUser(player);
            if (user == null) return;
            BatchState bs = BATCH.get();
            if (bs.depth == 0) {
                bs.user = user;
            }
            bs.depth++;
        }

        static void endBatch(Player player) {
            BatchState bs = BATCH.get();
            if (bs.depth <= 0) return;
            bs.depth--;
            if (bs.depth == 0) {
                User u = bs.user;
                bs.user = null;
                if (u != null && player.isOnline()) {
                    u.flushPackets();
                }
            }
        }

        private static void sendOrWrite(Player player, PacketWrapper<?> pkt) {
            if (player == null || !player.isOnline()) return;
            BatchState bs = BATCH.get();
            if (bs.depth > 0 && bs.user != null) {
                bs.user.writePacketSilently(pkt);
                return;
            }
            User user = PacketEvents.getAPI().getPlayerManager().getUser(player);
            if (user != null) user.sendPacketSilently(pkt);
        }

        static void destroyBatch(Player player, List<Integer> entityIds) {
            if (player == null || !player.isOnline() || entityIds.isEmpty()) return;
            int[] ids = new int[entityIds.size()];
            for (int i = 0; i < entityIds.size(); i++) ids[i] = entityIds.get(i);
            sendOrWrite(player, new WrapperPlayServerDestroyEntities(ids));
        }

        private static int nextEntityId(World world) {
            try {
                return SpigotReflectionUtil.generateEntityId(world);
            } catch (Throwable ignored) {
                try {
                    return SpigotReflectionUtil.generateEntityId();
                } catch (Throwable ignored2) {
                    return FALLBACK_IDS.decrementAndGet();
                }
            }
        }

        static DisplayHandle createText(
                Player player,
                Location loc,
                Component text,
                Transformation tf,
                byte opacity,
                Color bgColor,
                boolean shadow,
                TextDisplay.TextAlignment align,
                int lineWidth,
                int teleportDuration,
                boolean showNow
        ) {
            byte flags = 0;
            if (shadow) flags |= 0x01;
            if (align == TextDisplay.TextAlignment.LEFT) flags |= 0x08;
            else if (align == TextDisplay.TextAlignment.RIGHT) flags |= 0x10;
            int bgArgb = bgColor != null ? bgColor.asARGB() : 0;
            int eid = nextEntityId(loc.getWorld());
            PacketDisplay pd = new PacketDisplay(
                    player, eid, EntityTypes.TEXT_DISPLAY, false, loc, tf, teleportDuration,
                    text != null ? text : Component.empty(), lineWidth, bgArgb, opacity, flags,
                    null, null, (byte) 0
            );
            if (showNow) pd.show();
            return pd;
        }

        static DisplayHandle createItem(
                Player player,
                Location loc,
                ItemStack stack,
                ItemDisplay.ItemDisplayTransform displayTransform,
                Transformation tf,
                int teleportDuration,
                boolean showNow
        ) {
            ItemStack cloned = stack != null ? stack.clone() : null;
            com.github.retrooper.packetevents.protocol.item.ItemStack peStack =
                    cloned != null ? SpigotConversionUtil.fromBukkitItemStack(cloned)
                            : com.github.retrooper.packetevents.protocol.item.ItemStack.EMPTY;
            byte transformByte = toItemTransformByte(displayTransform);
            int eid = nextEntityId(loc.getWorld());
            PacketDisplay pd = new PacketDisplay(
                    player, eid, EntityTypes.ITEM_DISPLAY, true, loc, tf, teleportDuration,
                    null, 200, 0, (byte) -1, (byte) 0,
                    cloned, peStack, transformByte
            );
            if (showNow) pd.show();
            return pd;
        }

        private static byte toItemTransformByte(ItemDisplay.ItemDisplayTransform t) {
            if (t == null) return 0;
            return switch (t) {
                case NONE -> 0;
                case THIRDPERSON_LEFTHAND -> 1;
                case THIRDPERSON_RIGHTHAND -> 2;
                case FIRSTPERSON_LEFTHAND -> 3;
                case FIRSTPERSON_RIGHTHAND -> 4;
                case HEAD -> 5;
                case GUI -> 6;
                case GROUND -> 7;
                case FIXED -> 8;
            };
        }

        private static Vector3f copyVec(Vector3f v) {
            return new Vector3f(v.x, v.y, v.z);
        }

        private static Quaternionf copyQuat(Quaternionf q) {
            return new Quaternionf(q.x, q.y, q.z, q.w);
        }

        private static Transformation cloneTf(Transformation src) {
            Transformation s = src != null ? src : DisplayHandle.IDENTITY_TF;
            return new Transformation(
                    copyVec(s.getTranslation()),
                    copyQuat(s.getLeftRotation()),
                    copyVec(s.getScale()),
                    copyQuat(s.getRightRotation())
            );
        }

        private static boolean sameVec(Vector3f a, Vector3f b) {
            return Math.abs(a.x - b.x) < 1e-6f && Math.abs(a.y - b.y) < 1e-6f && Math.abs(a.z - b.z) < 1e-6f;
        }

        private static boolean sameQuat(Quaternionf a, Quaternionf b) {
            return Math.abs(a.x - b.x) < 1e-6f && Math.abs(a.y - b.y) < 1e-6f
                    && Math.abs(a.z - b.z) < 1e-6f && Math.abs(a.w - b.w) < 1e-6f;
        }

        private static boolean sameTf(Transformation a, Transformation b) {
            return sameVec(a.getTranslation(), b.getTranslation())
                    && sameVec(a.getScale(), b.getScale())
                    && sameQuat(a.getLeftRotation(), b.getLeftRotation())
                    && sameQuat(a.getRightRotation(), b.getRightRotation());
        }

        private static com.github.retrooper.packetevents.util.Vector3f peVec(Vector3f v) {
            return new com.github.retrooper.packetevents.util.Vector3f(v.x, v.y, v.z);
        }

        private static Quaternion4f peQuat(Quaternionf q) {
            return new Quaternion4f(q.x, q.y, q.z, q.w);
        }

        // PacketEvents writes byte floor(deg * 0.7111111f), where 0.7111111f < 256/360 by 6.6e-9.
        // Offsetting the rounded protocol step by +0.5 step guarantees floor(...) == exact step for all +/- angles.
        private static float encodeSpawnAngle(float deg) {
            int step = Math.round(deg * 256f / 360f);
            return (step + 0.5f) * 1.40625f;
        }

        private static final class PacketDisplay implements DisplayHandle {
            private final Player viewer;
            private final int entityId;
            private final UUID uuid = UUID.randomUUID();
            private final EntityType entityType;
            private final boolean isItem;
            private final World world;

            private double x, y, z;
            private float yaw, pitch;
            private int teleportDuration;
            private Transformation tf;

            // TextDisplay cached state
            private Component text;
            private final int lineWidth;
            private int bgArgb;
            private byte opacity;
            private final byte textFlags;

            // ItemDisplay cached state
            private ItemStack bukkitItem;
            private com.github.retrooper.packetevents.protocol.item.ItemStack peItem;
            private final byte itemTransform;

            private boolean spawned;
            private boolean destroyed;

            PacketDisplay(
                    Player viewer,
                    int entityId,
                    EntityType entityType,
                    boolean isItem,
                    Location loc,
                    Transformation tf,
                    int teleportDuration,
                    Component text,
                    int lineWidth,
                    int bgArgb,
                    byte opacity,
                    byte textFlags,
                    ItemStack bukkitItem,
                    com.github.retrooper.packetevents.protocol.item.ItemStack peItem,
                    byte itemTransform
            ) {
                this.viewer = viewer;
                this.entityId = entityId;
                this.entityType = entityType;
                this.isItem = isItem;
                this.world = loc.getWorld();
                this.x = loc.getX();
                this.y = loc.getY();
                this.z = loc.getZ();
                this.yaw = loc.getYaw();
                this.pitch = loc.getPitch();
                this.tf = cloneTf(tf);
                this.teleportDuration = Math.max(0, teleportDuration);
                this.text = text;
                this.lineWidth = lineWidth;
                this.bgArgb = bgArgb;
                this.opacity = opacity;
                this.textFlags = textFlags;
                this.bukkitItem = bukkitItem;
                this.peItem = peItem;
                this.itemTransform = itemTransform;
            }

            @Override public int entityId() { return entityId; }
            @Override public boolean isValid() { return !destroyed; }
            @Override public boolean isPacket() { return true; }
            @Override public boolean isSpawned() { return spawned && !destroyed; }

            @Override
            public void show() {
                if (destroyed || spawned) return;
                spawned = true;
                float sy = encodeSpawnAngle(yaw);
                float sp = encodeSpawnAngle(pitch);
                var peLoc = new com.github.retrooper.packetevents.protocol.world.Location(x, y, z, sy, sp);
                sendOrWrite(viewer, new WrapperPlayServerSpawnEntity(entityId, uuid, entityType, peLoc, sy, 0, new Vector3d()));
                sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId, buildFullMetadata()));
            }

            @Override
            public void hide() {
                if (destroyed || !spawned) return;
                spawned = false;
                sendOrWrite(viewer, new WrapperPlayServerDestroyEntities(entityId));
            }

            @Override
            public void destroy() {
                if (destroyed) return;
                boolean wasSpawned = spawned;
                spawned = false;
                destroyed = true;
                if (wasSpawned) {
                    sendOrWrite(viewer, new WrapperPlayServerDestroyEntities(entityId));
                }
            }

            @Override
            public void markDestroyedQuietly() {
                spawned = false;
                destroyed = true;
            }

            @Override
            public void teleport(double nx, double ny, double nz, float nyaw, float npitch) {
                if (destroyed) return;
                if (Math.abs(nx - x) < 1e-6 && Math.abs(ny - y) < 1e-6 && Math.abs(nz - z) < 1e-6
                        && Math.abs(nyaw - yaw) < 1e-4f && Math.abs(npitch - pitch) < 1e-4f) {
                    return;
                }
                this.x = nx;
                this.y = ny;
                this.z = nz;
                this.yaw = nyaw;
                this.pitch = npitch;
                if (spawned) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityTeleport(entityId, new Vector3d(nx, ny, nz), nyaw, npitch, false));
                }
            }

            @Override
            public void setTeleportDuration(int ticks) {
                int td = Math.max(0, ticks);
                if (destroyed || td == this.teleportDuration) return;
                this.teleportDuration = td;
                if (spawned) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId,
                            List.of(new EntityData<>(IDX_TELEPORT_DURATION, EntityDataTypes.INT, td))));
                }
            }

            @Override
            public void setText(Component next) {
                if (destroyed || isItem) return;
                Component val = next != null ? next : Component.empty();
                if (val.equals(this.text)) return;
                this.text = val;
                if (spawned) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId,
                            List.of(new EntityData<>(IDX_TEXT, EntityDataTypes.ADV_COMPONENT, val))));
                }
            }

            @Override
            public void setTextOpacity(byte nextOpacity) {
                if (destroyed || isItem || nextOpacity == this.opacity) return;
                this.opacity = nextOpacity;
                if (spawned) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId,
                            List.of(new EntityData<>(IDX_TEXT_OPACITY, EntityDataTypes.BYTE, nextOpacity))));
                }
            }

            @Override
            public void setBackgroundColor(Color argb) {
                if (destroyed || isItem) return;
                int val = argb != null ? argb.asARGB() : 0;
                if (val == this.bgArgb) return;
                this.bgArgb = val;
                if (spawned) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId,
                            List.of(new EntityData<>(IDX_BG_COLOR, EntityDataTypes.INT, val))));
                }
            }

            @Override
            public void setBackgroundColorAnimated(Color argb, int delay, int duration) {
                if (destroyed || isItem) return;
                int val = argb != null ? argb.asARGB() : 0;
                if (val == this.bgArgb) return;
                this.bgArgb = val;
                if (spawned) {
                    List<EntityData<?>> data = new ArrayList<>(3);
                    data.add(new EntityData<>(IDX_INTERP_DELAY, EntityDataTypes.INT, delay));
                    data.add(new EntityData<>(IDX_INTERP_DURATION, EntityDataTypes.INT, duration));
                    data.add(new EntityData<>(IDX_BG_COLOR, EntityDataTypes.INT, val));
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId, data));
                }
            }

            @Override
            public void setItemStack(ItemStack stack) {
                if (destroyed || !isItem) return;
                if (Objects.equals(this.bukkitItem, stack)) return;
                this.bukkitItem = stack != null ? stack.clone() : null;
                this.peItem = this.bukkitItem != null
                        ? SpigotConversionUtil.fromBukkitItemStack(this.bukkitItem)
                        : com.github.retrooper.packetevents.protocol.item.ItemStack.EMPTY;
                if (spawned) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId,
                            List.of(new EntityData<>(IDX_ITEM, EntityDataTypes.ITEMSTACK, this.peItem))));
                }
            }

            @Override
            public Transformation getTransformation() {
                return cloneTf(this.tf);
            }

            @Override
            public void setTransformation(Transformation nextTf) {
                if (destroyed || nextTf == null) return;
                if (sameTf(this.tf, nextTf)) return;
                List<EntityData<?>> data = new ArrayList<>(4);
                appendChangedTfData(this.tf, nextTf, data);
                this.tf = cloneTf(nextTf);
                if (spawned && !data.isEmpty()) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId, data));
                }
            }

            @Override
            public void setTransformationAnimated(Transformation nextTf, int delay, int duration) {
                setTransformationAndOpacity(nextTf, this.opacity, false, delay, duration);
            }

            @Override
            public void setTransformationAndOpacity(Transformation nextTf, byte nextOpacity, boolean opacityChanged, int delay, int duration) {
                if (destroyed) return;
                boolean tfChanged = nextTf != null && !sameTf(this.tf, nextTf);
                boolean opChanged = !isItem && opacityChanged && nextOpacity != this.opacity;
                if (!tfChanged && !opChanged) return;

                List<EntityData<?>> data = new ArrayList<>(7);
                if (tfChanged) {
                    data.add(new EntityData<>(IDX_INTERP_DELAY, EntityDataTypes.INT, delay));
                    data.add(new EntityData<>(IDX_INTERP_DURATION, EntityDataTypes.INT, duration));
                    appendChangedTfData(this.tf, nextTf, data);
                    this.tf = cloneTf(nextTf);
                }
                if (opChanged) {
                    this.opacity = nextOpacity;
                    data.add(new EntityData<>(IDX_TEXT_OPACITY, EntityDataTypes.BYTE, nextOpacity));
                }
                if (spawned && !data.isEmpty()) {
                    sendOrWrite(viewer, new WrapperPlayServerEntityMetadata(entityId, data));
                }
            }

            @Override
            public Location location() {
                return new Location(world, x, y, z, yaw, pitch);
            }

            private void appendChangedTfData(Transformation prev, Transformation next, List<EntityData<?>> out) {
                if (!sameVec(prev.getTranslation(), next.getTranslation())) {
                    out.add(new EntityData<>(IDX_TRANSLATION, EntityDataTypes.VECTOR3F, peVec(next.getTranslation())));
                }
                if (!sameQuat(prev.getLeftRotation(), next.getLeftRotation())) {
                    out.add(new EntityData<>(IDX_LEFT_ROT, EntityDataTypes.QUATERNION, peQuat(next.getLeftRotation())));
                }
                if (!sameVec(prev.getScale(), next.getScale())) {
                    out.add(new EntityData<>(IDX_SCALE, EntityDataTypes.VECTOR3F, peVec(next.getScale())));
                }
                if (!sameQuat(prev.getRightRotation(), next.getRightRotation())) {
                    out.add(new EntityData<>(IDX_RIGHT_ROT, EntityDataTypes.QUATERNION, peQuat(next.getRightRotation())));
                }
            }

            private List<EntityData<?>> buildFullMetadata() {
                List<EntityData<?>> data = new ArrayList<>(14);
                data.add(new EntityData<>(IDX_TELEPORT_DURATION, EntityDataTypes.INT, teleportDuration));
                data.add(new EntityData<>(IDX_TRANSLATION, EntityDataTypes.VECTOR3F, peVec(tf.getTranslation())));
                data.add(new EntityData<>(IDX_SCALE, EntityDataTypes.VECTOR3F, peVec(tf.getScale())));
                data.add(new EntityData<>(IDX_LEFT_ROT, EntityDataTypes.QUATERNION, peQuat(tf.getLeftRotation())));
                data.add(new EntityData<>(IDX_RIGHT_ROT, EntityDataTypes.QUATERNION, peQuat(tf.getRightRotation())));
                data.add(new EntityData<>(IDX_BILLBOARD, EntityDataTypes.BYTE, (byte) 0));
                data.add(new EntityData<>(IDX_BRIGHTNESS, EntityDataTypes.INT, FULL_BRIGHTNESS));
                if (isItem) {
                    data.add(new EntityData<>(IDX_ITEM, EntityDataTypes.ITEMSTACK,
                            peItem != null ? peItem : com.github.retrooper.packetevents.protocol.item.ItemStack.EMPTY));
                    data.add(new EntityData<>(IDX_ITEM_TRANSFORM, EntityDataTypes.BYTE, itemTransform));
                } else {
                    data.add(new EntityData<>(IDX_TEXT, EntityDataTypes.ADV_COMPONENT, text != null ? text : Component.empty()));
                    data.add(new EntityData<>(IDX_LINE_WIDTH, EntityDataTypes.INT, lineWidth));
                    data.add(new EntityData<>(IDX_BG_COLOR, EntityDataTypes.INT, bgArgb));
                    data.add(new EntityData<>(IDX_TEXT_OPACITY, EntityDataTypes.BYTE, opacity));
                    data.add(new EntityData<>(IDX_TEXT_FLAGS, EntityDataTypes.BYTE, textFlags));
                }
                return data;
            }
        }
    }
}
