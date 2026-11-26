package kz.kaizerui;

import kz.kaizerui.api.event.MenuCloseEvent;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.geysermc.cumulus.form.Form;
import org.geysermc.cumulus.form.SimpleForm;

import java.util.Arrays;
import java.util.UUID;

/**
 * Menus for Bedrock players: each menu page is sent as a server form (SimpleForm).
 * The Bedrock pack exported with the menus (ui/server_form.json) sees the title marker
 * {@code kz:<namespace>:<menu>|} and draws the form with the menu's layout; the form's buttons
 * carry the button labels and the text elements (in "bedrock-slot" order).
 */
final class BedrockMenus {

    /** Floodgate or Geyser, whichever is installed on this server */
    interface Bridge {
        boolean isBedrock(UUID id);
        boolean send(UUID id, Form form);
        String name();
    }

    private final KaizerUIPlugin plugin;
    private final Bridge bridge;

    BedrockMenus(KaizerUIPlugin plugin) {
        this.plugin = plugin;
        Bridge b = null;
        try {
            if (Bukkit.getPluginManager().isPluginEnabled("floodgate")) b = new FloodgateBridge();
            else if (Bukkit.getPluginManager().isPluginEnabled("Geyser-Spigot")) b = new GeyserBridge();
        } catch (Throwable t) {
            plugin.getLogger().warning("Bedrock support is off: " + t);
        }
        this.bridge = b;
        if (b != null) plugin.getLogger().info("Bedrock players get menus as forms through " + b.name() + ".");
    }

    boolean available() { return bridge != null; }

    boolean isBedrock(Player p) {
        try {
            return bridge != null && bridge.isBedrock(p.getUniqueId());
        } catch (Throwable t) {
            return false;
        }
    }

    /** Sends the menu as a form. Any thread is fine; results come back on the player's thread. */
    void open(Player p, MenuDef menu) {
        if (!plugin.fireOpenEvent(p, menu, true)) return;
        plugin.setBedrockMenu(p.getUniqueId(), menu.id);
        String[] slots = new String[Math.max(0, menu.bedrockSlots)];
        for (int i = 0; i < slots.length; i++) slots[i] = String.format("kzs%02d|", i);
        for (MenuDef.Element e : menu.elements) {
            if (e.bedrockSlot < 0 || e.bedrockSlot >= slots.length) continue;
            String dyn = plugin.dynamicText(p, e.id);
            String raw = dyn != null ? dyn : (e.type == MenuDef.Type.BUTTON ? e.label : e.text);
            // "kzs03|text": the pack shows each form button at its own element by this marker
            slots[e.bedrockSlot] = String.format("kzs%02d|", e.bedrockSlot) + Texts.section(plugin.resolveText(p, raw));
        }
        SimpleForm.Builder b = SimpleForm.builder()
                .title(menu.bedrockTitle)
                .content("");
        for (String s : slots) b.button(s);
        b.validResultHandler(res -> {
            int id = res.clickedButtonId();
            Sched.entity(plugin, p, () -> clicked(p, menu, id));
        });
        b.closedOrInvalidResultHandler(() -> Sched.entity(plugin, p, () -> {
            plugin.fireCloseEvent(p, menu.id, MenuCloseEvent.Reason.BEDROCK_DISMISSED, true);
            plugin.clearBedrockSession(p.getUniqueId());
        }));
        Form form = b.build();
        if (!bridge.send(p.getUniqueId(), form)) {
            plugin.getLogger().warning("Could not send menu " + menu.id + " to Bedrock player " + p.getName());
            plugin.clearBedrockSession(p.getUniqueId());
            return;
        }
        Actions.playSound(p, menu.openSound);
    }

    private void clicked(Player p, MenuDef menu, int slot) {
        if (!p.isOnline()) return;
        MenuDef.Element e = menu.bySlot(slot);
        if (e == null || e.type != MenuDef.Type.BUTTON) {
            // a text slot (not clickable in our pack) or an unknown button: show the menu again
            Sched.entityLater(plugin, p, 1, () -> open(p, menu));
            return;
        }
        Actions.After after = Actions.run(plugin, p, menu, e, true);
        if (after == Actions.After.CLOSE) {
            plugin.fireCloseEvent(p, menu.id, MenuCloseEvent.Reason.BUTTON_CLOSE, true);
            plugin.clearBedrockSession(p.getUniqueId());
        } else if (after == Actions.After.STAY) {
            // a form closes on every click: show the same page again unless the button closes it or opens another
            Sched.entityLater(plugin, p, 2, () -> open(p, menu));
        }
    }

    /* Each bridge is its own class so only the installed plugin's classes are loaded */

    static final class FloodgateBridge implements Bridge {
        public boolean isBedrock(UUID id) { return org.geysermc.floodgate.api.FloodgateApi.getInstance().isFloodgatePlayer(id); }
        public boolean send(UUID id, Form form) { return org.geysermc.floodgate.api.FloodgateApi.getInstance().sendForm(id, form); }
        public String name() { return "Floodgate"; }
    }

    static final class GeyserBridge implements Bridge {
        public boolean isBedrock(UUID id) { return org.geysermc.geyser.api.GeyserApi.api().isBedrockPlayer(id); }
        public boolean send(UUID id, Form form) { return org.geysermc.geyser.api.GeyserApi.api().sendForm(id, form); }
        public String name() { return "Geyser"; }
    }
}
