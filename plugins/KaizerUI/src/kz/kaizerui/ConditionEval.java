package kz.kaizerui;

import org.bukkit.entity.Player;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Evaluates PlaceholderAPI visibility conditions (element show/hide) and click requirements
 * ({@code require:<expr> | <denyMessage>}) uniformly across Java &amp; Bedrock menus.
 */
final class ConditionEval {
    private static final Pattern EXPR_PAT = Pattern.compile(
            "^(.*?)\\s*(>=|<=|==|!=|!contains|contains|starts|ends|>|<|=)\\s*(.*)$",
            Pattern.CASE_INSENSITIVE
    );

    private ConditionEval() {}

    static boolean all(KaizerUIPlugin plugin, Player p, List<MenuDef.Condition> list) {
        if (list == null || list.isEmpty()) return true;
        for (MenuDef.Condition c : list) {
            if (!evalCondition(plugin, p, c)) return false;
        }
        return true;
    }

    static boolean evalCondition(KaizerUIPlugin plugin, Player p, MenuDef.Condition c) {
        if (c == null || c.papi().isEmpty()) return true;
        String op = c.op().toLowerCase(Locale.ROOT);
        boolean res;
        if ("perm".equals(op) || "permission".equals(op)) {
            res = p != null && p.hasPermission(plugin.resolveText(p, c.papi()).trim());
        } else {
            String left = plugin.resolveText(p, c.papi()).trim();
            String right = plugin.resolveText(p, c.value()).trim();
            res = compare(left, op, right);
        }
        return c.invert() ? !res : res;
    }

    static boolean evalExpr(KaizerUIPlugin plugin, Player p, String expr) {
        if (expr == null || expr.isBlank()) return true;
        String s = expr.trim();
        if (s.regionMatches(true, 0, "perm:", 0, 5)) {
            String node = plugin.resolveText(p, s.substring(5)).trim();
            return p != null && !node.isEmpty() && p.hasPermission(node);
        }
        Matcher m = EXPR_PAT.matcher(s);
        if (!m.matches()) {
            String resolved = plugin.resolveText(p, s).trim();
            return matchBoolOrPositive(resolved);
        }
        String left = plugin.resolveText(p, m.group(1).trim()).trim();
        String op = m.group(2).toLowerCase(Locale.ROOT);
        if ("=".equals(op)) op = "==";
        String right = plugin.resolveText(p, m.group(3).trim()).trim();
        return compare(left, op, right);
    }

    static boolean matchValue(String resolved, String target) {
        if (target == null || target.isEmpty()) return matchBoolOrPositive(resolved);
        Double a = parseNum(resolved), b = parseNum(target);
        if (a != null && b != null) return Math.abs(a - b) < 1e-6;
        return resolved.trim().equalsIgnoreCase(target.trim());
    }

    static boolean matchBoolOrPositive(String raw) {
        if (raw == null || raw.isBlank()) return false;
        String t = raw.trim().toLowerCase(Locale.ROOT);
        if ("true".equals(t) || "yes".equals(t) || "on".equals(t) || "enabled".equals(t)) return true;
        if ("false".equals(t) || "no".equals(t) || "off".equals(t) || "disabled".equals(t)) return false;
        Double n = parseNum(t);
        return n != null && n > 0;
    }

    private static boolean compare(String left, String op, String right) {
        Double ln = parseNum(left), rn = parseNum(right);
        boolean bothNum = ln != null && rn != null;
        return switch (op) {
            case "==" -> bothNum ? Math.abs(ln - rn) < 1e-6 : left.equalsIgnoreCase(right);
            case "!=" -> bothNum ? Math.abs(ln - rn) >= 1e-6 : !left.equalsIgnoreCase(right);
            case ">=" -> bothNum && ln >= rn;
            case "<=" -> bothNum && ln <= rn;
            case ">" -> bothNum && ln > rn;
            case "<" -> bothNum && ln < rn;
            case "contains" -> left.toLowerCase(Locale.ROOT).contains(right.toLowerCase(Locale.ROOT));
            case "!contains" -> !left.toLowerCase(Locale.ROOT).contains(right.toLowerCase(Locale.ROOT));
            case "starts" -> left.toLowerCase(Locale.ROOT).startsWith(right.toLowerCase(Locale.ROOT));
            case "ends" -> left.toLowerCase(Locale.ROOT).endsWith(right.toLowerCase(Locale.ROOT));
            case "empty" -> left.isEmpty();
            case "!empty" -> !left.isEmpty();
            default -> left.equalsIgnoreCase(right);
        };
    }

    private static Double parseNum(String s) {
        if (s == null || s.isBlank()) return null;
        String clean = s.trim().replace(",", "").replace("$", "");
        if (clean.isEmpty()) return null;
        try {
            double v = Double.parseDouble(clean);
            return Double.isFinite(v) ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
