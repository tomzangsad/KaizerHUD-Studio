package kz.kaizerui;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.ArmorStand;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.util.Locale;
import java.util.Optional;

/**
 * Pure-reflection 3D animated model wrapper supporting ModelEngine 4 ({@code meg:<id>})
 * and BetterModel ({@code bm:<id>}) inside Java hologram menus.
 * Spawns an invisible marker ArmorStand shown only to the viewing player, attaches the model,
 * and cleans up everything cleanly on close/switch.
 */
final class CustomModelPart {

    final ArmorStand host;
    final float baseYaw;
    private Object megModeledEntity;
    private Object bmTracker;

    private CustomModelPart(ArmorStand host, float baseYaw, Object megModeledEntity, Object bmTracker) {
        this.host = host;
        this.baseYaw = baseYaw;
        this.megModeledEntity = megModeledEntity;
        this.bmTracker = bmTracker;
    }

    static CustomModelPart spawn(KaizerUIPlugin plugin, Player viewer, Location loc, MenuDef.Element e, String resolvedModelId, double worldScale, boolean showNow) {
        if (resolvedModelId == null || resolvedModelId.isBlank() || loc.getWorld() == null) return null;
        String raw = resolvedModelId.trim();
        String low = raw.toLowerCase(Locale.ROOT);
        boolean forceBm = low.startsWith("bm:") || low.startsWith("bettermodel:");
        boolean forceMeg = low.startsWith("meg:") || low.startsWith("modelengine:");
        String id = raw;
        if (forceBm || forceMeg) {
            int colon = raw.indexOf(':');
            if (colon >= 0) id = raw.substring(colon + 1).trim();
        }
        if (id.isEmpty()) return null;

        boolean hasMeg = Bukkit.getPluginManager().isPluginEnabled("ModelEngine");
        boolean hasBm = Bukkit.getPluginManager().isPluginEnabled("BetterModel");
        if (!hasMeg && !hasBm) return null;

        ArmorStand stand = loc.getWorld().spawn(loc, ArmorStand.class, as -> {
            as.setVisibleByDefault(false);
            as.setPersistent(false);
            as.setInvisible(true);
            as.setGravity(false);
            as.setMarker(true);
            as.setInvulnerable(true);
            as.setSilent(true);
            as.setBasePlate(false);
            as.setArms(false);
        });
        if (showNow) viewer.showEntity(plugin, stand);

        Object megMe = null;
        Object bmTr = null;
        if (!forceBm && hasMeg) {
            megMe = attachModelEngine(stand, id, e.animation, worldScale);
        }
        if (megMe == null && !forceMeg && hasBm) {
            bmTr = attachBetterModel(stand, id, e.animation, worldScale);
        }
        if (megMe == null && bmTr == null) {
            stand.remove();
            return null;
        }
        return new CustomModelPart(stand, loc.getYaw(), megMe, bmTr);
    }

    private static Object attachModelEngine(ArmorStand stand, String blueprintId, String animation, double scale) {
        try {
            Class<?> api = Class.forName("com.ticxo.modelengine.api.ModelEngineAPI");
            Object modeledEntity = api.getMethod("createModeledEntity", Entity.class).invoke(null, stand);
            Object activeModel = api.getMethod("createActiveModel", String.class).invoke(null, blueprintId);
            if (modeledEntity == null || activeModel == null) return null;

            try {
                activeModel.getClass().getMethod("setScale", double.class).invoke(activeModel, Math.max(0.05, scale));
            } catch (Throwable ignored) {}
            try {
                activeModel.getClass().getMethod("setHitboxScale", double.class).invoke(activeModel, Math.max(0.05, scale));
            } catch (Throwable ignored) {}

            // ModeledEntity.addModel(ActiveModel, boolean overrideHitbox)
            for (Method m : modeledEntity.getClass().getMethods()) {
                if ("addModel".equals(m.getName()) && m.getParameterCount() == 2) {
                    m.invoke(modeledEntity, activeModel, Boolean.FALSE);
                    break;
                }
            }
            if (animation != null && !animation.isBlank()) {
                try {
                    Object handler = activeModel.getClass().getMethod("getAnimationHandler").invoke(activeModel);
                    if (handler != null) {
                        for (Method m : handler.getClass().getMethods()) {
                            if ("playAnimation".equals(m.getName()) && m.getParameterCount() == 5
                                    && m.getParameterTypes()[0] == String.class) {
                                m.invoke(handler, animation.trim(), 0.2d, 0.2d, 1.0d, true);
                                break;
                            }
                        }
                    }
                } catch (Throwable ignored) {}
            }
            return modeledEntity;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static Object attachBetterModel(ArmorStand stand, String modelId, String animation, double scale) {
        try {
            Class<?> bmApi = Class.forName("kr.toxicity.model.api.BetterModel");
            Object renderer = null;
            for (Method m : bmApi.getMethods()) {
                if (("modelOrNull".equals(m.getName()) || "model".equals(m.getName()))
                        && m.getParameterCount() == 1 && m.getParameterTypes()[0] == String.class) {
                    Object res = m.invoke(null, modelId);
                    if (res instanceof Optional<?> opt) res = opt.orElse(null);
                    if (res != null) { renderer = res; break; }
                }
            }
            if (renderer == null) return null;

            Object tracker = null;
            for (Method m : renderer.getClass().getMethods()) {
                if (("create".equals(m.getName()) || "getOrCreate".equals(m.getName()))
                        && m.getParameterCount() == 1 && m.getParameterTypes()[0].isAssignableFrom(Entity.class)) {
                    tracker = m.invoke(renderer, stand);
                    if (tracker != null) break;
                }
            }
            if (tracker == null) return null;
            if (animation != null && !animation.isBlank()) {
                try {
                    for (Method m : tracker.getClass().getMethods()) {
                        if ("animate".equals(m.getName()) && m.getParameterCount() == 1 && m.getParameterTypes()[0] == String.class) {
                            m.invoke(tracker, animation.trim());
                            break;
                        }
                    }
                } catch (Throwable ignored) {}
            }
            return tracker;
        } catch (Throwable ignored) {
            return null;
        }
    }

    void look(float yaw) {
        if (host.isValid()) {
            host.setRotation(yaw, 0f);
        }
    }

    void destroy() {
        if (megModeledEntity != null) {
            try { megModeledEntity.getClass().getMethod("destroy").invoke(megModeledEntity); } catch (Throwable ignored) {}
            megModeledEntity = null;
        }
        if (bmTracker != null) {
            try { bmTracker.getClass().getMethod("close").invoke(bmTracker); } catch (Throwable ignored) {}
            bmTracker = null;
        }
        if (host.isValid()) host.remove();
    }
}
