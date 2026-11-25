package kz.kaizerui;

import io.papermc.paper.threadedregions.scheduler.ScheduledTask;
import org.bukkit.Bukkit;
import org.bukkit.entity.Entity;
import org.bukkit.plugin.Plugin;

/** Scheduling that works on Paper and Folia (entity + global region schedulers exist on both). */
public final class Sched {
    private Sched() {}

    /** Run on the entity's thread (now if possible, otherwise next tick). */
    public static void entity(Plugin plugin, Entity e, Runnable r) {
        e.getScheduler().run(plugin, t -> r.run(), null);
    }

    public static void entityLater(Plugin plugin, Entity e, long ticks, Runnable r) {
        e.getScheduler().runDelayed(plugin, t -> r.run(), null, Math.max(1, ticks));
    }

    public static ScheduledTask entityRepeat(Plugin plugin, Entity e, long period, Runnable r) {
        return e.getScheduler().runAtFixedRate(plugin, t -> r.run(), null, Math.max(1, period), Math.max(1, period));
    }

    public static void global(Plugin plugin, Runnable r) {
        Bukkit.getGlobalRegionScheduler().execute(plugin, r);
    }
}
