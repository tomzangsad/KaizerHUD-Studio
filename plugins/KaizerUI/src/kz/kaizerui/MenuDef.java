package kz.kaizerui;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * One menu page, read from plugins/KaizerUI/menus/&lt;id&gt;.yml (written by GUI Studio).
 * Coordinates are GUI pixels with (0, 0) at the menu's top-left corner.
 */
public final class MenuDef {

    public enum Type { IMAGE, BUTTON, TEXT, PLAYER_HEAD, PLAYER_MODEL, ITEM }

    /**
     * One glyph of a picture. Pictures bigger than 256 px are split into tiles because the
     * client's font atlas is 256×256 (a bigger glyph shows as a "missing" box).
     * x, y are relative to the element's top-left corner.
     */
    public record Tile(int x, int y, int w, int h, String glyph, int ascent) {}

    static List<Tile> tiles(Map<?, ?> m, String listKey, String glyphKey, int w, int h) {
        List<Tile> out = new ArrayList<>();
        if (m.get(listKey) instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> t)) continue;
                String g = blankToNull(str(t.get("glyph"), null));
                if (g == null) continue;
                int th = Math.max(1, num(t.get("h"), 1));
                out.add(new Tile(num(t.get("x"), 0), num(t.get("y"), 0), Math.max(1, num(t.get("w"), 1)), th, g, num(t.get("ascent"), Math.min(7, th))));
            }
        } else {
            String g = blankToNull(str(m.get(glyphKey), null));
            if (g != null) out.add(new Tile(0, 0, w, h, g, num(m.get(glyphKey + "-ascent"), Math.min(7, h))));
        }
        return Collections.unmodifiableList(out);
    }

    /** One element of a menu, in drawing order (first = bottom). */
    public static final class Element {
        public final String id;
        public final Type type;
        public final String name;
        public final int x, y, w, h;
        /** Java font glyphs of the picture (empty = no picture) and of the hover picture */
        public final List<Tile> tiles;
        public final List<Tile> hoverTiles;
        // button
        public final String label;
        public final String labelColor;
        public final double labelScale;
        public final boolean labelShadow;
        public final boolean closeOnClick;
        public final String hoverSound;
        public final List<String> actions;
        // text
        public final String text;
        public final String color;
        public final double scale;
        public final boolean shadow;
        public final String align;
        // player head / model: whose skin (placeholders allowed) and the hat / jacket layer
        public final String player;
        public final boolean hat;
        // player model on Java: real 3D player (Mannequin) or flat pixels; outfit, pose, turning
        public final boolean java3d;
        public final boolean outfit;
        public final boolean crouch;
        public final String turn;
        public final double angle, spinSpeed;
        // item: id (minecraft:x, itemsadder:ns:id, nexo:id, slot:head…), glint, flat / 3d, spin
        public final String item;
        public final boolean glint, item3d, spin;
        /** Index of this element among the Bedrock form buttons (-1 = not a form button) */
        public final int bedrockSlot;
        /** Optional hover tooltip text (Java) */
        public final String tooltip;
        /** Animated picture: every frame laid out like {@link #tiles} (empty = still picture) */
        public final List<List<Tile>> frames;
        public final double fps;
        /** Motion (null = none): entrance, repeating loop, hover state and click */
        public final Motion.Clip intro, loop, press;
        public final Motion.Hover hover;

        Element(Map<?, ?> m) {
            this.id = str(m.get("id"), "");
            this.type = switch (str(m.get("type"), "image").toLowerCase()) {
                case "button" -> Type.BUTTON;
                case "text" -> Type.TEXT;
                case "player_head" -> Type.PLAYER_HEAD;
                case "player_model" -> Type.PLAYER_MODEL;
                case "item" -> Type.ITEM;
                default -> Type.IMAGE;
            };
            this.name = str(m.get("name"), id);
            this.x = num(m.get("x"), 0);
            this.y = num(m.get("y"), 0);
            this.w = Math.max(1, num(m.get("w"), 1));
            this.h = Math.max(1, num(m.get("h"), 1));
            this.tiles = tiles(m, "tiles", "glyph", w, h);
            List<Tile> hov = tiles(m, "hover-tiles", "hover-glyph", w, h);
            // hover tiles must line up with the normal ones to be swapped one by one
            this.hoverTiles = hov.size() == tiles.size() ? hov : List.of();
            this.label = str(m.get("label"), "");
            this.labelColor = str(m.get("label-color"), "#ffffff");
            this.labelScale = dbl(m.get("label-scale"), 1.0);
            this.labelShadow = bool(m.get("label-shadow"), true);
            this.closeOnClick = bool(m.get("close-on-click"), false);
            this.hoverSound = str(m.get("hover-sound"), "");
            List<String> acts = new ArrayList<>();
            if (m.get("actions") instanceof List<?> list) for (Object o : list) if (o != null && !o.toString().isBlank()) acts.add(o.toString().trim());
            this.actions = Collections.unmodifiableList(acts);
            this.text = str(m.get("text"), "");
            this.color = str(m.get("color"), "#ffffff");
            this.scale = dbl(m.get("scale"), 1.0);
            this.shadow = bool(m.get("shadow"), true);
            this.align = str(m.get("align"), "center");
            this.player = str(m.get("player"), "%player_name%");
            this.hat = bool(m.get("hat"), true);
            this.java3d = bool(m.get("java-3d"), true);
            this.outfit = !"none".equalsIgnoreCase(str(m.get("outfit"), "own"));
            this.crouch = "crouching".equalsIgnoreCase(str(m.get("pose"), "standing"));
            this.turn = str(m.get("turn"), "none").toLowerCase(java.util.Locale.ROOT);
            this.angle = dbl(m.get("angle"), 0);
            this.spinSpeed = Math.max(1, Math.min(720, dbl(m.get("spin-speed"), 45)));
            this.item = str(m.get("item"), "");
            this.glint = bool(m.get("glint"), false);
            this.item3d = "3d".equalsIgnoreCase(str(m.get("look"), "flat"));
            this.spin = bool(m.get("spin"), false);
            this.bedrockSlot = num(m.get("bedrock-slot"), -1);
            this.tooltip = str(m.get("tooltip"), "");
            List<List<Tile>> fr = new ArrayList<>();
            if (m.get("frames") instanceof List<?> list) {
                for (Object o : list) {
                    if (!(o instanceof List<?> one)) continue;
                    List<Tile> ts = tiles(Map.of("tiles", one), "tiles", "glyph", w, h);
                    // every frame must line up with the still picture to be swapped tile by tile
                    if (ts.size() == tiles.size() && !ts.isEmpty()) fr.add(ts);
                }
            }
            this.frames = fr.size() > 1 ? Collections.unmodifiableList(fr) : List.of();
            this.fps = Math.max(1, Math.min(20, dbl(m.get("fps"), 8)));
            Map<?, ?> mo = Motion.map(m.get("motion"));
            this.intro = mo == null ? null : Motion.clip(mo.get("intro"));
            this.loop = mo == null ? null : Motion.clip(mo.get("loop"));
            this.press = mo == null ? null : Motion.clip(mo.get("press"));
            this.hover = mo == null ? null : Motion.hover(mo.get("hover"));
        }

        public boolean isPlayer() { return type == Type.PLAYER_HEAD || type == Type.PLAYER_MODEL; }

        public boolean hasHover() { return !hoverTiles.isEmpty(); }

        public boolean animated() { return intro != null || loop != null || press != null || hover != null || !frames.isEmpty(); }

        public boolean contains(double px, double py) {
            return px >= x && py >= y && px < x + w && py < y + h;
        }
    }

    public final String id;
    public final String title;
    public final String command;
    public final int width, height;
    public final int refreshTicks;
    public final String openSound;
    public final String bedrockTitle;
    public final int bedrockSlots;
    /** Java: size the menu to (almost) the whole screen and dim everything around it */
    public final boolean fullscreen;
    public final String backdrop;
    public final double backdropAlpha;
    public final String nextPage, prevPage;
    /** Opening animation of the whole page (null = appears at once) */
    public final Motion.Clip open;
    public final List<Element> elements;

    private MenuDef(YamlConfiguration y, String fallbackId) {
        this.id = y.getString("id", fallbackId);
        this.title = y.getString("title", id);
        this.command = y.getString("command", "").trim().replaceFirst("^/", "");
        this.width = Math.max(1, y.getInt("width", 320));
        this.height = Math.max(1, y.getInt("height", 180));
        this.refreshTicks = Math.max(0, y.getInt("refresh-ticks", 20));
        this.openSound = y.getString("open-sound", "");
        this.bedrockTitle = y.getString("bedrock-title", "kz::" + id + "|" + title);
        this.bedrockSlots = y.getInt("bedrock-slots", 0);
        this.fullscreen = y.getBoolean("fullscreen", false);
        this.backdrop = y.getString("backdrop", "#000000");
        this.backdropAlpha = Math.max(0, Math.min(1, y.getDouble("backdrop-alpha", 0.6)));
        this.nextPage = y.getString("next-page", "").trim();
        this.prevPage = y.getString("prev-page", "").trim();
        Map<?, ?> mo = Motion.map(y.get("motion"));
        this.open = mo == null ? null : Motion.clip(mo.get("open"));
        List<Element> els = new ArrayList<>();
        for (Map<?, ?> m : y.getMapList("elements")) els.add(new Element(m));
        this.elements = Collections.unmodifiableList(els);
    }

    public static MenuDef load(File file) {
        YamlConfiguration y = YamlConfiguration.loadConfiguration(file);
        String fallback = file.getName().replaceFirst("\\.ya?ml$", "");
        return new MenuDef(y, fallback);
    }

    /** Topmost button under (px, py), or null */
    public Element buttonAt(double px, double py) {
        for (int i = elements.size() - 1; i >= 0; i--) {
            Element e = elements.get(i);
            if (e.type == Type.BUTTON && e.contains(px, py)) return e;
        }
        return null;
    }

    /** Topmost element with a non-blank tooltip under (px, py), or null */
    public Element tooltipAt(double px, double py) {
        for (int i = elements.size() - 1; i >= 0; i--) {
            Element e = elements.get(i);
            if (!e.tooltip.isBlank() && e.contains(px, py)) return e;
        }
        return null;
    }

    public Element bySlot(int slot) {
        for (Element e : elements) if (e.bedrockSlot == slot) return e;
        return null;
    }

    /* ── small YAML helpers ── */

    static String str(Object o, String def) { return o == null ? def : o.toString(); }

    static String blankToNull(String s) { return s == null || s.isEmpty() ? null : s; }

    static int num(Object o, int def) {
        if (o instanceof Number n) return (int) Math.round(n.doubleValue());
        try { return o == null ? def : (int) Math.round(Double.parseDouble(o.toString())); } catch (NumberFormatException e) { return def; }
    }

    static double dbl(Object o, double def) {
        if (o instanceof Number n) return n.doubleValue();
        try { return o == null ? def : Double.parseDouble(o.toString()); } catch (NumberFormatException e) { return def; }
    }

    static boolean bool(Object o, boolean def) {
        if (o instanceof Boolean b) return b;
        return o == null ? def : Boolean.parseBoolean(o.toString());
    }

    /** Settings GUI Studio writes to studio.yml */
    public static final class Studio {
        public final String font;
        /** Font of Player Head / Model pixels (see {@link Skins}) */
        public final String skinFont;
        public final String cursorGlyph;
        public final int cursorAscent, cursorW, cursorH, hotX, hotY;
        public final boolean cameraLock, exitOnSneak;
        public final double distance, fill, sensitivity;
        public final String clickSound, hoverSound;
        public final int packVersion;

        public Studio(YamlConfiguration y) {
            this.font = y.getString("font", y.getString("namespace", "kaizerui") + ":gui");
            this.skinFont = y.getString("skin-font", y.getString("namespace", "kaizerui") + ":kz_skin");
            ConfigurationSection c = y.getConfigurationSection("cursor");
            this.cursorGlyph = c == null ? null : blankToNull(c.getString("glyph", null));
            this.cursorAscent = c == null ? 7 : c.getInt("glyph-ascent", 7);
            this.cursorW = c == null ? 8 : c.getInt("width", 8);
            this.cursorH = c == null ? 12 : c.getInt("height", 12);
            this.hotX = c == null ? 0 : c.getInt("hot-x", 0);
            this.hotY = c == null ? 0 : c.getInt("hot-y", 0);
            this.cameraLock = y.getBoolean("java.camera-lock", true);
            this.exitOnSneak = y.getBoolean("java.exit-on-sneak", true);
            this.distance = Math.max(0.3, y.getDouble("java.distance", 1.2));
            this.fill = Math.min(1.0, Math.max(0.1, y.getDouble("java.fill", 0.85)));
            this.sensitivity = Math.max(0.05, y.getDouble("java.sensitivity", 1.0));
            this.clickSound = y.getString("sounds.click", "minecraft:ui.button.click");
            this.hoverSound = y.getString("sounds.hover", "");
            this.packVersion = y.getInt("pack-version", 0);
        }
    }
}
