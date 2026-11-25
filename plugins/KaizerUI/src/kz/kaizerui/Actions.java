package kz.kaizerui;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.List;

/**
 * Button actions written in GUI Studio, one per line:
 * <pre>
 *   player:&lt;command&gt;     run as the player          console:&lt;command&gt;   run as the console
 *   open:&lt;menu&gt;          open another menu page      close                 close the menu
 *   message:&lt;text&gt;       chat message                sound:&lt;id&gt;[;volume;pitch]
 *   server:&lt;name&gt;        send to a proxy server (BungeeCord / Velocity)
 * </pre>
 */
public final class Actions {
    private Actions() {}

    /** What the menu should do after the actions ran */
    public enum After { STAY, CLOSE, OPENED_OTHER }

    /** Runs the actions on the player's thread. Returns what happened to the menu. */
    public static After run(KaizerUIPlugin plugin, Player p, MenuDef menu, MenuDef.Element el) {
        After after = el.closeOnClick ? After.CLOSE : After.STAY;
        for (String raw : el.actions) {
            String a = raw.trim();
            int c = a.indexOf(':');
            String kind = (c < 0 ? a : a.substring(0, c)).trim().toLowerCase();
            String arg = c < 0 ? "" : a.substring(c + 1).trim();
            switch (kind) {
                case "close" -> after = After.CLOSE;
                case "open" -> {
                    MenuDef next = plugin.menu(arg);
                    if (next != null) {
                        after = After.OPENED_OTHER;
                        Sched.entityLater(plugin, p, 1, () -> plugin.open(p, next));
                    } else {
                        plugin.getLogger().warning("Menu " + menu.id + ": button " + el.id + " opens unknown menu '" + arg + "'");
                    }
                }
                case "player", "cmd", "command" -> {
                    String cmd = stripSlash(Texts.papi(p, arg));
                    if (!cmd.isEmpty()) p.performCommand(cmd);
                }
                case "console" -> {
                    String cmd = stripSlash(Texts.papi(p, arg));
                    if (!cmd.isEmpty()) Sched.global(plugin, () -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd));
                }
                case "message", "msg" -> p.sendMessage(Texts.component(Texts.papi(p, arg)));
                case "sound" -> playSound(p, arg);
                case "server" -> sendToServer(plugin, p, arg);
                default -> {
                    // A line without a known prefix is treated as a player command
                    if (!a.isEmpty()) p.performCommand(stripSlash(Texts.papi(p, a)));
                }
            }
        }
        return after;
    }

    static String stripSlash(String s) {
        s = s.trim();
        return s.startsWith("/") ? s.substring(1) : s;
    }

    /** "id", "id;volume", "id;volume;pitch" */
    public static void playSound(Player p, String spec) {
        if (spec == null || spec.isBlank()) return;
        String[] parts = spec.split(";");
        float vol = 1f, pitch = 1f;
        try { if (parts.length > 1) vol = Float.parseFloat(parts[1].trim()); } catch (NumberFormatException ignored) {}
        try { if (parts.length > 2) pitch = Float.parseFloat(parts[2].trim()); } catch (NumberFormatException ignored) {}
        p.playSound(p.getLocation(), parts[0].trim(), vol, pitch);
    }

    static void sendToServer(KaizerUIPlugin plugin, Player p, String server) {
        if (server.isEmpty()) return;
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(bytes);
            out.writeUTF("Connect");
            out.writeUTF(server);
            p.sendPluginMessage(plugin, "BungeeCord", bytes.toByteArray());
        } catch (IOException e) {
            plugin.getLogger().warning("Could not send " + p.getName() + " to " + server + ": " + e.getMessage());
        }
    }

    public static boolean has(List<String> actions, String kind) {
        for (String a : actions) if (a.trim().toLowerCase().startsWith(kind)) return true;
        return false;
    }
}
