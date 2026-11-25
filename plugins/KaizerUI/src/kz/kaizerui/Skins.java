package kz.kaizerui;

import com.destroystokyo.paper.profile.PlayerProfile;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.profile.PlayerTextures;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Player Head / Player Model on Java: the skin drawn as text, one coloured 1 px glyph per skin
 * pixel — the way BetterHud / MythicHUD draw heads for the HUD.
 * <p>
 * Font {@code <ns>:kz_skin} (written by GUI Studio): row r of the picture is U+E000 + r, a 1 × 1
 * white pixel with ascent 1 - r, so all rows sit in one line; each pixel glyph advances 2, so
 * it is followed by a -1 space. Rows are joined by stepping back the picture width.
 * The text block (text px, origin = entity): x from 1 - W/2 to 1 + W/2, row 0 top 4 px above.
 */
final class Skins {
    private Skins() {}

    static final int ROW0 = 0xE000;
    static final char BACK1 = '', BACK8 = '', BACK16 = '', GAP = '';

    /** Skin picture (64 × 64, or 64 × 32 for old skins) and its arm width */
    record Skin(BufferedImage img, boolean slim) {}

    private static final long KEEP_MS = 10 * 60_000L, RETRY_MS = 60_000L;
    private record Entry(Skin skin, long at) {}
    private static final Map<String, Entry> CACHE = new ConcurrentHashMap<>();
    private static final Map<String, List<Consumer<Skin>>> LOADING = new ConcurrentHashMap<>();

    static void clear() { CACHE.clear(); }

    /** The skin if it is known (null = not loaded yet, or the player has none → draw Steve) */
    static Skin cached(String name) {
        Entry e = CACHE.get(key(name));
        return e == null ? null : e.skin;
    }

    static boolean fresh(String name) {
        Entry e = CACHE.get(key(name));
        if (e == null) return false;
        return System.currentTimeMillis() - e.at < (e.skin == null ? RETRY_MS : KEEP_MS);
    }

    private static String key(String name) { return name == null ? "" : name.trim().toLowerCase(Locale.ROOT); }

    /**
     * Loads the skin of a player name in the background (online players: their own profile,
     * anyone else: looked up at Mojang). {@code done} runs on an async thread; skin null = none.
     */
    static void load(Plugin plugin, String name, Consumer<Skin> done) {
        String k = key(name);
        if (k.isEmpty() || !k.matches("[a-z0-9_.*\\-]{1,32}")) { done.accept(null); return; }
        if (fresh(name)) { done.accept(cached(name)); return; }
        List<Consumer<Skin>> wait = LOADING.computeIfAbsent(k, x -> new ArrayList<>());
        boolean first;
        synchronized (wait) { first = wait.isEmpty(); wait.add(done); }
        if (!first) return;
        Player online = Bukkit.getPlayerExact(name.trim());
        PlayerProfile profile = online != null ? online.getPlayerProfile() : Bukkit.createProfile(name.trim());
        Bukkit.getAsyncScheduler().runNow(plugin, t -> {
            Skin skin = null;
            try {
                if (!profile.hasTextures()) profile.complete(true);
                PlayerTextures tx = profile.getTextures();
                URL url = tx.getSkin();
                if (url != null) {
                    BufferedImage img = ImageIO.read(url);
                    if (img != null && img.getWidth() == 64 && (img.getHeight() == 64 || img.getHeight() == 32)) {
                        skin = new Skin(img, tx.getSkinModel() == PlayerTextures.SkinModel.SLIM);
                    }
                }
            } catch (Throwable ex) {
                plugin.getLogger().fine("Skin of " + name + " could not be loaded: " + ex);
            }
            CACHE.put(k, new Entry(skin, System.currentTimeMillis()));
            List<Consumer<Skin>> list = LOADING.remove(k);
            if (list != null) {
                List<Consumer<Skin>> copy;
                synchronized (list) { copy = new ArrayList<>(list); }
                for (Consumer<Skin> c : copy) {
                    try { c.accept(skin); } catch (Throwable ignored) {}
                }
            }
        });
    }

    /* ───────────── pixels (ARGB, alpha 0 = empty) ───────────── */

    /** Front of the head, 8 × 8 */
    static int[][] head(Skin s, boolean hat) {
        if (s == null) return steveHead();
        int[][] g = new int[8][8];
        part(g, s.img, 8, 8, 8, 8, 0, 0, false, true);
        if (hat) part(g, s.img, 40, 8, 8, 8, 0, 0, false, false);
        return g;
    }

    /** The whole player from the front, 16 × 32 (arms 3 px wide on slim skins) */
    static int[][] body(Skin s, boolean hat) {
        if (s == null) return steveBody();
        int[][] g = new int[32][16];
        BufferedImage im = s.img;
        boolean legacy = im.getHeight() == 32;
        int aw = s.slim ? 3 : 4;
        part(g, im, 8, 8, 8, 8, 4, 0, false, true);            // head
        part(g, im, 20, 20, 8, 12, 4, 8, false, true);         // body
        part(g, im, 44, 20, aw, 12, 4 - aw, 8, false, true);   // right arm (left on screen)
        part(g, im, 4, 20, 4, 12, 4, 20, false, true);         // right leg
        if (legacy) {
            part(g, im, 44, 20, aw, 12, 12, 8, true, true);    // old skins: left = mirrored right
            part(g, im, 4, 20, 4, 12, 8, 20, true, true);
        } else {
            part(g, im, 36, 52, aw, 12, 12, 8, false, true);   // left arm
            part(g, im, 20, 52, 4, 12, 8, 20, false, true);    // left leg
        }
        if (hat) {
            part(g, im, 40, 8, 8, 8, 4, 0, false, false);
            if (!legacy) {
                part(g, im, 20, 36, 8, 12, 4, 8, false, false);
                part(g, im, 44, 36, aw, 12, 4 - aw, 8, false, false);
                part(g, im, 52, 52, aw, 12, 12, 8, false, false);
                part(g, im, 4, 36, 4, 12, 4, 20, false, false);
                part(g, im, 4, 52, 4, 12, 8, 20, false, false);
            }
        }
        return g;
    }

    /** Copies a w×h piece of the skin at (u, v) to the grid at (x, y); base layer = solid, overlay = blended */
    private static void part(int[][] g, BufferedImage im, int u, int v, int w, int h, int x, int y, boolean mirror, boolean base) {
        for (int j = 0; j < h; j++) {
            for (int i = 0; i < w; i++) {
                int su = u + (mirror ? w - 1 - i : i), sv = v + j;
                if (su >= im.getWidth() || sv >= im.getHeight()) continue;
                int c = im.getRGB(su, sv);
                int a = c >>> 24;
                if (base) {
                    g[y + j][x + i] = a == 0 ? 0 : (0xFF000000 | (c & 0xFFFFFF));
                } else if (a > 0) {
                    int d = g[y + j][x + i];
                    if ((d >>> 24) == 0 || a == 255) g[y + j][x + i] = 0xFF000000 | (c & 0xFFFFFF);
                    else g[y + j][x + i] = 0xFF000000 | mix(d, c, a / 255.0);
                }
            }
        }
    }

    private static int mix(int under, int over, double k) {
        int r = (int) Math.round(((over >> 16) & 255) * k + ((under >> 16) & 255) * (1 - k));
        int gg = (int) Math.round(((over >> 8) & 255) * k + ((under >> 8) & 255) * (1 - k));
        int b = (int) Math.round((over & 255) * k + (under & 255) * (1 - k));
        return (r << 16) | (gg << 8) | b;
    }

    /* ───────────── text ───────────── */

    /** The picture as text in the skin font (rows from top to bottom, ≤ 32 rows) */
    static Component text(int[][] g, Key font) {
        int rows = Math.min(32, g.length), w = g[0].length;
        TextComponent.Builder out = Component.text().font(font).color(NamedTextColor.WHITE);
        StringBuilder run = new StringBuilder();
        int runColor = -1;
        for (int r = 0; r < rows; r++) {
            char px = (char) (ROW0 + r);
            for (int x = 0; x < w; x++) {
                int c = g[r][x];
                int col = (c >>> 24) == 0 ? -2 : c & 0xFFFFFF;
                if (col != runColor && run.length() > 0) { flush(out, run, runColor); }
                runColor = col;
                if (col == -2) run.append(GAP);
                else run.append(px).append(BACK1);
            }
            if (r < rows - 1) {
                if (run.length() > 0) flush(out, run, runColor);
                runColor = -2;
                // back to the start of the picture for the next row
                int back = w;
                while (back >= 16) { run.append(BACK16); back -= 16; }
                while (back >= 8) { run.append(BACK8); back -= 8; }
                while (back-- > 0) run.append(BACK1);
            }
        }
        if (run.length() > 0) flush(out, run, runColor);
        return out.build();
    }

    private static void flush(TextComponent.Builder out, StringBuilder run, int color) {
        out.append(color < 0 ? Component.text(run.toString()) : Component.text(run.toString(), TextColor.color(color)));
        run.setLength(0);
    }

    /* ───────────── Steve (until the skin is known, or when there is none) ───────────── */

    private static final int[] STEVE_FACE = {
        0x5B5348, 0x5B5247, 0x605548, 0x605449, 0x605449, 0x605449, 0x5A4F42, 0x534A3F,
        0x5B5244, 0x645749, 0xA97557, 0xA77455, 0xA97456, 0xA57457, 0x564839, 0x5E554F,
        0x655548, 0xAA785A, 0xB67A5A, 0xCA9074, 0xBE8268, 0xAF785B, 0x9A6C52, 0x695E59,
        0x634C3A, 0x5F4633, 0x694D3A, 0xBC8265, 0xAB7556, 0x594333, 0x513A2D, 0x524237,
        0x865746, 0xCCB7AC, 0x2E2C35, 0xBB8168, 0xB9836A, 0x303239, 0xD0B8AC, 0x916551,
        0xA16B51, 0xB07B60, 0xB17B5D, 0xC99274, 0xB47E61, 0xA87559, 0x9F6D50, 0xA57058,
        0xA87457, 0xB27C5E, 0xB27D61, 0xA16F51, 0x9B6A4E, 0xAA7656, 0xAE795D, 0xAF7D63,
        0x9C6D53, 0xA8775C, 0xB07D5F, 0xAC795B, 0xAC795B, 0xB17D60, 0xAD7A5B, 0xA0745D
    };

    static int[][] steveHead() {
        int[][] g = new int[8][8];
        for (int i = 0; i < 64; i++) g[i / 8][i % 8] = 0xFF000000 | STEVE_FACE[i];
        return g;
    }

    /** Same colours as GUI Studio's stand-in picture (img/player_model.png) */
    static int[][] steveBody() {
        int[][] g = new int[32][16];
        int[][] h = steveHead();
        for (int y = 0; y < 8; y++) System.arraycopy(h[y], 0, g[y], 4, 8);
        int shirt = 0xFF13A3A8, shirtD = 0xFF0E8085, skin = 0xFFC39167, skinD = 0xFFAA7A54, pants = 0xFF3F3AA6, pantsD = 0xFF302C82, shoe = 0xFF55555F;
        for (int y = 8; y < 20; y++) for (int x = 0; x < 16; x++) {
            int c;
            if (x < 4 || x >= 12) c = (x == 3 || x == 15) ? (y < 11 ? shirtD : skinD) : (y < 11 ? shirt : skin);
            else c = x == 11 ? shirtD : shirt;
            g[y][x] = c;
        }
        for (int y = 20; y < 32; y++) for (int x = 4; x < 12; x++) g[y][x] = y >= 30 ? shoe : (x == 7 || x == 11 ? pantsD : pants);
        return g;
    }
}
