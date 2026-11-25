package com.kaizer.kaizermultibar.util;

/**
 * Utility class for BossBar text formatting and visible-length calculations.
 */
public final class TextFormatter {

    private TextFormatter() {}

    /** Length unit used to lay out the bossbar title (must match how the HUD pack slices it). */
    public enum LengthUnit {
        /** UTF-8 bytes — what Bedrock's {@code '%.Ns'} counts. */
        BYTES,
        /** Unicode code points. */
        CHARS;

        public static LengthUnit parse(String value) {
            return value != null && value.trim().equalsIgnoreCase("chars") ? CHARS : BYTES;
        }
    }

    /**
     * Pads or truncates a string to exactly {@code n} raw units (formatting codes included),
     * using '&' as invisible fill, so every section starts where the HUD pack's slices expect.
     */
    public static String padRight(String s, int n, LengthUnit unit) {
        if (s == null) s = "";
        int len = rawLength(s, unit);
        if (len > n) {
            return truncateRaw(s, n, unit);
        }
        StringBuilder sb = new StringBuilder(s);
        for (; len < n; len++) {
            sb.append('&');
        }
        return sb.toString();
    }

    /** Raw length of {@code s} in {@code unit}, counting '§' codes like any other character. */
    public static int rawLength(String s, LengthUnit unit) {
        if (s == null || s.isEmpty()) return 0;
        if (unit == LengthUnit.CHARS) return s.codePointCount(0, s.length());
        int bytes = 0;
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            bytes += utf8Length(cp);
            i += Character.charCount(cp);
        }
        return bytes;
    }

    /**
     * Cuts {@code s} to at most {@code max} raw units, without splitting a character and without
     * leaving a dangling '§' whose code character was cut off. Pads the remainder with '&'.
     */
    public static String truncateRaw(String s, int max, LengthUnit unit) {
        StringBuilder out = new StringBuilder();
        int used = 0;
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            int step = Character.charCount(cp);
            int size = unit == LengthUnit.CHARS ? 1 : utf8Length(cp);
            if (cp == '§' && i + step < s.length()) {
                int code = s.codePointAt(i + step);
                int pair = size + (unit == LengthUnit.CHARS ? 1 : utf8Length(code));
                if (used + pair > max) break;
                out.appendCodePoint(cp).appendCodePoint(code);
                used += pair;
                i += step + Character.charCount(code);
                continue;
            }
            if (used + size > max) break;
            out.appendCodePoint(cp);
            used += size;
            i += step;
        }
        for (; used < max; used++) {
            out.append('&');
        }
        return out.toString();
    }

    private static int utf8Length(int cp) {
        if (cp < 0x80) return 1;
        if (cp < 0x800) return 2;
        if (cp < 0x10000) return 3;
        return 4;
    }

    /**
     * Converts '&' color codes to '§' color codes (both legacy and invisible markers).
     */
    public static String format(String text) {
        if (text == null || text.isEmpty()) return "";
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '&' && i + 1 < text.length()) {
                char next = text.charAt(i + 1);
                if (isInvisibleMarkerCode(next) || isLegacyColorCode(next)) {
                    result.append('§').append(Character.toLowerCase(next));
                    i++;
                    continue;
                }
            }
            result.append(c);
        }
        return result.toString();
    }

    /**
     * Returns the number of visible (non-formatting) characters in the string.
     */
    public static int getVisibleLength(String text) {
        if (text == null || text.isEmpty()) return 0;
        int count = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '§' && i + 1 < text.length()) {
                i++;
                continue;
            }
            if (c == '&' && i + 1 < text.length()) {
                char next = text.charAt(i + 1);
                if (isInvisibleMarkerCode(next) || isLegacyColorCode(next)) {
                    i++;
                    continue;
                }
            }
            count++;
        }
        return count;
    }

    /**
     * Truncates a string to a maximum number of visible characters, preserving formatting codes.
     */
    public static String truncateVisible(String text, int maxLen) {
        if (text == null || text.isEmpty() || maxLen <= 0) return "";
        StringBuilder result = new StringBuilder();
        int visible = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '§' && i + 1 < text.length()) {
                result.append(c).append(text.charAt(i + 1));
                i++;
                continue;
            }
            if (c == '&' && i + 1 < text.length()) {
                char next = text.charAt(i + 1);
                if (isInvisibleMarkerCode(next) || isLegacyColorCode(next)) {
                    result.append('§').append(Character.toLowerCase(next));
                    i++;
                    continue;
                }
            }
            if (visible >= maxLen) break;
            result.append(c);
            visible++;
        }
        return result.toString();
    }

    public static boolean isLegacyColorCode(char code) {
        char n = Character.toLowerCase(code);
        return (n >= '0' && n <= '9') || (n >= 'a' && n <= 'f')
                || (n >= 'k' && n <= 'o') || n == 'r' || n == 'x';
    }

    public static boolean isInvisibleMarkerCode(char code) {
        char n = Character.toLowerCase(code);
        return n == 'z' || n == 'y' || n == 'w' || n == 'v';
    }
}
