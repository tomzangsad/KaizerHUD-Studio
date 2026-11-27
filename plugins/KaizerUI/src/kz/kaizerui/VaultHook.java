package kz.kaizerui;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * Reflection bridge to Vault Economy ({@code net.milkbowl.vault.economy.Economy}).
 * Completely optional — loads only when Vault and an economy provider (e.g. EssentialsX) exist.
 */
final class VaultHook {
    private static Boolean checked;
    private static Object econ;
    private static Method getBalanceM, withdrawM, depositM, formatM;

    private VaultHook() {}

    static boolean available() {
        init();
        return econ != null;
    }

    static double balance(Player p) {
        if (!available() || p == null) return 0;
        try {
            Object v = getBalanceM.invoke(econ, p);
            return v instanceof Number n ? n.doubleValue() : 0;
        } catch (Throwable t) {
            return 0;
        }
    }

    static boolean withdraw(Player p, double amount) {
        if (!available() || p == null || amount < 0) return false;
        if (amount == 0) return true;
        try {
            Object resp = withdrawM.invoke(econ, p, amount);
            return succeeded(resp);
        } catch (Throwable t) {
            return false;
        }
    }

    static boolean deposit(Player p, double amount) {
        if (!available() || p == null || amount < 0) return false;
        if (amount == 0) return true;
        try {
            Object resp = depositM.invoke(econ, p, amount);
            return succeeded(resp);
        } catch (Throwable t) {
            return false;
        }
    }

    static String format(double amount) {
        if (available() && formatM != null) {
            try {
                Object out = formatM.invoke(econ, amount);
                if (out != null && !out.toString().isBlank()) return out.toString();
            } catch (Throwable ignored) {}
        }
        DecimalFormat df = new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.US));
        return "$" + df.format(amount);
    }

    private static boolean succeeded(Object resp) {
        if (resp == null) return false;
        try {
            Object ok = resp.getClass().getMethod("transactionSuccess").invoke(resp);
            return ok instanceof Boolean b && b;
        } catch (Throwable t) {
            return false;
        }
    }

    private static synchronized void init() {
        if (Boolean.TRUE.equals(checked) && econ != null) return;
        checked = true;
        if (!Bukkit.getPluginManager().isPluginEnabled("Vault")) return;
        try {
            Class<?> econCls = Class.forName("net.milkbowl.vault.economy.Economy");
            Object reg = Bukkit.getServicesManager().getRegistration(econCls);
            if (reg == null) return;
            Object prov = reg.getClass().getMethod("getProvider").invoke(reg);
            if (prov == null) return;
            getBalanceM = econCls.getMethod("getBalance", OfflinePlayer.class);
            withdrawM = econCls.getMethod("withdrawPlayer", OfflinePlayer.class, double.class);
            depositM = econCls.getMethod("depositPlayer", OfflinePlayer.class, double.class);
            try { formatM = econCls.getMethod("format", double.class); } catch (NoSuchMethodException ignored) {}
            econ = prov;
        } catch (Throwable t) {
            econ = null;
        }
    }
}
