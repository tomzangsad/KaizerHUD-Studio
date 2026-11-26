package kz.kaizerui;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketListenerCommon;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import com.github.retrooper.packetevents.event.PacketReceiveEvent;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.entity.data.EntityData;
import com.github.retrooper.packetevents.protocol.entity.data.EntityDataTypes;
import com.github.retrooper.packetevents.protocol.item.ItemStack;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.util.Vector3d;
import com.github.retrooper.packetevents.wrapper.play.client.WrapperPlayClientPlayerPositionAndRotation;
import com.github.retrooper.packetevents.wrapper.play.client.WrapperPlayClientPlayerRotation;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerActionBar;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerBossBar;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerCamera;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerDisplayScoreboard;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityMetadata;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityTeleport;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerScoreboardObjective;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSetPassengers;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSetSlot;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSystemChatMessage;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.EnumSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Moves the player's view to another entity (vanilla "camera" packet, the same one spectator mode uses),
 * reads client rotation packets directly for low-latency cursor movement, and hides distracting HUD packets
 * (action bar, boss bars, scoreboard sidebar) while a menu is open.
 * Only this class touches PacketEvents, so KaizerUI runs without it (crosshair mode).
 */
final class CameraHook {

    @FunctionalInterface
    interface RotationCallback {
        void onRotate(UUID playerId, float yaw, float pitch);
    }

    private CameraHook() {}

    static boolean available() {
        return Bukkit.getPluginManager().isPluginEnabled("packetevents");
    }

    static void init(RotationCallback onRotate) {
        if (!available()) return;
        try {
            Impl.init(onRotate);
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not register PacketEvents listener: " + t);
        }
    }

    static void shutdown() {
        if (!available()) return;
        try {
            Impl.shutdown();
        } catch (Throwable ignored) {}
    }

    static void forget(UUID playerId) {
        if (!available() || playerId == null) return;
        try {
            Impl.forget(playerId);
        } catch (Throwable ignored) {}
    }

    static void setCamera(Player player, int entityId) {
        if (!available()) return;
        try {
            Impl.send(player, entityId);
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not move the camera: " + t);
        }
    }

    /**
     * The client still draws the player's own hands while the camera is elsewhere (and they sway
     * with the mouse). Shows both hands empty on the client only; Player#updateInventory() brings
     * the real items back.
     */
    static void hideHands(Player player) {
        if (!available()) return;
        try {
            Impl.hideHands(player, player.getInventory().getHeldItemSlot());
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not hide the held items: " + t);
        }
    }

    /** Tells the client again that the player rides this entity (the mount packet can arrive too early) */
    static void setPassenger(Player player, int vehicleId) {
        if (!available()) return;
        try {
            Impl.passenger(player, vehicleId);
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not resend the mount: " + t);
        }
    }

    /**
     * Marks the player invisible on their own client only: an invisible player's empty hand is not
     * drawn, so no arm swings across the menu. Other players still see them normally.
     */
    static void setSelfInvisible(Player player, boolean invisible) {
        if (!available()) return;
        try {
            byte flags = 0;
            if (player.getFireTicks() > 0) flags |= 0x01;
            if (player.isSneaking()) flags |= 0x02;
            if (player.isSprinting()) flags |= 0x08;
            if (player.isSwimming()) flags |= 0x10;
            if (invisible || player.isInvisible()) flags |= 0x20;
            if (player.isGlowing()) flags |= 0x40;
            if (player.isGliding()) flags |= (byte) 0x80;
            Impl.flags(player, flags);
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not hide the arm: " + t);
        }
    }

    static void hideHud(Player player, boolean actionBar, boolean bossBars, boolean scoreboard) {
        if (!available()) return;
        try {
            Impl.hideHud(player, actionBar, bossBars, scoreboard);
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not hide HUD: " + t);
        }
    }

    static void showHud(Player player) {
        if (!available()) return;
        try {
            Impl.showHud(player);
        } catch (Throwable t) {
            Bukkit.getLogger().warning("[KaizerUI] Could not restore HUD: " + t);
        }
    }

    static void teleportEntity(Player player, int entityId, double x, double y, double z, float yaw, float pitch) {
        if (!available() || entityId < 0) return;
        try {
            Impl.teleport(player, entityId, x, y, z, yaw, pitch);
        } catch (Throwable ignored) {}
    }

    private static final class Impl {

        private static final class BossEntry {
            Component title = Component.empty();
            float health = 1f;
            BossBar.Color color = BossBar.Color.PINK;
            BossBar.Overlay overlay = BossBar.Overlay.PROGRESS;
            EnumSet<BossBar.Flag> flags = EnumSet.noneOf(BossBar.Flag.class);
        }

        private static final class HudState {
            final Map<Integer, String> sidebars = new ConcurrentHashMap<>();
            final Map<UUID, BossEntry> bossBars = new ConcurrentHashMap<>();
            volatile boolean hideActionBar;
            volatile boolean hideBossBars;
            volatile boolean hideScoreboard;
        }

        private static final Map<UUID, HudState> HUD = new ConcurrentHashMap<>();
        private static PacketListenerCommon listener;
        private static volatile RotationCallback rotationCallback;

        static void init(RotationCallback cb) {
            rotationCallback = cb;
            if (listener != null) return;
            listener = PacketEvents.getAPI().getEventManager().registerListener(new PacketListenerAbstract(PacketListenerPriority.NORMAL) {
                @Override
                public void onPacketReceive(PacketReceiveEvent e) {
                    if (e.getUser() == null || e.getUser().getUUID() == null) return;
                    RotationCallback rcb = rotationCallback;
                    if (rcb == null) return;
                    var type = e.getPacketType();
                    if (type == PacketType.Play.Client.PLAYER_ROTATION) {
                        WrapperPlayClientPlayerRotation w = new WrapperPlayClientPlayerRotation(e);
                        rcb.onRotate(e.getUser().getUUID(), w.getYaw(), w.getPitch());
                    } else if (type == PacketType.Play.Client.PLAYER_POSITION_AND_ROTATION) {
                        WrapperPlayClientPlayerPositionAndRotation w = new WrapperPlayClientPlayerPositionAndRotation(e);
                        rcb.onRotate(e.getUser().getUUID(), w.getYaw(), w.getPitch());
                    }
                }

                @Override
                public void onPacketSend(PacketSendEvent e) {
                    if (e.getUser() == null || e.getUser().getUUID() == null) return;
                    UUID id = e.getUser().getUUID();
                    HudState st = HUD.computeIfAbsent(id, k -> new HudState());
                    var type = e.getPacketType();

                    if (type == PacketType.Play.Server.DISPLAY_SCOREBOARD) {
                        WrapperPlayServerDisplayScoreboard w = new WrapperPlayServerDisplayScoreboard(e);
                        int pos = w.getPosition();
                        if (pos == 1 || pos >= 3) {
                            String name = w.getScoreName();
                            if (name == null || name.isEmpty()) st.sidebars.remove(pos);
                            else {
                                st.sidebars.put(pos, name);
                                if (st.hideScoreboard) e.setCancelled(true);
                            }
                        }
                    } else if (type == PacketType.Play.Server.SCOREBOARD_OBJECTIVE) {
                        WrapperPlayServerScoreboardObjective w = new WrapperPlayServerScoreboardObjective(e);
                        if (w.getMode() == WrapperPlayServerScoreboardObjective.ObjectiveMode.REMOVE) {
                            String obj = w.getName();
                            if (obj != null) {
                                Iterator<Map.Entry<Integer, String>> it = st.sidebars.entrySet().iterator();
                                while (it.hasNext()) {
                                    if (obj.equals(it.next().getValue())) it.remove();
                                }
                            }
                        }
                    } else if (type == PacketType.Play.Server.BOSS_BAR) {
                        WrapperPlayServerBossBar w = new WrapperPlayServerBossBar(e);
                        UUID barId = w.getUUID();
                        if (barId != null) {
                            switch (w.getAction()) {
                                case ADD -> {
                                    BossEntry be = new BossEntry();
                                    be.title = w.getTitle() != null ? w.getTitle() : Component.empty();
                                    be.health = w.getHealth();
                                    be.color = w.getColor() != null ? w.getColor() : BossBar.Color.PINK;
                                    be.overlay = w.getOverlay() != null ? w.getOverlay() : BossBar.Overlay.PROGRESS;
                                    be.flags = w.getFlags() != null && !w.getFlags().isEmpty()
                                            ? EnumSet.copyOf(w.getFlags())
                                            : EnumSet.noneOf(BossBar.Flag.class);
                                    st.bossBars.put(barId, be);
                                }
                                case REMOVE -> st.bossBars.remove(barId);
                                case UPDATE_HEALTH -> {
                                    BossEntry be = st.bossBars.get(barId);
                                    if (be != null) be.health = w.getHealth();
                                }
                                case UPDATE_TITLE -> {
                                    BossEntry be = st.bossBars.get(barId);
                                    if (be != null && w.getTitle() != null) be.title = w.getTitle();
                                }
                                case UPDATE_STYLE -> {
                                    BossEntry be = st.bossBars.get(barId);
                                    if (be != null) {
                                        if (w.getColor() != null) be.color = w.getColor();
                                        if (w.getOverlay() != null) be.overlay = w.getOverlay();
                                    }
                                }
                                case UPDATE_FLAGS -> {
                                    BossEntry be = st.bossBars.get(barId);
                                    if (be != null) {
                                        be.flags = w.getFlags() != null && !w.getFlags().isEmpty()
                                                ? EnumSet.copyOf(w.getFlags())
                                                : EnumSet.noneOf(BossBar.Flag.class);
                                    }
                                }
                            }
                            if (st.hideBossBars && w.getAction() != WrapperPlayServerBossBar.Action.REMOVE) {
                                e.setCancelled(true);
                            }
                        }
                    } else if (type == PacketType.Play.Server.ACTION_BAR) {
                        if (st.hideActionBar) e.setCancelled(true);
                    } else if (type == PacketType.Play.Server.SYSTEM_CHAT_MESSAGE) {
                        if (st.hideActionBar) {
                            WrapperPlayServerSystemChatMessage w = new WrapperPlayServerSystemChatMessage(e);
                            if (w.isOverlay()) e.setCancelled(true);
                        }
                    }
                }
            });
        }

        static void shutdown() {
            for (Player p : Bukkit.getOnlinePlayers()) {
                HudState st = HUD.get(p.getUniqueId());
                if (st != null && (st.hideActionBar || st.hideBossBars || st.hideScoreboard)) {
                    try { showHud(p); } catch (Throwable ignored) {}
                }
            }
            if (listener != null) {
                PacketEvents.getAPI().getEventManager().unregisterListener(listener);
                listener = null;
            }
            rotationCallback = null;
            HUD.clear();
        }

        static void forget(UUID id) {
            HUD.remove(id);
        }

        static void hideHud(Player player, boolean actionBar, boolean bossBars, boolean scoreboard) {
            HudState st = HUD.computeIfAbsent(player.getUniqueId(), k -> new HudState());
            st.hideActionBar = actionBar;
            st.hideBossBars = bossBars;
            st.hideScoreboard = scoreboard;
            var pm = PacketEvents.getAPI().getPlayerManager();
            if (actionBar) {
                pm.sendPacketSilently(player, new WrapperPlayServerActionBar(Component.empty()));
            }
            if (scoreboard) {
                if (!st.sidebars.containsKey(1)) {
                    pm.sendPacketSilently(player, new WrapperPlayServerDisplayScoreboard(1, ""));
                }
                for (Integer slot : st.sidebars.keySet()) {
                    pm.sendPacketSilently(player, new WrapperPlayServerDisplayScoreboard(slot, ""));
                }
            }
            if (bossBars) {
                for (UUID barId : st.bossBars.keySet()) {
                    pm.sendPacketSilently(player, new WrapperPlayServerBossBar(barId, WrapperPlayServerBossBar.Action.REMOVE));
                }
            }
        }

        static void showHud(Player player) {
            HudState st = HUD.get(player.getUniqueId());
            if (st == null) return;
            boolean hadScoreboard = st.hideScoreboard;
            boolean hadBossBars = st.hideBossBars;
            st.hideActionBar = false;
            st.hideBossBars = false;
            st.hideScoreboard = false;
            var pm = PacketEvents.getAPI().getPlayerManager();
            if (hadScoreboard) {
                for (Map.Entry<Integer, String> en : st.sidebars.entrySet()) {
                    pm.sendPacketSilently(player, new WrapperPlayServerDisplayScoreboard(en.getKey(), en.getValue()));
                }
            }
            if (hadBossBars) {
                for (Map.Entry<UUID, BossEntry> en : st.bossBars.entrySet()) {
                    BossEntry be = en.getValue();
                    WrapperPlayServerBossBar add = new WrapperPlayServerBossBar(en.getKey(), WrapperPlayServerBossBar.Action.ADD);
                    add.setTitle(be.title != null ? be.title : Component.empty());
                    add.setHealth(be.health);
                    add.setColor(be.color != null ? be.color : BossBar.Color.PINK);
                    add.setOverlay(be.overlay != null ? be.overlay : BossBar.Overlay.PROGRESS);
                    add.setFlags(be.flags != null ? EnumSet.copyOf(be.flags) : EnumSet.noneOf(BossBar.Flag.class));
                    pm.sendPacketSilently(player, add);
                }
            }
        }

        static void teleport(Player player, int entityId, double x, double y, double z, float yaw, float pitch) {
            PacketEvents.getAPI().getPlayerManager().sendPacketSilently(
                    player, new WrapperPlayServerEntityTeleport(entityId, new Vector3d(x, y, z), yaw, pitch, false));
        }

        static void passenger(Player player, int vehicleId) {
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, new WrapperPlayServerSetPassengers(vehicleId, new int[]{player.getEntityId()}));
        }

        static void flags(Player player, byte flags) {
            // entity data index 0 = shared flags byte (on fire, sneaking, sprinting, swimming, invisible, glowing, gliding)
            List<EntityData<?>> data = List.of(new EntityData<>(0, EntityDataTypes.BYTE, flags));
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, new WrapperPlayServerEntityMetadata(player.getEntityId(), data));
        }

        static void send(Player player, int entityId) {
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, new WrapperPlayServerCamera(entityId));
        }

        static void hideHands(Player player, int heldSlot) {
            // player inventory window 0: hotbar = slots 36..44, off hand = 45
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, new WrapperPlayServerSetSlot(0, 0, 36 + heldSlot, ItemStack.EMPTY));
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, new WrapperPlayServerSetSlot(0, 0, 45, ItemStack.EMPTY));
        }
    }
}
