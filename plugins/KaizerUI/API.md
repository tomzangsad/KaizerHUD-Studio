# KaizerUI Developer API (`kz.kaizerui.api`)

KaizerUI exposes a clean Bukkit API and event system so other plugins can open menus, inject per-player placeholders, swap items/texts dynamically, and handle button clicks (`event:<key>`) on both **Java** and **Bedrock**.

## 1. Obtaining the API

In your `plugin.yml`, add:
```yaml
depend: [KaizerUI] # or softdepend: [KaizerUI]
```

Then retrieve the API either directly or via Bukkit's `ServicesManager`:

```java
import kz.kaizerui.api.KaizerUI;

if (KaizerUI.isAvailable()) {
    KaizerUI ui = KaizerUI.get();
}

// Or via ServicesManager:
KaizerUI ui = Bukkit.getServicesManager().load(KaizerUI.class);
```

## 2. Methods (`kz.kaizerui.api.KaizerUI`)

| Method | Description |
|---|---|
| `open(Player, String menuId)` | Opens a menu (automatically picks Java or Bedrock). Returns `false` if the menu ID does not exist. |
| `open(Player, String menuId, Map<String, String> placeholders)` | Opens a menu with per-player custom placeholders (`%key%` and `{key}`). |
| `close(Player)` | Closes the player's open Java menu. |
| `isOpen(Player)` | Returns `true` if the player currently has a Java or Bedrock KaizerUI menu open. |
| `currentMenuId(Player)` | Returns the currently open menu ID, or `null`. |
| `menuIds()` / `hasMenu(String)` | Lists loaded menu IDs / checks if a menu exists. |
| `refresh(Player)` | Re-evaluates texts, placeholders, dynamic items, and armor outfits immediately. |
| `setPlaceholder(Player, String key, String value)` | Sets a custom placeholder for the player (`null` removes it). |
| `clearPlaceholders(Player)` | Clears custom placeholders for the player. |
| `setDynamicText(Player, String elementId, String text)` | Overrides the text/label of a specific `text` or `button` element for this player. |
| `setDynamicItem(Player, String elementId, ItemStack item)` | Overrides the displayed `ItemStack` of an `item` element for this player (Java). |
| `clearDynamicOverrides(Player)` | Clears dynamic text/item overrides for the player. |
| `reload()` | Reloads `config.yml`, `studio.yml`, and `menus/*.yml`. |

## 3. Bukkit Events (`kz.kaizerui.api.event`)

- **`MenuOpenEvent`** (`Cancellable`) — Fired right before opening a menu on Java or Bedrock. Listeners can cancel opening or mutate `event.getPlaceholders()`.
- **`MenuClickEvent`** (`Cancellable`) — Fired whenever a player clicks a button. If the button has an `event:<key>` action, `event.getEventKey()` returns `<key>`. Cancelling stops the button's configured actions.
- **`MenuCloseEvent`** — Fired when a menu closes (`Reason`: `PLAYER_SNEAK`, `BUTTON_CLOSE`, `SWITCH_MENU`, `DAMAGED`, `TELEPORT`, `WORLD_CHANGE`, `DEATH`, `QUIT`, `API`, `RELOAD`, `BEDROCK_DISMISSED`).

## 4. Examples

### Custom Shop Button with `event:buy_vip`
In GUI Studio, add `event:buy_vip` to the button's **Actions**:

```java
import kz.kaizerui.api.KaizerUI;
import kz.kaizerui.api.event.MenuClickEvent;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;

public final class ShopListener implements Listener {
    @EventHandler
    public void onMenuClick(MenuClickEvent e) {
        if (!"shop".equals(e.getMenuId())) return;
        if (!"buy_vip".equals(e.getEventKey())) return;

        var player = e.getPlayer();
        if (!hasEnoughCoins(player, 500)) {
            e.setCancelled(true);
            player.sendMessage("§cNot enough coins!");
            return;
        }
        takeCoins(player, 500);
        KaizerUI.get().setPlaceholder(player, "coins", String.valueOf(getCoins(player)));
        KaizerUI.get().refresh(player);
    }
}
```

### Dynamic Auction / Reward Item
```java
KaizerUI ui = KaizerUI.get();
ui.setDynamicItem(player, "featured_slot", auctionItemStack);
ui.setDynamicText(player, "featured_price", "&ePrice: &6" + price + "g");
ui.open(player, "auction", Map.of("seller", sellerName));
```
