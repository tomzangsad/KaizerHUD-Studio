package kz.kaizerui;

import org.bukkit.configuration.ConfigurationSection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Animations written by GUI Studio (GS.Motion presets, already expanded into keyframes).
 *
 * <p>A clip: {@code {length, delay, loop, pivot: [px, py], tracks: {name: [[t, value, ease], ...]}}}.
 * Tracks: x, y (GUI px, y down) · scale, sx, sy, alpha (%) · rot (degrees, clockwise). The ease of
 * a key shapes the way to the next key — the same rules as gs_motion.js, so the game plays what
 * the editor preview showed.</p>
 */
final class Motion {

    static final String[] TRACKS = {"x", "y", "scale", "sx", "sy", "rot", "alpha"};
    static final int X = 0, Y = 1, SCALE = 2, SX = 3, SY = 4, ROT = 5, ALPHA = 6;
    private static final double[] REST = {0, 0, 100, 100, 100, 0, 100};

    private Motion() {}

    static double[] rest() { return REST.clone(); }

    /** One animation clip */
    static final class Clip {
        final double length, delay;
        final boolean loop;
        final double px, py;
        final double[][] times = new double[TRACKS.length][];
        final double[][] values = new double[TRACKS.length][];
        final String[][] eases = new String[TRACKS.length][];

        private Clip(Map<?, ?> m) {
            this.length = Math.max(0, MenuDef.dbl(m.get("length"), 0));
            this.delay = Math.max(0, MenuDef.dbl(m.get("delay"), 0));
            this.loop = MenuDef.bool(m.get("loop"), false);
            double ppx = 0.5, ppy = 0.5;
            if (m.get("pivot") instanceof List<?> pv && pv.size() == 2) {
                ppx = MenuDef.dbl(pv.get(0), 0.5);
                ppy = MenuDef.dbl(pv.get(1), 0.5);
            }
            this.px = ppx;
            this.py = ppy;
            Map<?, ?> tr = m.get("tracks") instanceof Map<?, ?> t ? t : Map.of();
            for (int i = 0; i < TRACKS.length; i++) {
                if (!(tr.get(TRACKS[i]) instanceof List<?> keys) || keys.isEmpty()) continue;
                List<double[]> tv = new ArrayList<>();
                List<String> te = new ArrayList<>();
                for (Object k : keys) {
                    if (!(k instanceof List<?> key) || key.size() < 2) continue;
                    tv.add(new double[]{MenuDef.dbl(key.get(0), 0), MenuDef.dbl(key.get(1), REST[i])});
                    te.add(key.size() > 2 && key.get(2) != null ? key.get(2).toString() : "linear");
                }
                if (tv.isEmpty()) continue;
                times[i] = new double[tv.size()];
                values[i] = new double[tv.size()];
                eases[i] = te.toArray(new String[0]);
                for (int j = 0; j < tv.size(); j++) { times[i][j] = tv.get(j)[0]; values[i][j] = tv.get(j)[1]; }
            }
        }

        /** Values at t seconds after the clip was started (its delay included) */
        double[] sample(double t) {
            double[] st = rest();
            double tt = Math.max(0, t - delay);
            if (loop && length > 0) tt %= length;
            for (int i = 0; i < TRACKS.length; i++) if (times[i] != null) st[i] = valueAt(i, tt);
            return st;
        }

        boolean finished(double t) { return !loop && t >= delay + length; }

        private double valueAt(int i, double t) {
            double[] ts = times[i], vs = values[i];
            if (t <= ts[0]) return vs[0];
            int n = ts.length;
            if (t >= ts[n - 1]) return vs[n - 1];
            int k = 0;
            while (k < n - 2 && ts[k + 1] <= t) k++;
            double span = ts[k + 1] - ts[k];
            return vs[k] + (vs[k + 1] - vs[k]) * ease(eases[i][k], span > 0 ? (t - ts[k]) / span : 1);
        }
    }

    /** Hover: the state a button moves to while the cursor is on it, in {@code length} seconds */
    static final class Hover {
        final double length;
        final double[] target = rest();

        private Hover(Map<?, ?> m) {
            this.length = Math.max(0, MenuDef.dbl(m.get("length"), 0.12));
            if (m.get("state") instanceof Map<?, ?> st) {
                for (int i = 0; i < TRACKS.length; i++) if (st.get(TRACKS[i]) != null) target[i] = MenuDef.dbl(st.get(TRACKS[i]), REST[i]);
            }
        }

        double[] at(double w) {
            double e = ease("out", w);
            double[] o = new double[TRACKS.length];
            for (int i = 0; i < o.length; i++) o[i] = REST[i] + (target[i] - REST[i]) * e;
            return o;
        }
    }

    static Clip clip(Object o) {
        Map<?, ?> m = map(o);
        return m == null ? null : new Clip(m);
    }

    static Hover hover(Object o) {
        Map<?, ?> m = map(o);
        return m == null ? null : new Hover(m);
    }

    /** a then b: moves and turns add up, sizes and opacity multiply */
    static double[] combine(double[] a, double[] b) {
        return new double[]{
                a[X] + b[X], a[Y] + b[Y],
                a[SCALE] * b[SCALE] / 100, a[SX] * b[SX] / 100, a[SY] * b[SY] / 100,
                a[ROT] + b[ROT],
                a[ALPHA] * b[ALPHA] / 100
        };
    }

    static boolean same(double[] a, double[] b) {
        if (a == null || b == null) return false;
        for (int i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-3) return false;
        return true;
    }

    static double ease(String name, double t) {
        t = Math.max(0, Math.min(1, t));
        return switch (name == null ? "linear" : name) {
            case "in" -> t * t;
            case "out" -> t * (2 - t);
            case "inout" -> t * t * (3 - 2 * t);
            case "back" -> 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
            case "bounce" -> bounceOut(t);
            case "elastic" -> t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
            case "steps" -> Math.floor(t * 4) / 4;
            case "hold" -> t >= 1 ? 1 : 0;
            default -> t;
        };
    }

    private static double bounceOut(double t) {
        double n = 7.5625, d = 2.75;
        if (t < 1 / d) return n * t * t;
        if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
        if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
        t -= 2.625 / d;
        return n * t * t + 0.984375;
    }

    /** YAML map (a plain Map inside element lists, a ConfigurationSection at the top level) → Map */
    static Map<?, ?> map(Object o) {
        if (o instanceof Map<?, ?> m) return m;
        if (o instanceof ConfigurationSection s) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (String k : s.getKeys(false)) {
                Object v = s.get(k);
                out.put(k, v instanceof ConfigurationSection ? map(v) : v);
            }
            return out;
        }
        return null;
    }
}
