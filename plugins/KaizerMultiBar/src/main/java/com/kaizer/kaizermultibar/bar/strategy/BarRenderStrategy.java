package com.kaizer.kaizermultibar.bar.strategy;

import org.bukkit.entity.Player;

import java.util.Set;
import java.util.UUID;

/**
 * Strategy Pattern — defines how BossBars are rendered for players.
 * Concrete implementations: {@link CombinedBarStrategy}, {@link SplitBarStrategy}.
 */
public interface BarRenderStrategy {

    /** Creates and shows BossBar(s) for the player. */
    void initPlayer(Player player);

    /** Updates BossBar text/progress for the player. */
    void updatePlayer(Player player);

    /** Removes and cleans up BossBar(s) for the player. */
    void removePlayer(Player player);

    /** Removes all BossBars for all players (used on plugin disable / reload). */
    void removeAll();

    /** Toggles visibility of BossBar(s) for the player. */
    void toggleVisibility(Player player);

    /** Returns true if this player already has bars initialized. */
    boolean hasBarsFor(Player player);

    /** Returns the set of BossBar UUIDs managed by this strategy (used for priority tracking). */
    Set<UUID> getManagedBarUuids();

    /** Makes the next update send the data again (respawn / world change). Boss bars: nothing to do. */
    default void refresh(Player player) {}
}
