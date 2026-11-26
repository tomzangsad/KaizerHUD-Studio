package kz.kaizerui.api.event;

import org.bukkit.entity.Player;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;

import java.util.Collections;
import java.util.List;

/**
 * Fired when a player clicks a button in a KaizerUI menu (Java or Bedrock).
 * If the button has an {@code event:<key>} action, {@link #getEventKey()} returns {@code <key>}.
 * Cancelling prevents the button's configured actions from executing.
 */
public final class MenuClickEvent extends Event implements Cancellable {
    private static final HandlerList HANDLERS = new HandlerList();

    private final Player player;
    private final String menuId;
    private final String elementId;
    private final String elementName;
    private final String eventKey;
    private final List<String> actions;
    private final boolean bedrock;
    private boolean cancelled;

    public MenuClickEvent(Player player, String menuId, String elementId, String elementName,
                          String eventKey, List<String> actions, boolean bedrock) {
        this.player = player;
        this.menuId = menuId;
        this.elementId = elementId;
        this.elementName = elementName;
        this.eventKey = eventKey == null ? "" : eventKey;
        this.actions = actions == null ? List.of() : Collections.unmodifiableList(actions);
        this.bedrock = bedrock;
    }

    public Player getPlayer() { return player; }

    public String getMenuId() { return menuId; }

    public String getElementId() { return elementId; }

    public String getElementName() { return elementName; }

    /** Key from {@code event:<key>} action, or empty string if none. */
    public String getEventKey() { return eventKey; }

    public List<String> getActions() { return actions; }

    public boolean isBedrock() { return bedrock; }

    @Override
    public boolean isCancelled() { return cancelled; }

    @Override
    public void setCancelled(boolean cancel) { this.cancelled = cancel; }

    @Override
    public HandlerList getHandlers() { return HANDLERS; }

    public static HandlerList getHandlerList() { return HANDLERS; }
}
