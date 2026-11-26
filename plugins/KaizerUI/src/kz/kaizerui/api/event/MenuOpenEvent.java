package kz.kaizerui.api.event;

import org.bukkit.entity.Player;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;

import java.util.Map;

/**
 * Fired right before a KaizerUI menu is opened for a player (Java or Bedrock).
 * Listeners may cancel opening or mutate the per-player placeholder map before rendering.
 */
public final class MenuOpenEvent extends Event implements Cancellable {
    private static final HandlerList HANDLERS = new HandlerList();

    private final Player player;
    private final String menuId;
    private final boolean bedrock;
    private final Map<String, String> placeholders;
    private boolean cancelled;

    public MenuOpenEvent(Player player, String menuId, boolean bedrock, Map<String, String> placeholders) {
        this.player = player;
        this.menuId = menuId;
        this.bedrock = bedrock;
        this.placeholders = placeholders;
    }

    public Player getPlayer() { return player; }

    public String getMenuId() { return menuId; }

    public boolean isBedrock() { return bedrock; }

    /** Mutable map of custom per-player placeholders for this session. */
    public Map<String, String> getPlaceholders() { return placeholders; }

    @Override
    public boolean isCancelled() { return cancelled; }

    @Override
    public void setCancelled(boolean cancel) { this.cancelled = cancel; }

    @Override
    public HandlerList getHandlers() { return HANDLERS; }

    public static HandlerList getHandlerList() { return HANDLERS; }
}
