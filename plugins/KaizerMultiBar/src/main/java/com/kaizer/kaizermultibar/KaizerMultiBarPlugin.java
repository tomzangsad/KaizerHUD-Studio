package com.kaizer.kaizermultibar;

import org.bukkit.plugin.java.JavaPlugin;

/**
 * Plugin entry point. Replaces the old KaizerMultiBarLoader (which downloaded the core
 * from a license server): the core now ships inside this jar and starts directly.
 */
public final class KaizerMultiBarPlugin extends JavaPlugin {

    private KaizerMultiBarCore core;

    @Override
    public void onEnable() {
        core = new KaizerMultiBarCore(this);
        core.onEnable();
    }

    @Override
    public void onDisable() {
        if (core != null) core.onDisable();
    }
}
