package com.kaizer.kaizermultibar.bar.strategy;

import org.bukkit.boss.BossBar;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Shared base for bar strategies — handles BossBar UUID tracking and priority reflection.
 */
public abstract class AbstractBarStrategy implements BarRenderStrategy {

    protected final Set<UUID> managedBarUuids = ConcurrentHashMap.newKeySet();

    /** Attempts to extract the BossBar's UUID and register it as managed. */
    protected void trackBarUuid(BossBar bar) {
        UUID uuid = resolveBarUuid(bar);
        if (uuid != null) managedBarUuids.add(uuid);
    }

    /** Removes the BossBar's UUID from the managed set. */
    protected void untrackBarUuid(BossBar bar) {
        UUID uuid = resolveBarUuid(bar);
        if (uuid != null) managedBarUuids.remove(uuid);
    }

    /**
     * Tries to get the UUID via Paper's getUniqueId(), then falls back to
     * CraftBossBar's internal NMS handle field.
     */
    private UUID resolveBarUuid(BossBar bar) {
        if (bar == null) return null;
        // Try direct getUniqueId() (some Paper versions)
        try {
            Method m = bar.getClass().getMethod("getUniqueId");
            return (UUID) m.invoke(bar);
        } catch (Exception ignored) {}
        // Try direct getId() (some Paper versions)
        try {
            Method m = bar.getClass().getMethod("getId");
            Object result = m.invoke(bar);
            if (result instanceof UUID) return (UUID) result;
        } catch (Exception ignored) {}
        // Try via NMS handle — getUniqueId()
        try {
            Field f = bar.getClass().getDeclaredField("handle");
            f.setAccessible(true);
            Object handle = f.get(bar);
            if (handle != null) {
                try {
                    Method m = handle.getClass().getMethod("getUniqueId");
                    return (UUID) m.invoke(handle);
                } catch (Exception ignored2) {}
                // Mojang mappings on Paper 1.21+: getId()
                try {
                    Method m = handle.getClass().getMethod("getId");
                    Object result = m.invoke(handle);
                    if (result instanceof UUID) return (UUID) result;
                } catch (Exception ignored2) {}
            }
        } catch (Exception ignored) {}
        return null;
    }

    /** Attempts to set bar display priority via reflection (Paper-only API). */
    protected void trySetPriority(BossBar bar) {
        try {
            Method m = bar.getClass().getMethod("setPriority", int.class);
            m.invoke(bar, Integer.MAX_VALUE);
        } catch (Exception ignored) {}
    }

    @Override
    public Set<UUID> getManagedBarUuids() {
        return managedBarUuids;
    }
}
