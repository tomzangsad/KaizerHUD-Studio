package kz.kaizerui;

import kz.kaizerui.api.event.MenuCloseEvent;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityDismountEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.event.player.PlayerAnimationEvent;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerItemHeldEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerSwapHandItemsEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.event.player.PlayerToggleSneakEvent;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Hologram menus for Java players: open / close and all the input while a menu is open. */
final class JavaMenus implements Listener {

    private final KaizerUIPlugin plugin;
    private final Map<UUID, JavaSession> sessions = new ConcurrentHashMap<>();

    JavaMenus(KaizerUIPlugin plugin) { this.plugin = plugin; }

    JavaSession session(Player p) { return sessions.get(p.getUniqueId()); }

    boolean isOpen(Player p) { return sessions.containsKey(p.getUniqueId()); }

    void onPacketRotation(UUID id, float yaw, float pitch) {
        JavaSession s = sessions.get(id);
        if (s != null && s.locked && !s.closed) s.onPacketRotate(yaw, pitch);
    }

    /** Must run on the player's thread. */
    void open(Player p, MenuDef menu) {
        if (!plugin.fireOpenEvent(p, menu, false)) return;
        JavaSession cur = sessions.get(p.getUniqueId());
        if (cur != null && !cur.closed) {
            cur.switchTo(menu);
        } else {
            boolean lock = plugin.studio().cameraLock && CameraHook.available();
            JavaSession s = new JavaSession(plugin, p, menu, plugin.studio(), lock);
            sessions.put(p.getUniqueId(), s);
            s.start();
            plugin.fovHintOnce(p);
            if (plugin.studio().cameraLock && !CameraHook.available() && p.hasPermission("kaizerui.admin")) {
                p.sendMessage(plugin.msg("no-packetevents"));
            }
        }
        Actions.playSound(p, menu.openSound);
    }

    /** Must run on the player's thread. */
    void close(Player p) {
        close(p, MenuCloseEvent.Reason.API);
    }

    void close(Player p, MenuCloseEvent.Reason reason) {
        JavaSession s = sessions.remove(p.getUniqueId());
        if (s != null) s.close(reason);
    }

    /** Temporarily hides the hologram so the player can type into chat without losing session vars. */
    void pauseForInput(Player p) {
        JavaSession s = sessions.remove(p.getUniqueId());
        if (s != null) s.closeForInput();
    }

    void closeAll() {
        for (JavaSession s : sessions.values()) {
            try { s.close(MenuCloseEvent.Reason.RELOAD); } catch (Throwable ignored) { /* shutting down */ }
        }
        sessions.clear();
    }

    /* ───────────── input ───────────── */

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent e) {
        JavaSession s = session(e.getPlayer());
        // camera-lock sessions ride an entity and read the rotation every tick instead
        if (s == null || s.locked) return;
        Location to = e.getTo();
        Location lock = s.lockLocation();
        if (to.getWorld() != lock.getWorld() || to.distanceSquared(lock) > 1.0E-4) {
            // keep the player in place, keep the new head rotation
            Location fixed = lock.clone();
            fixed.setYaw(to.getYaw());
            fixed.setPitch(to.getPitch());
            e.setTo(fixed);
        }
        if (to.getYaw() != e.getFrom().getYaw() || to.getPitch() != e.getFrom().getPitch()) {
            s.onRotate(to.getYaw(), to.getPitch());
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onSwing(PlayerAnimationEvent e) {
        JavaSession s = session(e.getPlayer());
        if (s == null) return;
        e.setCancelled(true);
        s.click();
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInteract(PlayerInteractEvent e) {
        JavaSession s = session(e.getPlayer());
        if (s == null) return;
        e.setCancelled(true);
        // right click counts as a click too (left click arrives as an arm swing)
        if (e.getAction() == Action.RIGHT_CLICK_AIR || e.getAction() == Action.RIGHT_CLICK_BLOCK) s.click();
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInteractEntity(PlayerInteractEntityEvent e) {
        JavaSession s = session(e.getPlayer());
        if (s == null) return;
        e.setCancelled(true);
        s.click();
    }

    /** Sneaking makes a riding player get off: that leaves the menu (or is stopped when sneak-exit is off) */
    @EventHandler(priority = EventPriority.LOWEST)
    public void onDismount(EntityDismountEvent e) {
        if (!(e.getEntity() instanceof Player p)) return;
        JavaSession s = session(p);
        if (s == null || s.closing || e.getDismounted() != s.vehicle()) return;
        if (!s.studio.exitOnSneak && e.isCancellable()) {
            e.setCancelled(true);
            return;
        }
        close(p, MenuCloseEvent.Reason.PLAYER_SNEAK);
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onSneak(PlayerToggleSneakEvent e) {
        if (!e.isSneaking()) return;
        JavaSession s = session(e.getPlayer());
        if (s != null && s.studio.exitOnSneak) close(e.getPlayer(), MenuCloseEvent.Reason.PLAYER_SNEAK);
    }

    /* ───────────── keep the player safe and still while a menu is open ───────────── */

    @EventHandler(priority = EventPriority.LOWEST)
    public void onDamageOther(EntityDamageByEntityEvent e) {
        if (e.getDamager() instanceof Player p && isOpen(p)) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamaged(EntityDamageEvent e) {
        // being hurt closes the menu so the player can react
        if (e.getEntity() instanceof Player p && isOpen(p)) close(p, MenuCloseEvent.Reason.DAMAGED);
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onBreak(BlockBreakEvent e) { if (isOpen(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlace(BlockPlaceEvent e) { if (isOpen(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onDrop(PlayerDropItemEvent e) { if (isOpen(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onSwap(PlayerSwapHandItemsEvent e) { if (isOpen(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onHeld(PlayerItemHeldEvent e) {
        JavaSession s = session(e.getPlayer());
        if (s == null) return;
        e.setCancelled(true);
        int diff = (e.getNewSlot() - e.getPreviousSlot() + 9) % 9;
        if (diff >= 1 && diff <= 4) s.onScroll(1);
        else if (diff >= 5) s.onScroll(-1);
        // the client showed the other slot's item for a moment: hide it again
        if (s.locked) Sched.entityLater(plugin, e.getPlayer(), 1, () -> CameraHook.hideHands(e.getPlayer()));
    }

    /** Block the invisible Horse mount's own inventory, while letting other plugins' GUIs close this menu and open cleanly */
    @EventHandler(priority = EventPriority.LOWEST)
    public void onInventory(InventoryOpenEvent e) {
        if (!(e.getPlayer() instanceof Player p)) return;
        JavaSession s = session(p);
        if (s == null) return;
        if ((s.vehicle() != null && s.vehicle().equals(e.getInventory().getHolder()))
                || e.getInventory().getHolder() instanceof org.bukkit.entity.AbstractHorse) {
            e.setCancelled(true);
            return;
        }
        close(p, MenuCloseEvent.Reason.API);
    }

    /* ───────────── close when the player leaves the spot ───────────── */

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent e) {
        JavaSession s = session(e.getPlayer());
        if (s == null) return;
        // onMove's setTo() comes back as a PLUGIN teleport to the lock spot: that one is ours
        Location to = e.getTo();
        Location lock = s.lockLocation();
        if (to.getWorld() == lock.getWorld() && to.distanceSquared(lock) < 1.0E-3) return;
        close(e.getPlayer(), MenuCloseEvent.Reason.TELEPORT);
    }

    @EventHandler
    public void onWorld(PlayerChangedWorldEvent e) { close(e.getPlayer(), MenuCloseEvent.Reason.WORLD_CHANGE); }

    @EventHandler
    public void onDeath(PlayerDeathEvent e) { close(e.getEntity(), MenuCloseEvent.Reason.DEATH); }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) { close(e.getPlayer(), MenuCloseEvent.Reason.QUIT); }
}
