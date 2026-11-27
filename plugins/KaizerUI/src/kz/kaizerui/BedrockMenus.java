package kz.kaizerui;

import kz.kaizerui.api.event.MenuCloseEvent;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.geysermc.cumulus.form.CustomForm;
import org.geysermc.cumulus.form.Form;
import org.geysermc.cumulus.form.SimpleForm;
import org.geysermc.cumulus.util.FormImage;

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
        SimpleForm.Builder b = SimpleForm.builder()
                .title(menu.bedrockTitle)
                .content("");
        addMenuSlotButtons(b, p, menu);
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

    private void addMenuSlotButtons(SimpleForm.Builder b, Player p, MenuDef menu) {
        String[] slots = new String[Math.max(0, menu.bedrockSlots)];
        String[] slotImages = new String[slots.length];
        for (int i = 0; i < slots.length; i++) slots[i] = String.format("kzs%02d|", i);
        for (MenuDef.Element e : menu.elements) {
            if (e.bedrockSlot < 0 || e.bedrockSlot >= slots.length) continue;
            if (e.type == MenuDef.Type.ITEM) {
                slots[e.bedrockSlot] = String.format("kzs%02d|", e.bedrockSlot);
                slotImages[e.bedrockSlot] = Items.bedrockTextureOf(plugin, p, e.item);
                continue;
            }
            String dyn = plugin.dynamicText(p, e.id);
            String raw;
            if (e.type == MenuDef.Type.INPUT) {
                String cur = plugin.getSessionVar(p.getUniqueId(), e.varName, e.defaultValue);
                raw = dyn != null ? dyn : ((e.prefix != null ? e.prefix : "") + cur + (e.suffix != null ? e.suffix : ""));
            } else {
                raw = dyn != null ? dyn : (e.type == MenuDef.Type.BUTTON ? e.label : e.text);
            }
            // "kzs03|text": the pack shows each form button at its own element by this marker
            String elCol = e.type == MenuDef.Type.BUTTON ? e.labelColor
                    : (e.type == MenuDef.Type.INPUT ? e.textColor : e.color);
            String resolved = safeBedrockText(Texts.section(plugin.resolveText(p, raw)), elCol);
            slots[e.bedrockSlot] = String.format("kzs%02d|", e.bedrockSlot) + resolved;
        }
        for (int i = 0; i < slots.length; i++) {
            if (slotImages[i] != null && !slotImages[i].isBlank()) {
                b.button(slots[i], FormImage.of(FormImage.Type.PATH, slotImages[i]));
            } else {
                b.button(slots[i]);
            }
        }
    }

    /** Prevents Bedrock JSON UI strtod() expression parsing from swallowing labels starting with digits or symbols. */
    private static String safeBedrockText(String text, String hexColor) {
        if (text == null || text.isEmpty()) return "";
        if (text.charAt(0) == '§') return text;
        int idx = 0;
        while (idx < text.length() && Character.isWhitespace(text.charAt(idx))) idx++;
        if (idx >= text.length()) return text;
        char c = text.charAt(idx);
        if ((c >= '0' && c <= '9') || c == '<' || c == '>' || c == '-' || c == '+' || c == '=' || c == '/' || c == '!' || c == '(' || c == '[' || c == '.') {
            return "§" + nearestBedrockColor(hexColor) + text;
        }
        return text;
    }

    private static char nearestBedrockColor(String hex) {
        if (hex == null) return 'f';
        String clean = hex.trim();
        if (clean.startsWith("#")) clean = clean.substring(1);
        if (clean.length() != 6) return 'f';
        int rgb;
        try { rgb = Integer.parseInt(clean, 16); }
        catch (NumberFormatException ex) { return 'f'; }
        int r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
        final char[] codes = {'0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'};
        final int[][] pal = {
            {0,0,0},{0,0,170},{0,170,0},{0,170,170},{170,0,0},{170,0,170},{255,170,0},{170,170,170},
            {85,85,85},{85,85,255},{85,255,85},{85,255,255},{255,85,85},{255,85,255},{255,255,85},{255,255,255}
        };
        int bestIdx = 15;
        int bestDist = Integer.MAX_VALUE;
        for (int i = 0; i < pal.length; i++) {
            int dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2];
            int dist = dr * dr + dg * dg + db * db;
            if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        return codes[bestIdx];
    }

    private void clicked(Player p, MenuDef menu, int slot) {
        if (!p.isOnline()) return;
        MenuDef.Element e = menu.bySlot(slot);
        if (e != null && e.type == MenuDef.Type.INPUT) {
            openInputForm(p, menu, e);
            return;
        }
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

    /** Native Bedrock Cumulus CustomForm dialog for interactive number / slider / text inputs. */
    void openInputForm(Player p, MenuDef menu, MenuDef.Element el) {
        if (!p.isOnline() || bridge == null) return;
        String title = Texts.section(plugin.resolveText(p, el.promptTitle != null && !el.promptTitle.isBlank() ? el.promptTitle : menu.title));
        String curVal = plugin.getSessionVar(p.getUniqueId(), el.varName, el.defaultValue);
        String fieldLabel = Texts.section(plugin.resolveText(p, (el.name != null && !el.name.isBlank() ? el.name : el.varName)));
        boolean sliderMode = "slider".equals(el.inputType);

        CustomForm.Builder cb = CustomForm.builder().title(title);
        if (sliderMode) {
            float min = (float) el.inputMin;
            float max = (float) Math.max(el.inputMin + 1, el.inputMax);
            float step = (float) Math.max(0.01, el.inputStep);
            float defNum = min;
            try { defNum = Math.max(min, Math.min(max, Float.parseFloat(curVal))); } catch (NumberFormatException ignored) {}
            cb.slider(fieldLabel, min, max, step, defNum);
        } else {
            cb.input(fieldLabel, Texts.section(el.placeholder != null ? el.placeholder : ""), curVal != null ? curVal : "");
        }

        cb.validResultHandler(res -> Sched.entity(plugin, p, () -> {
            String out;
            if (sliderMode) {
                float fv = res.asSlider(0);
                out = KaizerUIPlugin.formatNumber(fv);
            } else {
                String rawIn = res.asInput(0);
                String trimmed = rawIn == null ? "" : rawIn.trim();
                if (!"text".equals(el.inputType)) {
                    try {
                        double n = Double.parseDouble(trimmed.replace(",", ""));
                        n = Math.max(el.inputMin, Math.min(el.inputMax, n));
                        out = KaizerUIPlugin.formatNumber(n);
                    } catch (NumberFormatException ex) {
                        out = curVal;
                    }
                } else {
                    out = trimmed;
                }
            }
            plugin.setSessionVar(p.getUniqueId(), el.varName, out);
            if (el.actions != null && !el.actions.isEmpty()) {
                Actions.After after = Actions.run(plugin, p, menu, el, true);
                if (after == Actions.After.CLOSE) {
                    plugin.fireCloseEvent(p, menu.id, MenuCloseEvent.Reason.BUTTON_CLOSE, true);
                    plugin.clearBedrockSession(p.getUniqueId());
                    return;
                } else if (after == Actions.After.OPENED_OTHER) {
                    return;
                }
            }
            Sched.entityLater(plugin, p, 1, () -> open(p, menu));
        }));

        cb.closedOrInvalidResultHandler(() -> Sched.entityLater(plugin, p, 1, () -> open(p, menu)));
        if (!bridge.send(p.getUniqueId(), cb.build())) {
            Sched.entityLater(plugin, p, 1, () -> open(p, menu));
        }
    }

    /** Opens an in-place animated crate spin on the same Bedrock menu page and awards the server-rolled prize. */
    void openSpinForm(Player p, MenuDef menu, MenuDef.Element rouletteEl) {
        if (!p.isOnline() || bridge == null || rouletteEl.rewards.isEmpty()) return;
        MenuDef.Reward winner = RoulettePart.rollWinner(rouletteEl.rewards);
        String winnerTex = Items.bedrockTextureOf(plugin, p, winner.item());
        String ns = plugin.studio() != null ? plugin.studio().font.split(":")[0] : "kaizerui";
        String title = "kz:" + ns + ":spin:" + menu.id + ":" + rouletteEl.id + "|";

        java.util.concurrent.atomic.AtomicBoolean granted = new java.util.concurrent.atomic.AtomicBoolean(false);
        Runnable grant = () -> {
            if (!granted.compareAndSet(false, true)) return;
            plugin.setSessionVar(p.getUniqueId(), "reward_id", winner.id());
            plugin.setSessionVar(p.getUniqueId(), "reward_name", winner.name());
            plugin.setSessionVar(p.getUniqueId(), "reward_item", winner.item());
            Actions.playSound(p, rouletteEl.winSound);
            Actions.runList(plugin, p, menu, winner.actions(), true);
        };

        long ticks = Math.max(20L, Math.round(rouletteEl.durationSec * 20.0));
        Sched.entityLater(plugin, p, ticks, () -> { if (p.isOnline()) grant.run(); });

        SimpleForm.Builder b = SimpleForm.builder().title(title).content("");
        addMenuSlotButtons(b, p, menu);
        int winSlot = Math.max(0, menu.bedrockSlots);
        String btnText = String.format("kzs%02d|", winSlot) + safeBedrockText(Texts.section("&a&l" + winner.name()), "#55ff55");
        if (winnerTex != null && !winnerTex.isBlank()) b.button(btnText, FormImage.of(FormImage.Type.PATH, winnerTex));
        else b.button(btnText);

        b.validResultHandler(res -> Sched.entity(plugin, p, () -> {
            grant.run();
            int id = res.clickedButtonId();
            if (id >= 0 && id < menu.bedrockSlots) clicked(p, menu, id);
            else open(p, menu);
        }));
        b.closedOrInvalidResultHandler(() -> Sched.entity(plugin, p, () -> {
            grant.run();
            plugin.fireCloseEvent(p, menu.id, MenuCloseEvent.Reason.BEDROCK_DISMISSED, true);
            plugin.clearBedrockSession(p.getUniqueId());
        }));
        if (!bridge.send(p.getUniqueId(), b.build())) {
            grant.run();
            Sched.entityLater(plugin, p, 1, () -> open(p, menu));
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
