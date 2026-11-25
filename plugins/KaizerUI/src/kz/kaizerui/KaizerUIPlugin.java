package kz.kaizerui;

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
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.Arrays;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

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
    private NamespacedKey fovKey, speedKey, hintKey;
    private UUID packId;

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
        if (Bukkit.getPluginManager().isPluginEnabled("floodgate") || Bukkit.getPluginManager().isPluginEnabled("Geyser-Spigot")) {
            bedrock = new BedrockMenus(this);
        }
        getServer().getMessenger().registerOutgoingPluginChannel(this, "BungeeCord");

        KuiCommand cmd = new KuiCommand(this);
        var pc = getCommand("kui");
        if (pc != null) { pc.setExecutor(cmd); pc.setTabCompleter(cmd); }

        getLogger().info("Loaded " + menus.size() + " menus. Camera lock: "
                + (CameraHook.available() ? "on (PacketEvents)" : "off — install PacketEvents for a mouse cursor; the crosshair is used instead")
                + ". Bedrock: " + (bedrock != null && bedrock.available() ? "on" : "off (no Floodgate / Geyser)"));
    }

    @Override
    public void onDisable() {
        if (javaMenus != null) javaMenus.closeAll();
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

    boolean isBedrock(Player p) { return bedrock != null && bedrock.isBedrock(p); }

    /** Opens a menu for the player (any thread). */
    void open(Player p, MenuDef menu) {
        Sched.entity(this, p, () -> {
            if (!p.isOnline()) return;
            if (isBedrock(p)) {
                if (getConfig().getBoolean("bedrock.enabled", true)) bedrock.open(p, menu);
            } else if (getConfig().getBoolean("java.enabled", true)) {
                javaMenus.open(p, menu);
            }
        });
    }

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
}
