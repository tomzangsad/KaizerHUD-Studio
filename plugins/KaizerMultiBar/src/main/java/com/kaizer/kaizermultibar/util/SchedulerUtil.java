package com.kaizer.kaizermultibar.util;

import com.kaizer.kaizermultibar.KaizerMultiBarCore;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.function.Consumer;

/**
 * Scheduler utility that supports both Bukkit/Paper and Folia.
 * Folia uses regionised threading and requires different scheduler access.
 */
public class SchedulerUtil {

    private static Boolean isFolia = null;
    private static Object globalRegionScheduler = null;
    private static Object asyncScheduler = null;

    /**
     * Check if running on Folia
     */
    public static boolean isFolia() {
        if (isFolia == null) {
            try {
                Class.forName("io.papermc.paper.threadedregions.scheduler.GlobalRegionScheduler");
                isFolia = true;
            } catch (ClassNotFoundException e) {
                isFolia = false;
            }
        }
        return isFolia;
    }

    /**
     * Run a task immediately
     */
    public static void runTask(Plugin plugin, Runnable task) {
        if (isFolia()) {
            runFoliaTask(plugin, task);
        } else {
            Bukkit.getScheduler().runTask(plugin, task);
        }
    }

    /**
     * Run a task with delay
     */
    public static void runTaskLater(Plugin plugin, Runnable task, long delayTicks) {
        if (isFolia()) {
            runFoliaTaskLater(plugin, task, delayTicks);
        } else {
            Bukkit.getScheduler().runTaskLater(plugin, task, delayTicks);
        }
    }

    /**
     * Run a repeating task
     */
    public static void runTaskTimer(Plugin plugin, Runnable task, long delayTicks, long periodTicks) {
        if (isFolia()) {
            runFoliaTaskTimer(plugin, task, delayTicks, periodTicks);
        } else {
            Bukkit.getScheduler().runTaskTimer(plugin, task, delayTicks, periodTicks);
        }
    }

    /**
     * Run a task for a specific player (Folia: player scheduler, Bukkit: global scheduler)
     */
    public static void runTaskForPlayer(Plugin plugin, Player player, Runnable task) {
        if (isFolia()) {
            runFoliaPlayerTask(plugin, player, task);
        } else {
            Bukkit.getScheduler().runTask(plugin, task);
        }
    }

    /**
     * Run a delayed task for a specific player
     */
    public static void runTaskLaterForPlayer(Plugin plugin, Player player, Runnable task, long delayTicks) {
        if (isFolia()) {
            runFoliaPlayerTaskLater(plugin, player, task, delayTicks);
        } else {
            Bukkit.getScheduler().runTaskLater(plugin, task, delayTicks);
        }
    }

    /**
     * Cancel all tasks for this plugin
     */
    public static void cancelTasks(Plugin plugin) {
        if (isFolia()) {
            // Folia tasks are cancelled automatically when plugin is disabled
            // But we can cancel specific schedulers if needed
        } else {
            Bukkit.getScheduler().cancelTasks(plugin);
        }
    }

    /**
     * Cancel a specific task by ID (Bukkit only - Folia uses different system)
     */
    public static void cancelTask(int taskId) {
        if (!isFolia()) {
            Bukkit.getScheduler().cancelTask(taskId);
        }
        // Folia doesn't use task IDs, tasks are cancelled via ScheduledTask instance
    }

    // ========== Folia Implementation ==========
    // Folia API signatures (all use Consumer<ScheduledTask>, not Runnable):
    //   GlobalRegionScheduler.run(Plugin, Consumer)
    //   GlobalRegionScheduler.runDelayed(Plugin, Consumer, long delayTicks)
    //   GlobalRegionScheduler.runAtFixedRate(Plugin, Consumer, long initialDelay, long period)
    //   EntityScheduler.run(Plugin, Consumer, Runnable retired)
    //   EntityScheduler.runDelayed(Plugin, Consumer, Runnable retired, long delayTicks)

    private static void runFoliaTask(Plugin plugin, Runnable task) {
        try {
            Object scheduler = getGlobalRegionScheduler();
            java.util.function.Consumer<Object> taskConsumer = scheduledTask -> task.run();
            scheduler.getClass().getMethod("run", Plugin.class, java.util.function.Consumer.class)
                    .invoke(scheduler, plugin, taskConsumer);
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to schedule Folia task: " + e.getMessage());
        }
    }

    private static void runFoliaTaskLater(Plugin plugin, Runnable task, long delay) {
        try {
            Object scheduler = getGlobalRegionScheduler();
            java.util.function.Consumer<Object> taskConsumer = scheduledTask -> task.run();
            long safeDelay = Math.max(1L, delay);
            scheduler.getClass().getMethod("runDelayed", Plugin.class, java.util.function.Consumer.class, long.class)
                    .invoke(scheduler, plugin, taskConsumer, safeDelay);
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to schedule delayed Folia task: " + e.getMessage());
        }
    }

    private static void runFoliaTaskTimer(Plugin plugin, Runnable task, long delay, long period) {
        try {
            Object scheduler = getGlobalRegionScheduler();
            java.util.function.Consumer<Object> taskConsumer = scheduledTask -> task.run();

            // Folia requires initialDelay > 0
            long initialDelay = Math.max(1L, delay);
            scheduler.getClass().getMethod("runAtFixedRate", Plugin.class, java.util.function.Consumer.class, long.class, long.class)
                    .invoke(scheduler, plugin, taskConsumer, initialDelay, period);

            // If delay was 0, run task immediately as well
            if (delay <= 0) {
                task.run();
            }
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to schedule Folia timer task: " + e.getMessage());
        }
    }

    private static void runFoliaPlayerTask(Plugin plugin, Player player, Runnable task) {
        try {
            Object scheduler = player.getClass().getMethod("getScheduler").invoke(player);
            java.util.function.Consumer<Object> taskConsumer = scheduledTask -> task.run();
            // EntityScheduler.run(Plugin, Consumer<ScheduledTask>, Runnable retired)
            scheduler.getClass().getMethod("run", Plugin.class, java.util.function.Consumer.class, Runnable.class)
                    .invoke(scheduler, plugin, taskConsumer, (Runnable) null);
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to schedule player task on Folia: " + e.getMessage());
            // Fallback to global scheduler
            runFoliaTask(plugin, task);
        }
    }

    private static void runFoliaPlayerTaskLater(Plugin plugin, Player player, Runnable task, long delay) {
        try {
            Object scheduler = player.getClass().getMethod("getScheduler").invoke(player);
            java.util.function.Consumer<Object> taskConsumer = scheduledTask -> task.run();
            long safeDelay = Math.max(1L, delay);
            // EntityScheduler.runDelayed(Plugin, Consumer<ScheduledTask>, Runnable retired, long delayTicks)
            scheduler.getClass().getMethod("runDelayed", Plugin.class, java.util.function.Consumer.class, Runnable.class, long.class)
                    .invoke(scheduler, plugin, taskConsumer, (Runnable) null, safeDelay);
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to schedule delayed player task on Folia: " + e.getMessage());
            // Fallback to global scheduler
            runFoliaTaskLater(plugin, task, delay);
        }
    }

    private static Object getGlobalRegionScheduler() {
        if (globalRegionScheduler == null) {
            try {
                globalRegionScheduler = Bukkit.class.getMethod("getGlobalRegionScheduler").invoke(null);
            } catch (Exception e) {
                throw new RuntimeException("Failed to get Folia GlobalRegionScheduler", e);
            }
        }
        return globalRegionScheduler;
    }
}
