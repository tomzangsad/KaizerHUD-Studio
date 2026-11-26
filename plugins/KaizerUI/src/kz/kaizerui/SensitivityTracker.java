package kz.kaizerui;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Estimates each player's Minecraft mouse sensitivity from the quantized pitch increments
 * their client sends during normal gameplay ({@code step = 1.2 * (0.6 * s + 0.2)^3}).
 * Default Minecraft sensitivity (100%, s = 0.5) gives a step of 0.15 degrees per count.
 */
final class SensitivityTracker {

    private static final double DEFAULT_STEP = 0.15;
    private static final int SAMPLE_CAP = 32;
    private static final int MIN_SAMPLES = 12;

    private static final class State {
        float lastPitch;
        boolean hasLast;
        final double[] deltas = new double[SAMPLE_CAP];
        int count;
        int cursor;
        volatile double detectedStep = DEFAULT_STEP;
        volatile boolean detected;
    }

    private final Map<UUID, State> states = new ConcurrentHashMap<>();

    void observe(UUID id, float pitch) {
        if (id == null) return;
        State st = states.computeIfAbsent(id, k -> new State());
        synchronized (st) {
            if (!st.hasLast) {
                st.lastPitch = pitch;
                st.hasLast = true;
                return;
            }
            double dp = Math.abs(pitch - st.lastPitch);
            st.lastPitch = pitch;
            if (dp < 0.005 || dp > 15.0) return;

            st.deltas[st.cursor] = dp;
            st.cursor = (st.cursor + 1) % SAMPLE_CAP;
            if (st.count < SAMPLE_CAP) st.count++;

            if (st.count >= MIN_SAMPLES) {
                double est = estimateStep(st);
                if (est > 0) {
                    st.detectedStep = est;
                    st.detected = true;
                }
            }
        }
    }

    private static double estimateStep(State st) {
        int n = st.count;
        double minD = Double.MAX_VALUE;
        for (int i = 0; i < n; i++) {
            if (st.deltas[i] < minD) minD = st.deltas[i];
        }
        if (minD <= 0 || minD > 1.0) return -1;

        for (int k = 1; k <= 4; k++) {
            double cand = minD / k;
            if (cand < 0.0096 || cand > 0.6144) continue;
            int matches = 0;
            for (int i = 0; i < n; i++) {
                double ratio = st.deltas[i] / cand;
                if (Math.abs(ratio - Math.round(ratio)) < 0.08) matches++;
            }
            if (matches * 100 >= n * 85) return cand;
        }
        return -1;
    }

    /** Scale factor to normalize cursor speed across client mouse sensitivities. */
    double scaleFor(UUID id) {
        State st = states.get(id);
        if (st == null || !st.detected) return 1.0;
        double scale = DEFAULT_STEP / st.detectedStep;
        return Math.max(0.25, Math.min(4.0, scale));
    }

    /** Estimated Minecraft sensitivity option percentage (0-200%), or -1 if unknown yet. */
    int detectedPercent(UUID id) {
        State st = states.get(id);
        if (st == null || !st.detected) return -1;
        // step = 1.2 * (0.6 * s + 0.2)^3 -> s = ((step / 1.2)^(1/3) - 0.2) / 0.6
        double s = (Math.cbrt(st.detectedStep / 1.2) - 0.2) / 0.6;
        return (int) Math.round(Math.max(0.0, Math.min(1.0, s)) * 200.0);
    }

    void forget(UUID id) {
        if (id != null) states.remove(id);
    }
}
