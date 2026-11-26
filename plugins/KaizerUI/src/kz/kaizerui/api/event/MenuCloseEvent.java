package kz.kaizerui.api.event;

import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;

/**
 * Fired when a KaizerUI menu closes or switches to another menu.
 */
public final class MenuCloseEvent extends Event {
    private static final HandlerList HANDLERS = new HandlerList();

    public enum Reason {
        PLAYER_SNEAK,
        BUTTON_CLOSE,
        SWITCH_MENU,
        DAMAGED,
        TELEPORT,
        WORLD_CHANGE,
        DEATH,
        QUIT,
        API,
        RELOAD,
        BEDROCK_DISMISSED
    }

    private final Player player;
    private final String menuId;
    private final Reason reason;
    private final boolean bedrock;

    public MenuCloseEvent(Player player, String menuId, Reason reason, boolean bedrock) {
        this.player = player;
        this.menuId = menuId;
        this.reason = reason;
        this.bedrock = bedrock;
    }

    public Player getPlayer() { return player; }

    public String getMenuId() { return menuId; }

    public Reason getReason() { return reason; }

    public boolean isBedrock() { return bedrock; }

    @Override
    public HandlerList getHandlers() { return HANDLERS; }

    public static HandlerList getHandlerList() { return HANDLERS; }
}
