package kz.kaizerui;

/** Approximate width of text in the vanilla default font (GUI px), used to align texts left / right. */
final class Fonts {
    private Fonts() {}

    static double width(String s) {
        if (s == null) return 0;
        double w = 0;
        boolean bold = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if ((c == '&' || c == '§') && i + 1 < s.length()) {
                char k = Character.toLowerCase(s.charAt(i + 1));
                if (k == '#' && i + 7 < s.length()) { i += 7; continue; }
                if ("0123456789abcdefr".indexOf(k) >= 0) { bold = false; i++; continue; }
                if (k == 'l') { bold = true; i++; continue; }
                if ("kmno".indexOf(k) >= 0) { i++; continue; }
            }
            w += advance(c) + (bold ? 1 : 0);
        }
        return Math.max(0, w - 1); // the last character's 1 px gap is not drawn
    }

    private static int advance(char c) {
        switch (c) {
            case 'i': case '!': case '.': case ',': case ':': case ';': case '|': case '\'': return 2;
            case 'l': case '`': return 3;
            case 'I': case 't': case ' ': case '[': case ']': return 4;
            case 'f': case 'k': case '(': case ')': case '{': case '}': case '<': case '>': case '"': case '*': return 5;
            case '@': case '~': return 7;
            default: return c < 128 ? 6 : 8;
        }
    }
}
