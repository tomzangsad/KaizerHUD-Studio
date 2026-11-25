package com.kaizer.kaizermultibar.bar;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import com.kaizer.kaizermultibar.service.PlayerVisibilityService;
import com.kaizer.kaizermultibar.bar.strategy.BarRenderStrategy;
import com.kaizer.kaizermultibar.bar.strategy.ChannelBarStrategy;
import com.kaizer.kaizermultibar.bar.strategy.CombinedBarStrategy;
import com.kaizer.kaizermultibar.bar.strategy.SplitBarStrategy;
import com.kaizer.kaizermultibar.util.SchedulerUtil;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Manager Pattern — owns the BossBar lifecycle for all players.
 * Delegates rendering to the active {@link BarRenderStrategy} (combined or split).
 */
public class BossBarManager {

    private final KaizerMultiBarCore plugin;
    private final PlayerVisibilityService visibilityService;
    private BarRenderStrategy strategy;
    private final Map<UUID, Integer> scheduledInitTasks = new HashMap<>();

    public BossBarManager(KaizerMultiBarCore plugin, PlayerVisibilityService visibilityService) {
        this.plugin = plugin;
        this.visibilityService = visibilityService;
        this.strategy = buildStrategy();
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    public void initPlayer(Player player) {
        if (!plugin.getConfig().getBoolean("bossbar.enabled", true)) return;
        if (!visibilityService.canSeeBossBar(player)) {
            removePlayer(player);
            return;
        }
        strategy.initPlayer(player);
    }

    public void updateAllPlayers() {
        if (!plugin.getConfig().getBoolean("bossbar.enabled", true)) return;
        if (plugin.getConfig().getConfigurationSection("bossbar.bars") == null) return;

        for (Player player : Bukkit.getOnlinePlayers()) {
            if (!visibilityService.canSeeBossBar(player)) {
                removePlayer(player);
                continue;
            }
            if (!strategy.hasBarsFor(player)) {
                scheduleInitPlayer(player, 100L);
                continue; // bars not ready yet — will init async
            }
            strategy.updatePlayer(player);
        }
    }

    public void updatePlayer(Player player) {
        if (!plugin.getConfig().getBoolean("bossbar.enabled", true)) return;
        if (!visibilityService.canSeeBossBar(player)) {
            removePlayer(player);
            return;
        }
        if (strategy.hasBarsFor(player)) {
            strategy.updatePlayer(player);
        }
    }

    public void removePlayer(Player player) {
        strategy.removePlayer(player);
    }

    public void removeAll() {
        strategy.removeAll();
    }

    public void toggleVisibility(Player player) {
        strategy.toggleVisibility(player);
    }

    /** Re-sends the data on the next update (action bar / title channel only). */
    public void refreshPlayer(Player player) {
        strategy.refresh(player);
    }

    /** True when the data goes through a boss bar (not the action bar / title channel). */
    public boolean usesBossBar() {
        return !(strategy instanceof ChannelBarStrategy);
    }

    // -----------------------------------------------------------------------
    // Reload support — rebuilds strategy from current config
    // -----------------------------------------------------------------------

    /**
     * Removes all active bars and recreates the strategy based on the reloaded config.
     * Caller is responsible for re-initializing per-player bars afterwards.
     */
    public void reload() {
        strategy.removeAll();
        this.strategy = buildStrategy();
    }

    // -----------------------------------------------------------------------
    // Scheduled init — prevents duplicate init tasks per player
    // -----------------------------------------------------------------------

    public void scheduleInitPlayer(Player player, long delayTicks) {
        UUID uuid = player.getUniqueId();
        if (scheduledInitTasks.containsKey(uuid)) return;

        // Use SchedulerUtil for Folia compatibility
        SchedulerUtil.runTaskLaterForPlayer(plugin.getPlugin(), player, () -> {
            scheduledInitTasks.remove(uuid);
            if (player.isOnline()) initPlayer(player);
        }, delayTicks);

        // Store a placeholder task ID (Folia doesn't use task IDs)
        scheduledInitTasks.put(uuid, -1);
    }

    public void cancelScheduledInit(Player player) {
        Integer taskId = scheduledInitTasks.remove(player.getUniqueId());
        if (taskId != null && taskId > 0) {
            SchedulerUtil.cancelTask(taskId);
        }
    }

    // -----------------------------------------------------------------------
    // Priority tracking — shared with BarPriorityManager
    // -----------------------------------------------------------------------

    public Set<UUID> getManagedBarUuids() {
        return strategy.getManagedBarUuids();
    }

    public boolean hasBarsFor(Player player) {
        return strategy.hasBarsFor(player);
    }

    /** Returns true if this player is eligible for managed bars (Bedrock via Floodgate). */
    public boolean shouldManagePlayer(Player player) {
        return plugin.getConfig().getBoolean("bossbar.enabled", true)
                && visibilityService.canSeeBossBar(player);
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private BarRenderStrategy buildStrategy() {
        // bossbar.channel: bossbar (default) | title — must match the exported .mcpack
        String channelName = plugin.getConfig().getString("bossbar.channel", "bossbar");
        ChannelBarStrategy.Channel channel = ChannelBarStrategy.Channel.parse(channelName);
        if (channel != null) {
            plugin.getLogger().info("HUD data channel: " + channel.name().toLowerCase(java.util.Locale.ROOT));
            return new ChannelBarStrategy(plugin, channel);
        }
        if (channelName != null && !channelName.trim().equalsIgnoreCase("bossbar")) {
            plugin.getLogger().warning("Unknown bossbar.channel '" + channelName + "' - using bossbar.");
        }
        boolean combine = plugin.getConfig().getBoolean("bossbar.combine-into-one", true);
        return combine ? new CombinedBarStrategy(plugin) : new SplitBarStrategy(plugin);
    }
}
