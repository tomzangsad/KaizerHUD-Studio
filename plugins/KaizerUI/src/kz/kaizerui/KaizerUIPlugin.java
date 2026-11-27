package kz.kaizerui;

import kz.kaizerui.api.KaizerUI;
import kz.kaizerui.api.event.MenuCloseEvent;
import kz.kaizerui.api.event.MenuOpenEvent;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.Collections;
import java.util.Deque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * KaizerUI: cursor GUI menus made in KaizerHUD Studio (GUI Studio).
 * Java players see holograms and a cursor; Bedrock players get the same menu as a server form.
 */
public final class KaizerUIPlugin extends JavaPlugin implements Listener {

    private final Map<String, MenuDef> menus = new LinkedHashMap<>();
    private final Map<String, String> commandAliases = new LinkedHashMap<>();
    private MenuDef.Studio studio;
    private JavaMenus javaMenus;
    private BedrockMenus bedrock;
    private KaizerUI api;
    private final SensitivityTracker sensitivity = new SensitivityTracker();
    private final Map<UUID, Deque<String>> navHistory = new ConcurrentHashMap<>();
    private final Map<UUID, Map<String, String>> customPlaceholders = new ConcurrentHashMap<>();
    private final Map<UUID, Map<String, String>> sessionVars = new ConcurrentHashMap<>();
    private final Map<UUID, PendingChatInput> pendingChatInputs = new ConcurrentHashMap<>();
    private final Map<UUID, Map<String, String>> dynamicTexts = new ConcurrentHashMap<>();
    private final Map<UUID, Map<String, org.bukkit.inventory.ItemStack>> dynamicItems = new ConcurrentHashMap<>();
    private final Map<UUID, String> bedrockOpenMenu = new ConcurrentHashMap<>();
    private NamespacedKey fovKey, speedKey, hintKey;
    private UUID packId;

    private static final Pattern MATH_EXPR = Pattern.compile("\\{([A-Za-z0-9_.\\-]+)\\s*([+\\-*/])\\s*([A-Za-z0-9_.\\-]+)\\}");
    private static final Pattern VAR_TOKEN = Pattern.compile("\\{([A-Za-z0-9_.\\-]+)\\}");
    private record PendingChatInput(MenuDef menu, MenuDef.Element element) {}

    @Override
    public void onEnable() {
        saveDefaultConfig();
        fovKey = new NamespacedKey(this, "fov");
        speedKey = new NamespacedKey(this, "speed");
        hintKey = new NamespacedKey(this, "fov_hint");
        new File(getDataFolder(), "menus").mkdirs();
        reloadAll();

        javaMenus = new JavaMenus(this);
        getServer().getPluginManager().registerEvents(javaMenus, this);
        getServer().getPluginManager().registerEvents(this, this);
        if (CameraHook.available()) {
            CameraHook.init((uuid, yaw, pitch) -> {
                sensitivity.observe(uuid, pitch);
                if (javaMenus != null) javaMenus.onPacketRotation(uuid, yaw, pitch);
            });
        }
        if (Bukkit.getPluginManager().isPluginEnabled("floodgate") || Bukkit.getPluginManager().isPluginEnabled("Geyser-Spigot")) {
            bedrock = new BedrockMenus(this);
        }
        getServer().getMessenger().registerOutgoingPluginChannel(this, "BungeeCord");

        api = new ApiImpl();
        KaizerUI.Holder.set(api);
        getServer().getServicesManager().register(KaizerUI.class, api, this, ServicePriority.Normal);

        KuiCommand cmd = new KuiCommand(this);
        var pc = getCommand("kui");
        if (pc != null) { pc.setExecutor(cmd); pc.setTabCompleter(cmd); }

        getLogger().info("Loaded " + menus.size() + " menus. Camera lock: "
                + (CameraHook.available() ? "on (PacketEvents)" : "off — install PacketEvents for a mouse cursor; the crosshair is used instead")
                + ". Bedrock: " + (bedrock != null && bedrock.available() ? "on" : "off (no Floodgate / Geyser)"));
    }

    @Override
    public void onDisable() {
        getServer().getServicesManager().unregisterAll(this);
        KaizerUI.Holder.set(null);
        api = null;
        if (javaMenus != null) javaMenus.closeAll();
        CameraHook.shutdown();
        navHistory.clear();
        customPlaceholders.clear();
        sessionVars.clear();
        pendingChatInputs.clear();
        dynamicTexts.clear();
        dynamicItems.clear();
        bedrockOpenMenu.clear();
    }

    /** Reads config.yml, studio.yml and menus/*.yml. Returns the number of menus. */
    int reloadAll() {
        reloadConfig();
        Texts.reset();
        Skins.clear();
        File studioFile = new File(getDataFolder(), "studio.yml");
        studio = new MenuDef.Studio(YamlConfiguration.loadConfiguration(studioFile));
        if (!studioFile.exists()) getLogger().warning("studio.yml is missing: export your menus from KaizerHUD Studio (GUI Studio) into plugins/KaizerUI/");

        menus.clear();
        commandAliases.clear();
        File[] files = new File(getDataFolder(), "menus").listFiles((d, n) -> n.endsWith(".yml") || n.endsWith(".yaml"));
        if (files != null) {
            Arrays.sort(files);
            for (File f : files) {
                try {
                    MenuDef m = MenuDef.load(f);
                    menus.put(m.id.toLowerCase(Locale.ROOT), m);
                    if (!m.command.isEmpty()) commandAliases.put(m.command.toLowerCase(Locale.ROOT), m.id);
                } catch (Exception e) {
                    getLogger().warning("Could not read " + f.getName() + ": " + e.getMessage());
                }
            }
        }
        String url = getConfig().getString("resource-pack.url", "");
        packId = url.isBlank() ? null : UUID.nameUUIDFromBytes(("kaizerui:" + url).getBytes(StandardCharsets.UTF_8));
        return menus.size();
    }

    /* ───────────── opening menus ───────────── */

    MenuDef menu(String id) { return id == null ? null : menus.get(id.trim().toLowerCase(Locale.ROOT)); }

    Collection<MenuDef> menus() { return menus.values(); }

    MenuDef.Studio studio() { return studio; }

    JavaMenus java() { return javaMenus; }

    BedrockMenus bedrock() { return bedrock; }

    boolean isBedrock(Player p) { return bedrock != null && bedrock.isBedrock(p); }

    /** Opens a menu for the player (any thread). */
    void open(Player p, MenuDef menu) {
        open(p, menu, true);
    }

    void open(Player p, MenuDef menu, boolean resetHistory) {
        open(p, menu, resetHistory, null);
    }

    void open(Player p, MenuDef menu, boolean resetHistory, Map<String, String> extraPlaceholders) {
        pendingChatInputs.remove(p.getUniqueId());
        if (extraPlaceholders != null && !extraPlaceholders.isEmpty()) {
            Map<String, String> map = customPlaceholders.computeIfAbsent(p.getUniqueId(), k -> new ConcurrentHashMap<>());
            extraPlaceholders.forEach((k, v) -> {
                if (k != null && v != null) map.put(k, v);
            });
        }
        Sched.entity(this, p, () -> {
            if (!p.isOnline()) return;
            if (resetHistory && !javaMenus.isOpen(p)) clearHistory(p.getUniqueId());
            initMenuVarDefaults(p, menu);
            if (isBedrock(p)) {
                if (getConfig().getBoolean("bedrock.enabled", true)) bedrock.open(p, menu);
            } else if (getConfig().getBoolean("java.enabled", true)) {
                javaMenus.open(p, menu);
            }
        });
    }

    void initMenuVarDefaults(Player p, MenuDef m) {
        if (p == null || m == null) return;
        Map<String, String> vars = sessionVars.computeIfAbsent(p.getUniqueId(), k -> new ConcurrentHashMap<>());
        for (MenuDef.Element e : m.elements) {
            if (e.type == MenuDef.Type.INPUT && e.varName != null && !e.varName.isEmpty()) {
                vars.putIfAbsent(e.varName, e.defaultValue != null ? e.defaultValue : "1");
            }
            if (e.type == MenuDef.Type.BUTTON && e.isToggle() && !e.toggleVar.isEmpty()) {
                boolean on = getToggle(p, e);
                vars.put(e.toggleVar, on ? "true" : "false");
                vars.put(e.toggleVar + "_state", on ? "ON" : "OFF");
            }
        }
    }

    private NamespacedKey toggleKey(String varName) {
        String clean = String.valueOf(varName == null ? "" : varName).trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_.-]+", "_");
        if (clean.isEmpty()) clean = "flag";
        return new NamespacedKey(this, "tg_" + clean);
    }

    boolean getToggle(Player p, MenuDef.Element e) {
        if (e == null) return true;
        if (!e.togglePapi.isEmpty() && p != null) {
            String res = resolveText(p, e.togglePapi).trim();
            if (!res.equals(e.togglePapi)) {
                return e.toggleOnValue.isEmpty()
                        ? ConditionEval.matchBoolOrPositive(res)
                        : ConditionEval.matchValue(res, e.toggleOnValue);
            }
        }
        return getToggle(p, e.toggleVar, e.toggleDefault);
    }

    boolean getToggle(Player p, String varName, boolean def) {
        if (p == null || varName == null || varName.isBlank()) return def;
        Byte stored = p.getPersistentDataContainer().get(toggleKey(varName), PersistentDataType.BYTE);
        return stored == null ? def : stored != 0;
    }

    void setToggle(Player p, String varName, boolean on) {
        if (p == null || varName == null || varName.isBlank()) return;
        String v = varName.trim();
        p.getPersistentDataContainer().set(toggleKey(v), PersistentDataType.BYTE, (byte) (on ? 1 : 0));
        setSessionVar(p.getUniqueId(), v, on ? "true" : "false");
        setSessionVar(p.getUniqueId(), v + "_state", on ? "ON" : "OFF");
    }

    boolean flipToggle(Player p, String varName, boolean def) {
        boolean next = !getToggle(p, varName, def);
        setToggle(p, varName, next);
        return next;
    }

    void setSessionVar(UUID id, String key, String value) {
        if (id == null || key == null || key.isBlank()) return;
        Map<String, String> vars = sessionVars.computeIfAbsent(id, k -> new ConcurrentHashMap<>());
        if (value == null) vars.remove(key.trim());
        else vars.put(key.trim(), value);
    }

    String getSessionVar(UUID id, String key, String def) {
        if (id == null || key == null || key.isBlank()) return def;
        Map<String, String> vars = sessionVars.get(id);
        if (vars == null) return def;
        return vars.getOrDefault(key.trim(), def);
    }

    void clearSessionVars(UUID id) {
        if (id != null) sessionVars.remove(id);
    }

    void openInputPrompt(Player p, MenuDef menu, MenuDef.Element inputEl) {
        if (p == null || menu == null || inputEl == null) return;
        if (isBedrock(p) && bedrock != null && bedrock.available()) {
            bedrock.openInputForm(p, menu, inputEl);
        } else {
            beginJavaChatInput(p, menu, inputEl);
        }
    }

    void beginJavaChatInput(Player p, MenuDef menu, MenuDef.Element inputEl) {
        if (p == null || !p.isOnline() || menu == null || inputEl == null) return;
        if (javaMenus != null) javaMenus.pauseForInput(p);
        pendingChatInputs.put(p.getUniqueId(), new PendingChatInput(menu, inputEl));
        String title = resolveText(p, inputEl.promptTitle != null && !inputEl.promptTitle.isBlank() ? inputEl.promptTitle : ("Enter " + inputEl.varName));
        String hint = "text".equals(inputEl.inputType)
                ? "&7(Type in chat, or &ccancel &7to go back)"
                : "&7(" + formatNumber(inputEl.inputMin) + " - " + formatNumber(inputEl.inputMax) + ", or type &ccancel&7)";
        p.sendMessage(Texts.component("&b[KaizerUI] &f" + title + " " + hint));
    }

    static String formatNumber(double v) {
        if (Math.abs(v - Math.rint(v)) < 1e-9) return Long.toString(Math.round(v));
        DecimalFormat df = new DecimalFormat("0.##", DecimalFormatSymbols.getInstance(Locale.US));
        return df.format(v);
    }

    private static Double lookupNumber(String token, Map<String, String> vars, Map<String, String> ph) {
        String s = null;
        if (vars != null && vars.containsKey(token)) s = vars.get(token);
        else if (ph != null && ph.containsKey(token)) s = ph.get(token);
        if (s == null) s = token;
        try {
            return Double.parseDouble(s.trim().replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    boolean fireOpenEvent(Player p, MenuDef m, boolean isBedrock) {
        Map<String, String> ph = customPlaceholders.computeIfAbsent(p.getUniqueId(), k -> new ConcurrentHashMap<>());
        MenuOpenEvent ev = new MenuOpenEvent(p, m.id, isBedrock, ph);
        getServer().getPluginManager().callEvent(ev);
        return !ev.isCancelled();
    }

    void fireCloseEvent(Player p, String menuId, MenuCloseEvent.Reason reason, boolean isBedrock) {
        getServer().getPluginManager().callEvent(new MenuCloseEvent(p, menuId, reason, isBedrock));
    }

    String resolveText(Player p, String raw) {
        if (raw == null || raw.isEmpty()) return "";
        String out = raw;
        Map<String, String> ph = p == null ? null : customPlaceholders.get(p.getUniqueId());
        Map<String, String> vars = p == null ? null : sessionVars.get(p.getUniqueId());
        for (int pass = 0; pass < 2; pass++) {
            if (ph != null && !ph.isEmpty()) {
                for (Map.Entry<String, String> en : ph.entrySet()) {
                    String k = en.getKey(), v = en.getValue();
                    if (k == null || v == null) continue;
                    out = out.replace(k, v);
                    if (!k.startsWith("%") && !k.endsWith("%")) out = out.replace("%" + k + "%", v);
                    if (!k.startsWith("{") && !k.endsWith("}")) out = out.replace("{" + k + "}", v);
                }
            }
            if (vars != null && !vars.isEmpty() && out.indexOf('{') >= 0) {
                Matcher vm = VAR_TOKEN.matcher(out);
                StringBuilder sb = new StringBuilder();
                while (vm.find()) {
                    String key = vm.group(1);
                    String val = vars.get(key);
                    vm.appendReplacement(sb, val != null ? Matcher.quoteReplacement(val) : Matcher.quoteReplacement(vm.group(0)));
                }
                vm.appendTail(sb);
                out = sb.toString();
            }
            if (out.indexOf('{') >= 0) {
                Matcher mm = MATH_EXPR.matcher(out);
                StringBuilder sb = new StringBuilder();
                while (mm.find()) {
                    Double a = lookupNumber(mm.group(1), vars, ph);
                    Double b = lookupNumber(mm.group(3), vars, ph);
                    if (a != null && b != null) {
                        double res = switch (mm.group(2)) {
                            case "+" -> a + b;
                            case "-" -> a - b;
                            case "*" -> a * b;
                            case "/" -> b == 0 ? 0 : a / b;
                            default -> 0;
                        };
                        mm.appendReplacement(sb, Matcher.quoteReplacement(formatNumber(res)));
                    } else {
                        mm.appendReplacement(sb, Matcher.quoteReplacement(mm.group(0)));
                    }
                }
                mm.appendTail(sb);
                out = sb.toString();
            }
        }
        return Texts.papi(p, out);
    }

    String dynamicText(Player p, String elementId) {
        Map<String, String> map = dynamicTexts.get(p.getUniqueId());
        return map == null ? null : map.get(elementId);
    }

    ItemStack dynamicItem(Player p, String elementId) {
        Map<String, ItemStack> map = dynamicItems.get(p.getUniqueId());
        ItemStack s = map == null ? null : map.get(elementId);
        return s == null ? null : s.clone();
    }

    void setBedrockMenu(UUID id, String menuId) {
        if (id == null) return;
        if (menuId == null) bedrockOpenMenu.remove(id);
        else bedrockOpenMenu.put(id, menuId);
    }

    void clearBedrockSession(UUID id) {
        if (id == null) return;
        bedrockOpenMenu.remove(id);
        clearHistory(id);
        clearSessionVars(id);
        clearPlayerOverrides(id);
    }

    void clearPlayerOverrides(UUID id) {
        if (id == null) return;
        customPlaceholders.remove(id);
        dynamicTexts.remove(id);
        dynamicItems.remove(id);
    }

    void pushHistory(UUID id, String fromMenuId) {
        if (id == null || fromMenuId == null || fromMenuId.isBlank()) return;
        Deque<String> stack = navHistory.computeIfAbsent(id, k -> new ArrayDeque<>());
        synchronized (stack) {
            if (fromMenuId.equals(stack.peekFirst())) return;
            while (stack.size() >= 16) stack.removeLast();
            stack.addFirst(fromMenuId);
        }
    }

    String popHistory(UUID id) {
        if (id == null) return null;
        Deque<String> stack = navHistory.get(id);
        if (stack == null) return null;
        synchronized (stack) {
            return stack.pollFirst();
        }
    }

    void clearHistory(UUID id) {
        if (id != null) navHistory.remove(id);
    }

    SensitivityTracker sensitivity() { return sensitivity; }

    void close(Player p) {
        Sched.entity(this, p, () -> javaMenus.close(p));
    }

    /* ───────────── settings ───────────── */

    double fovOf(Player p) {
        Double v = p.getPersistentDataContainer().get(fovKey, PersistentDataType.DOUBLE);
        return v != null ? v : getConfig().getDouble("java.default-fov", 70);
    }

    void setFov(Player p, double fov) { p.getPersistentDataContainer().set(fovKey, PersistentDataType.DOUBLE, fov); }

    void clearFov(Player p) { p.getPersistentDataContainer().remove(fovKey); }

    double speedOf(Player p) {
        Double v = p.getPersistentDataContainer().get(speedKey, PersistentDataType.DOUBLE);
        return v != null ? v : 1.0;
    }

    void setSpeed(Player p, double speed) { p.getPersistentDataContainer().set(speedKey, PersistentDataType.DOUBLE, speed); }

    boolean flipFacing() { return getConfig().getBoolean("java.flip-facing", false); }
    /** Items (ItemDisplay) seen from behind in game? turn them around */
    boolean itemFlip() { return getConfig().getBoolean("java.item-flip", false); }
    /** Player Model: real 3D player (Mannequin, 1.21.9+) when the menu asks for it */
    boolean models3d() { return getConfig().getBoolean("java.models-3d", true); }

    double offsetY() { return getConfig().getDouble("java.offset-y", 0); }

    String labelHoverColor() { return getConfig().getString("java.label-hover-color", "#ffff55"); }

    long clickCooldownMs() { return getConfig().getLong("java.click-cooldown-ms", 150); }

    /** Share of the screen height a full-screen menu uses */
    double fullscreenFill() { return Math.max(0.5, Math.min(1.0, getConfig().getDouble("java.fullscreen-fill", 0.94))); }

    boolean hasOwnFov(Player p) { return p.getPersistentDataContainer().has(fovKey, PersistentDataType.DOUBLE); }

    /** Tells a player once that menus are sized for a FOV they can change */
    void fovHintOnce(Player p) {
        if (hasOwnFov(p) || p.getPersistentDataContainer().has(hintKey, PersistentDataType.BYTE)) return;
        p.getPersistentDataContainer().set(hintKey, PersistentDataType.BYTE, (byte) 1);
        p.sendMessage(msg("fov-hint", "%fov%", String.valueOf((int) fovOf(p))));
    }

    /** Ride an invisible horse (blocks the E key) instead of a display entity */
    boolean horseVehicle() { return "horse".equalsIgnoreCase(getConfig().getString("java.vehicle", "horse")); }

    boolean light3dModels() { return getConfig().getBoolean("java.light-3d-models", true); }

    boolean autoSensitivity() { return getConfig().getBoolean("java.auto-sensitivity", true); }

    boolean hideActionBar() { return getConfig().getBoolean("java.hide-hud.action-bar", true); }

    boolean hideBossBars() { return getConfig().getBoolean("java.hide-hud.boss-bars", true); }

    boolean hideScoreboard() { return getConfig().getBoolean("java.hide-hud.scoreboard", true); }

    Component msg(String key, String... pairs) {
        String s = getConfig().getString("messages." + key, key);
        for (int i = 0; i + 1 < pairs.length; i += 2) s = s.replace(pairs[i], pairs[i + 1]);
        return Texts.component(getConfig().getString("messages.prefix", "") + s);
    }

    /* ───────────── menu commands (/shop …) and resource pack ───────────── */

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent e) {
        String msg = e.getMessage();
        if (msg.length() < 2) return;
        String label = msg.substring(1).split(" ", 2)[0].toLowerCase(Locale.ROOT);
        String id = commandAliases.get(label);
        if (id == null) return;
        MenuDef m = menu(id);
        if (m == null) return;
        e.setCancelled(true);
        if (!e.getPlayer().hasPermission("kaizerui.use")) { e.getPlayer().sendMessage(msg("no-permission")); return; }
        open(e.getPlayer(), m);
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        String url = getConfig().getString("resource-pack.url", "");
        if (url.isBlank() || packId == null) return;
        Player p = e.getPlayer();
        Sched.entityLater(this, p, 20, () -> {
            if (!p.isOnline() || isBedrock(p)) return;
            byte[] hash = null;
            String sha1 = getConfig().getString("resource-pack.sha1", "").trim();
            if (sha1.length() == 40) {
                try { hash = HexFormat.of().parseHex(sha1); } catch (IllegalArgumentException ignored) { /* bad hash: send without */ }
            }
            p.addResourcePack(packId, url, hash, getConfig().getString("resource-pack.prompt", ""),
                    getConfig().getBoolean("resource-pack.required", false));
        });
    }

    @EventHandler
    public void onQuitCleanup(org.bukkit.event.player.PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        pendingChatInputs.remove(id);
        sensitivity.forget(id);
        CameraHook.forget(id);
        clearHistory(id);
        clearSessionVars(id);
        bedrockOpenMenu.remove(id);
        clearPlayerOverrides(id);
    }

    @SuppressWarnings("deprecation")
    @EventHandler(priority = EventPriority.LOWEST)
    public void onChatInput(org.bukkit.event.player.AsyncPlayerChatEvent e) {
        Player p = e.getPlayer();
        PendingChatInput pending = pendingChatInputs.get(p.getUniqueId());
        if (pending == null) return;
        e.setCancelled(true);
        String msg = e.getMessage().trim();
        Sched.entity(this, p, () -> {
            if (!p.isOnline()) {
                pendingChatInputs.remove(p.getUniqueId());
                return;
            }
            PendingChatInput cur = pendingChatInputs.get(p.getUniqueId());
            if (cur == null) return;
            if ("cancel".equalsIgnoreCase(msg) || "-cancel".equalsIgnoreCase(msg)) {
                pendingChatInputs.remove(p.getUniqueId());
                open(p, cur.menu(), false);
                return;
            }
            MenuDef.Element el = cur.element();
            String finalVal = msg;
            if (!"text".equals(el.inputType)) {
                try {
                    double n = Double.parseDouble(msg.replace(",", ""));
                    n = Math.max(el.inputMin, Math.min(el.inputMax, n));
                    finalVal = formatNumber(n);
                } catch (NumberFormatException ex) {
                    p.sendMessage(Texts.component("&cPlease enter a valid number (" + formatNumber(el.inputMin) + " - " + formatNumber(el.inputMax) + "), or type &fcancel&c."));
                    return;
                }
            }
            pendingChatInputs.remove(p.getUniqueId());
            setSessionVar(p.getUniqueId(), el.varName, finalVal);
            Actions.playSound(p, studio != null ? studio.clickSound : "");
            if (el.actions != null && !el.actions.isEmpty()) {
                Actions.After after = Actions.run(this, p, cur.menu(), el, false);
                if (after == Actions.After.STAY) open(p, cur.menu(), false);
            } else {
                open(p, cur.menu(), false);
            }
        });
    }

    private final class ApiImpl implements KaizerUI {
        @Override
        public boolean open(Player player, String menuId) {
            return open(player, menuId, null);
        }

        @Override
        public boolean open(Player player, String menuId, Map<String, String> placeholders) {
            if (player == null || menuId == null) return false;
            MenuDef m = menu(menuId);
            if (m == null) return false;
            KaizerUIPlugin.this.open(player, m, true, placeholders);
            return true;
        }

        @Override
        public void close(Player player) {
            if (player != null) KaizerUIPlugin.this.close(player);
        }

        @Override
        public boolean isOpen(Player player) {
            if (player == null) return false;
            return javaMenus.isOpen(player) || bedrockOpenMenu.containsKey(player.getUniqueId());
        }

        @Override
        public String currentMenuId(Player player) {
            if (player == null) return null;
            JavaSession s = javaMenus.session(player);
            if (s != null && !s.closed) return s.menu.id;
            return bedrockOpenMenu.get(player.getUniqueId());
        }

        @Override
        public Set<String> menuIds() {
            Set<String> out = new LinkedHashSet<>();
            for (MenuDef m : menus.values()) out.add(m.id);
            return Collections.unmodifiableSet(out);
        }

        @Override
        public boolean hasMenu(String menuId) {
            return menu(menuId) != null;
        }

        @Override
        public void refresh(Player player) {
            if (player == null || !player.isOnline()) return;
            Sched.entity(KaizerUIPlugin.this, player, () -> {
                JavaSession s = javaMenus.session(player);
                if (s != null && !s.closed) {
                    s.refreshNow();
                    return;
                }
                String bm = bedrockOpenMenu.get(player.getUniqueId());
                MenuDef m = menu(bm);
                if (m != null && isBedrock(player)) bedrock.open(player, m);
            });
        }

        @Override
        public void setPlaceholder(Player player, String key, String value) {
            if (player == null || key == null) return;
            Map<String, String> map = customPlaceholders.computeIfAbsent(player.getUniqueId(), k -> new ConcurrentHashMap<>());
            if (value == null) map.remove(key);
            else map.put(key, value);
        }

        @Override
        public void clearPlaceholders(Player player) {
            if (player != null) customPlaceholders.remove(player.getUniqueId());
        }

        @Override
        public void setDynamicText(Player player, String elementId, String text) {
            if (player == null || elementId == null) return;
            Map<String, String> map = dynamicTexts.computeIfAbsent(player.getUniqueId(), k -> new ConcurrentHashMap<>());
            if (text == null) map.remove(elementId);
            else map.put(elementId, text);
        }

        @Override
        public void setDynamicItem(Player player, String elementId, ItemStack item) {
            if (player == null || elementId == null) return;
            Map<String, ItemStack> map = dynamicItems.computeIfAbsent(player.getUniqueId(), k -> new ConcurrentHashMap<>());
            if (item == null) map.remove(elementId);
            else map.put(elementId, item.clone());
        }

        @Override
        public void clearDynamicOverrides(Player player) {
            if (player == null) return;
            dynamicTexts.remove(player.getUniqueId());
            dynamicItems.remove(player.getUniqueId());
        }

        @Override
        public int reload() {
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (javaMenus.isOpen(p)) javaMenus.close(p, MenuCloseEvent.Reason.RELOAD);
            }
            return reloadAll();
        }
    }
}
