package kz.kaizerui;

import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** /kui open|close|list|reload|fov|speed */
final class KuiCommand implements TabExecutor {
    private final KaizerUIPlugin plugin;

    KuiCommand(KaizerUIPlugin plugin) { this.plugin = plugin; }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        String sub = args.length == 0 ? "help" : args[0].toLowerCase(Locale.ROOT);
        boolean admin = sender.hasPermission("kaizerui.admin");
        switch (sub) {
            case "open" -> {
                if (args.length < 2) { usage(sender, label); return true; }
                MenuDef m = plugin.menu(args[1]);
                if (m == null) { sender.sendMessage(plugin.msg("no-menu", "%menu%", args[1])); return true; }
                Player target = target(sender, args, 2, admin);
                if (target == null) return true;
                if (target == sender && !sender.hasPermission("kaizerui.use")) { sender.sendMessage(plugin.msg("no-permission")); return true; }
                plugin.open(target, m);
            }
            case "close" -> {
                Player target = target(sender, args, 1, admin);
                if (target != null) plugin.close(target);
            }
            case "list" -> {
                if (!admin) { sender.sendMessage(plugin.msg("no-permission")); return true; }
                StringBuilder sb = new StringBuilder("&7Menus: ");
                for (MenuDef m : plugin.menus()) sb.append("&f").append(m.id).append(m.command.isEmpty() ? "" : " &8(/" + m.command + ")").append("&7, ");
                sender.sendMessage(Texts.component(sb.length() > 9 ? sb.substring(0, sb.length() - 4) : "&7No menus loaded."));
            }
            case "reload" -> {
                if (!admin) { sender.sendMessage(plugin.msg("no-permission")); return true; }
                for (Player p : Bukkit.getOnlinePlayers()) if (plugin.java().isOpen(p)) plugin.close(p);
                int n = plugin.reloadAll();
                sender.sendMessage(plugin.msg("reloaded", "%count%", String.valueOf(n)));
            }
            case "fov" -> {
                if (!(sender instanceof Player p)) { sender.sendMessage(plugin.msg("players-only")); return true; }
                if (args.length < 2) {
                    sender.sendMessage(Texts.component("&7Menus are sized for FOV &f" + (int) plugin.fovOf(p) + "&7. &f/" + label + " fov <30-110>&7: bigger number = bigger menu · &f/" + label + " fov reset&7: back to the server default"));
                    return true;
                }
                if (args[1].equalsIgnoreCase("reset")) {
                    plugin.clearFov(p);
                    sender.sendMessage(plugin.msg("fov-set", "%fov%", String.valueOf((int) plugin.fovOf(p))));
                    return true;
                }
                double v = parse(args[1], 70);
                v = Math.max(30, Math.min(110, v));
                plugin.setFov(p, v);
                sender.sendMessage(plugin.msg("fov-set", "%fov%", String.valueOf((int) v)));
            }
            case "speed" -> {
                if (!(sender instanceof Player p)) { sender.sendMessage(plugin.msg("players-only")); return true; }
                if (args.length < 2) {
                    int pct = plugin.sensitivity().detectedPercent(p.getUniqueId());
                    String auto = pct >= 0 ? (pct + "%") : "learning (look around in game)";
                    sender.sendMessage(Texts.component("&7Auto-sensitivity: &f" + auto + " &8· &7multiplier: &f" + plugin.speedOf(p) + " &8· &f/" + label + " speed <0.2-5>"));
                    return true;
                }
                double v = Math.max(0.2, Math.min(5, parse(args[1], 1)));
                plugin.setSpeed(p, v);
                sender.sendMessage(plugin.msg("speed-set", "%speed%", String.valueOf(v)));
            }
            default -> usage(sender, label);
        }
        return true;
    }

    private Player target(CommandSender sender, String[] args, int idx, boolean admin) {
        if (args.length > idx) {
            if (!admin) { sender.sendMessage(plugin.msg("no-permission")); return null; }
            Player p = Bukkit.getPlayerExact(args[idx]);
            if (p == null) sender.sendMessage(plugin.msg("player-not-found", "%player%", args[idx]));
            return p;
        }
        if (sender instanceof Player p) return p;
        sender.sendMessage(plugin.msg("players-only"));
        return null;
    }

    private static double parse(String s, double def) {
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return def; }
    }

    private void usage(CommandSender sender, String label) {
        sender.sendMessage(Texts.component("&b/" + label + " open <menu> [player] &7— open a menu\n"
                + "&b/" + label + " close [player] &7— close it\n"
                + "&b/" + label + " fov <degrees> &7— size menus for your FOV\n"
                + "&b/" + label + " speed <x> &7— cursor speed\n"
                + "&b/" + label + " list &7| &b/" + label + " reload"));
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> out = new ArrayList<>();
        if (args.length == 1) {
            for (String s : List.of("open", "close", "fov", "speed", "list", "reload")) if (s.startsWith(args[0].toLowerCase(Locale.ROOT))) out.add(s);
        } else if (args.length == 2 && args[0].equalsIgnoreCase("open")) {
            for (MenuDef m : plugin.menus()) if (m.id.startsWith(args[1].toLowerCase(Locale.ROOT))) out.add(m.id);
        } else if ((args.length == 3 && args[0].equalsIgnoreCase("open")) || (args.length == 2 && args[0].equalsIgnoreCase("close"))) {
            if (sender.hasPermission("kaizerui.admin")) for (Player p : Bukkit.getOnlinePlayers()) out.add(p.getName());
        }
        return out;
    }
}
