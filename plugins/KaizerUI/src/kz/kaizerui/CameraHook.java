package kz.kaizerui;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.protocol.entity.data.EntityData;
import com.github.retrooper.packetevents.protocol.entity.data.EntityDataTypes;
import com.github.retrooper.packetevents.protocol.item.ItemStack;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerCamera;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntityMetadata;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSetPassengers;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSetSlot;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.List;

/**
 * Moves the player's view to another entity (vanilla "camera" packet, the same one spectator mode uses).
 * The player keeps their game mode; turning the head still sends rotations, but the view stays still.
 * Only this class touches PacketEvents, so KaizerUI runs without it (crosshair mode).
 */
final class CameraHook {
    private CameraHook() {}

    static boolean available() {
        return Bukkit.getPluginManager().isPluginEnabled("packetevents");
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

    private static final class Impl {
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
