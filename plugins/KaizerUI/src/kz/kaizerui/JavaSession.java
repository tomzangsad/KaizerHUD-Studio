package kz.kaizerui;

import io.papermc.paper.threadedregions.scheduler.ScheduledTask;
import kz.kaizerui.api.event.MenuCloseEvent;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.data.Levelled;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Horse;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.entity.TextDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.AxisAngle4f;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * A menu open for one Java player, drawn with TextDisplay holograms.
 *
 * <p>Geometry: the menu is a flat panel {@code distance} blocks in front of the camera, facing it.
 * 1 GUI pixel = {@code s} blocks. Every picture is one font glyph exactly w×h text pixels, and a
 * TextDisplay at scale {@code s / 0.025} draws 1 text pixel as 1 GUI pixel.</p>
 *
 * <p>Vanilla text display layout (1.21 client, TextDisplayRenderer): the text block is centred on
 * x at {@code 1 - width/2} and its first line top sits 10 px above the entity origin; a bitmap
 * glyph's top is {@code 7 - ascent} px below the line top and it is {@code w + 1} px wide
 * (advance). So a w×h glyph with ascent a has its centre {@code +0.5} px right of the origin and
 * {@code 3 + a - h/2} px above it.</p>
 *
 * <p>Cursor: with camera lock (PacketEvents) the client's view is moved to a still entity, so turning
 * the head no longer turns the view; the head's yaw / pitch changes move the cursor. A client whose
 * camera is another entity stops sending its rotation (LocalPlayer.sendPosition checks
 * isControlledCamera) — except while riding, when it sends a rotation packet every tick. So the
 * player rides an invisible display entity while the menu is open, and the rotation is read every
 * tick. Without PacketEvents the crosshair is the cursor (ray from the eye onto the panel).</p>
 *
 * <p>Pictures bigger than 256 px arrive as several tiles (the client's font atlas is 256×256);
 * each tile is its own TextDisplay.</p>
 *
 * <p>Motion: every animated element keeps its displays ("parts"). Each tick the element's state
 * (move, scale, turn, opacity — see {@link Motion}) is worked out and sent as the displays'
 * transformation with a 1–2 tick interpolation, so the client glides between the samples. The
 * page's opening animation is applied around the menu's pivot on top of each element's own.</p>
 */
final class JavaSession {

    private static final double TEXT_PX = 0.025;      // blocks per text pixel at scale 1
    private static final double LAYER = 0.0006;       // gap between layers, towards the camera
    private static final double CAMERA_FORWARD = 0.4; // camera sits in front of the head model

    final KaizerUIPlugin plugin;
    final Player player;
    final MenuDef.Studio studio;
    final boolean locked;
    MenuDef menu;

    private final World world;
    private final Location lock;
    private final float yaw0;
    private final Vector f, r, u, cam;
    private Vector center;
    private double s;            // blocks per GUI pixel at menu plane (depth 0)
    private double menuDist = 1.2;
    private double pxPerDeg;
    private double cx, cy;       // cursor, GUI pixels
    /** Where the cursor may go (GUI px): the menu, or with Full screen the whole visible screen */
    private double minX, minY, maxX, maxY;
    private float lastYaw, lastPitch;
    private boolean rotationKnown;
    private boolean cursorPlaced;
    private final double eyeX, eyeY, eyeZ;
    private boolean recenterPending;
    private long recenterSentMs;
    private long lastRecenterMs;

    private ItemDisplay camera;
    private Entity vehicle;
    private ScheduledTask rotationTask;
    boolean closing;
    private TextDisplay cursor;
    private volatile int cursorEntityId = -1;
    private volatile float cursorYaw;
    private final Object inputLock = new Object();
    private final AtomicBoolean hoverSyncQueued = new AtomicBoolean(false);
    private final List<Entity> menuEntities = new ArrayList<>();
    private final Map<String, List<Entity>> elemEntities = new HashMap<>();
    private final Set<String> hiddenElems = new HashSet<>();
    private final List<Entity> deferredVisuals = new ArrayList<>();
    private boolean visualsShown;
    private final List<Location> fakeLights = new ArrayList<>();
    private final Set<String> fakeLightKeys = new HashSet<>();
    private final Map<String, List<TextDisplay>> pictures = new HashMap<>();
    private final Map<String, TextDisplay> labels = new HashMap<>();
    private final Map<String, TextDisplay> texts = new HashMap<>();
    /** Player Head / Model displays and the name whose skin each one shows */
    private final Map<String, Part> skinParts = new HashMap<>();
    private final Map<String, String> skinNames = new HashMap<>();
    /** Player Model in 3D (Mannequin) and Item displays, with the task that turns them */
    private final Map<String, ModelPart> models = new HashMap<>();
    private final Map<String, CustomModelPart> customModels = new HashMap<>();
    private final Map<String, ItemDisplay> items = new HashMap<>();
    private final Map<String, TextDisplay> inputLabels = new HashMap<>();
    private final Map<String, RoulettePart> roulettes = new HashMap<>();
    private record ScrollNode(Entity entity, double ox, double oy, double depth, float yaw, float pitch, MenuDef.Element el, MenuDef.Element area) {}
    private final List<ScrollNode> scrollNodes = new ArrayList<>();
    private final Map<String, double[]> scrollOffsets = new HashMap<>();
    private volatile String panGrabbed;
    private float panLastYaw, panLastPitch;
    private boolean panKnown;
    private final java.util.concurrent.ConcurrentHashMap<String, double[]> panPending = new java.util.concurrent.ConcurrentHashMap<>();
    private ScheduledTask turnTask;
    private long turnTick;
    /**
     * Turn = drag: a click on the model grabs it, moving the mouse turns it (the cursor stays put),
     * the next click lets go. Java sends no "button held", so press + move works and one more click drops it.
     */
    private volatile String grabbed;
    private float grabLastYaw;
    private boolean grabKnown;
    private final Map<String, Float> dragYaw = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, Float> dragShown = new HashMap<>();
    private static final float DRAG_DEG_PER_DEG = 3f;
    private MenuDef.Element hovered;
    private MenuDef.Element tooltipEl;
    private TextDisplay tooltipDisplay;
    private ScheduledTask refreshTask;
    private long lastClick;
    private long lastScrollMs;
    boolean closed;

    /* motion */
    private static final int ANIM_LEAD = 1;           // ticks before the first frame: the client has the displays by then
    private final List<Anim> anims = new ArrayList<>();
    private final Map<String, Anim> animById = new HashMap<>();
    private Motion.Clip openClip;
    private double[] menuState = Motion.rest();
    private ScheduledTask animTask;
    private long animTick;
    private TextDisplay backdrop;
    private Color backdropColor;

    /** One display of an element: its entity origin in GUI px, base scale, and depth-adjusted GUI scale */
    private static final class Part {
        final TextDisplay d;
        final double ox, oy;
        final float k;
        final double sd;
        int opacity = 255;
        Part(TextDisplay d, double ox, double oy, float k, double sd) { this.d = d; this.ox = ox; this.oy = oy; this.k = k; this.sd = sd; }
    }

    /** Motion state of one element */
    private static final class Anim {
        final MenuDef.Element el;
        final List<Part> parts = new ArrayList<>();
        final List<Part> picture = new ArrayList<>();   // tile displays, for frame changes
        double[] last;
        double hoverW;
        boolean hoverOn;
        double pressAt = -1;
        int frame;
        Anim(MenuDef.Element el) { this.el = el; }
    }

    JavaSession(KaizerUIPlugin plugin, Player player, MenuDef menu, MenuDef.Studio studio, boolean locked) {
        this.plugin = plugin;
        this.player = player;
        this.menu = menu;
        this.studio = studio;
        this.locked = locked;
        this.world = player.getWorld();
        this.lock = player.getLocation().clone();
        Location eye = player.getEyeLocation();
        this.yaw0 = eye.getYaw();
        this.eyeX = eye.getX();
        this.eyeY = eye.getY();
        this.eyeZ = eye.getZ();
        double yr = Math.toRadians(yaw0);
        this.f = new Vector(-Math.sin(yr), 0, Math.cos(yr));
        this.r = new Vector(-Math.cos(yr), 0, -Math.sin(yr));
        this.u = new Vector(0, 1, 0);
        this.cam = eye.toVector().add(f.clone().multiply(locked ? CAMERA_FORWARD : 0));
    }

    Location lockLocation() { return lock; }

    /* ───────────── open / switch / close ───────────── */

    void start() {
        if (locked) {
            camera = world.spawn(new Location(world, cam.getX(), cam.getY(), cam.getZ(), yaw0, 0f), ItemDisplay.class, d -> {
                d.setVisibleByDefault(false);
                d.setPersistent(false);
            });
            player.showEntity(plugin, camera);
            // the player sits on an invisible entity where they stand: a riding client keeps sending
            // its head rotation even while its camera is somewhere else
            vehicle = spawnVehicle();
            player.showEntity(plugin, vehicle);
            // mount one tick later so the client already knows the vehicle
            Sched.entityLater(plugin, player, 1, () -> {
                if (closed || vehicle == null || !vehicle.isValid()) return;
                vehicle.addPassenger(player);
            });
            // camera + hidden hands; sent again a little later because the very first menu after
            // joining sometimes arrived before the client had the entities (cursor stuck)
            if (Math.abs(lock.getPitch()) > 5f) {
                synchronized (inputLock) {
                    recenterPending = true;
                    recenterSentMs = System.currentTimeMillis();
                    lastRecenterMs = recenterSentMs;
                }
                CameraHook.lookLevel(player, eyeX, eyeY, eyeZ, yaw0);
            }
            Sched.entityLater(plugin, player, 2, () -> {
                if (closed) return;
                boolean needLevel;
                float ry = yaw0;
                synchronized (inputLock) {
                    needLevel = !rotationKnown || Math.abs(lastPitch) > 15f;
                    if (needLevel) {
                        recenterPending = true;
                        recenterSentMs = System.currentTimeMillis();
                        lastRecenterMs = recenterSentMs;
                        if (rotationKnown) ry = lastYaw;
                    }
                }
                if (needLevel) CameraHook.lookLevel(player, eyeX, eyeY, eyeZ, ry);
            });
            for (long delay : new long[]{3, 10, 30}) {
                Sched.entityLater(plugin, player, delay, () -> {
                    if (closed) return;
                    if (vehicle != null && vehicle.isValid()) {
                        boolean missing = !vehicle.getPassengers().contains(player);
                        if (missing) vehicle.addPassenger(player);
                        if (missing || delay == 3) CameraHook.setPassenger(player, vehicle.getEntityId());
                    }
                    if (camera != null && camera.isValid()) CameraHook.setCamera(player, camera.getEntityId());
                    CameraHook.hideHands(player);
                    CameraHook.setSelfInvisible(player, true);
                });
            }
            CameraHook.hideHud(player, plugin.hideActionBar(), plugin.hideBossBars(), plugin.hideScoreboard());
            rotationTask = Sched.entityRepeat(plugin, player, 20, () -> {
                // the server re-sends the player's flags when they change: keep the arm hidden
                CameraHook.setSelfInvisible(player, true);
            });
        }
        build(menu);
    }

    /** Shows another menu in the same session (camera and cursor stay). */
    void switchTo(MenuDef next) {
        plugin.fireCloseEvent(player, this.menu.id, MenuCloseEvent.Reason.SWITCH_MENU, false);
        clearMenu();
        this.menu = next;
        build(next);
    }

    void close() {
        close(MenuCloseEvent.Reason.API);
    }

    void close(MenuCloseEvent.Reason reason) {
        if (closed) return;
        teardown(reason, true);
    }

    /** Closes the hologram temporarily for private chat input without clearing navHistory or sessionVars. */
    void closeForInput() {
        if (closed) return;
        teardown(MenuCloseEvent.Reason.API, false);
    }

    private void teardown(MenuCloseEvent.Reason reason, boolean clearSessionData) {
        closed = true;
        closing = true;
        if (rotationTask != null) { rotationTask.cancel(); rotationTask = null; }
        clearMenu();
        cursorEntityId = -1;
        if (cursor != null) { cursor.remove(); cursor = null; }
        if (camera != null) {
            if (locked && player.isOnline()) CameraHook.setCamera(player, player.getEntityId());
            camera.remove();
            camera = null;
        }
        if (locked && player.isOnline()) CameraHook.showHud(player);
        if (clearSessionData) {
            plugin.fireCloseEvent(player, menu.id, reason, false);
            plugin.clearHistory(player.getUniqueId());
            plugin.clearSessionVars(player.getUniqueId());
            plugin.clearPlayerOverrides(player.getUniqueId());
        }
        if (vehicle != null) {
            vehicle.removePassenger(player);
            vehicle.remove();
            vehicle = null;
            if (player.isOnline()) {
                CameraHook.setSelfInvisible(player, false);
                player.teleportAsync(lock);   // back to where the menu was opened, facing the same way
                player.updateInventory();     // show the held items again
            }
        }
    }

    Entity vehicle() { return vehicle; }

    /**
     * An untamed, invisible horse: while riding something with its own inventory screen the client
     * asks the server before opening the inventory (key E) instead of opening it itself, and an
     * untamed horse opens nothing — so E does nothing while the menu is open. If a protection or
     * mob plugin blocks the spawn, an invisible display entity is used instead (E then still works).
     */
    private Entity spawnVehicle() {
        if (plugin.horseVehicle()) {
            try {
                Horse h = world.spawn(lock.clone(), Horse.class, e -> {
                    e.setVisibleByDefault(false);
                    e.setPersistent(false);
                    e.setInvisible(true);
                    e.setSilent(true);
                    e.setAI(false);
                    e.setGravity(false);
                    e.setInvulnerable(true);
                    e.setCollidable(false);
                    e.setTamed(false);
                    e.setAdult();
                });
                if (h.isValid()) return h;
            } catch (Throwable ignored) {
                // spawn refused: fall back below
            }
        }
        return world.spawn(lock.clone(), ItemDisplay.class, d -> {
            d.setVisibleByDefault(false);
            d.setPersistent(false);
        });
    }

    private void clearMenu() {
        if (refreshTask != null) { refreshTask.cancel(); refreshTask = null; }
        if (animTask != null) { animTask.cancel(); animTask = null; }
        if (turnTask != null) { turnTask.cancel(); turnTask = null; }
        restoreFakeLights();
        grabbed = null;
        panGrabbed = null;
        panPending.clear();
        setCursorGrabbing(false);
        models.clear();
        for (CustomModelPart cmp : customModels.values()) cmp.destroy();
        customModels.clear();
        for (RoulettePart rp : roulettes.values()) rp.destroy();
        roulettes.clear();
        scrollNodes.clear();
        scrollOffsets.clear();
        items.clear();
        inputLabels.clear();
        dragYaw.clear();
        dragShown.clear();
        anims.clear();
        animById.clear();
        backdrop = null;
        openClip = null;
        deferredVisuals.clear();
        visualsShown = false;
        if (tooltipDisplay != null) { tooltipDisplay.remove(); tooltipDisplay = null; }
        tooltipEl = null;
        for (Entity e : menuEntities) if (e.isValid()) e.remove();
        menuEntities.clear();
        elemEntities.clear();
        hiddenElems.clear();
        pictures.clear();
        labels.clear();
        texts.clear();
        skinParts.clear();
        skinNames.clear();
        hovered = null;
    }

    /* ───────────── layout ───────────── */

    private void build(MenuDef m) {
        double d = studio.distance;
        menuDist = Math.max(0.25, d);
        double fov = Math.max(30, Math.min(110, plugin.fovOf(player)));
        double visH = 2 * d * Math.tan(Math.toRadians(fov / 2));
        double visW = visH * 16.0 / 9.0;
        // full screen: as big as a 16:9 screen allows, keeping a small safe edge
        double fill = m.fullscreen ? plugin.fullscreenFill() : studio.fill;
        double widthCap = m.fullscreen ? Math.min(0.99, fill + 0.04) : 0.95;
        s = visH * fill / m.height;
        if (m.width * s > visW * widthCap) s = visW * widthCap / m.width;
        if (m.fullscreen) {
            // the cursor roams the whole screen (as wide as the FOV the menu is sized for), not only the menu
            double hw = visW / (2 * s) * 0.995, hh = visH / (2 * s) * 0.99;
            minX = Math.min(0, m.width / 2.0 - hw); maxX = Math.max(m.width, m.width / 2.0 + hw);
            minY = Math.min(0, m.height / 2.0 - hh); maxY = Math.max(m.height, m.height / 2.0 + hh);
        } else {
            minX = 0; minY = 0; maxX = m.width; maxY = m.height;
        }
        center = cam.clone().add(f.clone().multiply(d));
        openClip = m.open;
        animTick = 0;
        menuState = openClip != null ? openClip.sample(0) : Motion.rest();
        for (MenuDef.Element e : m.elements) {
            if (openClip != null || e.animated()) {
                Anim a = new Anim(e);
                anims.add(a);
                animById.put(e.id, a);
            }
        }
        if (m.fullscreen && m.backdropAlpha > 0) backdrop(m, d);
        double halfDeg = Math.toDegrees(Math.atan((m.height * s / 2) / d));
        double sensScale = plugin.autoSensitivity() ? plugin.sensitivity().scaleFor(player.getUniqueId()) : 1.0;
        pxPerDeg = (m.height / 2.0) / Math.max(1, halfDeg) * plugin.speedOf(player) * studio.sensitivity * sensScale;

        boolean deferVisuals = openClip != null;
        visualsShown = !deferVisuals;
        int layer = 1;
        for (MenuDef.Element e : m.elements) {
            double depth = layer++ * LAYER;
            Anim a = animById.get(e.id);
            int startIdx = menuEntities.size();
            switch (e.type) {
                case IMAGE -> {
                    if (!e.tiles.isEmpty()) pictures.put(e.id, picture(a, e.tiles, e.x, e.y, depth));
                }
                case BUTTON -> {
                    List<MenuDef.Tile> bt = buttonTiles(e, false);
                    if (!bt.isEmpty()) pictures.put(e.id, picture(a, bt, e.x, e.y, depth));
                    String rawLabel = plugin.dynamicText(player, e.id);
                    if (rawLabel == null) rawLabel = e.label;
                    if (!rawLabel.isEmpty()) {
                        labels.put(e.id, text(a, plugin.resolveText(player, rawLabel), e.labelColor, e.labelScale, e.labelShadow, "center",
                                e.x, e.y, e.w, e.h, depth + LAYER / 2));
                    }
                }
                case TEXT -> {
                    String rawText = plugin.dynamicText(player, e.id);
                    if (rawText == null) rawText = e.text;
                    texts.put(e.id, text(a, plugin.resolveText(player, rawText), e.color, e.scale, e.shadow, e.align,
                            e.x, e.y, e.w, e.h, depth));
                }
                case PLAYER_HEAD -> playerPart(a, e, depth);
                case PLAYER_MODEL -> {
                    if (e.java3d && plugin.models3d() && ModelPart.available()) model3d(e, depth, !deferVisuals);
                    else playerPart(a, e, depth);
                }
                case ITEM -> itemPart(e, depth, !deferVisuals);
                case CUSTOM_MODEL -> customModelPart(e, depth, !deferVisuals);
                case INPUT -> inputPart(a, e, depth);
                case ROULETTE -> roulettes.put(e.id, new RoulettePart(this, e, depth));
                case SCROLL_AREA -> {
                    scrollOffsets.putIfAbsent(e.id, new double[]{0, 0});
                    scrollAreaPart(e, depth);
                }
            }
            if (menuEntities.size() > startIdx) {
                elemEntities.put(e.id, new ArrayList<>(menuEntities.subList(startIdx, menuEntities.size())));
            }
            if (!e.scrollGroup.isEmpty() && menuEntities.size() > startIdx) {
                MenuDef.Element area = scrollAreaOf(m, e);
                if (area != null) {
                    for (int ei = startIdx; ei < menuEntities.size(); ei++) {
                        Entity ent = menuEntities.get(ei);
                        if (ent instanceof Display disp) disp.setTeleportDuration(1);
                        Vector rel = ent.getLocation().toVector().subtract(center);
                        double eDepth = -rel.dot(f);
                        double sd = sAt(eDepth);
                        double ox = rel.dot(r) / sd + m.width / 2.0;
                        double oy = m.height / 2.0 - rel.dot(u) / sd;
                        scrollNodes.add(new ScrollNode(ent, ox, oy, eDepth, ent.getLocation().getYaw(), ent.getLocation().getPitch(), e, area));
                    }
                }
            }
        }
        applyAllScrolls();
        syncVisibility();
        if (!models.isEmpty() || !customModels.isEmpty() || items.keySet().stream().anyMatch(id -> elementById(m, id).spin)) {
            turnTick = 0;
            turnTask = Sched.entityRepeat(plugin, player, 1, this::turn);
        }
        if (!anims.isEmpty() || openClip != null) {
            animTask = Sched.entityRepeat(plugin, player, 1, this::animate);
        }

        if (locked && studio.cursorGlyph != null) {
            // the cursor keeps its place between pages; it is respawned because the scale may change
            cursorEntityId = -1;
            if (cursor != null) { cursor.remove(); cursor = null; }
            if (!cursorPlaced) { cx = m.width / 2.0; cy = m.height / 2.0; cursorPlaced = true; }
            cx = clamp(cx, minX, maxX);
            cy = clamp(cy, minY, maxY);
            double cursorDepth = (menu.elements.size() + 3) * LAYER;
            cursor = spawnText(cursorOrigin(), glyphComponent(studio.cursorGlyph), (float) (sAt(cursorDepth) / TEXT_PX), false);
            cursor.setTeleportDuration(1);
            cursorYaw = cursor.getLocation().getYaw();
            cursorEntityId = cursor.getEntityId();
        }
        if (m.refreshTicks > 0 && hasPlaceholders(m)) {
            refreshTask = Sched.entityRepeat(plugin, player, m.refreshTicks, this::refreshTexts);
        }
        updateHover();
    }

    private static boolean hasPlaceholders(MenuDef m) {
        for (MenuDef.Element e : m.elements) {
            if (e.type == MenuDef.Type.TEXT && (e.text.indexOf('%') >= 0 || e.text.indexOf('{') >= 0)) return true;
            if (e.type == MenuDef.Type.BUTTON && (e.label.indexOf('%') >= 0 || e.label.indexOf('{') >= 0)) return true;
            if (e.type == MenuDef.Type.INPUT) return true;
            if (e.isPlayer() && e.player.indexOf('%') >= 0 && !isViewer(e)) return true;
            if (e.type == MenuDef.Type.ITEM && Items.dynamic(e.item)) return true;
            if (!e.visibility.isEmpty() || !e.togglePapi.isEmpty()) return true;
            if (e.type == MenuDef.Type.PLAYER_MODEL && e.outfit) return true;
        }
        return false;
    }

    void refreshNow() {
        if (!closed) refreshTexts();
    }

    private void refreshTexts() {
        if (closed) return;
        for (MenuDef.Element e : menu.elements) {
            if (e.type == MenuDef.Type.TEXT) {
                TextDisplay t = texts.get(e.id);
                String dyn = plugin.dynamicText(player, e.id);
                String raw = dyn != null ? dyn : e.text;
                if (t != null && (dyn != null || raw.indexOf('%') >= 0 || raw.indexOf('{') >= 0)) {
                    t.text(Texts.component(plugin.resolveText(player, raw), e.color));
                }
            } else if (e.type == MenuDef.Type.BUTTON) {
                if (e.isToggle()) {
                    List<TextDisplay> pic = pictures.get(e.id);
                    List<MenuDef.Tile> tiles = buttonTiles(e, e == hovered);
                    if (pic != null && !tiles.isEmpty()) {
                        for (int i = 0; i < pic.size() && i < tiles.size(); i++) pic.get(i).text(glyphComponent(tiles.get(i).glyph()));
                    }
                }
                TextDisplay t = labels.get(e.id);
                String dyn = plugin.dynamicText(player, e.id);
                String raw = dyn != null ? dyn : e.label;
                if (t != null && (dyn != null || raw.indexOf('%') >= 0 || raw.indexOf('{') >= 0)) {
                    t.text(Texts.component(plugin.resolveText(player, raw), e == hovered && !e.hasHover() ? plugin.labelHoverColor() : e.labelColor));
                }
            } else if (e.type == MenuDef.Type.INPUT) {
                TextDisplay t = inputLabels.get(e.id);
                if (t != null) {
                    String curVal = plugin.getSessionVar(player.getUniqueId(), e.varName, e.defaultValue);
                    String disp = (e.prefix != null ? e.prefix : "") + curVal + (e.suffix != null ? e.suffix : "") + " &7✎";
                    t.text(Texts.component(plugin.resolveText(player, disp), e.textColor));
                }
            } else if (e.type == MenuDef.Type.PLAYER_MODEL && models.containsKey(e.id)) {
                models.get(e.id).refreshOutfit(player);
            } else if (e.type == MenuDef.Type.ITEM && items.containsKey(e.id)) {
                ItemStack dyn = plugin.dynamicItem(player, e.id);
                if (dyn != null || Items.dynamic(e.item)) {
                    ItemDisplay d = items.get(e.id);
                    if (d.isValid()) d.setItemStack(dyn != null ? dyn : Items.resolve(plugin, player, e.item, e.glint));
                }
            } else if (e.isPlayer() && skinParts.containsKey(e.id)) {
                // e.g. a leaderboard: the name behind the placeholder changed → show the new skin
                String name = skinName(e);
                if (!name.equalsIgnoreCase(skinNames.getOrDefault(e.id, ""))) showSkin(e, name);
            }
        }
        syncVisibility();
        if (tooltipEl != null && tooltipDisplay != null && tooltipDisplay.isValid()) {
            tooltipDisplay.text(Texts.component(plugin.resolveText(player, tooltipEl.tooltip)));
        }
    }

    private void syncVisibility() {
        if (closed || menu == null) return;
        for (MenuDef.Element e : menu.elements) {
            if (e.visibility.isEmpty()) continue;
            boolean vis = ConditionEval.all(plugin, player, e.visibility);
            boolean wasHidden = hiddenElems.contains(e.id);
            if (vis && wasHidden) hiddenElems.remove(e.id);
            else if (!vis && !wasHidden) hiddenElems.add(e.id);
            List<Entity> ents = elemEntities.get(e.id);
            if (ents == null) continue;
            for (Entity ent : ents) {
                if (!ent.isValid()) continue;
                if (!vis) player.hideEntity(plugin, ent);
                else if (visualsShown && !isClippedOut(ent)) player.showEntity(plugin, ent);
            }
        }
    }

    /* ───────────── player head / model ───────────── */

    private static boolean isViewer(MenuDef.Element e) {
        String p = e.player.trim().toLowerCase(java.util.Locale.ROOT);
        return p.isEmpty() || p.equals("%player_name%") || p.equals("%player%");
    }

    /** The player name behind the element's player text (placeholders, colour codes removed) */
    private String skinName(MenuDef.Element e) {
        if (isViewer(e)) return player.getName();
        String n = Texts.papi(player, e.player).replaceAll("[&§][0-9a-fk-orA-FK-OR]", "").trim();
        return n.isEmpty() ? player.getName() : n;
    }

    private int[][] skinPixels(MenuDef.Element e, Skins.Skin skin) {
        return e.type == MenuDef.Type.PLAYER_HEAD ? Skins.head(skin, e.hat) : Skins.body(skin, e.hat);
    }

    /**
     * One display drawing the skin as coloured pixels (see {@link Skins}), fitted in the box and
     * centred: a head is 8 × 8 skin px, a model 16 × 32. Steve until the skin has loaded.
     */
    private void playerPart(Anim a, MenuDef.Element e, double depth) {
        boolean head = e.type == MenuDef.Type.PLAYER_HEAD;
        int gw = head ? 8 : 16, gh = head ? 8 : 32;
        double p = Math.min(e.w / (double) gw, e.h / (double) gh);
        double bx = e.x + (e.w - gw * p) / 2, by = e.y + (e.h - gh * p) / 2;
        double ox = bx - (1 - gw / 2.0) * p;          // text block starts 1 - W/2 text px from the origin
        double oy = by + (4 - plugin.offsetY()) * p;   // row 0 top is 4 text px above the origin
        String name = skinName(e);
        Skins.Skin known = Skins.cached(name);
        Part part = spawnPart(a, ox, oy, depth, Skins.text(skinPixels(e, known), Key.key(studio.skinFont)), (float) (s * p / TEXT_PX), false);
        skinParts.put(e.id, part);
        skinNames.put(e.id, name);
        if (known == null || !Skins.fresh(name)) showSkin(e, name);
    }

    private static MenuDef.Element elementById(MenuDef m, String id) {
        for (MenuDef.Element e : m.elements) if (e.id.equals(id)) return e;
        throw new IllegalStateException(id);
    }

    /** Yaw that makes a display / model face the camera (same as the text displays) */
    private float facingYaw() { return plugin.flipFacing() ? yaw0 : yaw0 + 180f; }

    /**
     * Player Model as a real 3D player (see {@link ModelPart}): fitted in the element's box,
     * feet on its bottom, a little in front of the menu so the background never cuts it.
     */
    private void model3d(MenuDef.Element e, double depth, boolean showNow) {
        double k0 = Math.min(e.w * s / ModelPart.MODEL_W, e.h * s / ModelPart.MODEL_H);
        double modelDepth = depth + LAYER + 0.16 * k0;
        double sd = sAt(modelDepth);
        double k = Math.min(e.w * sd / ModelPart.MODEL_W, e.h * sd / ModelPart.MODEL_H);
        double bottom = e.y + (e.h + ModelPart.MODEL_H * k / sd) / 2.0;
        Vector feet = world(e.x + e.w / 2.0, bottom, modelDepth);
        float yaw = facingYaw() + (float) e.angle;
        Location feetLoc = new Location(world, feet.getX(), feet.getY(), feet.getZ());
        ModelPart mp = new ModelPart(plugin, player, world, feetLoc, k, yaw,
                skinName(e), isViewer(e), e.outfit, e.crouch, showNow);
        menuEntities.add(mp.handle());
        if (!showNow) deferredVisuals.add(mp.handle());
        models.put(e.id, mp);
        dragYaw.put(e.id, yaw);
        if (plugin.light3dModels()) {
            placeFakeLight(feetLoc);
            placeFakeLight(feetLoc.clone().add(0, 0.5 * ModelPart.MODEL_H * k, 0));
        }
    }

    private void placeFakeLight(Location loc) {
        int bx = loc.getBlockX(), by = loc.getBlockY(), bz = loc.getBlockZ();
        String key = bx + "," + by + "," + bz;
        if (!fakeLightKeys.add(key)) return;
        Block block = world.getBlockAt(bx, by, bz);
        if (!block.getType().isAir()) return;
        BlockData light = Material.LIGHT.createBlockData(d -> ((Levelled) d).setLevel(15));
        Location bLoc = new Location(world, bx, by, bz);
        player.sendBlockChange(bLoc, light);
        fakeLights.add(bLoc);
    }

    private void restoreFakeLights() {
        if (fakeLights.isEmpty()) return;
        if (player.isOnline()) {
            for (Location loc : fakeLights) {
                player.sendBlockChange(loc, loc.getBlock().getBlockData());
            }
        }
        fakeLights.clear();
        fakeLightKeys.clear();
    }

    /**
     * Item element: the real item (ItemDisplay). Flat = drawn like in the inventory and pressed
     * flat so it stays in front of the menu; 3D = the item model, brought forward by its depth.
     */
    private void itemPart(MenuDef.Element e, double depth, boolean showNow) {
        ItemStack dyn = plugin.dynamicItem(player, e.id);
        ItemStack stack = dyn != null ? dyn : Items.resolve(plugin, player, e.item, e.glint);
        double baseDepth = depth + LAYER / 2;
        double dEff = baseDepth + (e.item3d ? Math.min(e.w, e.h) * sAt(baseDepth) * 0.5 : 0);
        float k = (float) (Math.min(e.w, e.h) * sAt(dEff));
        Vector pos = world(e.x + e.w / 2.0, e.y + e.h / 2.0, dEff);
        float yaw = facingYaw() + (plugin.itemFlip() ? 0f : 180f);
        ItemDisplay d = world.spawn(new Location(world, pos.getX(), pos.getY(), pos.getZ(), yaw, 0f), ItemDisplay.class, x -> {
            x.setVisibleByDefault(false);
            x.setPersistent(false);
            x.setItemStack(stack);
            x.setItemDisplayTransform(e.item3d ? ItemDisplay.ItemDisplayTransform.NONE : ItemDisplay.ItemDisplayTransform.GUI);
            x.setBillboard(Display.Billboard.FIXED);
            x.setBrightness(new Display.Brightness(15, 15));
            x.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(k, k, e.item3d ? k : k * 0.05f), new AxisAngle4f()));
        });
        if (showNow) player.showEntity(plugin, d);
        else deferredVisuals.add(d);
        menuEntities.add(d);
        items.put(e.id, d);
    }

    private void customModelPart(MenuDef.Element e, double depth, boolean showNow) {
        String resolvedId = plugin.resolveText(player, e.modelId);
        double worldScale = Math.max(0.12, Math.min(e.w, e.h) * sAt(depth + LAYER) * 0.55 * e.scale3d);
        Vector feet = world(e.x + e.w / 2.0, e.y + e.h * 0.85, depth + LAYER);
        float yaw = facingYaw() + (float) e.angle;
        CustomModelPart cmp = CustomModelPart.spawn(plugin, player, new Location(world, feet.getX(), feet.getY(), feet.getZ(), yaw, 0f), e, resolvedId, worldScale, showNow);
        if (cmp == null) return;
        if (!showNow) deferredVisuals.add(cmp.host);
        menuEntities.add(cmp.host);
        customModels.put(e.id, cmp);
        if (plugin.light3dModels()) {
            placeFakeLight(cmp.host.getLocation());
        }
    }

    private void inputPart(Anim a, MenuDef.Element e, double depth) {
        Color bgCol = parseArgb(e.bgColor, 220);
        Color brCol = parseArgb(e.borderColor, 240);
        // Box fill (using stretched space background quad 5x11 px)
        double sd = sAt(depth);
        double boxW = Math.max(2, e.w) * sd;
        double boxH = Math.max(2, e.h) * sd;
        float sx = (float) (boxW / (5 * TEXT_PX)), sy = (float) (boxH / (11 * TEXT_PX));
        Vector origin = world(e.x + e.w / 2.0, e.y + e.h / 2.0, depth)
                .subtract(r.clone().multiply(0.5 * TEXT_PX * sx))
                .subtract(u.clone().multiply(5.5 * TEXT_PX * sy));
        TextDisplay box = world.spawn(toLocation(origin), TextDisplay.class, x -> {
            x.setVisibleByDefault(false);
            x.setPersistent(false);
            x.text(Component.text(" "));
            x.setBillboard(Display.Billboard.FIXED);
            x.setDefaultBackground(false);
            x.setBackgroundColor(bgCol);
            x.setShadowed(false);
            x.setSeeThrough(false);
            x.setBrightness(new Display.Brightness(15, 15));
            x.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(sx, sy, 1f), new AxisAngle4f()));
        });
        player.showEntity(plugin, box);
        menuEntities.add(box);

        // Bottom accent bar
        double sdBar = sAt(depth + LAYER * 0.25);
        float barSx = (float) ((Math.max(2, e.w) * sdBar) / (5 * TEXT_PX));
        float barH = (float) ((1.5 * sdBar) / (11 * TEXT_PX));
        Vector barOrigin = world(e.x + e.w / 2.0, e.y + e.h - 0.75, depth + LAYER * 0.25)
                .subtract(r.clone().multiply(0.5 * TEXT_PX * barSx))
                .subtract(u.clone().multiply(5.5 * TEXT_PX * barH));
        TextDisplay bar = world.spawn(toLocation(barOrigin), TextDisplay.class, x -> {
            x.setVisibleByDefault(false);
            x.setPersistent(false);
            x.text(Component.text(" "));
            x.setBillboard(Display.Billboard.FIXED);
            x.setDefaultBackground(false);
            x.setBackgroundColor(brCol);
            x.setShadowed(false);
            x.setSeeThrough(false);
            x.setBrightness(new Display.Brightness(15, 15));
            x.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(barSx, barH, 1f), new AxisAngle4f()));
        });
        player.showEntity(plugin, bar);
        menuEntities.add(bar);

        String curVal = plugin.getSessionVar(player.getUniqueId(), e.varName, e.defaultValue);
        String disp = (e.prefix != null ? e.prefix : "") + curVal + (e.suffix != null ? e.suffix : "") + " &7✎";
        inputLabels.put(e.id, text(a, plugin.resolveText(player, disp), e.textColor, e.scale, e.shadow, e.align, e.x, e.y, e.w, e.h, depth + LAYER / 2));
    }

    private void scrollAreaPart(MenuDef.Element e, double depth) {
        if (e.bgColor == null || e.bgColor.isBlank()) return;
        Color bgCol = parseArgb(e.bgColor, 85);
        double sd = sAt(depth);
        double boxW = Math.max(2, e.w) * sd, boxH = Math.max(2, e.h) * sd;
        float sx = (float) (boxW / (5 * TEXT_PX)), sy = (float) (boxH / (11 * TEXT_PX));
        Vector origin = world(e.x + e.w / 2.0, e.y + e.h / 2.0, depth)
                .subtract(r.clone().multiply(0.5 * TEXT_PX * sx))
                .subtract(u.clone().multiply(5.5 * TEXT_PX * sy));
        TextDisplay box = world.spawn(toLocation(origin), TextDisplay.class, x -> {
            x.setVisibleByDefault(false);
            x.setPersistent(false);
            x.text(Component.text(" "));
            x.setBillboard(Display.Billboard.FIXED);
            x.setDefaultBackground(false);
            x.setBackgroundColor(bgCol);
            x.setShadowed(false);
            x.setSeeThrough(false);
            x.setBrightness(new Display.Brightness(15, 15));
            x.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(sx, sy, 1f), new AxisAngle4f()));
        });
        player.showEntity(plugin, box);
        menuEntities.add(box);
    }

    double guiScale() { return s; }
    double guiScaleAt(double depth) { return sAt(depth); }
    private double depthFactor(double depth) { return Math.max(0.15, (menuDist - depth) / menuDist); }
    private double sAt(double depth) { return s * depthFactor(depth); }
    Vector worldCenter(double px, double py, double depth) { return world(px, py, depth); }
    Vector rightVec() { return r.clone(); }
    Vector upVec() { return u.clone(); }
    Location facingLoc(Vector v) { return toLocation(v); }
    Location itemFacingLoc(Vector v) {
        float yaw = facingYaw() + (plugin.itemFlip() ? 0f : 180f);
        return new Location(world, v.getX(), v.getY(), v.getZ(), yaw, 0f);
    }

    void spinRoulette(String id) {
        if (closed || roulettes.isEmpty()) return;
        RoulettePart rp = id != null && !id.isBlank() ? roulettes.get(id.trim()) : null;
        if (rp == null) rp = roulettes.values().iterator().next();
        if (rp != null) rp.startSpin();
    }

    void scrollByAction(String arg) {
        if (closed || arg == null || arg.isBlank()) return;
        String[] parts = arg.trim().split(":");
        MenuDef.Element area = null;
        double dx = 0, dy = 0;
        if (parts.length >= 3) {
            area = findScrollArea(parts[0].trim());
            dx = parseDouble(parts[1], 0);
            dy = parseDouble(parts[2], 0);
        } else if (parts.length == 2) {
            area = findScrollArea(parts[0].trim());
            if (area != null) {
                if ("reset".equalsIgnoreCase(parts[1].trim())) {
                    scrollOffsets.put(area.id, new double[]{0, 0});
                    applyScroll(area);
                    updateHover();
                    return;
                }
                dy = parseDouble(parts[1], 0);
            } else {
                area = findScrollArea("");
                dx = parseDouble(parts[0], 0);
                dy = parseDouble(parts[1], 0);
            }
        } else {
            area = findScrollArea("");
            dy = parseDouble(parts[0], 0);
        }
        if (area != null) {
            panAreaBy(area, dx, dy);
            updateHover();
        }
    }

    private static double parseDouble(String sVal, double def) {
        try { return Double.parseDouble(sVal.trim()); }
        catch (NumberFormatException ex) { return def; }
    }

    private MenuDef.Element findScrollArea(String id) {
        if (menu == null) return null;
        for (MenuDef.Element el : menu.elements) {
            if (el.type == MenuDef.Type.SCROLL_AREA && (id.isEmpty() || el.id.equals(id))) return el;
        }
        return null;
    }

    private MenuDef.Element scrollAreaOf(MenuDef m, MenuDef.Element e) {
        if (m == null || e == null || e.scrollGroup == null || e.scrollGroup.isEmpty()) return null;
        for (MenuDef.Element el : m.elements) {
            if (el.type == MenuDef.Type.SCROLL_AREA && e.scrollGroup.equals(el.id)) return el;
        }
        return null;
    }

    private void panAreaBy(MenuDef.Element area, double dx, double dy) {
        double maxSx = "vertical".equals(area.scrollMode) ? 0 : Math.max(0, area.contentW - area.w);
        double maxSy = "horizontal".equals(area.scrollMode) ? 0 : Math.max(0, area.contentH - area.h);
        double[] off = scrollOffsets.computeIfAbsent(area.id, k -> new double[]{0, 0});
        double nx = clamp(off[0] + dx, 0, maxSx);
        double ny = clamp(off[1] + dy, 0, maxSy);
        if (nx != off[0] || ny != off[1]) {
            off[0] = nx;
            off[1] = ny;
            applyScroll(area);
        }
    }

    private void applyAllScrolls() {
        if (menu == null || scrollNodes.isEmpty()) return;
        for (MenuDef.Element el : menu.elements) {
            if (el.type == MenuDef.Type.SCROLL_AREA) applyScroll(el);
        }
    }

    private void applyScroll(MenuDef.Element area) {
        double[] off = scrollOffsets.getOrDefault(area.id, new double[]{0, 0});
        for (ScrollNode n : scrollNodes) {
            if (!area.id.equals(n.area.id) || !n.entity.isValid()) continue;
            Vector p = world(n.ox - off[0], n.oy - off[1], n.depth);
            n.entity.teleportAsync(new Location(world, p.getX(), p.getY(), p.getZ(), n.yaw, n.pitch));
            boolean vis = isVisibleInArea(n.el, area, off[0], off[1]);
            if (!vis) {
                player.hideEntity(plugin, n.entity);
            } else if (visualsShown || !deferredVisuals.contains(n.entity)) {
                player.showEntity(plugin, n.entity);
            }
        }
    }

    private static boolean isVisibleInArea(MenuDef.Element el, MenuDef.Element area, double sx, double sy) {
        double cxEl = el.x - sx + el.w / 2.0;
        double cyEl = el.y - sy + el.h / 2.0;
        return cxEl >= area.x && cxEl <= area.x + area.w && cyEl >= area.y && cyEl <= area.y + area.h;
    }

    private boolean isClippedOut(Entity ent) {
        for (ScrollNode n : scrollNodes) {
            if (n.entity == ent) {
                double[] off = scrollOffsets.getOrDefault(n.area.id, new double[]{0, 0});
                return !isVisibleInArea(n.el, n.area, off[0], off[1]);
            }
        }
        return false;
    }

    private boolean containsEffective(MenuDef.Element e, double px, double py) {
        MenuDef.Element area = scrollAreaOf(menu, e);
        if (area == null) return e.contains(px, py);
        if (!area.contains(px, py)) return false;
        double[] off = scrollOffsets.getOrDefault(area.id, new double[]{0, 0});
        return e.contains(px + off[0], py + off[1]);
    }

    private MenuDef.Element hoveredButtonAt(double px, double py) {
        for (int i = menu.elements.size() - 1; i >= 0; i--) {
            MenuDef.Element e = menu.elements.get(i);
            if (hiddenElems.contains(e.id)) continue;
            if ((e.type == MenuDef.Type.BUTTON || e.type == MenuDef.Type.INPUT) && containsEffective(e, px, py)) return e;
        }
        return null;
    }

    private MenuDef.Element hoveredTooltipAt(double px, double py) {
        for (int i = menu.elements.size() - 1; i >= 0; i--) {
            MenuDef.Element e = menu.elements.get(i);
            if (hiddenElems.contains(e.id)) continue;
            if (!e.tooltip.isBlank() && containsEffective(e, px, py)) return e;
        }
        return null;
    }

    private void flushPan() {
        if (closed || panPending.isEmpty()) return;
        for (var en : panPending.entrySet()) {
            double[] delta = panPending.remove(en.getKey());
            if (delta == null) continue;
            MenuDef.Element area = findScrollArea(en.getKey());
            if (area != null) panAreaBy(area, delta[0], delta[1]);
        }
        updateHover();
    }

    private static Color parseArgb(String hex, int alpha) {
        try {
            int rgb = Integer.parseInt(String.valueOf(hex).replace("#", "").trim(), 16);
            return Color.fromARGB(alpha, (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
        } catch (NumberFormatException ex) {
            return Color.fromARGB(alpha, 22, 27, 38);
        }
    }

    /** Every tick while something turns: spinning models / items, heads following the cursor */
    private void turn() {
        if (closed) return;
        long t = turnTick++;
        String g = grabbed;
        for (Map.Entry<String, ModelPart> en : models.entrySet()) {
            String id = en.getKey();
            MenuDef.Element e = elementById(menu, id);
            ModelPart mp = en.getValue();
            if (id.equals(g) || "drag".equals(e.turn) || "none".equals(e.turn)) {
                Float y = dragYaw.get(id);
                if (y != null && !y.equals(dragShown.get(id))) {
                    dragShown.put(id, y);
                    mp.look(y, y, 0f);
                }
            } else if ("spin".equals(e.turn)) {
                float base = dragYaw.getOrDefault(id, mp.baseYaw);
                float yaw = base + (float) (e.spinSpeed * t / 20.0);
                mp.look(yaw, yaw, 0f);
            } else if ("mouse".equals(e.turn) && t % 2 == 0) {
                float base = dragYaw.getOrDefault(id, mp.baseYaw);
                // the whole player turns as the cursor moves left / right over the menu: side to side = a full turn (360°)
                double rel = cx < 0 ? 0 : clamp((cx - (e.x + e.w / 2.0)) / Math.max(1, menu.width / 2.0), -1, 1);
                float yaw = base - (float) (rel * 180);   // the front follows the cursor's side
                mp.look(yaw, yaw, 0f);
            } else if ("cursor".equals(e.turn) && t % 2 == 0) {
                float base = dragYaw.getOrDefault(id, mp.baseYaw);
                Location eye = mp.entity.getEyeLocation();
                Vector target = world(cx, cy, 0);
                Vector dir = target.subtract(eye.toVector());
                double horiz = Math.hypot(dir.getX(), dir.getZ());
                float headYaw = (float) Math.toDegrees(Math.atan2(-dir.getX(), dir.getZ()));
                float pitch = (float) -Math.toDegrees(Math.atan2(dir.getY(), Math.max(1e-6, horiz)));
                float rel = wrap(headYaw - base);
                headYaw = base + (float) clamp(rel, -60, 60);
                mp.look(base, headYaw, (float) clamp(pitch, -50, 50));
            }
        }
        if (t % 2 == 0) {
            for (Map.Entry<String, ItemDisplay> en : items.entrySet()) {
                MenuDef.Element e = elementById(menu, en.getKey());
                ItemDisplay d = en.getValue();
                if (!e.spin || !d.isValid()) continue;
                Transformation old = d.getTransformation();
                float ang = (float) Math.toRadians((t * 6) % 360);   // 60° a second
                d.setInterpolationDelay(0);
                d.setInterpolationDuration(2);
                d.setTransformation(new Transformation(old.getTranslation(), new AxisAngle4f(ang, 0, 1, 0), old.getScale(), new AxisAngle4f()));
            }
            for (Map.Entry<String, CustomModelPart> en : customModels.entrySet()) {
                MenuDef.Element e = elementById(menu, en.getKey());
                CustomModelPart cmp = en.getValue();
                if (!e.spin) continue;
                float yaw = cmp.baseYaw + (float) (e.spinSpeed * t / 20.0);
                cmp.look(yaw);
            }
        }
    }

    /** Loads the skin of {@code name} and puts it on the element's display when it arrives */
    private void showSkin(MenuDef.Element e, String name) {
        skinNames.put(e.id, name);
        Skins.load(plugin, name, skin -> Sched.entity(plugin, player, () -> {
            if (closed) return;
            Part part = skinParts.get(e.id);
            if (part == null || !part.d.isValid() || !name.equals(skinNames.get(e.id))) return;
            part.d.text(Skins.text(skinPixels(e, skin), Key.key(studio.skinFont)));
        }));
    }

    /** World position of a point of the menu (GUI px from its top-left), {@code depth} blocks towards the camera (perspective-compensated) */
    private Vector world(double px, double py, double depth) {
        double sd = sAt(depth);
        return center.clone()
                .add(r.clone().multiply((px - menu.width / 2.0) * sd))
                .add(u.clone().multiply((menu.height / 2.0 - py) * sd))
                .subtract(f.clone().multiply(depth));
    }

    /** Entity origin that puts the centre of a w×h glyph (ascent a) at the given GUI point */
    private Vector glyphOrigin(double centreX, double centreY, int h, int ascent, double depth) {
        double sd = sAt(depth);
        double up = 3 + ascent - h / 2.0 - plugin.offsetY();
        return world(centreX, centreY, depth)
                .subtract(r.clone().multiply(0.5 * sd))
                .subtract(u.clone().multiply(up * sd));
    }

    private Vector cursorOrigin() {
        double gx = cx - studio.hotX + studio.cursorW / 2.0;
        double gy = cy - studio.hotY + studio.cursorH / 2.0;
        return glyphOrigin(gx, gy, studio.cursorH, studio.cursorAscent, (menu.elements.size() + 3) * LAYER);
    }

    /** One TextDisplay per tile of the picture at x, y */
    private List<TextDisplay> picture(Anim a, List<MenuDef.Tile> tiles, int x, int y, double depth) {
        List<TextDisplay> out = new ArrayList<>(tiles.size());
        for (MenuDef.Tile t : tiles) {
            // entity origin (GUI px) that puts the glyph's centre on the tile's centre
            double ox = x + t.x() + t.w() / 2.0 - 0.5;
            double oy = y + t.y() + t.h() / 2.0 + (3 + t.ascent() - t.h() / 2.0 - plugin.offsetY());
            Part part = spawnPart(a, ox, oy, depth, glyphComponent(t.glyph()), (float) (s / TEXT_PX), false);
            if (a != null) a.picture.add(part);
            out.add(part.d);
        }
        return out;
    }

    /** Spawns one display of an element, already in the element's first animation state */
    private Part spawnPart(Anim a, double ox, double oy, double depth, Component text, float k, boolean shadow) {
        double sd = sAt(depth);
        float kd = (float) (k * depthFactor(depth));
        Part part = new Part(null, ox, oy, kd, sd);
        Transformation tf;
        int op = 255;
        if (a != null) {
            double[] es = elementState(a, 0);
            tf = transform(part, a.el, es, menuState);
            op = opacity(es, menuState);
            a.last = es;
        } else {
            tf = new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(kd, kd, kd), new AxisAngle4f());
        }
        Part real = new Part(spawnText(world(ox, oy, depth), text, tf, (byte) op, shadow), ox, oy, kd, sd);
        real.opacity = op;
        menuEntities.add(real.d);
        if (a != null) a.parts.add(real);
        return real;
    }

    /** A line of normal text inside the box x,y,w,h (vertically centred; aligned left / centre / right) */
    private TextDisplay text(Anim a, String content, String color, double scale, boolean shadow, String align,
                             int x, int y, int w, int h, double depth) {
        double k = Math.max(0.1, scale);
        double width = Fonts.width(content) * k;      // GUI px, approximate for unusual characters
        double centreX = switch (align == null ? "center" : align) {
            case "left" -> x + width / 2.0;
            case "right" -> x + w - width / 2.0;
            default -> x + w / 2.0;
        };
        // default font: 8 px glyphs, ascent 7 → centre 6 px above the origin (in text px)
        double ox = centreX - 0.5 * k;
        double oy = y + h / 2.0 + (6 - plugin.offsetY()) * k;
        return spawnPart(a, ox, oy, depth, Texts.component(content, color), (float) (s * k / TEXT_PX), shadow).d;
    }

    /**
     * A big dimmed sheet behind the menu that covers the whole view (any FOV / screen shape):
     * the background quad of a TextDisplay showing one space, stretched. For " " the quad is
     * 5 × 11 text px, centred 0.5 px right of and 5.5 px above the entity origin.
     */
    private void backdrop(MenuDef m, double d) {
        double w = d * 8, h = d * 5;
        float sx = (float) (w / (5 * TEXT_PX)), sy = (float) (h / (11 * TEXT_PX));
        Vector origin = center.clone().add(f.clone().multiply(LAYER))           // just behind the menu
                .subtract(r.clone().multiply(0.5 * TEXT_PX * sx))
                .subtract(u.clone().multiply(5.5 * TEXT_PX * sy));
        Color col;
        try {
            int rgb = Integer.parseInt(m.backdrop.replace("#", ""), 16);
            col = Color.fromARGB((int) Math.round(m.backdropAlpha * 255), (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
        } catch (NumberFormatException e) {
            col = Color.fromARGB((int) Math.round(m.backdropAlpha * 255), 0, 0, 0);
        }
        backdropColor = col;
        final Color bg = openClip != null ? withAlpha(col, menuState[Motion.ALPHA] / 100) : col;
        TextDisplay t = world.spawn(toLocation(origin), TextDisplay.class, x -> {
            x.setVisibleByDefault(false);
            x.setPersistent(false);
            x.text(Component.text(" "));
            x.setBillboard(Display.Billboard.FIXED);
            x.setDefaultBackground(false);
            x.setBackgroundColor(bg);
            x.setShadowed(false);
            x.setSeeThrough(false);
            x.setBrightness(new Display.Brightness(15, 15));
            x.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(sx, sy, 1f), new AxisAngle4f()));
        });
        player.showEntity(plugin, t);
        menuEntities.add(t);
        backdrop = t;
    }

    private static Color withAlpha(Color c, double k) {
        return Color.fromARGB((int) Math.round(Math.max(0, Math.min(1, k)) * c.getAlpha()), c.getRed(), c.getGreen(), c.getBlue());
    }

    private Component glyphComponent(String glyph) {
        return Component.text(glyph).font(Key.key(studio.font)).color(NamedTextColor.WHITE);
    }

    private Location toLocation(Vector v) {
        float yaw = plugin.flipFacing() ? yaw0 : yaw0 + 180f;
        return new Location(world, v.getX(), v.getY(), v.getZ(), yaw, 0f);
    }

    private TextDisplay spawnText(Vector pos, Component text, float scale, boolean shadow) {
        return spawnText(pos, text, new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(scale, scale, scale), new AxisAngle4f()), (byte) -1, shadow);
    }

    private TextDisplay spawnText(Vector pos, Component text, Transformation tf, byte opacity, boolean shadow) {
        TextDisplay t = world.spawn(toLocation(pos), TextDisplay.class, d -> {
            d.setVisibleByDefault(false);
            d.setPersistent(false);
            d.text(text);
            d.setBillboard(Display.Billboard.FIXED);
            d.setDefaultBackground(false);
            d.setBackgroundColor(Color.fromARGB(0, 0, 0, 0));
            d.setShadowed(shadow);
            d.setSeeThrough(false);
            d.setLineWidth(100000);
            d.setBrightness(new Display.Brightness(15, 15));
            d.setTextOpacity(opacity);
            d.setTransformation(tf);
        });
        player.showEntity(plugin, t);
        return t;
    }

    /* ───────────── motion ───────────── */

    private double now() { return Math.max(0, animTick - ANIM_LEAD) / 20.0; }

    /** The element's own state at t (entrance, loop, hover, click) */
    private double[] elementState(Anim a, double t) {
        MenuDef.Element e = a.el;
        double[] st = Motion.rest();
        if (e.intro != null) st = Motion.combine(st, e.intro.sample(t));
        if (e.loop != null && t >= e.loop.delay) st = Motion.combine(st, e.loop.sample(t));
        if (e.hover != null && a.hoverW > 0) st = Motion.combine(st, e.hover.at(a.hoverW));
        if (e.press != null && a.pressAt >= 0) {
            double pt = t - a.pressAt;
            if (pt > e.press.length) a.pressAt = -1;
            else st = Motion.combine(st, e.press.sample(pt));
        }
        return st;
    }

    /** True while something of the element changes every tick (not only a slow loop) */
    private boolean busy(Anim a, double t) {
        MenuDef.Element e = a.el;
        if (e.intro != null && !e.intro.finished(t)) return true;
        if (a.pressAt >= 0) return true;
        return e.hover != null && (a.hoverOn ? a.hoverW < 1 : a.hoverW > 0);
    }

    private void animate() {
        if (closed) return;
        long tick = animTick++;
        if (tick < ANIM_LEAD) return;
        double t = (tick - ANIM_LEAD) / 20.0;
        double[] ms = openClip != null ? openClip.sample(t) : Motion.rest();
        if (!visualsShown && !deferredVisuals.isEmpty() && (ms[Motion.ALPHA] >= 25.0 || tick >= ANIM_LEAD + 2)) {
            visualsShown = true;
            for (Entity ent : deferredVisuals) {
                if (ent.isValid() && !isClippedOut(ent)) player.showEntity(plugin, ent);
            }
            deferredVisuals.clear();
        }
        boolean menuMoved = !Motion.same(ms, menuState);
        menuState = ms;
        if (menuMoved && backdrop != null && backdrop.isValid() && backdropColor != null) {
            backdrop.setInterpolationDelay(0);
            backdrop.setInterpolationDuration(1);
            backdrop.setBackgroundColor(withAlpha(backdropColor, ms[Motion.ALPHA] / 100));
        }
        for (Anim a : anims) {
            MenuDef.Element e = a.el;
            if (e.hover != null) {
                double step = e.hover.length > 0 ? 0.05 / e.hover.length : 1;
                a.hoverW = a.hoverOn ? Math.min(1, a.hoverW + step) : Math.max(0, a.hoverW - step);
            }
            boolean fast = menuMoved || busy(a, t);
            // slow loops are sent every other tick (2-tick glide); everything else every tick
            if (fast || tick % 2 == 0) {
                double[] es = elementState(a, t);
                if (menuMoved || !Motion.same(es, a.last)) {
                    a.last = es;
                    int dur = fast ? 1 : 2;
                    int op = opacity(es, ms);
                    for (Part p : a.parts) push(p, transform(p, e, es, ms), op, dur);
                }
            }
            // animated picture (the hover picture wins while the cursor is on it)
            if (!e.frames.isEmpty() && !(a.hoverOn && e.hasHover())) {
                int fi = (int) Math.floor(t * e.fps) % e.frames.size();
                if (fi != a.frame) {
                    a.frame = fi;
                    List<MenuDef.Tile> ts = e.frames.get(fi);
                    for (int i = 0; i < a.picture.size() && i < ts.size(); i++) a.picture.get(i).d.text(glyphComponent(ts.get(i).glyph()));
                }
            }
        }
    }

    private void push(Part p, Transformation tf, int op, int dur) {
        if (!p.d.isValid()) return;
        // opacity is a signed byte on the client and is interpolated as one: crossing 127 ↔ 128
        // would sweep through every value in between, so that one step is sent without a glide
        boolean flip = (p.opacity > 127) != (op > 127);
        p.d.setInterpolationDelay(0);
        p.d.setInterpolationDuration(flip ? 0 : dur);
        p.d.setTransformation(tf);
        if (op != p.opacity) { p.d.setTextOpacity((byte) op); p.opacity = op; }
    }

    /** Text opacity for a state: 0 % → 8 (hidden; 0–3 would draw fully opaque), else 26..255 */
    private static int opacity(double[] es, double[] ms) {
        double a = es[Motion.ALPHA] * ms[Motion.ALPHA] / 10000;
        if (a <= 0.02) return 8;
        return (int) Math.max(26, Math.min(255, Math.round(255 * a)));
    }

    /**
     * Display transformation for one part: the element's state around its pivot, then the page's
     * opening state around the menu pivot. Worked out in the display's own plane (blocks, x to the
     * player's right, y up, origin = the entity), then split into rotation · scale · rotation.
     */
    private Transformation transform(Part p, MenuDef.Element e, double[] es, double[] ms) {
        double epx = e.x + e.w * (e.intro != null ? e.intro.px : 0.5);
        double epy = e.y + e.h * (e.intro != null ? e.intro.py : 0.5);
        double mpx = menu.width * (openClip != null ? openClip.px : 0.5);
        double mpy = menu.height * (openClip != null ? openClip.py : 0.5);
        double pex = (epx - p.ox) * p.sd, pey = (p.oy - epy) * p.sd;     // element pivot
        double cx0 = (mpx - p.ox) * p.sd, cy0 = (p.oy - mpy) * p.sd;     // menu pivot
        double[] ae = linear(es), am = linear(ms);
        double[] a = {am[0] * ae[0] + am[1] * ae[2], am[0] * ae[1] + am[1] * ae[3], am[2] * ae[0] + am[3] * ae[2], am[2] * ae[1] + am[3] * ae[3]};
        // point → C + Am (Pe + Ae (v - Pe) + de - C) + dm
        double vx = pex - (ae[0] * pex + ae[1] * pey) + es[Motion.X] * p.sd - cx0;
        double vy = pey - (ae[2] * pex + ae[3] * pey) - es[Motion.Y] * p.sd - cy0;
        double tx = cx0 + am[0] * vx + am[1] * vy + ms[Motion.X] * p.sd;
        double ty = cy0 + am[2] * vx + am[3] * vy - ms[Motion.Y] * p.sd;
        // 2×2 SVD: a = R(phi) · diag(s1, s2) · R(theta)
        double E = (a[0] + a[3]) / 2, F = (a[0] - a[3]) / 2, G = (a[2] + a[1]) / 2, H = (a[2] - a[1]) / 2;
        double Q = Math.hypot(E, H), R = Math.hypot(F, G);
        double s1 = Math.max(1e-4, Q + R), s2 = Math.max(1e-4, Q - R);
        double a1 = Math.atan2(G, F), a2 = Math.atan2(H, E);
        float theta = (float) ((a2 - a1) / 2), phi = (float) ((a2 + a1) / 2);
        return new Transformation(new Vector3f((float) tx, (float) ty, 0f), new Quaternionf().rotateZ(phi),
                new Vector3f((float) (p.k * s1), (float) (p.k * s2), p.k), new Quaternionf().rotateZ(theta));
    }

    /** Rotation · stretch of a state as a 2×2 matrix [a b; c d] in a y-up plane (rot is clockwise on screen) */
    private static double[] linear(double[] st) {
        double k = st[Motion.SCALE] / 100;
        double kx = k * st[Motion.SX] / 100, ky = k * st[Motion.SY] / 100;
        double ang = -Math.toRadians(st[Motion.ROT]);
        double c = Math.cos(ang), sn = Math.sin(ang);
        return new double[]{c * kx, -sn * ky, sn * kx, c * ky};
    }

    /* ───────────── input ───────────── */

    private boolean consumeRecenterPitch(float yaw, float pitch, long now) {
        if (!recenterPending) return false;
        if (now - recenterSentMs > 450L) {
            recenterPending = false;
            return false;
        }
        if (Math.abs(pitch - lastPitch) > 18f && Math.abs(pitch) < 28f) {
            recenterPending = false;
            lastYaw = yaw;
            lastPitch = pitch;
            rotationKnown = true;
            if (panGrabbed != null) {
                panLastYaw = yaw;
                panLastPitch = pitch;
                panKnown = true;
            }
            if (grabbed != null) {
                grabLastYaw = yaw;
                grabKnown = true;
            }
            return true;
        }
        return false;
    }

    /** Head turned directly from Netty rotation packet (may run on Netty IO thread). */
    void onPacketRotate(float yaw, float pitch) {
        if (closed || !locked) return;
        Vector pos = null;
        boolean needRecenter = false;
        float recenterYaw = yaw;
        long now = System.currentTimeMillis();
        synchronized (inputLock) {
            if (consumeRecenterPitch(yaw, pitch, now)) return;
            String pg = panGrabbed;
            if (pg != null) {
                if (!panKnown) { panLastYaw = yaw; panLastPitch = pitch; panKnown = true; }
                float dy = wrap(yaw - panLastYaw);
                float rawDp = pitch - panLastPitch;
                final float dp = Math.abs(rawDp) > 55f ? 0f : rawDp;
                panLastYaw = yaw; panLastPitch = pitch;
                lastYaw = yaw; lastPitch = pitch; rotationKnown = true;
                if (dy != 0 || dp != 0) {
                    panPending.compute(pg, (k, v) -> {
                        if (v == null) return new double[]{-dy * pxPerDeg, -dp * pxPerDeg};
                        v[0] -= dy * pxPerDeg; v[1] -= dp * pxPerDeg;
                        return v;
                    });
                    Sched.entity(plugin, player, this::flushPan);
                }
                if ((!recenterPending && Math.abs(pitch) >= 35f && now - lastRecenterMs >= 160L)
                        || (Math.abs(pitch) >= 82f && now - lastRecenterMs >= 80L)) {
                    recenterPending = true;
                    recenterSentMs = now;
                    lastRecenterMs = now;
                    needRecenter = true;
                    recenterYaw = yaw;
                }
            } else {
                String g = grabbed;
                if (g != null) {
                    if (!grabKnown) { grabLastYaw = yaw; grabKnown = true; }
                    float d = wrap(yaw - grabLastYaw);
                    grabLastYaw = yaw;
                    if (d != 0) dragYaw.computeIfPresent(g, (k, v) -> v - d * DRAG_DEG_PER_DEG);
                    lastYaw = yaw; lastPitch = pitch; rotationKnown = true;
                } else if (!rotationKnown) {
                    lastYaw = yaw; lastPitch = pitch; rotationKnown = true;
                } else {
                    float dy = wrap(yaw - lastYaw);
                    float dp = pitch - lastPitch;
                    if (Math.abs(dp) > 55f) dp = 0f;
                    lastYaw = yaw;
                    lastPitch = pitch;
                    if (dy != 0 || dp != 0) {
                        cx = clamp(cx + dy * pxPerDeg, minX, maxX);
                        cy = clamp(cy + dp * pxPerDeg, minY, maxY);
                        if (cursorEntityId != -1) pos = cursorOrigin();
                    }
                    if ((!recenterPending && Math.abs(pitch) >= 35f && now - lastRecenterMs >= 160L)
                            || (Math.abs(pitch) >= 82f && now - lastRecenterMs >= 80L)) {
                        recenterPending = true;
                        recenterSentMs = now;
                        lastRecenterMs = now;
                        needRecenter = true;
                        recenterYaw = yaw;
                    }
                }
            }
        }
        if (needRecenter) {
            CameraHook.lookLevel(player, eyeX, eyeY, eyeZ, recenterYaw);
        }
        if (pos != null) {
            CameraHook.teleportEntity(player, cursorEntityId, pos.getX(), pos.getY(), pos.getZ(), cursorYaw, 0f);
        }
        if (pos != null && hoverSyncQueued.compareAndSet(false, true)) {
            Sched.entity(plugin, player, this::syncHoverAndTooltip);
        }
    }

    private void syncHoverAndTooltip() {
        hoverSyncQueued.set(false);
        if (closed) return;
        updateHover();
        updateTooltipPosition();
    }

    /** Head turned (from PlayerMoveEvent in crosshair mode, player's thread). */
    void onRotate(float yaw, float pitch) {
        if (closed) return;
        synchronized (inputLock) {
            String pg = panGrabbed;
            if (pg != null) {
                if (!panKnown) { panLastYaw = yaw; panLastPitch = pitch; panKnown = true; }
                float dy = wrap(yaw - panLastYaw);
                float dp = pitch - panLastPitch;
                panLastYaw = yaw; panLastPitch = pitch;
                if (locked) { lastYaw = yaw; lastPitch = pitch; rotationKnown = true; }
                if (dy != 0 || dp != 0) {
                    MenuDef.Element area = findScrollArea(pg);
                    if (area != null) panAreaBy(area, -dy * pxPerDeg, -dp * pxPerDeg);
                }
                return;
            }
            String g = grabbed;
            if (g != null) {
                if (!grabKnown) { grabLastYaw = yaw; grabKnown = true; }
                float d = wrap(yaw - grabLastYaw);
                grabLastYaw = yaw;
                if (d != 0) dragYaw.computeIfPresent(g, (k, v) -> v - d * DRAG_DEG_PER_DEG);
                if (locked) { lastYaw = yaw; lastPitch = pitch; rotationKnown = true; }
                return;
            }
            if (locked) {
                if (!rotationKnown) { lastYaw = yaw; lastPitch = pitch; rotationKnown = true; return; }
                float dy = wrap(yaw - lastYaw);
                float dp = pitch - lastPitch;
                lastYaw = yaw;
                lastPitch = pitch;
                if (dy == 0 && dp == 0) return;
                cx = clamp(cx + dy * pxPerDeg, minX, maxX);
                cy = clamp(cy + dp * pxPerDeg, minY, maxY);
                if (cursor != null && cursor.isValid()) cursor.teleportAsync(toLocation(cursorOrigin()));
            } else {
                // crosshair mode: where the look ray meets the panel
                double yr = Math.toRadians(yaw), pr = Math.toRadians(pitch);
                Vector dir = new Vector(-Math.sin(yr) * Math.cos(pr), -Math.sin(pr), Math.cos(yr) * Math.cos(pr));
                double along = dir.dot(f);
                if (along < 0.05) { cx = -1; cy = -1; }
                else {
                    Vector hit = cam.clone().add(dir.multiply(studio.distance / along));
                    Vector rel = hit.subtract(center);
                    cx = rel.dot(r) / s + menu.width / 2.0;
                    cy = menu.height / 2.0 - rel.dot(u) / s;
                }
            }
        }
        updateHover();
        updateTooltipPosition();
    }

    /** Mouse wheel scrolled (slot change while locked). */
    void onScroll(int dir) {
        if (closed || dir == 0) return;
        long now = System.currentTimeMillis();
        // Scroll area under cursor captures mouse wheel before page-turning
        for (int i = menu.elements.size() - 1; i >= 0; i--) {
            MenuDef.Element el = menu.elements.get(i);
            if (el.type == MenuDef.Type.SCROLL_AREA && el.contains(cx, cy)) {
                double maxSx = "vertical".equals(el.scrollMode) ? 0 : Math.max(0, el.contentW - el.w);
                double maxSy = "horizontal".equals(el.scrollMode) ? 0 : Math.max(0, el.contentH - el.h);
                if (maxSx > 0 || maxSy > 0) {
                    if (now - lastScrollMs < 40) return;
                    lastScrollMs = now;
                    if ("horizontal".equals(el.scrollMode)) panAreaBy(el, dir * el.stepPx, 0);
                    else panAreaBy(el, 0, dir * el.stepPx);
                    updateHover();
                    updateTooltipPosition();
                    return;
                }
            }
        }
        if (now - lastScrollMs < 200) return;
        lastScrollMs = now;
        String target = dir > 0 ? menu.nextPage : menu.prevPage;
        if (target == null || target.isEmpty()) return;
        MenuDef next = plugin.menu(target);
        if (next == null) return;
        Actions.playSound(player, studio.clickSound);
        switchTo(next);
    }

    private void updateHover() {
        MenuDef.Element now = hoveredButtonAt(cx, cy);
        if (now != hovered) {
            if (hovered != null) setHover(hovered, false);
            hovered = now;
            if (now != null) {
                setHover(now, true);
                String snd = !now.hoverSound.isBlank() ? now.hoverSound : studio.hoverSound;
                Actions.playSound(player, snd);
            }
        }
        MenuDef.Element tip = hoveredTooltipAt(cx, cy);
        if (tip != tooltipEl) {
            tooltipEl = tip;
            if (tip == null) {
                if (tooltipDisplay != null) { tooltipDisplay.remove(); tooltipDisplay = null; }
            } else {
                Component txt = Texts.component(plugin.resolveText(player, tip.tooltip));
                if (tooltipDisplay == null || !tooltipDisplay.isValid()) {
                    float scale = (float) (sAt((menu.elements.size() + 2) * LAYER) * 0.85 / TEXT_PX);
                    Vector pos = tooltipWorldPos();
                    tooltipDisplay = world.spawn(toLocation(pos), TextDisplay.class, d -> {
                        d.setVisibleByDefault(false);
                        d.setPersistent(false);
                        d.text(txt);
                        d.setBillboard(Display.Billboard.FIXED);
                        d.setAlignment(TextDisplay.TextAlignment.LEFT);
                        d.setDefaultBackground(false);
                        d.setBackgroundColor(Color.fromARGB(235, 16, 0, 16));
                        d.setShadowed(true);
                        d.setSeeThrough(false);
                        d.setLineWidth(220);
                        d.setBrightness(new Display.Brightness(15, 15));
                        d.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(scale, scale, scale), new AxisAngle4f()));
                        d.setTeleportDuration(1);
                    });
                    player.showEntity(plugin, tooltipDisplay);
                } else {
                    tooltipDisplay.text(txt);
                    updateTooltipPosition();
                }
            }
        }
    }

    private Vector tooltipWorldPos() {
        double tx = cx + 10;
        if (tx > maxX - 95) tx = Math.max(minX + 4, cx - 95);
        double ty = cy + 6;
        if (ty > maxY - 40) ty = Math.max(minY + 4, cy - 30);
        return world(tx, ty, (menu.elements.size() + 2) * LAYER);
    }

    private void updateTooltipPosition() {
        if (tooltipDisplay == null || !tooltipDisplay.isValid()) return;
        Location loc = toLocation(tooltipWorldPos());
        tooltipDisplay.teleportAsync(loc);
    }

    private void setCursorGrabbing(boolean on) {
        if (cursor == null || !cursor.isValid() || studio.cursorGlyph == null) return;
        cursor.text(Component.text(studio.cursorGlyph)
                .font(Key.key(studio.font))
                .color(on ? NamedTextColor.GOLD : NamedTextColor.WHITE));
    }

    private List<MenuDef.Tile> buttonTiles(MenuDef.Element e, boolean hover) {
        if (e.isToggle()) {
            boolean isOn = plugin.getToggle(player, e);
            if (isOn) return hover && e.hasHover() ? e.hoverTiles : e.tiles;
            if (hover && e.hasOffHover()) return e.offHoverTiles;
            return e.hasOffTiles() ? e.offTiles : e.tiles;
        }
        Anim a = animById.get(e.id);
        return hover && e.hasHover() ? e.hoverTiles : (!e.frames.isEmpty() && a != null ? e.frames.get(a.frame) : e.tiles);
    }

    private void setHover(MenuDef.Element e, boolean on) {
        Anim a = animById.get(e.id);
        if (a != null) a.hoverOn = on;
        List<TextDisplay> pic = pictures.get(e.id);
        if (pic != null && (e.hasHover() || e.isToggle())) {
            List<MenuDef.Tile> tiles = buttonTiles(e, on);
            for (int i = 0; i < pic.size() && i < tiles.size(); i++) pic.get(i).text(glyphComponent(tiles.get(i).glyph()));
        }
        TextDisplay lab = labels.get(e.id);
        if (lab != null && !e.hasHover()) {
            String dyn = plugin.dynamicText(player, e.id);
            String raw = dyn != null ? dyn : e.label;
            lab.text(Texts.component(plugin.resolveText(player, raw), on ? plugin.labelHoverColor() : e.labelColor));
        }
    }

    /** Attack / use key (player's thread) */
    void click() {
        if (closed) return;
        long now = System.currentTimeMillis();
        if (now - lastClick < plugin.clickCooldownMs()) return;
        lastClick = now;
        if (panGrabbed != null) {
            panGrabbed = null;
            setCursorGrabbing(false);
            Actions.playSound(player, studio.clickSound);
            return;
        }
        if (grabbed != null) {
            grabbed = null;
            setCursorGrabbing(false);
            Actions.playSound(player, studio.clickSound);
            return;      // let go of the model
        }
        MenuDef.Element b = hovered;
        if (b == null) {
            // a click on any 3D Player Model grabs it so moving the mouse turns it
            for (int i = menu.elements.size() - 1; i >= 0; i--) {
                MenuDef.Element e = menu.elements.get(i);
                if (e.type == MenuDef.Type.PLAYER_MODEL && models.containsKey(e.id) && !"spin".equals(e.turn) && containsEffective(e, cx, cy)) {
                    grabKnown = false;
                    grabbed = e.id;
                    setCursorGrabbing(true);
                    Actions.playSound(player, studio.clickSound);
                    return;
                }
                if (e.type == MenuDef.Type.SCROLL_AREA && ("pan2d".equals(e.scrollMode) || "both".equals(e.scrollMode)) && e.contains(cx, cy)) {
                    panKnown = false;
                    panGrabbed = e.id;
                    setCursorGrabbing(true);
                    Actions.playSound(player, studio.clickSound);
                    return;
                }
            }
            return;
        }
        Anim a = animById.get(b.id);
        if (a != null && b.press != null) a.pressAt = now();
        Actions.playSound(player, studio.clickSound);
        if (b.type == MenuDef.Type.INPUT) {
            plugin.beginJavaChatInput(player, menu, b);
            return;
        }
        Actions.After after = Actions.run(plugin, player, menu, b, false);
        if (after == Actions.After.CLOSE) plugin.java().close(player, MenuCloseEvent.Reason.BUTTON_CLOSE);
        else if (after == Actions.After.STAY) {
            refreshTexts();
            // console commands run on the next tick: look again so worn items / the model's outfit update
            Sched.entityLater(plugin, player, 3, () -> { if (!closed) refreshTexts(); });
        }
    }

    private static float wrap(float deg) {
        deg %= 360f;
        if (deg >= 180f) deg -= 360f;
        if (deg < -180f) deg += 360f;
        return deg;
    }

    private static double clamp(double v, double lo, double hi) { return Math.max(lo, Math.min(hi, v)); }
}
