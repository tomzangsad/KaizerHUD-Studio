package kz.kaizerui;

import io.papermc.paper.threadedregions.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import org.bukkit.Color;
import org.bukkit.World;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.TextDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.AxisAngle4f;
import org.joml.Vector3f;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Weighted crate roulette renderer supporting multiple spin styles:
 * {@code csgo}, {@code tease}, {@code slot_v}, {@code wheel}, {@code flash}, and {@code flip}.
 */
final class RoulettePart {

    private final JavaSession session;
    final MenuDef.Element el;
    private final double depth;
    private final List<Entity> ownEntities = new ArrayList<>();
    private final List<SlotView> pool = new ArrayList<>();

    private TextDisplay bgDisplay;
    private TextDisplay needleDisplay;
    private ScheduledTask spinTask;
    private boolean spinning;
    private final List<MenuDef.Reward> idleStrip = new ArrayList<>();
    private List<MenuDef.Reward> activeStrip;
    private MenuDef.Reward pendingWinner;
    private int lastCenterIdx = -1;

    private record SlotView(TextDisplay cardBg, ItemDisplay item, TextDisplay label) {}

    RoulettePart(JavaSession session, MenuDef.Element el, double depth) {
        this.session = session;
        this.el = el;
        this.depth = depth;
        buildIdle();
    }

    private String style() {
        String st = el.spinStyle;
        if (st == null || st.isBlank()) return "csgo";
        return switch (st) {
            case "tease", "slot_v", "flash", "flip" -> st;
            default -> "csgo";
        };
    }

    private void buildIdle() {
        World w = session.player.getWorld();
        double s = session.guiScaleAt(depth);
        double sNeedle = session.guiScaleAt(depth + 0.00048);
        double boxW = Math.max(16, el.w) * s;
        double boxH = Math.max(16, el.h) * s;
        double TEXT_PX = 0.025;
        String style = style();

        // Frame backdrop
        float bgSx = (float) (boxW / (5 * TEXT_PX)), bgSy = (float) (boxH / (11 * TEXT_PX));
        Vector bgPos = session.worldCenter(el.x + el.w / 2.0, el.y + el.h / 2.0, depth)
                .subtract(session.rightVec().multiply(0.5 * TEXT_PX * bgSx))
                .subtract(session.upVec().multiply(5.5 * TEXT_PX * bgSy));
        bgDisplay = w.spawn(session.facingLoc(bgPos), TextDisplay.class, x -> {
            x.setVisibleByDefault(false);
            x.setPersistent(false);
            x.text(Component.text(" "));
            x.setBillboard(Display.Billboard.FIXED);
            x.setDefaultBackground(false);
            x.setBackgroundColor(parseArgb(el.bgColor, 235));
            x.setShadowed(false);
            x.setSeeThrough(false);
            x.setBrightness(new Display.Brightness(15, 15));
            x.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(bgSx, bgSy, 1f), new AxisAngle4f()));
        });
        session.player.showEntity(session.plugin, bgDisplay);
        ownEntities.add(bgDisplay);

        // Pointer needle (vertical for horizontal modes, horizontal for slot_v, hidden for flash/flip)
        if (!"flash".equals(style) && !"flip".equals(style)) {
            boolean vert = "slot_v".equals(style);
            float nSx = (float) ((vert ? Math.max(16, el.w) : 2.0) * sNeedle / (5 * TEXT_PX));
            float nSy = (float) ((vert ? 2.0 : Math.max(16, el.h)) * sNeedle / (11 * TEXT_PX));
            Vector nPos = session.worldCenter(el.x + el.w / 2.0, el.y + el.h / 2.0, depth + 0.00048)
                    .subtract(session.rightVec().multiply(0.5 * TEXT_PX * nSx))
                    .subtract(session.upVec().multiply(5.5 * TEXT_PX * nSy));
            needleDisplay = w.spawn(session.facingLoc(nPos), TextDisplay.class, x -> {
                x.setVisibleByDefault(false);
                x.setPersistent(false);
                x.text(Component.text(" "));
                x.setBillboard(Display.Billboard.FIXED);
                x.setDefaultBackground(false);
                x.setBackgroundColor(parseArgb(el.pointerColor, 255));
                x.setShadowed(false);
                x.setSeeThrough(false);
                x.setBrightness(new Display.Brightness(15, 15));
                x.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(nSx, nSy, 1f), new AxisAngle4f()));
            });
            session.player.showEntity(session.plugin, needleDisplay);
            ownEntities.add(needleDisplay);
        }

        // Pool visible slots inside viewport
        int visibleCount;
        if ("slot_v".equals(style)) {
            int reels = Math.max(1, Math.min(5, el.reels));
            int cardH = Math.max(14, Math.min(el.slotSize, (int) Math.floor((el.h - 8) * 0.52)));
            int stepV = cardH + Math.max(0, el.slotGap);
            int perReel = Math.max(3, Math.min(5, (int) Math.ceil((double) el.h / stepV) + 2));
            visibleCount = Math.min(25, reels * perReel);
        } else if ("flash".equals(style) || "flip".equals(style)) {
            visibleCount = Math.max(3, Math.min(9, el.cardCount));
        } else {
            int step = Math.max(16, el.slotSize) + Math.max(0, el.slotGap);
            visibleCount = Math.max(4, Math.min(11, (int) Math.ceil((double) el.w / step) + 3));
        }
        for (int i = 0; i < visibleCount; i++) {
            TextDisplay cBg = w.spawn(session.facingLoc(bgPos), TextDisplay.class, x -> {
                x.setVisibleByDefault(false);
                x.setPersistent(false);
                x.text(Component.text(" "));
                x.setBillboard(Display.Billboard.FIXED);
                x.setDefaultBackground(false);
                x.setBackgroundColor(Color.fromARGB(0, 0, 0, 0));
                x.setShadowed(false);
                x.setSeeThrough(false);
                x.setBrightness(new Display.Brightness(15, 15));
                x.setTeleportDuration(1);
            });
            ItemDisplay itemD = w.spawn(session.facingLoc(bgPos), ItemDisplay.class, x -> {
                x.setVisibleByDefault(false);
                x.setPersistent(false);
                x.setItemDisplayTransform(ItemDisplay.ItemDisplayTransform.GUI);
                x.setBillboard(Display.Billboard.FIXED);
                x.setBrightness(new Display.Brightness(15, 15));
                x.setTeleportDuration(1);
            });
            TextDisplay labD = w.spawn(session.facingLoc(bgPos), TextDisplay.class, x -> {
                x.setVisibleByDefault(false);
                x.setPersistent(false);
                x.text(Component.empty());
                x.setBillboard(Display.Billboard.FIXED);
                x.setDefaultBackground(false);
                x.setBackgroundColor(Color.fromARGB(0, 0, 0, 0));
                x.setShadowed(true);
                x.setSeeThrough(false);
                x.setLineWidth(120);
                x.setBrightness(new Display.Brightness(15, 15));
                x.setTeleportDuration(1);
            });
            session.player.showEntity(session.plugin, cBg);
            session.player.showEntity(session.plugin, itemD);
            session.player.showEntity(session.plugin, labD);
            ownEntities.add(cBg);
            ownEntities.add(itemD);
            ownEntities.add(labD);
            pool.add(new SlotView(cBg, itemD, labD));
        }

        List<MenuDef.Reward> src = el.rewards;
        if (src.isEmpty()) src = List.of(new MenuDef.Reward("r1", "Prize", "minecraft:diamond", "#3b82f6", 10, List.of()));
        for (int i = 0; i < 24; i++) idleStrip.add(src.get(i % src.size()));
        renderIdle();
    }

    private void renderIdle() {
        String style = style();
        List<MenuDef.Reward> src = el.rewards.isEmpty() ? idleStrip.subList(0, 1) : el.rewards;
        if ("flash".equals(style)) {
            int count = Math.max(3, Math.min(9, el.cardCount));
            List<MenuDef.Reward> board = new ArrayList<>(count);
            for (int i = 0; i < count; i++) board.add(src.get(i % src.size()));
            renderFlash(board, 0, false);
        } else if ("flip".equals(style)) {
            int count = Math.max(3, Math.min(9, el.cardCount));
            List<MenuDef.Reward> board = new ArrayList<>(count);
            for (int i = 0; i < count; i++) board.add(src.get(i % src.size()));
            renderFlipGrid(board, -1, false, 1.0, false, false);
        } else if ("slot_v".equals(style)) {
            int reels = Math.max(1, Math.min(5, el.reels));
            int cardH = Math.max(14, Math.min(el.slotSize, (int) Math.floor((el.h - 8) * 0.52)));
            int stepV = cardH + Math.max(0, el.slotGap);
            double offY = (el.h - cardH) / 2.0 - 2 * stepV;
            List<List<MenuDef.Reward>> strips = new ArrayList<>(reels);
            double[] offsets = new double[reels];
            for (int r = 0; r < reels; r++) {
                List<MenuDef.Reward> rs = new ArrayList<>(24);
                for (int i = 0; i < 24; i++) rs.add(src.get((i + r) % src.size()));
                strips.add(rs);
                offsets[r] = offY;
            }
            renderVerticalReels(strips, offsets);
        } else {
            int step = Math.max(16, el.slotSize) + Math.max(0, el.slotGap);
            int startOff = Math.round((el.w - el.slotSize) / 2.0f - 3 * step);
            renderHorizontalStrip(idleStrip, startOff);
        }
    }

    boolean startSpin() {
        if (spinning || el.rewards.isEmpty()) return false;
        spinning = true;
        pendingWinner = rollWinner(el.rewards);
        String style = style();
        int totalTicks = Math.max(20, (int) Math.round(el.durationSec * 20.0));
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        lastCenterIdx = -1;

        if ("flash".equals(style)) {
            int count = Math.max(3, Math.min(9, el.cardCount));
            int pickSlot = rng.nextInt(count);
            int hops = Math.max(18, (int) Math.round(el.durationSec * 7.0));
            final int startOff = ((pickSlot - hops) % count + count) % count;
            List<MenuDef.Reward> board = new ArrayList<>(count);
            for (int i = 0; i < count; i++) board.add(el.rewards.get(rng.nextInt(el.rewards.size())));
            final int[] lastHop = {-1};
            final int[] tick = {0};
            spinTask = Sched.entityRepeat(session.plugin, session.player, 1, () -> {
                if (session.closed || !spinning) { stopTask(); return; }
                tick[0]++;
                double p = Math.min(1.0, (double) tick[0] / totalTicks);
                int hop = Math.min(hops, (int) Math.floor((1.0 - Math.pow(1.0 - p, 2.5)) * (hops + 0.99)));
                if (hop != lastHop[0] || p >= 1.0) {
                    lastHop[0] = hop;
                    for (int i = 0; i < count; i++) board.set(i, el.rewards.get(rng.nextInt(el.rewards.size())));
                    boolean atEnd = hop >= hops || p >= 1.0;
                    int active = atEnd ? pickSlot : (startOff + hop) % count;
                    if (atEnd) board.set(pickSlot, pendingWinner);
                    lastCenterIdx = active;
                    if (!atEnd) Actions.playSound(session.player, el.tickSound);
                }
                renderFlash(board, lastCenterIdx, true);
                if (tick[0] >= totalTicks) finishSpin();
            });
            return true;
        }

        if ("flip".equals(style)) {
            int count = Math.max(3, Math.min(9, el.cardCount));
            int pickSlot = rng.nextInt(count);
            int hops = Math.max(12, (int) Math.round(el.durationSec * 5.0));
            final int startOff = ((pickSlot - hops) % count + count) % count;
            List<MenuDef.Reward> finalBoard = new ArrayList<>(count);
            for (int i = 0; i < count; i++) {
                finalBoard.add(i == pickSlot ? pendingWinner : el.rewards.get(rng.nextInt(el.rewards.size())));
            }
            final int[] tick = {0};
            spinTask = Sched.entityRepeat(session.plugin, session.player, 1, () -> {
                if (session.closed || !spinning) { stopTask(); return; }
                tick[0]++;
                double p = Math.min(1.0, (double) tick[0] / totalTicks);
                if (p < 0.68) {
                    double sp = p / 0.68;
                    int hop = Math.min(hops, (int) Math.floor((1.0 - Math.pow(1.0 - sp, 2.4)) * (hops + 0.99)));
                    int active = hop >= hops ? pickSlot : (startOff + hop) % count;
                    if (active != lastCenterIdx) {
                        lastCenterIdx = active;
                        Actions.playSound(session.player, el.tickSound);
                    }
                    renderFlipGrid(finalBoard, active, false, 1.0, false, false);
                } else if (p < 0.86) {
                    double fp = (p - 0.68) / 0.18;
                    double sx = Math.max(0.1, Math.abs(Math.cos(fp * Math.PI)));
                    renderFlipGrid(finalBoard, pickSlot, fp >= 0.5, sx, false, false);
                } else {
                    double fp2 = Math.min(1.0, (p - 0.86) / 0.14);
                    double sx2 = Math.max(0.1, Math.abs(Math.cos(fp2 * Math.PI)));
                    renderFlipGrid(finalBoard, pickSlot, true, p >= 1.0 ? 1.0 : sx2, fp2 >= 0.5, true);
                }
                if (tick[0] >= totalTicks) finishSpin();
            });
            return true;
        }

        int WIN_SLOT = 34;

        if ("slot_v".equals(style)) {
            int reels = Math.max(1, Math.min(5, el.reels));
            List<List<MenuDef.Reward>> strips = new ArrayList<>(reels);
            for (int r = 0; r < reels; r++) {
                List<MenuDef.Reward> rs = new ArrayList<>(42);
                for (int i = 0; i < 42; i++) {
                    rs.add(i == WIN_SLOT ? pendingWinner : el.rewards.get(rng.nextInt(el.rewards.size())));
                }
                strips.add(rs);
            }
            int cardH = Math.max(14, Math.min(el.slotSize, (int) Math.floor((el.h - 8) * 0.52)));
            int stepV = cardH + Math.max(0, el.slotGap);
            double startY = (el.h - cardH) / 2.0 - 2 * stepV;
            double targetY = (el.h - cardH) / 2.0 - WIN_SLOT * stepV;
            final int[] tick = {0};
            spinTask = Sched.entityRepeat(session.plugin, session.player, 1, () -> {
                if (session.closed || !spinning) { stopTask(); return; }
                tick[0]++;
                double p = Math.min(1.0, (double) tick[0] / totalTicks);
                double[] offsets = new double[reels];
                for (int r = 0; r < reels; r++) {
                    double endP = reels == 1 ? 1.0 : (0.58 + 0.42 * r / (reels - 1));
                    double rp = Math.min(1.0, p / endP);
                    double ease = 1.0 - Math.pow(1.0 - rp, 4.0);
                    offsets[r] = startY + (targetY - startY) * ease;
                }
                renderVerticalReels(strips, offsets);
                int centerTile = (int) Math.round(((el.h / 2.0) - offsets[reels - 1] - cardH / 2.0) / stepV);
                if (centerTile != lastCenterIdx) {
                    lastCenterIdx = centerTile;
                    Actions.playSound(session.player, el.tickSound);
                }
                if (tick[0] >= totalTicks) finishSpin();
            });
            return true;
        }

        // 'csgo' or 'tease'
        activeStrip = new ArrayList<>(42);
        for (int i = 0; i < 42; i++) {
            activeStrip.add(i == WIN_SLOT ? pendingWinner : el.rewards.get(rng.nextInt(el.rewards.size())));
        }
        int step = Math.max(16, el.slotSize) + Math.max(0, el.slotGap);
        double startX = (el.w - el.slotSize) / 2.0 - 2 * step;
        double jitter = (rng.nextDouble() - 0.5) * el.slotSize * 0.28;
        double targetX = (el.w - el.slotSize) / 2.0 - WIN_SLOT * step + jitter;
        boolean teaseMode = "tease".equals(style);
        final int[] tick = {0};
        spinTask = Sched.entityRepeat(session.plugin, session.player, 1, () -> {
            if (session.closed || !spinning) { stopTask(); return; }
            tick[0]++;
            double p = Math.min(1.0, (double) tick[0] / totalTicks);
            double ease;
            if (teaseMode) {
                double pm1 = p - 1.0;
                double c1 = 1.85;
                double c3 = c1 + 1.0;
                ease = 1.0 + c3 * pm1 * pm1 * pm1 + c1 * pm1 * pm1;
            } else {
                ease = 1.0 - Math.pow(1.0 - p, 4.0);
            }
            double offsetPx = startX + (targetX - startX) * ease;
            renderHorizontalStrip(activeStrip, offsetPx);
            int centerTile = (int) Math.round(((el.w / 2.0) - offsetPx - el.slotSize / 2.0) / step);
            if (centerTile != lastCenterIdx) {
                lastCenterIdx = centerTile;
                Actions.playSound(session.player, el.tickSound);
            }
            if (tick[0] >= totalTicks) finishSpin();
        });
        return true;
    }

    private void stopTask() {
        if (spinTask != null) { spinTask.cancel(); spinTask = null; }
    }

    private void finishSpin() {
        stopTask();
        spinning = false;
        MenuDef.Reward win = pendingWinner;
        if (win != null) {
            session.plugin.setSessionVar(session.player.getUniqueId(), "reward_id", win.id());
            session.plugin.setSessionVar(session.player.getUniqueId(), "reward_name", win.name());
            session.plugin.setSessionVar(session.player.getUniqueId(), "reward_item", win.item());
            Actions.playSound(session.player, el.winSound);
            Actions.runList(session.plugin, session.player, session.menu, win.actions(), false);
            session.refreshNow();
        }
    }

    private void drawCard(SlotView sv, MenuDef.Reward rw, double cx, double cy, double cardW, double cardH, int alpha, double labelScaleMul) {
        double dCard = depth + 0.00012;
        double dItem = depth + 0.00024;
        double dLab = depth + 0.00036;
        double sCard = session.guiScaleAt(dCard);
        double sItem = session.guiScaleAt(dItem);
        double sLab = session.guiScaleAt(dLab);
        double TEXT_PX = 0.025;

        double bgW = cardW * sCard, bgH = cardH * sCard;
        float cSx = (float) (bgW / (5 * TEXT_PX)), cSy = (float) (bgH / (11 * TEXT_PX));
        Vector cPos = session.worldCenter(cx, cy, dCard)
                .subtract(session.rightVec().multiply(0.5 * TEXT_PX * cSx))
                .subtract(session.upVec().multiply(5.5 * TEXT_PX * cSy));
        sv.cardBg.setBackgroundColor(parseArgb(rw.color(), alpha));
        sv.cardBg.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(cSx, cSy, 1f), new AxisAngle4f()));
        sv.cardBg.teleportAsync(session.facingLoc(cPos));

        float itemScale = (float) (Math.min(cardW, cardH) * 0.56 * sItem);
        Vector iPos = session.worldCenter(cx, cy - Math.max(1.5, cardH * 0.07), dItem);
        ItemStack st = Items.resolve(session.plugin, session.player, rw.item(), false);
        sv.item.setItemStack(st);
        sv.item.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(itemScale, itemScale, Math.max(0.005f, itemScale * 0.05f)), new AxisAngle4f()));
        sv.item.teleportAsync(session.itemFacingLoc(iPos));

        double kLab = 0.52 * labelScaleMul;
        float lScale = (float) (sLab * kLab / TEXT_PX);
        Vector lPos = session.worldCenter(cx, cy + cardH * 0.34 + 4.5 * kLab, dLab);
        sv.label.text(Texts.component(rw.name(), "#f1f5f9"));
        sv.label.setTextOpacity(alpha < 100 ? (byte) 140 : (byte) -1);
        sv.label.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(lScale, lScale, lScale), new AxisAngle4f()));
        sv.label.teleportAsync(session.facingLoc(lPos));
    }

    private void drawMysteryCard(SlotView sv, double cx, double cy, double cardW, double cardH, int alpha, boolean lit) {
        double dCard = depth + 0.00012;
        double dLab = depth + 0.00036;
        double sCard = session.guiScaleAt(dCard);
        double sLab = session.guiScaleAt(dLab);
        double TEXT_PX = 0.025;

        double bgW = cardW * sCard, bgH = cardH * sCard;
        float cSx = (float) (bgW / (5 * TEXT_PX)), cSy = (float) (bgH / (11 * TEXT_PX));
        Vector cPos = session.worldCenter(cx, cy, dCard)
                .subtract(session.rightVec().multiply(0.5 * TEXT_PX * cSx))
                .subtract(session.upVec().multiply(5.5 * TEXT_PX * cSy));
        sv.cardBg.setBackgroundColor(parseArgb(lit ? "#d97706" : "#252f4a", alpha));
        sv.cardBg.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(cSx, cSy, 1f), new AxisAngle4f()));
        sv.cardBg.teleportAsync(session.facingLoc(cPos));

        sv.item.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(0.0001f, 0.0001f, 0.0001f), new AxisAngle4f()));

        double kQ = 1.45 * Math.min(1.0, cardW / 40.0);
        float qScale = (float) (sLab * kQ / TEXT_PX);
        Vector qPos = session.worldCenter(cx, cy + 5.0 * kQ, dLab);
        sv.label.text(Texts.component("&l?", lit ? "#fde047" : "#f6c453"));
        sv.label.setTextOpacity(alpha < 100 ? (byte) 150 : (byte) -1);
        sv.label.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(qScale, qScale, qScale), new AxisAngle4f()));
        sv.label.teleportAsync(session.facingLoc(qPos));
    }

    private void renderHorizontalStrip(List<MenuDef.Reward> strip, double offsetPx) {
        int step = Math.max(16, el.slotSize) + Math.max(0, el.slotGap);
        int baseCardH = Math.max(14, Math.min(el.h - 6, el.slotSize));
        double baseCy = el.y + el.h / 2.0;

        int firstVisible = Math.max(0, (int) Math.floor((-offsetPx - step) / step));
        for (int pIdx = 0; pIdx < pool.size(); pIdx++) {
            SlotView sv = pool.get(pIdx);
            int sIdx = firstVisible + pIdx;
            if (sIdx < 0 || sIdx >= strip.size()) { hideSlot(sv); continue; }
            double cx = el.x + offsetPx + sIdx * step + el.slotSize / 2.0;
            if (cx < el.x + el.slotSize * 0.35 || cx > el.x + el.w - el.slotSize * 0.35) { hideSlot(sv); continue; }
            drawCard(sv, strip.get(sIdx), cx, baseCy, el.slotSize, baseCardH, 145, 1.0);
        }
    }

    private void renderVerticalReels(List<List<MenuDef.Reward>> strips, double[] offsetsPy) {
        int reels = Math.max(1, Math.min(strips.size(), offsetsPy.length));
        int gap = Math.max(0, el.slotGap);
        double availW = Math.max(20, el.w - 12 - (reels - 1) * gap);
        double colW = availW / reels;
        int cardW = Math.max(14, Math.min(el.slotSize, (int) Math.floor(colW)));
        int cardH = Math.max(14, Math.min(el.slotSize, (int) Math.floor((el.h - 8) * 0.52)));
        int stepV = cardH + gap;
        double totalW = reels * cardW + (reels - 1) * gap;
        double startX = el.x + (el.w - totalW) * 0.5;

        int pIdx = 0;
        for (int r = 0; r < reels && pIdx < pool.size(); r++) {
            List<MenuDef.Reward> strip = strips.get(r);
            double offsetPy = offsetsPy[r];
            double cx = startX + r * (cardW + gap) + cardW / 2.0;
            int firstVisible = Math.max(0, (int) Math.floor((-offsetPy - stepV) / stepV));
            for (int k = 0; k < 5 && pIdx < pool.size(); k++) {
                int sIdx = firstVisible + k;
                if (sIdx < 0 || sIdx >= strip.size()) continue;
                double cy = el.y + offsetPy + sIdx * stepV + cardH / 2.0;
                if (cy < el.y + cardH * 0.35 || cy > el.y + el.h - cardH * 0.35) continue;
                drawCard(pool.get(pIdx++), strip.get(sIdx), cx, cy, cardW, cardH, 160, 0.95);
            }
        }
        while (pIdx < pool.size()) hideSlot(pool.get(pIdx++));
    }

    private double[] gridCardLayout(int count) {
        int rows = count >= 6 ? 2 : 1;
        int colsTop = (int) Math.ceil((double) count / rows);
        int gap = Math.max(0, el.slotGap);
        double availW = Math.max(24, el.w - 16);
        double availH = Math.max(24, el.h - 14);
        double maxW = Math.floor((availW - (colsTop - 1) * gap) / colsTop);
        double maxH = Math.floor((availH - (rows - 1) * gap) / rows);
        double size = Math.max(14, Math.min(el.slotSize, Math.min(maxW, maxH)));
        return new double[]{rows, colsTop, gap, size};
    }

    private void renderFlash(List<MenuDef.Reward> board, int activeIdx, boolean activeHighlight) {
        int count = Math.min(pool.size(), Math.max(1, board.size()));
        double[] g = gridCardLayout(count);
        int rows = (int) g[0], colsTop = (int) g[1];
        double gap = g[2], size = g[3];
        double totalH = rows * size + (rows - 1) * gap;
        double startY = el.y + (el.h - totalH) * 0.5;
        for (int pIdx = 0; pIdx < pool.size(); pIdx++) {
            SlotView sv = pool.get(pIdx);
            if (pIdx >= count) { hideSlot(sv); continue; }
            int row = pIdx < colsTop ? 0 : 1;
            int rowCols = row == 0 ? colsTop : (count - colsTop);
            int col = row == 0 ? pIdx : (pIdx - colsTop);
            double rowW = rowCols * size + (rowCols - 1) * gap;
            double startX = el.x + (el.w - rowW) * 0.5;
            double cx = startX + col * (size + gap) + size * 0.5;
            double cy = startY + row * (size + gap) + size * 0.5;
            boolean lit = activeHighlight && pIdx == activeIdx;
            double mul = lit ? 1.12 : 0.94;
            drawCard(sv, board.get(pIdx), cx, cy, size * mul, size * mul, lit ? 230 : 85, lit ? 1.05 : 0.9);
        }
    }

    private void renderFlipGrid(List<MenuDef.Reward> board, int focusIdx, boolean focusRevealed, double widthPulse, boolean othersRevealed, boolean othersFlipping) {
        int count = Math.min(pool.size(), Math.max(1, board.size()));
        double[] g = gridCardLayout(count);
        int rows = (int) g[0], colsTop = (int) g[1];
        double gap = g[2], size = g[3];
        double totalH = rows * size + (rows - 1) * gap;
        double startY = el.y + (el.h - totalH) * 0.5;
        for (int pIdx = 0; pIdx < pool.size(); pIdx++) {
            SlotView sv = pool.get(pIdx);
            if (pIdx >= count) { hideSlot(sv); continue; }
            int row = pIdx < colsTop ? 0 : 1;
            int rowCols = row == 0 ? colsTop : (count - colsTop);
            int col = row == 0 ? pIdx : (pIdx - colsTop);
            double rowW = rowCols * size + (rowCols - 1) * gap;
            double startX = el.x + (el.w - rowW) * 0.5;
            double cx = startX + col * (size + gap) + size * 0.5;
            double cy = startY + row * (size + gap) + size * 0.5;
            boolean isFocus = pIdx == focusIdx;
            if (isFocus) {
                double sx = othersFlipping ? 1.0 : widthPulse;
                if (focusRevealed) {
                    drawCard(sv, board.get(pIdx), cx, cy, size * 1.10 * sx, size * 1.10, 230, 1.05);
                } else {
                    drawMysteryCard(sv, cx, cy, size * sx, size, 225, true);
                }
            } else {
                boolean dim = focusIdx >= 0;
                double sx = othersFlipping ? widthPulse : 1.0;
                if (othersRevealed) {
                    drawCard(sv, board.get(pIdx), cx, cy, size * sx, size, 85, 0.9);
                } else {
                    drawMysteryCard(sv, cx, cy, size * sx, size, dim ? 105 : 185, false);
                }
            }
        }
    }

    private void hideSlot(SlotView sv) {
        Transformation zero = new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(0.0001f, 0.0001f, 0.0001f), new AxisAngle4f());
        sv.cardBg.setBackgroundColor(Color.fromARGB(0, 0, 0, 0));
        sv.cardBg.setTransformation(zero);
        sv.item.setTransformation(zero);
        sv.label.setTextOpacity((byte) 8);
    }

    static MenuDef.Reward rollWinner(List<MenuDef.Reward> rewards) {
        double total = 0;
        for (MenuDef.Reward r : rewards) total += Math.max(0.01, r.weight());
        double roll = ThreadLocalRandom.current().nextDouble() * total;
        for (MenuDef.Reward r : rewards) {
            roll -= Math.max(0.01, r.weight());
            if (roll <= 0) return r;
        }
        return rewards.get(0);
    }

    void destroy() {
        spinning = false;
        stopTask();
        for (Entity e : ownEntities) if (e.isValid()) e.remove();
        ownEntities.clear();
        pool.clear();
    }

    private static Color parseArgb(String hex, int alpha) {
        try {
            int rgb = Integer.parseInt(String.valueOf(hex).replace("#", "").trim(), 16);
            return Color.fromARGB(alpha, (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
        } catch (NumberFormatException ex) {
            return Color.fromARGB(alpha, 16, 20, 32);
        }
    }
}
