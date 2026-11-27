package kz.kaizerui;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Optional reflection bridges for multi-currency plugins (PlayerPoints &amp; CoinsEngine).
 * Zero compile-time dependency: safely degrades when either plugin is absent.
 */
final class CurrencyHook {
    private static Boolean ppChecked;
    private static Object ppApi;
    private static Method ppLook, ppTake, ppGive;

    private static Boolean ceChecked;
    private static Class<?> ceApiCls, ceCurrCls;
    private static Method ceGetCurr, ceGetBal, ceRemBal, ceAddBal;

    private CurrencyHook() {}

    static boolean hasPlayerPoints() {
        initPlayerPoints();
        return ppApi != null;
    }

    static int getPoints(Player p) {
        if (!hasPlayerPoints() || p == null || ppLook == null) return 0;
        try {
            Object v = ppLook.invoke(ppApi, p.getUniqueId());
            return v instanceof Number n ? n.intValue() : 0;
        } catch (Throwable t) {
            return 0;
        }
    }

    static boolean takePoints(Player p, int amount) {
        if (!hasPlayerPoints() || p == null || amount < 0) return false;
        if (amount == 0) return true;
        try {
            if (getPoints(p) < amount) return false;
            Object ok = ppTake.invoke(ppApi, p.getUniqueId(), amount);
            return ok instanceof Boolean b && b;
        } catch (Throwable t) {
            return false;
        }
    }

    static boolean givePoints(Player p, int amount) {
        if (!hasPlayerPoints() || p == null || amount < 0) return false;
        if (amount == 0) return true;
        try {
            Object ok = ppGive.invoke(ppApi, p.getUniqueId(), amount);
            return ok instanceof Boolean b && b;
        } catch (Throwable t) {
            return false;
        }
    }

    static boolean hasCoinsEngine() {
        initCoinsEngine();
        return ceApiCls != null;
    }

    static boolean takeCurrency(Player p, String currencyId, double amount) {
        if (!hasCoinsEngine() || p == null || currencyId == null || currencyId.isBlank() || amount < 0) return false;
        try {
            Object curr = ceGetCurr.invoke(null, currencyId.trim());
            if (curr == null) return false;
            if (amount == 0) return true;
            Object balObj = ceGetBal.invoke(null, p, curr);
            double bal = balObj instanceof Number n ? n.doubleValue() : 0;
            if (bal + 1e-6 < amount) return false;
            ceRemBal.invoke(null, p, curr, amount);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    static boolean giveCurrency(Player p, String currencyId, double amount) {
        if (!hasCoinsEngine() || p == null || currencyId == null || currencyId.isBlank() || amount < 0) return false;
        try {
            Object curr = ceGetCurr.invoke(null, currencyId.trim());
            if (curr == null) return false;
            if (amount == 0) return true;
            ceAddBal.invoke(null, p, curr, amount);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    private static synchronized void initPlayerPoints() {
        if (Boolean.TRUE.equals(ppChecked) && ppApi != null) return;
        ppChecked = true;
        if (!Bukkit.getPluginManager().isPluginEnabled("PlayerPoints")) return;
        try {
            Class<?> cls = Class.forName("org.black_ixx.playerpoints.PlayerPoints");
            Object inst = cls.getMethod("getInstance").invoke(null);
            Object api = cls.getMethod("getAPI").invoke(inst);
            if (api == null) return;
            Class<?> apiCls = api.getClass();
            ppLook = apiCls.getMethod("look", UUID.class);
            ppTake = apiCls.getMethod("take", UUID.class, int.class);
            ppGive = apiCls.getMethod("give", UUID.class, int.class);
            ppApi = api;
        } catch (Throwable t) {
            ppApi = null;
        }
    }

    private static synchronized void initCoinsEngine() {
        if (Boolean.TRUE.equals(ceChecked) && ceApiCls != null) return;
        ceChecked = true;
        if (!Bukkit.getPluginManager().isPluginEnabled("CoinsEngine")) return;
        try {
            ceApiCls = Class.forName("su.nightexpress.coinsengine.api.CoinsEngineAPI");
            ceCurrCls = Class.forName("su.nightexpress.coinsengine.api.currency.Currency");
            ceGetCurr = ceApiCls.getMethod("getCurrency", String.class);
            ceGetBal = ceApiCls.getMethod("getBalance", Player.class, ceCurrCls);
            ceRemBal = ceApiCls.getMethod("removeBalance", Player.class, ceCurrCls, double.class);
            ceAddBal = ceApiCls.getMethod("addBalance", Player.class, ceCurrCls, double.class);
        } catch (Throwable t) {
            ceApiCls = null;
        }
    }
}
