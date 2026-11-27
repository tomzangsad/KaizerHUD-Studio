package kz.kaizerui;

import kz.kaizerui.api.event.MenuClickEvent;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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

        return runList(plugin, p, menu, el.actions, bedrock, el.closeOnClick);
    }

    static After runList(KaizerUIPlugin plugin, Player p, MenuDef menu, List<String> actionList, boolean bedrock) {
        return runList(plugin, p, menu, actionList, bedrock, false);
    }

    private static After runList(KaizerUIPlugin plugin, Player p, MenuDef menu, List<String> actionList, boolean bedrock, boolean closeDefault) {
        After after = closeDefault ? After.CLOSE : After.STAY;
        boolean willClose = closeDefault || has(actionList, "close");
        List<String> deferredPlayerCmds = new ArrayList<>();
        List<String> deferredConsoleCmds = new ArrayList<>();
        for (String raw : actionList) {
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
                case "set" -> {
                    int eq = arg.indexOf('=');
                    if (eq > 0) {
                        String k = arg.substring(0, eq).trim();
                        String v = plugin.resolveText(p, arg.substring(eq + 1).trim());
                        plugin.setSessionVar(p.getUniqueId(), k, v);
                    }
                }
                case "add" -> mutateNumericVar(plugin, p, arg, true);
                case "mul" -> mutateNumericVar(plugin, p, arg, false);
                case "pay" -> {
                    if (!execPay(plugin, p, arg)) return After.STAY;
                }
                case "buy" -> {
                    if (!execBuy(plugin, p, arg)) return After.STAY;
                }
                case "sell" -> {
                    if (!execSell(plugin, p, arg)) return After.STAY;
                }
                case "sellhand" -> {
                    if (!execSellHand(plugin, p, arg)) return After.STAY;
                }
                case "trade" -> {
                    if (!execTrade(plugin, p, arg)) return After.STAY;
                }
                case "input" -> {
                    MenuDef.Element targetEl = findInputElement(menu, arg);
                    if (targetEl != null) {
                        after = After.OPENED_OTHER;
                        Sched.entityLater(plugin, p, 1, () -> plugin.openInputPrompt(p, menu, targetEl));
                    }
                }
                case "spin" -> {
                    if (bedrock) {
                        MenuDef.Element rEl = findElementByType(menu, MenuDef.Type.ROULETTE, arg);
                        if (rEl != null && plugin.bedrock() != null) {
                            after = After.OPENED_OTHER;
                            Sched.entityLater(plugin, p, 1, () -> plugin.bedrock().openSpinForm(p, menu, rEl));
                        }
                    } else {
                        JavaSession s = plugin.java() != null ? plugin.java().session(p) : null;
                        if (s != null) s.spinRoulette(arg);
                    }
                }
                case "scroll" -> {
                    if (!bedrock && !arg.isEmpty()) {
                        JavaSession s = plugin.java() != null ? plugin.java().session(p) : null;
                        if (s != null) s.scrollByAction(arg);
                    }
                }
                case "open" -> {
                    int q = arg.indexOf('?');
                    String menuId = plugin.resolveText(p, (q < 0 ? arg : arg.substring(0, q))).trim();
                    if (q >= 0) applyQueryParams(plugin, p, arg.substring(q + 1));
                    MenuDef next = plugin.menu(menuId);
                    if (next != null) {
                        plugin.pushHistory(p.getUniqueId(), menu.id);
                        after = After.OPENED_OTHER;
                        Sched.entityLater(plugin, p, 1, () -> plugin.open(p, next, false));
                    } else {
                        plugin.getLogger().warning("Menu " + menu.id + ": opens unknown menu '" + menuId + "'");
                    }
                }
                case "player", "cmd", "command" -> {
                    String cmd = stripSlash(plugin.resolveText(p, arg));
                    if (!cmd.isEmpty()) {
                        if (!bedrock && willClose) deferredPlayerCmds.add(cmd);
                        else runPlayerCommand(plugin, p, menu, cmd);
                    }
                }
                case "console" -> {
                    String cmd = stripSlash(plugin.resolveText(p, arg));
                    if (!cmd.isEmpty()) {
                        if (!bedrock && willClose) deferredConsoleCmds.add(cmd);
                        else Sched.global(plugin, () -> runConsoleCommand(plugin, p, menu, cmd));
                    }
                }
                case "message", "msg" -> p.sendMessage(Texts.component(plugin.resolveText(p, arg)));
                case "sound" -> playSound(p, arg);
                case "server" -> sendToServer(plugin, p, arg);
                default -> {
                    // A line without a known prefix is treated as a player command
                    if (!a.isEmpty()) {
                        String cmd = stripSlash(plugin.resolveText(p, a));
                        if (!cmd.isEmpty()) {
                            if (!bedrock && willClose) deferredPlayerCmds.add(cmd);
                            else runPlayerCommand(plugin, p, menu, cmd);
                        }
                    }
                }
            }
        }
        if (!deferredPlayerCmds.isEmpty() || !deferredConsoleCmds.isEmpty()) {
            Sched.entityLater(plugin, p, 2, () -> {
                if (!p.isOnline()) return;
                for (String cmd : deferredPlayerCmds) runPlayerCommand(plugin, p, menu, cmd);
                for (String cmd : deferredConsoleCmds) Sched.global(plugin, () -> runConsoleCommand(plugin, p, menu, cmd));
            });
        }
        return after;
    }

    private static void runPlayerCommand(KaizerUIPlugin plugin, Player p, MenuDef menu, String cmd) {
        boolean ok = p.performCommand(cmd);
        if (!ok) {
            plugin.getLogger().warning("Menu '" + menu.id + "': unknown/failed player command '/" + cmd + "'");
            if (p.hasPermission("kaizerui.admin")) {
                p.sendMessage(Texts.component("&e[KaizerUI] &cCommand not found: &f/" + cmd));
            }
        }
    }

    private static void runConsoleCommand(KaizerUIPlugin plugin, Player p, MenuDef menu, String cmd) {
        boolean ok = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
        if (!ok) {
            plugin.getLogger().warning("Menu '" + menu.id + "': unknown/failed console command '/" + cmd + "'");
            if (p != null && p.isOnline() && p.hasPermission("kaizerui.admin")) {
                Sched.entity(plugin, p, () -> p.sendMessage(Texts.component("&e[KaizerUI] &cConsole command not found: &f/" + cmd)));
            }
        }
    }

    private static void applyQueryParams(KaizerUIPlugin plugin, Player p, String query) {
        if (query == null || query.isBlank()) return;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq <= 0) continue;
            String k = decodeUrl(pair.substring(0, eq).trim());
            String v = decodeUrl(pair.substring(eq + 1).trim());
            if (!k.isEmpty()) plugin.setSessionVar(p.getUniqueId(), k, plugin.resolveText(p, v));
        }
    }

    private static String decodeUrl(String s) {
        try {
            return URLDecoder.decode(s, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return s;
        }
    }

    private static void mutateNumericVar(KaizerUIPlugin plugin, Player p, String arg, boolean addMode) {
        int eq = arg.indexOf('=');
        if (eq <= 0) return;
        String k = arg.substring(0, eq).trim();
        String rhs = plugin.resolveText(p, arg.substring(eq + 1).trim());
        String curS = plugin.getSessionVar(p.getUniqueId(), k, addMode ? "0" : "1");
        try {
            double cur = Double.parseDouble(curS.replace(",", ""));
            double val = Double.parseDouble(rhs.replace(",", ""));
            double next = addMode ? (cur + val) : (cur * val);
            plugin.setSessionVar(p.getUniqueId(), k, KaizerUIPlugin.formatNumber(next));
        } catch (NumberFormatException ignored) {}
    }

    private static MenuDef.Element findInputElement(MenuDef menu, String target) {
        if (menu == null || target == null) return null;
        String t = target.trim();
        for (MenuDef.Element e : menu.elements) {
            if (e.type == MenuDef.Type.INPUT && (e.id.equalsIgnoreCase(t) || e.varName.equalsIgnoreCase(t))) return e;
        }
        return null;
    }

    private static MenuDef.Element findElementByType(MenuDef menu, MenuDef.Type type, String id) {
        if (menu == null) return null;
        String t = id == null ? "" : id.trim();
        for (MenuDef.Element e : menu.elements) {
            if (e.type == type && (t.isEmpty() || e.id.equalsIgnoreCase(t))) return e;
        }
        return null;
    }

    private static String elRefName(MenuDef.Element e) { return e == null ? "" : e.id; }

    private static boolean econFail(Player p, String msg) {
        if (p != null && p.isOnline()) {
            p.sendMessage(Texts.component("&e[KaizerUI] " + msg));
            playSound(p, "minecraft:entity.villager.no;0.9;1.0");
        }
        return false;
    }

    private static double parseAmt(String s, double def) {
        if (s == null || s.isBlank()) return def;
        try { return Double.parseDouble(s.trim().replace(",", "")); }
        catch (NumberFormatException e) { return def; }
    }

    private static String prettyItemName(KaizerUIPlugin plugin, Player p, org.bukkit.inventory.ItemStack stack, String itemId) {
        if (stack != null && stack.hasItemMeta() && stack.getItemMeta().hasDisplayName()) {
            return stack.getItemMeta().getDisplayName();
        }
        String custom = plugin.getSessionVar(p.getUniqueId(), "item_name", "");
        if (custom != null && !custom.isBlank()) return custom;
        String clean = itemId.contains(":") ? itemId.substring(itemId.lastIndexOf(':') + 1) : itemId;
        return clean.replace('_', ' ');
    }

    /** Right-splits "<item_id>:<qty>:<total_price>" because item_id itself may contain colons. */
    private static String[] splitItemQtyPrice(KaizerUIPlugin plugin, Player p, String raw) {
        String resolved = plugin.resolveText(p, raw == null ? "" : raw).trim();
        int last = resolved.lastIndexOf(':');
        if (last <= 0) return null;
        int mid = resolved.lastIndexOf(':', last - 1);
        if (mid <= 0) return null;
        return new String[]{
            resolved.substring(0, mid).trim(),
            resolved.substring(mid + 1, last).trim(),
            resolved.substring(last + 1).trim()
        };
    }

    private static boolean execPay(KaizerUIPlugin plugin, Player p, String arg) {
        if (!VaultHook.available()) return econFail(p, "&cVault + an economy plugin is required.");
        double amt = Math.max(0, parseAmt(plugin.resolveText(p, arg), 0));
        if (amt <= 0) return true;
        if (VaultHook.balance(p) < amt) return econFail(p, "&cNot enough money! Need &e" + VaultHook.format(amt) + "&c.");
        if (!VaultHook.withdraw(p, amt)) return econFail(p, "&cCould not withdraw &e" + VaultHook.format(amt) + "&c.");
        return true;
    }

    private static boolean execBuy(KaizerUIPlugin plugin, Player p, String arg) {
        if (!VaultHook.available()) return econFail(p, "&cVault + an economy plugin is required.");
        String[] parts = splitItemQtyPrice(plugin, p, arg);
        if (parts == null) return econFail(p, "&cInvalid buy syntax (expected buy:<item>:<qty>:<price>).");
        int qty = Math.max(1, (int) Math.round(parseAmt(parts[1], 1)));
        double price = Math.max(0, parseAmt(parts[2], 0));
        org.bukkit.inventory.ItemStack stack = Items.resolve(plugin, p, parts[0], false);
        if (stack == null) return econFail(p, "&cUnknown item: &f" + parts[0]);
        if (price > 0) {
            if (VaultHook.balance(p) < price) return econFail(p, "&cNot enough money! Need &e" + VaultHook.format(price) + "&c.");
            if (!VaultHook.withdraw(p, price)) return econFail(p, "&cCould not withdraw &e" + VaultHook.format(price) + "&c.");
        }
        Items.give(p, stack, qty);
        String name = prettyItemName(plugin, p, stack, parts[0]);
        p.sendMessage(Texts.component("&aBought &f" + qty + "x " + name + " &afor &e" + VaultHook.format(price) + "&a!"));
        return true;
    }

    private static boolean execSell(KaizerUIPlugin plugin, Player p, String arg) {
        if (!VaultHook.available()) return econFail(p, "&cVault + an economy plugin is required.");
        String[] parts = splitItemQtyPrice(plugin, p, arg);
        if (parts == null) return econFail(p, "&cInvalid sell syntax (expected sell:<item>:<qty>:<price>).");
        int qty = Math.max(1, (int) Math.round(parseAmt(parts[1], 1)));
        double price = Math.max(0, parseAmt(parts[2], 0));
        org.bukkit.inventory.ItemStack stack = Items.resolve(plugin, p, parts[0], false);
        if (stack == null) return econFail(p, "&cUnknown item: &f" + parts[0]);
        int have = Items.count(p, stack);
        if (have < qty) return econFail(p, "&cNeed &e" + qty + "x &c(you have &f" + have + "&c).");
        if (!Items.remove(p, stack, qty)) return econFail(p, "&cCould not remove items from inventory.");
        if (price > 0 && !VaultHook.deposit(p, price)) {
            Items.give(p, stack, qty);
            return econFail(p, "&cCould not deposit &e" + VaultHook.format(price) + "&c.");
        }
        String name = prettyItemName(plugin, p, stack, parts[0]);
        p.sendMessage(Texts.component("&aSold &f" + qty + "x " + name + " &afor &e+" + VaultHook.format(price) + "&a!"));
        return true;
    }

    private static boolean execSellHand(KaizerUIPlugin plugin, Player p, String arg) {
        if (!VaultHook.available()) return econFail(p, "&cVault + an economy plugin is required.");
        org.bukkit.inventory.ItemStack hand = p.getInventory().getItemInMainHand();
        if (hand == null || hand.getType().isAir() || hand.getAmount() <= 0) {
            return econFail(p, "&cHold an item in your hand to sell!");
        }
        double unitPrice = Math.max(0, parseAmt(plugin.resolveText(p, arg), 25));
        int amt = hand.getAmount();
        double total = amt * unitPrice;
        String name = hand.hasItemMeta() && hand.getItemMeta().hasDisplayName()
                ? hand.getItemMeta().getDisplayName()
                : hand.getType().name().toLowerCase(java.util.Locale.ROOT).replace('_', ' ');
        org.bukkit.inventory.ItemStack backup = hand.clone();
        p.getInventory().setItemInMainHand(null);
        if (total > 0 && !VaultHook.deposit(p, total)) {
            p.getInventory().setItemInMainHand(backup);
            return econFail(p, "&cCould not deposit &e" + VaultHook.format(total) + "&c.");
        }
        p.sendMessage(Texts.component("&aSold &f" + amt + "x " + name + " &afor &e+" + VaultHook.format(total) + "&a!"));
        return true;
    }

    private static boolean execTrade(KaizerUIPlugin plugin, Player p, String arg) {
        int c = arg == null ? -1 : arg.indexOf(':');
        if (c <= 0) return econFail(p, "&cInvalid trade syntax (expected trade:<mode>:<item>:<qty>:<price>).");
        String mode = plugin.resolveText(p, arg.substring(0, c)).trim().toUpperCase(java.util.Locale.ROOT);
        String rest = arg.substring(c + 1);
        if (mode.contains("HAND")) {
            String[] parts = splitItemQtyPrice(plugin, p, rest);
            double unit = 25;
            if (parts != null) {
                int q = Math.max(1, (int) Math.round(parseAmt(parts[1], 1)));
                double pr = Math.max(0, parseAmt(parts[2], 25));
                unit = pr > 0 ? pr / q : 25;
            }
            return execSellHand(plugin, p, Double.toString(unit));
        }
        if (mode.startsWith("SELL")) return execSell(plugin, p, rest);
        return execBuy(plugin, p, rest);
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
