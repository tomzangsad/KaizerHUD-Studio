/* ========================================
   Preview Rendering
   ======================================== */

// ANCHORS defined in app.js

// Preview font size (CSS px per GUI px, Minecraftia) per Bedrock font_size. Minecraftia at 8 px
// draws digits 7 px tall and "10:08" 25 px wide — exactly Bedrock's normal font (measured in game
// 2026-11-23). small 4 = measured 2026-11-22; large ×1.5 is not measured.
const PREVIEW_FONT_PX = { small: 4, normal: 8, large: 12 };

/* Where Bedrock draws a bossbar text — the same for texts made in the editor and imported ones.
   Export (codegen.rs): a 1×1 panel at anchor_from + offset, pivoted by its anchor_to, holding a
   label at text_anchor_from of that panel + e, pivoted by text_anchor_to;
   e = text_offset − default for its row/size (+ lift on the middle row), rounded to 0.1.
   In game (GUI units, y down), measured 2026-11-22/23 (HudGraveyard, Simple HUD, GUI scale 3):
     digit top = panel top + text_anchor_from.y + e.y − text_anchor_to.y × boxH + inkTop
     label left/centre/right edge = panel left + text_anchor_from.x + e.x
   boxH = label height, inkTop = digits below the label top. normal measured 2026-11-23 (2nd round,
   Simple HUD re-imported: top/bottom rows and centred text all agree with boxH 10, inkTop 1);
   small from the 2026-11-22 calibration + middle lift; large = normal × 1.5 (not measured).
   The preview places the glyphs with the font's measured metrics, so it does not depend on how
   Windows (WebView2) or Linux lay out Minecraftia's odd line box. */
const BEDROCK_TEXT = {
  defaults: {
    top: { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] },
    middle: { small: [0, 0.9], normal: [0, 1.4], large: [0, 2] },
  },
  lift: { small: -1, normal: 0, large: 0 }, // codegen.rs bedrock_middle_label_lift
  inkTop: { small: 1.25, normal: 1, large: 1.5 },
  boxH: { small: 5, normal: 10, large: 15 },
  digitH: { small: 3.5, normal: 7, large: 10.5 },
};

const KzTextModel = {
  size(el) {
    return BEDROCK_TEXT.inkTop[el.font_size] !== undefined ? el.font_size : "normal";
  },
  isMiddle(name) {
    return ["center", "left_middle", "right_middle", "middle_left", "middle_right"].includes(name);
  },
  /** label offset written to the pack (codegen.rs text_offset_delta) */
  labelOffset(el) {
    const size = this.size(el);
    const from = el.text_anchor_from || "top_left";
    const middle = this.isMiddle(from);
    let to = Array.isArray(el.text_offset) ? el.text_offset : null;
    if (!to && el.text_offsets && Array.isArray(el.text_offsets[size])) to = el.text_offsets[size];
    const def = BEDROCK_TEXT.defaults[middle ? "middle" : "top"][size];
    const d = (i) => {
      const v = to ? Number(to[i]) : NaN;
      let r = Number.isFinite(v) ? v - def[i] : 0;
      if (i === 1 && middle) r += BEDROCK_TEXT.lift[size];
      return Math.round(r * 10) / 10 + 0;
    };
    return [d(0), d(1)];
  },
  /** in-game placement relative to the anchor point P (anchor_from + offset), GUI units:
      x = label edge, pivotX = 0 / 0.5 / 1 (left / centre / right edge at x), digitTop = top of digits */
  place(el, posEl) {
    const p = posEl || el;
    const size = this.size(el);
    const panelTo = ANCHORS[p.anchor_to || p.anchor_from] || ANCHORS.top_left;
    const tFrom = ANCHORS[el.text_anchor_from] || ANCHORS.top_left;
    const tTo = ANCHORS[el.text_anchor_to || el.text_anchor_from] || tFrom;
    const e = this.labelOffset(el);
    return {
      x: -panelTo.x + tFrom.x + e[0],
      pivotX: tTo.x,
      digitTop: -panelTo.y + tFrom.y + e[1] - tTo.y * BEDROCK_TEXT.boxH[size] + BEDROCK_TEXT.inkTop[size],
      digitH: BEDROCK_TEXT.digitH[size],
    };
  },
  /** text_offset that puts the digits' top-left / centre / top-right exactly on P
      (Java importer: the pack's text point), for a panel pivot fx, fy */
  exactTextOffset(align, size, fx, fy) {
    size = BEDROCK_TEXT.inkTop[size] !== undefined ? size : "normal";
    const middle = align === "center";
    const def = BEDROCK_TEXT.defaults[middle ? "middle" : "top"][size];
    const tx = align === "center" ? 0.5 : align === "right" ? 1 : 0;
    const ty = middle ? 0.5 : 0;
    const lift = middle ? BEDROCK_TEXT.lift[size] : 0;
    const want = middle ? -BEDROCK_TEXT.digitH[size] / 2 : 0; // digit top relative to P
    const ey = want + fy - ty + ty * BEDROCK_TEXT.boxH[size] - BEDROCK_TEXT.inkTop[size];
    const ex = fx - tx;
    const r = (v) => Math.round(v * 10) / 10 + 0;
    return [r(def[0] + ex), r(def[1] + ey - lift)];
  },
};
window.KzTextModel = KzTextModel;

function getPreviewScale() {
  const screen = document.getElementById("preview-screen");
  return {
    scaleX: screen.clientWidth / App.BEDROCK_WIDTH,
    scaleY: screen.clientHeight / App.BEDROCK_HEIGHT,
  };
}

/**
 * Calculate an element's position on the preview canvas.
 *
 * Images   → parent is the full screen (top_left origin)
 * Texts    → parent is scoreboard_sidebar:
 *            anchor=top_middle, offset=[-2,5], size=[100%,0]
 *            Since width is 100% and it's center-anchored, its left edge
 *            is exactly at screen left edge (0).
 *            So parent top-left origin = (-2*scaleX, 5*scaleY)
 *            parent width=sw, parent height=0
 *
 * For text the div is auto-sized (fit-content).
 * anchor_to for text is ignored (treated as top_left) because
 * the `players` factory panel self-aligns, so the offset is from
 * the anchor point directly — not shifted by the element's own size.
 */
function calcPosition(el) {
  const screen = document.getElementById("preview-screen");
  const sw = screen.clientWidth;
  const sh = screen.clientHeight;
  const { scaleX, scaleY } = getPreviewScale();

  const anchorFrom = ANCHORS[el.anchor_from] || ANCHORS["top_left"];

  if (el.type === "nameplate") {
    // Bedrock: a nameplate panel is content-sized, 17px tall (codegen.rs nameplate_slot_N_text_panel).
    // Every nameplate sits in one stack at the project's nameplate position, 2px from the top;
    // x is set after render, when the widths are known (see the second pass in renderPreview).
    return {
      x: null,
      y: 2 * scaleY,
      w: null,
      h: 17 * scaleY,
      isNameplate: true,
    };
  }
  if (el.type === "text" || el.type === "xp_label") {
    // Add xp_label
    const x = anchorFrom.x * sw + el.offset[0] * scaleX;
    const y = anchorFrom.y * sh + el.offset[1] * scaleY;
    return { x, y, w: null, h: null };
  } else {
    // image, player_head, bar, xp_label
    let elW = el.size[0] * scaleX;
    let elH = el.size[1] * scaleY;
    let x = anchorFrom.x * sw + el.offset[0] * scaleX;
    const y = anchorFrom.y * sh + el.offset[1] * scaleY;
    return { x, y, w: elW, h: elH };
  }
}

/* XP level number: size of the digits, from the font's real glyphs.
   Minecraftia has odd metrics (ascent 1.75em, negative descent, digits end
   0.6em above the baseline) and Windows reads them differently, so measure.
   line  = height of the font's line box on this system (ascent + descent)
   shift = margin that moves that line box so the digits start at the top
   ink   = height of the digits
   Measured once at 100px (canvas rounds font metrics to whole pixels). */
const _xpMetricCache = new Map();
function xpGlyphMetrics(fontPx, text) {
  const key = text || "0";
  let em = _xpMetricCache.get(key);
  if (!em) {
    try {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = '100px "Minecraftia", monospace';
      ctx.textBaseline = "alphabetic";
      const t = ctx.measureText(key);
      const asc = t.fontBoundingBoxAscent, desc = t.fontBoundingBoxDescent;
      const top = t.actualBoundingBoxAscent, bottom = t.actualBoundingBoxDescent;
      if ([asc, desc, top, bottom].every((v) => Number.isFinite(v)) && asc + desc > 0 && top + bottom > 0) {
        em = { line: (asc + desc) / 100, shift: (top - asc) / 100, ink: (top + bottom) / 100 };
      }
    } catch (e) {
      em = null;
    }
    if (!em) return null;
    // keep only what was measured with the real font, not the fallback
    if (!document.fonts || document.fonts.check('100px "Minecraftia"')) {
      if (_xpMetricCache.size > 50) _xpMetricCache.clear();
      _xpMetricCache.set(key, em);
    }
  }
  return { line: em.line * fontPx, shift: em.shift * fontPx, ink: em.ink * fontPx };
}

function renderPreview() {
  const container = document.getElementById("preview-elements");
  container.innerHTML = "";

  const { scaleX, scaleY } = getPreviewScale();

  // Add horbar.png as static background at bottom_middle
  const horbarDiv = document.createElement("div");
  horbarDiv.className = "preview-element is-horbar";
  horbarDiv.style.position = "absolute";
  const horbarSize = { w: 182 * scaleX, h: 22 * scaleY }; // Hardcoded dimensions
  const horbarPos = {
    x: container.clientWidth / 2 - horbarSize.w / 2, // center horizontally
    y: container.clientHeight - horbarSize.h - 2, // bottom aligned + offset up 2px
  };
  horbarDiv.style.left = `${horbarPos.x}px`;
  horbarDiv.style.top = `${horbarPos.y}px`;
  horbarDiv.style.width = `${horbarSize.w}px`;
  horbarDiv.style.height = `${horbarSize.h}px`;
  horbarDiv.style.pointerEvents = "none"; // Not interactive
  horbarDiv.style.zIndex = "10"; // Higher to be visible when zoomed

  // Custom hotbar textures from the Widgets panel (legacy widgets.png or 1.20.2+ sprites)
  const hotbarSprites =
    window.Widgets && typeof Widgets.getHotbarSprites === "function"
      ? Widgets.getHotbarSprites()
      : null;
  horbarDiv.style.opacity = hotbarSprites ? "1" : "0.8";

  const horbarImg = document.createElement("img");
  horbarImg.src = hotbarSprites ? hotbarSprites.bar : "img/horbar.png";
  horbarImg.draggable = false;
  horbarImg.style.width = "100%";
  horbarImg.style.height = "100%";
  horbarImg.style.objectFit = hotbarSprites ? "fill" : "contain";
  horbarImg.style.imageRendering = "pixelated";
  horbarDiv.appendChild(horbarImg);

  if (hotbarSprites) {
    // Selection frame over slot 1, 1px outside the bar like in game
    const selImg = document.createElement("img");
    selImg.src = hotbarSprites.selection;
    selImg.draggable = false;
    selImg.style.position = "absolute";
    selImg.style.left = `${-1 * scaleX}px`;
    selImg.style.top = `${-1 * scaleY}px`;
    selImg.style.width = `${24 * scaleX}px`;
    selImg.style.height = `${24 * scaleY}px`;
    selImg.style.imageRendering = "pixelated";
    horbarDiv.appendChild(selImg);
  }
  container.appendChild(horbarDiv);

  // Add perspective.png as 3 static slots at top_middle
  const perspOffsets = [-19, 0, 19];
  perspOffsets.forEach((offsetX) => {
    const perspDiv = document.createElement("div");
    perspDiv.className = "preview-element is-perspective";
    perspDiv.style.position = "absolute";
    perspDiv.style.pointerEvents = "none";
    perspDiv.style.zIndex = "10";
    perspDiv.style.opacity = "0.8";
    const perspSize = { w: 18 * scaleX, h: 18 * scaleY };
    perspDiv.style.width = `${perspSize.w}px`;
    perspDiv.style.height = `${perspSize.h}px`;
    // top_middle anchor: x = center + offsetX - halfWidth, y = offsetY
    const perspX =
      container.clientWidth / 2 + offsetX * scaleX - perspSize.w / 2;
    const perspY = 1 * scaleY;
    perspDiv.style.left = `${perspX}px`;
    perspDiv.style.top = `${perspY}px`;
    const perspImg = document.createElement("img");
    perspImg.src = "img/perspective.png";
    perspImg.draggable = false;
    perspImg.style.width = "100%";
    perspImg.style.height = "100%";
    perspImg.style.objectFit = "contain";
    perspImg.style.imageRendering = "pixelated";
    perspDiv.appendChild(perspImg);
    container.appendChild(perspDiv);
  });

  function applyBarVisual(targetDiv, barElement, slicedImages, alphaOverride) {
    if (slicedImages && slicedImages.length > 0) {
      targetDiv.style.overflow = "hidden";
      targetDiv.style.isolation = "isolate";
      if (alphaOverride !== undefined) {
        targetDiv.style.opacity = String(alphaOverride);
      }

      const img = document.createElement("img");
      img.src = slicedImages[barElement.previewStep - 1];
      img.draggable = false;
      img.style.position = "absolute";
      img.style.top = "0";
      img.style.left = "0";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "fill";
      img.style.imageRendering = "pixelated";
      img.style.display = "block";
      targetDiv.appendChild(img);

      // Apply barColor tint via multiply overlay (same as property panel preview)
      const barColor = barElement.barColor;
      if (
        barColor &&
        /^#[0-9A-Fa-f]{6}$/i.test(barColor) &&
        barColor.toUpperCase() !== "#FFFFFF"
      ) {
        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.background = barColor;
        overlay.style.mixBlendMode = "multiply";
        overlay.style.pointerEvents = "none";
        targetDiv.appendChild(overlay);
      }
      return;
    }

    const BAR_COLORS = {
      hp: "#e74c3c",
      food: "#e67e22",
      armor: "#95a5a6",
      air: "#3498db",
    };
    const fallbackColor =
      barElement.barColor && /^#[0-9A-Fa-f]{6}$/i.test(barElement.barColor)
        ? barElement.barColor
        : BAR_COLORS[barElement.barType] || "#e74c3c";
    targetDiv.style.background = fallbackColor;
    targetDiv.style.opacity = String(
      alphaOverride !== undefined ? alphaOverride : barElement.alpha,
    );
    targetDiv.style.borderRadius = "2px";
    targetDiv.style.border = "5px solid rgba(108, 255, 108, 0.3)"; // Add subtle border for visibility
  }

  App.elements.forEach((el) => {
    const div = document.createElement("div");
    div.className =
      "preview-element" +
      (el.type === "image"
        ? " is-image"
        : el.type === "player_head"
          ? " is-player-head"
          : el.type === "bar"
            ? " is-bar"
            : el.type === "xp_label"
              ? " is-xp-label"
              : el.type === "nameplate"
                ? " is-nameplate"
                : " is-text") +
      (App.selectedIds.includes(el.id) ? " selected" : "");
    div.dataset.id = el.id;

    const positionSource =
      typeof getPositionTargetElement === "function"
        ? getPositionTargetElement(App.elements, el)
        : el;
    const pos = calcPosition(positionSource);

    // Set position (skip left for nameplate - calculated after append)
    if (pos.x !== null) {
      div.style.left = pos.x + "px";
    }
    div.style.top = pos.y + "px";
    div.style.zIndex = positionSource.layer;
    div.style.opacity = el.alpha;

    // Set size (skip width for nameplate - content-sized)
    if (pos.w !== null) {
      div.style.width = pos.w + "px";
      div.style.height = pos.h + "px";
    } else if (el.type !== "nameplate") {
      div.style.width = "auto";
      div.style.height = "auto";
      div.style.minWidth = "1px";
      div.style.minHeight = "1px";
    }

    // Apply anchor pivot translation for images/bars only
    // Text labels and nameplates don't use pivot - position is pre-calculated
    if (el.type !== "text" && el.type !== "nameplate") {
      const elAnchor =
        ANCHORS[positionSource.anchor_from] || ANCHORS["top_left"];
      let translateX = 0;
      if (elAnchor.x === 0.5) translateX = -50;
      else if (elAnchor.x === 1) translateX = -100;

      let translateY = 0;
      if (elAnchor.y === 0.5) translateY = -50;
      else if (elAnchor.y === 1) translateY = -100;

      div.style.transform = `translate(${translateX}%, ${translateY}%)`;
    }
    if (el.type === "xp_label") {
      // XP label should not have centering transform - it uses anchor_from/offset like other elements
      div.style.width = "fit-content";
      div.style.height = "fit-content";
    }

    if (el.type === "bar") {
      const resolvedBar =
        typeof resolveBarForRender === "function"
          ? resolveBarForRender(App.elements, el)
          : el;
      const renderBar = {
        ...resolvedBar,
        anchor_from: positionSource.anchor_from,
        anchor_to: positionSource.anchor_to,
        offset: [...positionSource.offset],
        layer: positionSource.layer,
      };
      const resolvedPos = calcPosition(renderBar);
      div.style.left = resolvedPos.x + "px";
      div.style.top = resolvedPos.y + "px";
      div.style.zIndex = renderBar.layer;
      div.style.opacity = resolvedBar.alpha;
      if (resolvedPos.w !== null) {
        div.style.width = resolvedPos.w + "px";
        div.style.height = resolvedPos.h + "px";
      }
      applyBarVisual(
        div,
        resolvedBar,
        resolvedBar.slicedImages,
        resolvedBar.alpha,
      );
    } else if (el.type === "nameplate") {
      // Nameplate: content-sized width, fixed height
      div.style.position = "absolute";
      div.style.top = pos.y + "px";
      div.style.height = pos.h + "px";
      div.style.width = "fit-content"; // Bedrock: text width + 6px, no minimum

      const bgImg = document.createElement("img");
      bgImg.src = "img/sagust.png";
      bgImg.draggable = false;
      bgImg.style.position = "absolute";
      bgImg.style.width = "100%";
      bgImg.style.height = "100%";
      bgImg.style.imageRendering = "pixelated";
      bgImg.style.top = "0";
      bgImg.style.left = "0";
      div.appendChild(bgImg);

      const fontSize = 6 * Math.max(scaleX, scaleY);
      const span = document.createElement("span");
      span.className = "text-content";
      span.style.position = "relative";
      span.style.display = "inline-flex";
      span.style.alignItems = "center";
      span.style.justifyContent = "center";
      span.style.padding = "0 " + 3 * scaleX + "px";
      span.style.height = "100%";
      span.style.fontSize = fontSize + "px";
      span.style.fontFamily = '"Minecraftia", monospace';
      span.style.color = `rgb(${Math.round(el.color[0] * 255)}, ${Math.round(el.color[1] * 255)}, ${Math.round(el.color[2] * 255)})`;
      span.style.zIndex = "1";
      span.style.whiteSpace = "nowrap";
      if (el.shadow) {
        span.style.textShadow = `${1 * scaleX}px ${1 * scaleY}px 0 rgba(0,0,0,0.5)`;
      }
      span.textContent =
        el.papi_placeholder ||
        el.name ||
        `nameplate_slot #${el.collection_index}`;
      div.appendChild(span);
    } else if (el.type === "image" || el.type === "player_head") {
      const imgSrc =
        el.type === "player_head" ? "img/player_head.png" : el.imageData;
      if (imgSrc) {
        // Wrapper for image + color overlay (like Bar)
        const imgWrapper = document.createElement("div");
        imgWrapper.style.position = "relative";
        imgWrapper.style.width = "100%";
        imgWrapper.style.height = "100%";
        imgWrapper.style.display = "flex";
        imgWrapper.style.alignItems = "center";
        imgWrapper.style.justifyContent = "center";
        
        const img = document.createElement("img");
        const animated = el.type === "image" && window.KzAnim && KzAnim.isAnimated(el);
        img.src = animated ? KzAnim.currentFrame(el) : imgSrc;
        if (animated) img.dataset.kzAnim = String(el.id); // animation.js swaps the frames
        img.draggable = false;
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        img.style.objectFit = "contain";
        
        if (el.type === "player_head") {
          const zoom = el.head_zoom !== undefined ? el.head_zoom : 1.0;
          img.style.transform = `scale(${zoom})`;
          div.style.background = "rgba(0, 0, 0, 0.2)";
        }
        
        imgWrapper.appendChild(img);
        
        // Color overlay (multiply blend like Bar) - only if not white/default
        if (el.type === "image" && el.color) {
          const r = Math.round(el.color[0] * 255);
          const g = Math.round(el.color[1] * 255);
          const b = Math.round(el.color[2] * 255);
          // Only apply tint if color is not white
          if (r !== 255 || g !== 255 || b !== 255) {
            const colorOverlay = document.createElement("div");
            colorOverlay.style.position = "absolute";
            colorOverlay.style.top = "0";
            colorOverlay.style.left = "0";
            colorOverlay.style.width = "100%";
            colorOverlay.style.height = "100%";
            colorOverlay.style.background = `rgb(${r}, ${g}, ${b})`;
            colorOverlay.style.mixBlendMode = "multiply";
            colorOverlay.style.pointerEvents = "none";
            colorOverlay.style.zIndex = "2";
            imgWrapper.appendChild(colorOverlay);
          }
        }
        
        div.appendChild(imgWrapper);
      } else {
        div.style.background = "rgba(46, 204, 113, 0.2)";
        div.style.border = "1px dashed rgba(46, 204, 113, 0.5)";
        div.innerHTML =
          '<span style="font-size:10px;color:#2ecc71;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">No image</span>';
      }
    } else if (el.type === "xp_label") {
      const fontSize = PREVIEW_FONT_PX[el.xp_font_size] || PREVIEW_FONT_PX.small;
      div.style.fontSize = fontSize * Math.max(scaleX, scaleY) + "px";
      div.style.fontFamily = '"Minecraftia", monospace';
      div.style.color = `rgb(${Math.round(el.xp_color[0] * 255)}, ${Math.round(el.xp_color[1] * 255)}, ${Math.round(el.xp_color[2] * 255)})`;
      div.style.whiteSpace = "nowrap";
      if (el.xp_shadow) {
        div.style.textShadow = `${1 * scaleX}px ${1 * scaleY}px 0 rgba(0,0,0,0.5)`;
      }
      div.style.display = "block";
      div.style.textAlign = "center";

      // The box hugs the digits: the font's ascent/descent differ between
      // Windows (WebView2) and other systems, so a plain line box put the
      // number above the selection frame. Measure the real glyphs instead and
      // leave one unit below for the shadow, like the in-game label.
      const fontPx = fontSize * Math.max(scaleX, scaleY);
      const text = el.text || "13";
      const m = xpGlyphMetrics(fontPx, text);
      const span = document.createElement("span");
      span.className = "text-content";
      span.style.display = "block";
      span.style.width = "100%";
      span.style.textAlign = "center";
      span.textContent = text;
      // The digits are centred in the element's box (xpBoxSize: old 20×10 boxes read as 12×9),
      // exactly like Bedrock (centred label in a panel of that size) and Java (centred text).
      // The box is placed by its anchor corner like an image (pivot transform above).
      const [boxW0, boxH0] = xpBoxSize(el);
      const boxW = boxW0 * scaleX;
      const boxH = boxH0 * scaleY;
      div.style.width = boxW + "px";
      span.style.overflow = "visible";
      if (m) {
        div.style.height = boxH + "px";
        span.style.lineHeight = m.line + "px";
        span.style.height = m.line + "px";
        span.style.marginTop = (boxH - m.ink) / 2 + m.shift + "px";
      } else {
        // font metrics unavailable: centre the line box instead
        div.style.height = boxH + "px";
        div.style.lineHeight = boxH + "px";
      }
      div.appendChild(span);
    } else {
      // Bossbar text - panel + label nested structure matching JSON export
      const fontSize = PREVIEW_FONT_PX[KzTextModel.size(el)]; // export defaults to normal
      const fontSizePx = fontSize * Math.max(scaleX, scaleY);
      
      // Panel styling (outer container - 1x1 size like JSON)
      div.style.width = "1px";
      div.style.height = "1px";
      div.style.position = "absolute";
      
      // Create inner label element
      const label = document.createElement("span");
      label.className = "text-content";
      label.textContent = `text${el.collection_index}`; // short stand-in: the number is the slot Index
      
      // Label styling
      label.style.position = "absolute";
      label.style.fontSize = fontSizePx + "px";
      label.style.fontFamily = '"Minecraftia", monospace';
      label.style.color = `rgb(${Math.round(el.color[0] * 255)}, ${Math.round(el.color[1] * 255)}, ${Math.round(el.color[2] * 255)})`;
      label.style.whiteSpace = "nowrap";
      if (el.shadow) {
        label.style.textShadow = `${1 * scaleX}px ${1 * scaleY}px 0 rgba(0,0,0,0.5)`;
      }
      
      // Where the game draws it (KzTextModel above), relative to this div = the anchor point P.
      // The digits' top is put there with the font's measured line box (same on every system).
      const place = KzTextModel.place(el, positionSource);
      const m = xpGlyphMetrics(fontSizePx, "0");
      const shift = m ? m.shift : -0.25 * fontSizePx; // fallback: Linux Chrome metrics
      if (m) {
        label.style.lineHeight = m.line + "px";
        label.style.height = m.line + "px";
      }
      label.style.left = `${place.x * scaleX}px`;
      label.style.top = `${place.digitTop * scaleY + shift}px`;
      label.style.transform = `translateX(${-place.pivotX * 100}%)`;
      
      div.appendChild(label);
      
      // DEBUG: Red center marker at panel origin (1x1 pixel center)
      const centerDot = document.createElement("div");
      centerDot.style.position = "absolute";
      centerDot.style.width = "6px";
      centerDot.style.height = "6px";
      centerDot.style.backgroundColor = "#ff0000";
      centerDot.style.border = "1px solid white";
      centerDot.style.left = "50%";
      centerDot.style.top = "50%";
      centerDot.style.transform = "translate(-50%, -50%)";
      centerDot.style.zIndex = "9999";
      centerDot.style.pointerEvents = "none";
      div.appendChild(centerDot);
    }

    div.addEventListener("click", (e) => {
      e.stopPropagation();
      App.selectElement(el.id);
    });

    // Drag support — document listeners live in PreviewDrag (installed once)
    div.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (positionSource.lockPosition) return;

      // If dragging an unselected item, select it first
      if (!App.selectedIds.includes(el.id)) {
        const multi = e.ctrlKey || e.shiftKey || e.metaKey;
        App.selectElement(el.id, multi);
      }
      PreviewDrag.begin(e);
      e.preventDefault();
    });

    container.appendChild(div);
  });

  // Second pass: nameplates form Bedrock's horizontal stack (slot 1 leftmost, 1px spacers) at the
  // project's nameplate position: top_left [4, 2], top_right [-4, 2], top_middle centred [0, 2]
  // (desktop placement; on phones top_middle is pushed down, shown as a dashed outline).
  const nameplates = App.elements
    .filter((e) => e.type === "nameplate")
    .sort((a, b) => a.collection_index - b.collection_index);
  const sw = document.getElementById("preview-screen").clientWidth;
  const spacer = 1 * scaleX;
  const npDivs = nameplates.map((np) => document.querySelector(`[data-id="${np.id}"]`)).filter(Boolean);
  if (npDivs.length) {
    const npSet = getNameplateSettings();
    const total = npDivs.reduce((sum, d) => sum + d.offsetWidth, 0) + spacer * (npDivs.length - 1);
    let x =
      npSet.position === "top_left" ? 4 * scaleX
        : npSet.position === "top_middle" ? (sw - total) / 2
          : sw - 4 * scaleX - total;
    const startX = x;
    npDivs.forEach((div) => {
      div.style.left = x + "px";
      x += div.offsetWidth + spacer;
    });
    if (npSet.position === "top_middle" && npSet.mobileOffset > 0) {
      const ghost = document.createElement("div");
      ghost.className = "nameplate-mobile-ghost";
      ghost.title = `Phones: the nameplate row moves down ${npSet.mobileOffset}px (clear of the top buttons)`;
      ghost.style.position = "absolute";
      ghost.style.left = startX + "px";
      ghost.style.top = (2 + npSet.mobileOffset) * scaleY + "px";
      ghost.style.width = total + "px";
      ghost.style.height = 17 * scaleY + "px";
      ghost.style.border = "1px dashed rgba(255, 255, 255, 0.55)";
      ghost.style.boxSizing = "border-box";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "9998";
      const tag = document.createElement("span");
      tag.textContent = "mobile";
      tag.style.position = "absolute";
      tag.style.left = "2px";
      tag.style.top = "100%";
      tag.style.fontSize = "10px";
      tag.style.color = "rgba(255, 255, 255, 0.7)";
      ghost.appendChild(tag);
      container.appendChild(ghost);
    }
  }

  renderAnchorGuide();
}

// ── Anchor guide: shows which screen point the selected element's offset is measured from ──
function renderAnchorGuide() {
  const screen = document.getElementById("preview-screen");
  let guide = document.getElementById("anchor-guide");
  if (!guide) {
    guide = document.createElement("div");
    guide.id = "anchor-guide";
    screen.appendChild(guide);
  }
  const selected = App.getAllSelected ? App.getAllSelected() : [];
  if (selected.length !== 1 || selected[0].type === "nameplate") {
    guide.style.display = "none";
    return;
  }
  const el = selected[0];
  const src =
    typeof getPositionTargetElement === "function"
      ? getPositionTargetElement(App.elements, el) || el
      : el;
  const anchorName = ANCHORS[src.anchor_from] ? src.anchor_from : "top_left";
  const a = ANCHORS[anchorName];
  const sw = screen.clientWidth;
  const sh = screen.clientHeight;
  const { scaleX, scaleY } = getPreviewScale();
  const off = Array.isArray(src.offset) ? src.offset : [0, 0];
  const ax = a.x * sw;
  const ay = a.y * sh;
  const ox = ax + (Number(off[0]) || 0) * scaleX;
  const oy = ay + (Number(off[1]) || 0) * scaleY;
  const fmt = (n) => String(Math.round((Number(n) || 0) * 10) / 10);
  const chipAlignX = a.x === 1 ? "right" : a.x === 0.5 ? "center" : "left";
  const chipAlignY = a.y === 1 ? "bottom" : "top";

  guide.style.display = "block";
  guide.innerHTML = `
    <svg class="ag-lines" width="${sw}" height="${sh}">
      <line x1="${ax}" y1="${ay}" x2="${ox}" y2="${ay}" />
      <line x1="${ox}" y1="${ay}" x2="${ox}" y2="${oy}" />
    </svg>
    <div class="ag-anchor" style="left:${ax}px;top:${ay}px"></div>
    <div class="ag-origin" style="left:${ox}px;top:${oy}px"></div>
    <div class="ag-chip ag-x-${chipAlignX} ag-y-${chipAlignY}" style="left:${ax}px;top:${ay}px">
      <b>${anchorName}</b><span>x ${fmt(off[0])}</span><span>y ${fmt(off[1])}</span>
    </div>`;
}

// Debounced window resize handler
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => App.render(), 100);
});

// ── Element dragging — one controller for all elements ──────────────────────
// Offsets/anchors only change after a real drag (>= 3px), never on a plain click,
// so clicking an element can't shift its in-game position.
const GRID_CELLS_TO_ANCHORS = [
  "top_left", "top_middle", "top_right",
  "middle_left", "center", "middle_right",
  "bottom_left", "bottom_middle", "bottom_right",
];
const DRAG_THRESHOLD_PX = 3;

function previewDragTarget(selEl) {
  if (typeof getPositionTargetElement === "function") {
    return getPositionTargetElement(App.elements, selEl) || selEl;
  }
  return selEl;
}

// Same on-screen point, measured from a different anchor (HUD units, 0.1 precision)
function reanchorOffset(oldAnchor, newAnchor, offset) {
  const o = ANCHORS[oldAnchor] || ANCHORS["top_left"];
  const n = ANCHORS[newAnchor] || ANCHORS["top_left"];
  const x = offset[0] + (o.x - n.x) * App.BEDROCK_WIDTH;
  const y = offset[1] + (o.y - n.y) * App.BEDROCK_HEIGHT;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

const PreviewDrag = {
  state: null,

  begin(e) {
    const startOffsets = {};
    App.getAllSelected().forEach((selEl) => {
      const t = previewDragTarget(selEl);
      if (t && !t.lockPosition) startOffsets[t.id] = [...t.offset];
    });
    this.state = { x: e.clientX, y: e.clientY, startOffsets, moved: false };
  },

  move(e) {
    const s = this.state;
    if (!s) return;
    if (!s.moved) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_THRESHOLD_PX) return;
      s.moved = true;
      App.pushHistory();
    }
    const { scaleX, scaleY } = getPreviewScale();
    const dx = (e.clientX - s.x) / scaleX;
    const dy = (e.clientY - s.y) / scaleY;
    App.getAllSelected().forEach((selEl) => {
      const t = previewDragTarget(selEl);
      if (t && !t.lockPosition && s.startOffsets[t.id]) {
        t.offset = [
          Math.round(s.startOffsets[t.id][0] + dx),
          Math.round(s.startOffsets[t.id][1] + dy),
        ];
      }
    });
    App.render();
  },

  end() {
    const s = this.state;
    this.state = null;
    if (!s || !s.moved) return;

    // Auto-anchor to the 3x3 cell the element was dropped in (only while Grid is on)
    if (window.GridToggle && GridToggle.isActive) {
      const { scaleX, scaleY } = getPreviewScale();
      const screen = document.getElementById("preview-screen");
      const sw = screen.clientWidth;
      const sh = screen.clientHeight;
      App.getAllSelected().forEach((selEl) => {
        const t = previewDragTarget(selEl);
        if (!t || t.lockPosition) return;
        const a = ANCHORS[t.anchor_from] || ANCHORS["top_left"];
        const absX = a.x * sw + t.offset[0] * scaleX;
        const absY = a.y * sh + t.offset[1] * scaleY;
        let elW = 0, elH = 0;
        if (t.type !== "text" && t.size) {
          elW = t.size[0] * scaleX;
          elH = t.size[1] * scaleY;
        }
        const col = Math.max(0, Math.min(2, Math.floor(((absX + elW / 2) / sw) * 3)));
        const row = Math.max(0, Math.min(2, Math.floor(((absY + elH / 2) / sh) * 3)));
        const cellIndex = row * 3 + col;
        const newAnchor = GRID_CELLS_TO_ANCHORS[cellIndex];
        if (newAnchor && newAnchor !== t.anchor_from) {
          t.offset = reanchorOffset(t.anchor_from, newAnchor, t.offset);
          t.anchor_from = newAnchor;
          t.anchor_to = newAnchor;
          const cells = document.querySelectorAll(".grid-cell");
          if (cells[cellIndex]) {
            cells[cellIndex].classList.add("flash");
            setTimeout(() => cells[cellIndex].classList.remove("flash"), 350);
          }
        }
      });
    }
    App.render();
  },
};
document.addEventListener("mousemove", (e) => PreviewDrag.move(e));
document.addEventListener("mouseup", () => PreviewDrag.end());

// ── Marquee (drag-to-select) — initialized once ──────────────────────────────
(function initMarqueeSelect() {
  const screen = document.getElementById("preview-screen");
  if (!screen) return;

  const marquee = document.getElementById("marquee-select");
  if (!marquee) return;

  let isMarquee = false;
  let startX = 0,
    startY = 0;

  let lastMarqueeRect = null;

  screen.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    // Only start marquee when clicking on the screen background (not on an element)
    if (e.target.closest(".preview-element")) return;

    const rect = screen.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isMarquee = true;
    lastMarqueeRect = null;

    marquee.style.left = startX + "px";
    marquee.style.top = startY + "px";
    marquee.style.width = "0px";
    marquee.style.height = "0px";
    marquee.style.display = "block";

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isMarquee) return;
    const rect = screen.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    const x = Math.min(startX, curX);
    const y = Math.min(startY, curY);
    const w = Math.abs(curX - startX);
    const h = Math.abs(curY - startY);

    marquee.style.left = x + "px";
    marquee.style.top = y + "px";
    marquee.style.width = w + "px";
    marquee.style.height = h + "px";
  });

  document.addEventListener("mouseup", (e) => {
    if (!isMarquee) return;
    isMarquee = false;

    // Capture rect BEFORE hiding (hidden element has 0x0 rect)
    const mRect = marquee.getBoundingClientRect();
    marquee.style.display = "none";

    // Only treat as marquee if dragged at least 5px
    if (mRect.width < 5 && mRect.height < 5) return;

    // Find all element divs that intersect the marquee
    const matched = [];
    document.querySelectorAll(".preview-element[data-id]").forEach((div) => {
      const dRect = div.getBoundingClientRect();
      const overlaps = !(
        dRect.right < mRect.left ||
        dRect.left > mRect.right ||
        dRect.bottom < mRect.top ||
        dRect.top > mRect.bottom
      );
      if (overlaps) {
        const id = parseInt(div.dataset.id, 10);
        if (!isNaN(id)) matched.push(id);
      }
    });

    if (matched.length > 0) {
      App.selectedIds = matched;
      App.render();
    } else if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
      App.selectedIds = [];
      App.render();
    }
  });
})();

/* ── Pixel-accurate picking ──
   A click on a transparent part of an image (e.g. a big hotbar background) goes to
   the element underneath instead. Alt+click cycles through everything under the
   cursor. Texts, heads and nameplates count as solid boxes. */
(function installPixelPick() {
  const cache = new Map(); // img src → { d: alpha data, w, h }
  const SOLID = ["is-text", "is-player-head", "is-nameplate", "is-xp-label"];

  function pixels(img) {
    let c = cache.get(img.src);
    if (c) return c;
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    try {
      c = { d: ctx.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
    } catch (err) {
      c = { d: null };
    }
    if (cache.size > 400) cache.clear();
    cache.set(img.src, c);
    return c;
  }

  function alphaAt(img, x, y) {
    const r = img.getBoundingClientRect();
    if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) return 0;
    if (!img.complete || !img.naturalWidth) return 255;
    const c = pixels(img);
    if (!c.d) return 255;
    let px, py;
    if (getComputedStyle(img).objectFit === "contain") {
      const s = Math.min(r.width / c.w, r.height / c.h);
      px = Math.floor((x - (r.left + (r.width - c.w * s) / 2)) / s);
      py = Math.floor((y - (r.top + (r.height - c.h * s) / 2)) / s);
    } else {
      px = Math.floor(((x - r.left) / r.width) * c.w);
      py = Math.floor(((y - r.top) / r.height) * c.h);
    }
    if (px < 0 || py < 0 || px >= c.w || py >= c.h) return 0;
    return c.d[(py * c.w + px) * 4 + 3];
  }

  function solidAt(div, x, y) {
    if (SOLID.some((c) => div.classList.contains(c))) return true;
    const imgs = div.querySelectorAll("img");
    if (!imgs.length) return true;
    return Array.from(imgs).some((img) => alphaAt(img, x, y) > 16);
  }

  /** Elements under the point that are not transparent there, top first */
  function hits(x, y) {
    const out = [];
    for (const node of document.elementsFromPoint(x, y)) {
      const div = node.closest && node.closest(".preview-element[data-id]");
      if (div && !out.includes(div) && solidAt(div, x, y)) out.push(div);
    }
    return out;
  }

  let lastDown = null; // the mousedown's choice is reused by the click that follows

  function redirect(e) {
    if (e.__kzRedirect || e.button !== 0) return;
    const top = e.target.closest && e.target.closest(".preview-element[data-id]");
    if (!top) return;
    let chosen;
    if (e.type === "click" && lastDown && lastDown.x === e.clientX && lastDown.y === e.clientY) {
      chosen = lastDown.chosen;
    } else {
      const list = hits(e.clientX, e.clientY);
      chosen = list[0] || null;
      if (e.altKey && list.length > 1) {
        const cur = list.findIndex((d) => App.selectedIds.includes(Number(d.dataset.id)));
        chosen = list[(cur + 1) % list.length];
      }
      if (e.type === "mousedown") lastDown = { x: e.clientX, y: e.clientY, chosen };
    }
    if (chosen === top) return;
    e.stopPropagation();
    e.preventDefault();
    const target = chosen || document.getElementById("preview-screen");
    const ev = new MouseEvent(e.type, e);
    ev.__kzRedirect = true;
    target.dispatchEvent(ev);
  }

  function install() {
    const container = document.getElementById("preview-elements");
    if (!container) return;
    container.addEventListener("mousedown", redirect, true);
    container.addEventListener("click", redirect, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
