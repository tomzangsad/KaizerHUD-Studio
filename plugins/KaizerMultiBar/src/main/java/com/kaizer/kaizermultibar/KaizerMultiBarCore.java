package com.kaizer.kaizermultibar;

import com.kaizer.kaizermultibar.bar.BossBarManager;
import com.kaizer.kaizermultibar.bar.priority.BarPriorityManager;
import com.kaizer.kaizermultibar.papi.KaizerBarExpansion;
import com.kaizer.kaizermultibar.service.PlayerVisibilityService;
import com.kaizer.kaizermultibar.util.SchedulerUtil;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.logging.Level;

/**
 * Facade Pattern — thin plugin entry point that wires up managers and
 * delegates all work to {@link BossBarManager} and {@link BarPriorityManager}.
 */
public final class KaizerMultiBarCore implements Listener, org.bukkit.command.CommandExecutor {

    private static KaizerMultiBarCore instance;
    private final JavaPlugin plugin;
    private static boolean papiPresent;

    public KaizerMultiBarCore(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public JavaPlugin getPlugin() { return plugin; }
    public org.bukkit.configuration.file.FileConfiguration getConfig() { return plugin.getConfig(); }
    public void saveDefaultConfig() { plugin.saveDefaultConfig(); }
    public void reloadConfig() { plugin.reloadConfig(); }
    public java.util.logging.Logger getLogger() { return plugin.getLogger(); }
    public org.bukkit.Server getServer() { return plugin.getServer(); }
    public org.bukkit.command.PluginCommand getCommand(String name) { return plugin.getCommand(name); }

    public static KaizerMultiBarCore getInstance() {
        return instance;
    }

    public static boolean isPapiPresent() {
        return papiPresent;
    }

    private PlayerVisibilityService visibilityService;
    private BossBarManager barManager;
    private BarPriorityManager priorityManager;

    // -----------------------------------------------------------------------
    // Plugin lifecycle
    // -----------------------------------------------------------------------

    public void onEnable() {
        instance = this;

        getConfig().options().copyDefaults(true);
        saveDefaultConfig();

        // Version and compatibility check
        checkServerCompatibility();


        // PlaceholderAPI (softdepend) — track availability for safe calls in strategies
        papiPresent = Bukkit.getPluginManager().getPlugin("PlaceholderAPI") != null;
        if (papiPresent) {
            new KaizerBarExpansion().register();
        }

        // Command registration
        String cmdStr = getConfig().getString("bossbar.toggle-command", "/kzbos").replaceFirst("/", "");
        if (getCommand(cmdStr) != null) {
            getCommand(cmdStr).setExecutor(this);
        } else if (getCommand("kzbos") != null) {
            getCommand("kzbos").setExecutor(this);
        }

        Bukkit.getPluginManager().registerEvents(this, plugin);

        visibilityService = new PlayerVisibilityService();
        barManager = new BossBarManager(this, visibilityService);

        // Keeps our bossbar above other plugins' bars (needs the PacketEvents plugin)
        setupPriorityManager();

        // Periodic bar content update
        long interval = getConfig().getLong("bossbar.update-interval", 5L);
        SchedulerUtil.runTaskTimer(plugin, this::tickUpdate, 0L, interval);

        // Slower safety task to recover priority if something slips past the packet listener
        SchedulerUtil.runTaskTimer(plugin, this::tickPriorityCheck, 100L, 100L);

        // Init bars for players already online (e.g. plugin reload)
        for (Player p : Bukkit.getOnlinePlayers()) {
            barManager.scheduleInitPlayer(p, 100L);
        }

        getLogger().info("KaizerMultiBarCore has been enabled!");
    }

    /**
     * Boss bar channel: keep our bar above other plugins' bars (PacketEvents).
     * Action bar / title channel: we have no boss bar, so other bars are left alone.
     */
    private void setupPriorityManager() {
        if (!barManager.usesBossBar()) {
            if (priorityManager != null) {
                priorityManager.shutdown();
                priorityManager = null;
            }
            return;
        }
        if (priorityManager != null) return;
        if (Bukkit.getPluginManager().isPluginEnabled("packetevents")) {
            try {
                priorityManager = new BarPriorityManager(this, barManager);
                priorityManager.setup();
                getLogger().info("PacketEvents found - bossbar priority enabled.");
            } catch (Throwable t) {
                priorityManager = null;
                getLogger().warning("PacketEvents is installed but could not be used: " + t);
            }
        } else {
            getLogger().warning("PacketEvents is not installed - other plugins' bossbars may appear above ours."
                    + " Install PacketEvents (https://modrinth.com/plugin/packetevents) to keep KaizerMultiBar on top.");
        }
    }

    public void onDisable() {
        if (priorityManager != null) priorityManager.shutdown();
        if (barManager != null) {
            barManager.removeAll();
        }
        getLogger().info("KaizerMultiBarCore has been disabled!");
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        // Delay 1 tick so other plugins finish their join handling first.
        // During this window, BarPriorityManager (HIGHEST listener) queues any
        // external ADD packets.  Once initPlayer() establishes our bars, we release
        // the queue — external bars are appended below ours with zero flash.
        SchedulerUtil.runTaskLaterForPlayer(plugin, event.getPlayer(), () -> {
            Player player = event.getPlayer();
            if (!player.isOnline()) return;
            // Cancel any delayed re-init task that updateAllPlayers may have scheduled
            // during the 1-tick window before our bars were ready.  Without this, that
            // 100-tick task fires later and calls initPlayer() again — re-creating our
            // bar AFTER the external bars, which puts us at the bottom.
            barManager.cancelScheduledInit(player);
            barManager.initPlayer(player);
            barManager.updatePlayer(player);
            if (priorityManager != null) priorityManager.releasePendingPackets(player);
        }, 1L);
    }

    // Action bar / title channel: send the data again after the client may have rebuilt its HUD
    @EventHandler
    public void onRespawn(PlayerRespawnEvent event) {
        barManager.refreshPlayer(event.getPlayer());
    }

    @EventHandler
    public void onWorldChange(PlayerChangedWorldEvent event) {
        barManager.refreshPlayer(event.getPlayer());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        barManager.removePlayer(player);
        barManager.cancelScheduledInit(player);
        if (priorityManager != null) priorityManager.clearPlayer(player);
    }

    // -----------------------------------------------------------------------
    // Command
    // -----------------------------------------------------------------------

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
            if (!sender.hasPermission("kaizermultibar.command")) {
                sender.sendMessage(Component.text("You don't have permission.", NamedTextColor.RED));
                return true;
            }
            reloadConfig();
            barManager.reload();
            setupPriorityManager(); // the channel may have changed
            for (Player p : Bukkit.getOnlinePlayers()) {
                barManager.initPlayer(p);
                barManager.updatePlayer(p);
            }
            sender.sendMessage(Component.text("KaizerMultiBarCore configuration reloaded!", NamedTextColor.GREEN));
            return true;
        }

        if (sender instanceof Player p) {
            if (!getConfig().getBoolean("bossbar.enabled", true)) {
                p.sendMessage(Component.text("Bossbars are globally disabled in config.", NamedTextColor.RED));
                return true;
            }
            barManager.toggleVisibility(p);
            p.sendMessage(Component.text("HUD visibility toggled.", NamedTextColor.YELLOW));
        }
        return true;
    }

    // -----------------------------------------------------------------------
    // Scheduled tick handlers
    // -----------------------------------------------------------------------

    private void tickUpdate() {
        barManager.updateAllPlayers();
    }

    private void tickPriorityCheck() {
        if (priorityManager != null) {
            Bukkit.getOnlinePlayers().forEach(priorityManager::checkAndFix);
        }
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Check server compatibility and warn about potential issues
     */
    private void checkServerCompatibility() {
        String serverVersion = Bukkit.getVersion();
        String bukkitVersion = Bukkit.getBukkitVersion();
        
        getLogger().info("Server version: " + serverVersion);
        getLogger().info("Bukkit version: " + bukkitVersion);
        
        // Check for Folia
        if (serverVersion.toLowerCase().contains("folia")) {
            getLogger().warning("Running on Folia - some features may not work as expected!");
            getLogger().warning("Folia compatibility is experimental. Please report any issues.");
        }
        
        // Check minimum version
        String[] versionParts = bukkitVersion.split("-");
        if (versionParts.length > 0) {
            String mainVersion = versionParts[0];
            if (compareVersions(mainVersion, "1.16.0") < 0) {
                getLogger().severe("This plugin requires Minecraft 1.16 or higher!");
                getLogger().severe("Current server version: " + mainVersion);
                getLogger().severe("Plugin may not work correctly!");
            }
        }
        
        // Check for PaperMC
        try {
            Class.forName("com.destroystokyo.paper.PaperConfig");
            getLogger().info("PaperMC detected - full compatibility");
        } catch (ClassNotFoundException e) {
            getLogger().warning("PaperMC not detected - some features may be limited");
        }
    }
    
    /**
     * Simple version comparison utility
     */
    private int compareVersions(String v1, String v2) {
        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");
        
        int maxLength = Math.max(parts1.length, parts2.length);
        for (int i = 0; i < maxLength; i++) {
            int num1 = i < parts1.length ? Integer.parseInt(parts1[i]) : 0;
            int num2 = i < parts2.length ? Integer.parseInt(parts2[i]) : 0;
            
            if (num1 != num2) {
                return Integer.compare(num1, num2);
            }
        }
        return 0;
    }

}
