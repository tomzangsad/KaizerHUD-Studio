package kz.kaizerui;

import kz.kaizerui.api.event.MenuClickEvent;
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
 *   open:&lt;menu&gt;          open another menu page      back                  return to previous menu
 *   next / prev          go to next / prev page      close                 close the menu
 *   event:&lt;key&gt;          fire MenuClickEvent with key
 *   message:&lt;text&gt;       chat message                sound:&lt;id&gt;[;volume;pitch]
 *   server:&lt;name&gt;        send to a proxy server (BungeeCord / Velocity)
 * </pre>
 */
public final class Actions {
    private Actions() {}

    /** What the menu should do after the actions ran */
    public enum After { STAY, CLOSE, OPENED_OTHER }

    public static After run(KaizerUIPlugin plugin, Player p, MenuDef menu, MenuDef.Element el) {
        return run(plugin, p, menu, el, plugin.isBedrock(p));
    }

    /** Runs the actions on the player's thread. Returns what happened to the menu. */
    public static After run(KaizerUIPlugin plugin, Player p, MenuDef menu, MenuDef.Element el, boolean bedrock) {
        String eventKey = "";
        for (String raw : el.actions) {
            String a = raw.trim();
            if (a.length() >= 6 && a.regionMatches(true, 0, "event:", 0, 6)) {
                eventKey = a.substring(6).trim();
                break;
            }
        }
        MenuClickEvent clickEvent = new MenuClickEvent(p, menu.id, el.id, el.name, eventKey, el.actions, bedrock);
        Bukkit.getPluginManager().callEvent(clickEvent);
        if (clickEvent.isCancelled()) return After.STAY;

        After after = el.closeOnClick ? After.CLOSE : After.STAY;
        for (String raw : el.actions) {
            String a = raw.trim();
            int c = a.indexOf(':');
            String kind = (c < 0 ? a : a.substring(0, c)).trim().toLowerCase();
            String arg = c < 0 ? "" : a.substring(c + 1).trim();
            switch (kind) {
                case "close" -> after = After.CLOSE;
                case "event" -> { /* handled by MenuClickEvent above */ }
                case "back" -> {
                    String prevId = plugin.popHistory(p.getUniqueId());
                    MenuDef prev = prevId != null ? plugin.menu(prevId) : null;
                    if (prev != null) {
                        after = After.OPENED_OTHER;
                        Sched.entityLater(plugin, p, 1, () -> plugin.open(p, prev, false));
                    } else {
                        after = After.CLOSE;
                    }
                }
                case "next" -> {
                    MenuDef next = !menu.nextPage.isEmpty() ? plugin.menu(menu.nextPage) : null;
                    if (next != null) {
                        after = After.OPENED_OTHER;
                        Sched.entityLater(plugin, p, 1, () -> plugin.open(p, next, false));
                    }
                }
                case "prev" -> {
                    MenuDef prev = !menu.prevPage.isEmpty() ? plugin.menu(menu.prevPage) : null;
                    if (prev != null) {
                        after = After.OPENED_OTHER;
                        Sched.entityLater(plugin, p, 1, () -> plugin.open(p, prev, false));
                    }
                }
                case "open" -> {
                    MenuDef next = plugin.menu(arg);
                    if (next != null) {
                        plugin.pushHistory(p.getUniqueId(), menu.id);
                        after = After.OPENED_OTHER;
                        Sched.entityLater(plugin, p, 1, () -> plugin.open(p, next, false));
                    } else {
                        plugin.getLogger().warning("Menu " + menu.id + ": button " + el.id + " opens unknown menu '" + arg + "'");
                    }
                }
                case "player", "cmd", "command" -> {
                    String cmd = stripSlash(plugin.resolveText(p, arg));
                    if (!cmd.isEmpty()) p.performCommand(cmd);
                }
                case "console" -> {
                    String cmd = stripSlash(plugin.resolveText(p, arg));
                    if (!cmd.isEmpty()) Sched.global(plugin, () -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd));
                }
                case "message", "msg" -> p.sendMessage(Texts.component(plugin.resolveText(p, arg)));
                case "sound" -> playSound(p, arg);
                case "server" -> sendToServer(plugin, p, arg);
                default -> {
                    // A line without a known prefix is treated as a player command
                    if (!a.isEmpty()) p.performCommand(stripSlash(plugin.resolveText(p, a)));
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
