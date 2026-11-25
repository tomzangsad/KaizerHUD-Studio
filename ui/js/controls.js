/* ========================================



   Properties Panel Controls



   ======================================== */

const ANCHOR_OPTIONS = [
  "top_left",
  "top_middle",
  "top_right",

  "middle_left",
  "center",
  "middle_right",

  "bottom_left",
  "bottom_middle",
  "bottom_right",
];

const FONT_SIZE_OPTIONS = ["small", "normal", "large"];

const BAR_TYPE_OPTIONS = [
  { value: "hp", label: "HP", tag: "kh" },

  { value: "hp_freezing", label: "HP - FREEZING", tag: "fz" },

  { value: "hp_absorption", label: "HP - ABSORPTION", tag: "ab" },

  { value: "hp_health_boost", label: "HP - HEALTH_BOOST", tag: "hb" },

  { value: "hp_regeneration", label: "HP - REGENERATION", tag: "kr" },

  { value: "hp_wither", label: "HP - WITHER", tag: "kw" },

  { value: "hp_poison", label: "HP - POISON", tag: "kp" },

  { value: "food", label: "Food", tag: "kf" },

  { value: "food_hunger", label: "Food - HUNGER", tag: "kg" },

  { value: "food_saturation", label: "Food - SATURATION", tag: "ks" },

  { value: "armor", label: "Armor", tag: "ka" },

  { value: "air", label: "Air", tag: "ko" },

  { value: "exp", label: "EXP", tag: "ex" },
];

const BAR_EFFECT_OPTIONS = {
  hp: [
    "FREEZING",
    "ABSORPTION",
    "HEALTH_BOOST",
    "REGENERATION",
    "WITHER",
    "POISON",
  ],

  food: ["HUNGER", "SATURATION"],
};

function getBarTypeOptions(el) {
  return [
    ...BAR_TYPE_OPTIONS,
    { value: "custom", label: "Custom", tag: el.barCustomTag || "" },
  ];
}

function getBarTypeMeta(barType, customTag = "") {
  if (barType === "custom") {
    return { value: "custom", label: "Custom", tag: customTag || "" };
  }

  return (
    BAR_TYPE_OPTIONS.find((option) => option.value === barType) ||
    BAR_TYPE_OPTIONS[0]
  );
}

function getDefaultBarTexturePath(barType, customTag = "") {
  const meta = getBarTypeMeta(barType, customTag);

  return `textures/hotbar/fill_${meta.tag}/horizontal/16`;
}

function getBarEffectOptions(barType) {
  return BAR_EFFECT_OPTIONS[barType] || [];
}

function getDefaultPrefixForEffect(effectName) {
  const prefixMap = {
    FREEZING: "fz",

    ABSORPTION: "ab",

    HEALTH_BOOST: "hb",

    REGENERATION: "r",

    WITHER: "w",

    POISON: "p",

    HUNGER: "g",

    SATURATION: "s",
  };

  return prefixMap[effectName] || "";
}

function getDefaultTexturePathForPrefix(prefix) {
  return prefix ? `textures/hotbar/fill_${prefix}/horizontal/16` : "";
}

function getLinkableBarOptions(el) {
  return App.elements.filter(
    (candidate) => candidate.type === "bar" && candidate.id !== el.id,
  );
}

function getLinkablePositionOptions(el) {
  return App.elements.filter((candidate) => candidate.id !== el.id);
}

function startBarTextureJob(barId) {
  window.__barTextureJobTokens = window.__barTextureJobTokens || {};

  const token = `${barId}-${Date.now()}-${Math.random()}`;

  window.__barTextureJobTokens[barId] = token;

  return token;
}

function isLatestBarTextureJob(barId, token) {
  return !!(
    window.__barTextureJobTokens &&
    window.__barTextureJobTokens[barId] === token
  );
}

function syncColorSwatch(prefix, color) {
  const swatch = document.getElementById(prefix + "-swatch");

  if (swatch) {
    swatch.style.background = `rgb(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)})`;
  }
}

function getTypeBadgeInfo(type) {
  const map = {
    image: { icon: "🖼", label: "Image" },

    text: { icon: "T", label: "Scoreboard Text" },

    bar: { icon: "▬", label: "Status Bar" },

    player_head: { icon: "👤", label: "Player Head" },

    xp_label: { icon: "❇", label: "XP Level" },

    bossbar_text: { icon: "⚑", label: "Bossbar Text" },

    nameplate: { icon: "▭", label: "Nameplate" },
  };

  return map[type] || { icon: "?", label: type };
}

function renderColorInputs(prefix, color) {
  return `

    <div class="color-input-group">

      <div class="color-swatch" id="${prefix}-swatch" style="background:rgb(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)})"></div>

      <div class="color-input-wrapper">

        <div class="input-with-label"><span class="axis-label label-r">R</span><input type="number" id="${prefix}-r" value="${color[0]}" min="0" max="1" step="0.1" title="Red" /></div>

        <div class="input-with-label"><span class="axis-label label-g">G</span><input type="number" id="${prefix}-g" value="${color[1]}" min="0" max="1" step="0.1" title="Green" /></div>

        <div class="input-with-label"><span class="axis-label label-b">B</span><input type="number" id="${prefix}-b" value="${color[2]}" min="0" max="1" step="0.1" title="Blue" /></div>

      </div>

    </div>`;
}

// Helper: RGB array [r,g,b] to Hex string
function rgbToHex(color) {
  const r = Math.round((color[0] || 0) * 255);
  const g = Math.round((color[1] || 0) * 255);
  const b = Math.round((color[2] || 0) * 255);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Helper: Hex string to RGB array [r,g,b]
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [1, 1, 1];
  return [
    parseInt(clean.substr(0, 2), 16) / 255,
    parseInt(clean.substr(2, 2), 16) / 255,
    parseInt(clean.substr(4, 2), 16) / 255
  ];
}

// Hex color picker for RGB array properties (like Bar color picker)
function renderHexColorPickerFromRgb(id, rgbColor) {
  const hex = rgbToHex(rgbColor || [1, 1, 1]);
  return `
    <div style="display:flex;align-items:center;gap:6px;flex:1">
      <input type="color" id="${id}-picker" value="${hex}"
        style="width:32px;height:28px;padding:2px;border:1px solid var(--border,#444);border-radius:4px;cursor:pointer;background:none;flex-shrink:0"
        title="Click to pick a color" />
      <input type="text" id="${id}-hex" value="${hex}" maxlength="7"
        placeholder="#FFFFFF"
        style="flex:1;font-family:monospace;text-transform:uppercase;letter-spacing:1px"
        title="Hex color code" />
    </div>`;
}

function renderHexColorInput(id, hexValue) {
  const val =
    hexValue && /^#[0-9A-Fa-f]{6}$/.test(hexValue)
      ? hexValue.toUpperCase()
      : "#FFFFFF";
  return `
    <div style="display:flex;align-items:center;gap:6px;flex:1">
      <input type="color" id="${id}-picker" value="${val}"
        style="width:32px;height:28px;padding:2px;border:1px solid var(--border,#444);border-radius:4px;cursor:pointer;background:none;flex-shrink:0"
        title="Click to pick a color" />
      <input type="text" id="${id}-hex" value="${val}" maxlength="7"
        placeholder="#FFFFFF"
        style="flex:1;font-family:monospace;text-transform:uppercase;letter-spacing:1px"
        title="Hex color code" />
    </div>`;
}

function renderDualInput(id1, val1, id2, val2, label1, label2, opts = "") {
  return `

    <div class="dual-input">

      <div class="input-with-label"><span class="axis-label">${label1}</span><input type="number" id="${id1}" value="${val1}" ${opts} /></div>

      <div class="input-with-label"><span class="axis-label">${label2}</span><input type="number" id="${id2}" value="${val2}" ${opts} /></div>

    </div>`;
}

function renderAnchorGrid(currentAnchor, gridId) {
  const anchors = [
    "top_left",
    "top_middle",
    "top_right",

    "middle_left",
    "center",
    "middle_right",

    "bottom_left",
    "bottom_middle",
    "bottom_right",
  ];

  let cells = anchors
    .map(
      (a) =>
        `<div class="anchor-cell${a === currentAnchor ? " active" : ""}" data-anchor="${a}" title="${a.replace(/_/g, " ")}"></div>`,
    )
    .join("");

  return `<div class="anchor-grid" id="${gridId}">${cells}</div>`;
}

const VIS_OPERATORS = [
  ["==", "== (Equals)"],
  ["!=", "!= (Not Equals)"],
  [">", "> (Greater Than)"],
  ["<", "< (Less Than)"],
  [">=", ">= (Greater or Equal)"],
  ["<=", "<= (Less or Equal)"],
  ["in", "in (In List: a, b, c)"],
];

/** Extra show/hide conditions: every one must be true too (AND). Texts can't be hidden. */
function renderVisibilityExtra(el) {
  const list = normalizeVisibilityExtra(el.visibilityExtra);
  const rows = list
    .map(
      (c, i) => `
          <div class="kz-vis-extra" data-vis-index="${i}">
            <div class="kz-vis-extra-head">
              <span>AND condition ${i + 2}</span>
              <button type="button" class="btn btn-sm btn-danger kz-vis-remove" data-vis-index="${i}" title="Remove this condition">✕</button>
            </div>
            <div class="prop-row">
              <label>PAPI Placeholder</label>
              <input type="text" class="kz-vis-papi" data-vis-index="${i}" value="${escHtml(c.papi)}" placeholder="%player_gamemode%" />
            </div>
            <div class="prop-row">
              <label>Operator</label>
              <select class="kz-vis-op" data-vis-index="${i}">
                ${VIS_OPERATORS.map(([v, t]) => `<option value="${v}" ${c.op === v ? "selected" : ""}>${escHtml(t)}</option>`).join("")}
              </select>
            </div>
            <div class="prop-row">
              <label>Compare Value</label>
              <input type="text" class="kz-vis-value" data-vis-index="${i}" value="${escHtml(c.value)}" placeholder="SURVIVAL" />
            </div>
            <div class="prop-row">
              <label>Invert Result</label>
              <input type="checkbox" class="kz-vis-invert" data-vis-index="${i}" ${c.invert ? "checked" : ""} />
            </div>
          </div>`,
    )
    .join("");
  const textNote =
    el.type === "text" || el.type === "nameplate"
      ? `<small style="color: var(--text-muted); font-size: 0.7rem; display: block;">Texts are always shown in the Bedrock export.</small>`
      : "";
  return `
          ${rows}
          <div class="prop-row kz-vis-add-row">
            <button type="button" class="btn btn-sm" id="prop-visibility-add">+ Add condition</button>
            <small style="color: var(--text-muted); font-size: 0.7rem; display: block; margin-top: 4px;">${list.length ? "Shown only while ALL conditions are true." : "Add more if it must also depend on something else (all must be true)."}</small>
            ${textNote}
          </div>`;
}

function attachVisibilityExtraListeners(el) {
  const fresh = () => normalizeVisibilityExtra((App.elements.find((e) => e.id === el.id) || el).visibilityExtra);
  const set = (i, patch, rerender) => {
    const list = fresh();
    if (!list[i]) return;
    list[i] = { ...list[i], ...patch };
    App.updateElement(el.id, { visibilityExtra: list }, !rerender);
  };
  const add = document.getElementById("prop-visibility-add");
  if (add) {
    add.addEventListener("click", () => {
      const list = fresh();
      list.push({ papi: "", op: "==", value: "", invert: false });
      App.updateElement(el.id, { visibilityExtra: list }); // re-render Properties to show the new row
    });
  }
  document.querySelectorAll(".kz-vis-remove").forEach((b) => {
    b.addEventListener("click", () => {
      const list = fresh();
      list.splice(+b.dataset.visIndex, 1);
      App.updateElement(el.id, { visibilityExtra: list });
    });
  });
  document.querySelectorAll(".kz-vis-papi").forEach((inp) => {
    inp.addEventListener("input", () => set(+inp.dataset.visIndex, { papi: inp.value }, false));
  });
  document.querySelectorAll(".kz-vis-op").forEach((sel) => {
    sel.addEventListener("change", () => set(+sel.dataset.visIndex, { op: sel.value }, false));
  });
  document.querySelectorAll(".kz-vis-value").forEach((inp) => {
    inp.addEventListener("input", () => set(+inp.dataset.visIndex, { value: inp.value }, false));
  });
  document.querySelectorAll(".kz-vis-invert").forEach((cb) => {
    cb.addEventListener("change", () => set(+cb.dataset.visIndex, { invert: cb.checked }, false));
  });
}

function renderProperties() {
  const container = document.getElementById("properties-content");

  if (App.selectedIds.length > 1) {
    renderMultiProperties(container);

    return;
  }

  const el = App.getSelected();

  if (!el) {
    container.innerHTML =
      '<div class="no-selection"><p>Select an element to edit its properties</p></div>';

    return;
  }

  const linkablePositions = getLinkablePositionOptions(el);

  const linkedPositionSource =
    el.useLinkedPosition && el.linkedPositionId
      ? App.elements.find(
          (candidate) =>
            candidate.id === el.linkedPositionId && candidate.id !== el.id,
        )
      : null;

  const positionTarget = linkedPositionSource || el;

  const badge = getTypeBadgeInfo(el.type);

  let html = "";

  // Element Type Badge

  html += `

    <div class="prop-type-badge type-${el.type}">

      <div class="badge-icon">${badge.icon}</div>

      <div class="badge-info">

        <div class="badge-type">${badge.label}</div>

        <div class="badge-name">${escHtml(el.name)}</div>

      </div>

    </div>`;

  // General

  html += `

    <div class="prop-group">

      <div class="prop-group-title">General</div>

      <div class="prop-group-body">

        <div class="prop-row">

          <label>Name</label>

          <input type="text" id="prop-name" value="${escHtml(el.name)}" />

        </div>

        <div class="prop-row">

          <label>Group</label>

          <select id="prop-group">

            ${App.groups.map((g) => `<option value="${escHtml(g)}" ${el.group === g || (g === "Main" && !el.group) ? "selected" : ""}>${escHtml(g)}</option>`).join("")}

          </select>

        </div>

      </div>

    </div>`;

  // Image-specific

  if (el.type === "image") {
    html += `

      <div class="prop-group">

        <div class="prop-group-title">Image</div>

        <div class="prop-group-body">

          <div class="prop-image-preview">

            ${el.imageData ? `<img src="${el.imageData}" />` : '<span class="placeholder">No image loaded</span>'}

          </div>

          <button class="btn btn-change-image" id="btn-change-img">Change Image</button>

          <div class="prop-row">

            <label>Size</label>

            <div class="size-inputs">

              <input type="number" id="prop-img-size-w" value="${el.size[0]}" min="1" max="1024" step="1" title="Width" />

              <span class="size-separator">×</span>

              <input type="number" id="prop-img-size-h" value="${el.size[1]}" min="1" max="1024" step="1" title="Height" />

            </div>

          </div>

          <div class="prop-row">

            <label>Texture</label>

            <input type="text" id="prop-texture" value="${escHtml(el.texturePath)}" placeholder="textures/..." />

          </div>

          <div class="prop-row">

            <label>Color</label>

            ${renderHexColorPickerFromRgb("prop-img-color", el.color || [1, 1, 1])}

          </div>

          ${window.KzAnim ? KzAnim.renderSection(el) : ""}

        </div>

      </div>`;
  }

  // Text-specific

  if (el.type === "text") {
    html += `

      <div class="prop-group">

        <div class="prop-group-title">Scoreboard Text</div>

        <div class="prop-group-body">

          <div class="prop-row">

            <label>Index</label>

            <input type="number" id="prop-collection-index" value="${el.collection_index}" min="0" max="15" step="1" />

          </div>

          <div class="prop-row">

            <label>PAPI</label>

            <input type="text" id="prop-papi-placeholder" value="${escHtml(el.papi_placeholder || "")}" placeholder="Insert your placeholder (%player_x%)" title="PlaceholderAPI placeholder" />

          </div>

          <div class="prop-row">

            <label>Pad Length</label>

            ${renderPadInput(el)}
            ${renderPadBudget()}

          </div>

          <div class="prop-row">

            <label>Font Size</label>

            <select id="prop-font-size">

              ${FONT_SIZE_OPTIONS.map((f) => `<option value="${f}" ${el.font_size === f ? "selected" : ""}>${f}</option>`).join("")}

            </select>

          </div>

          <div class="prop-row">

            <label>Color</label>

            ${renderHexColorPickerFromRgb("prop-color", el.color)}

          </div>

          <div class="prop-row">

            <label>Shadow</label>

            <input type="checkbox" id="prop-shadow" ${el.shadow ? "checked" : ""} />

          </div>

          <div class="prop-row">

            <label>Text Align</label>

            <select id="prop-text-align">
              <option value="left" ${el.text_anchor_from === "top_left" ? "selected" : ""}>← Left</option>
              <option value="center" ${el.text_anchor_from === "center" ? "selected" : ""}>Center</option>
              <option value="right" ${el.text_anchor_from === "top_right" ? "selected" : ""}>Right →</option>
            </select>

          </div>

          <div class="prop-row">

            <label>Text Offset</label>

            ${renderDualInput("prop-text-offset-x", (el.text_offset || [0, 0])[0], "prop-text-offset-y", (el.text_offset || [0, 0])[1], "X", "Y", 'step="0.1"')}

          </div>


        </div>

      </div>`;
  }

  // Nameplate-specific

  if (el.type === "nameplate") {
    html += `

      <div class="prop-group">

        <div class="prop-group-title">Nameplate Text</div>

        <div class="prop-group-body">

          <div class="prop-row">

            <label>Index</label>

            <input type="number" id="prop-collection-index" value="${el.collection_index}" min="0" max="15" step="1" />

          </div>

          <div class="prop-row">

            <label>PAPI</label>

            <input type="text" id="prop-papi-placeholder" value="${escHtml(el.papi_placeholder || "")}" placeholder="Insert your placeholder (%player_x%)" title="PlaceholderAPI placeholder" />

          </div>

          <div class="prop-row">

            <label>Pad Length</label>

            ${renderPadInput(el)}
            ${renderPadBudget()}

          </div>

          <div class="prop-row">

            <label>Font Size</label>

            <select id="prop-font-size">

              ${FONT_SIZE_OPTIONS.map((f) => `<option value="${f}" ${el.font_size === f ? "selected" : ""}>${f}</option>`).join("")}

            </select>

          </div>

          <div class="prop-row">

            <label>Color</label>

            ${renderHexColorPickerFromRgb("prop-color", el.color)}

          </div>

          <div class="prop-row">

            <label>Shadow</label>

            <input type="checkbox" id="prop-shadow" ${el.shadow ? "checked" : ""} />

          </div>

          <div class="prop-row">

            <label>Text Align</label>

            <select id="prop-text-align">
              <option value="left" ${el.text_anchor_from === "top_left" ? "selected" : ""}>← Left</option>
              <option value="center" ${el.text_anchor_from === "center" ? "selected" : ""}>Center</option>
              <option value="right" ${el.text_anchor_from === "top_right" ? "selected" : ""}>Right →</option>
            </select>

          </div>

        </div>

      </div>`;
  }

  if (el.type === "bossbar_text") {
    html += `

      <div class="prop-group">

        <div class="prop-group-title">Bossbar Text</div>

        <div class="prop-group-body">

          <div class="prop-row">

            <label>Prefix</label>

            <input type="text" id="prop-bossbar-prefix" value="${escHtml(el.bossbar_prefix || "")}" placeholder="§0§0§r" title="Hidden prefix to detect" />

          </div>

          <div class="prop-row">

            <label>Font Size</label>

            <select id="prop-bossbar-font-size">

              ${FONT_SIZE_OPTIONS.map((f) => `<option value="${f}" ${el.bossbar_font_size === f ? "selected" : ""}>${f}</option>`).join("")}

            </select>

          </div>

          <div class="prop-row">

            <label>Color</label>

            ${renderColorInputs("prop-bossbar-color", el.bossbar_color)}

          </div>

          <div class="prop-row">

            <label>Shadow</label>

            <input type="checkbox" id="prop-bossbar-shadow" ${el.bossbar_shadow ? "checked" : ""} />

          </div>

        </div>

      </div>`;
  }

  // Player Head specific

  if (el.type === "player_head") {
    html += `

      <div class="prop-group">

        <div class="prop-group-title">Paper Doll (Inner 3D Model)</div>

        <div class="prop-group-body">

          <div class="prop-row">

            <label title="Scale/zoom of the paper doll">Doll Size</label>

            ${renderDualInput("prop-doll-size-w", el.doll_size ? el.doll_size[0] : 75, "prop-doll-size-h", el.doll_size ? el.doll_size[1] : 205, "W", "H", 'step="1"')}

          </div>

          <div class="prop-row">

            <label title="Shifts the paper doll">Doll Offset</label>

            ${renderDualInput("prop-doll-offset-x", el.doll_offset ? el.doll_offset[0] : 1, "prop-doll-offset-y", el.doll_offset ? el.doll_offset[1] : 18, "X", "Y", 'step="0.5"')}

          </div>

          <div class="prop-row" style="flex-direction:column;gap:6px;">

            <label title="Zoom the image inside the frame (frame size stays the same)">Image Zoom</label>

            <div style="display:flex;align-items:center;gap:8px;">

              <input type="range" id="prop-head-zoom" min="0.3" max="3.0" step="0.05"
                value="${el.head_zoom !== undefined ? el.head_zoom : 1.0}"
                style="flex:1;accent-color:#a78bfa;height:4px;cursor:pointer;" />

              <input type="number" id="prop-head-zoom-num" min="0.3" max="3.0" step="0.05"
                value="${el.head_zoom !== undefined ? Number(el.head_zoom).toFixed(2) : "1.00"}"
                style="width:54px;background:#1e1b4b;border:1px solid rgba(139,92,246,.3);border-radius:6px;padding:4px 6px;color:#e2e8f0;font-size:12px;text-align:center;" />

            </div>

          </div>

        </div>

      </div>`;
  }

  // Bar specific

  if (el.type === "bar") {
    const BAR_TYPES = getBarTypeOptions(el);

    const curType =
      BAR_TYPES.find((t) => t.value === el.barType) || BAR_TYPES[0];

    const linkableBars = getLinkableBarOptions(el);

    const linkedBar = linkableBars.find(
      (candidate) => candidate.id === el.linkedBarId,
    );

    const customPapiValue = el.barCustomPapi || "";

    const customMaxValue = el.barCustomMax || "";

    html += `

      <div class="prop-group">

        <div class="prop-group-title">Bar Settings</div>

        <div class="prop-group-body">

          <div class="prop-row">

            <label>Bar Type</label>

            <select id="prop-bar-type">

              ${BAR_TYPES.map((t) => `<option value="${t.value}" ${el.barType === t.value ? "selected" : ""}>${t.label}</option>`).join("")}

            </select>

          </div>

          <div class="prop-row">

            <label>Tag Prefix</label>

            <input type="text" id="prop-bar-custom-tag" value="${escHtml(curType.tag)}" maxlength="2" readonly title="Auto-generated unique tag" style="opacity:0.7" />

            <div id="prop-bar-tag-error" style="display: none; margin-top: 4px; font-size: 0.7rem; color: #fca5a5;">⚠️ Max 2 characters allowed</div>

          </div>

          ${
            el.barType === "custom"
              ? `

          <div class="prop-row">

            <label>PAPI</label>

            <input type="text" id="prop-bar-custom-papi" value="${escHtml(customPapiValue)}" placeholder="%player_exp%" />

          </div>

          <div class="prop-row">

            <label>Max</label>

            <input type="text" id="prop-bar-custom-max" value="${escHtml(customMaxValue)}" placeholder="100" />

          </div>

          `
              : ""
          }

          <div class="prop-row">

            <label>Texture Path</label>

            <input type="text" id="prop-bar-texture-path" value="${escHtml(el.barTexturePath)}" placeholder="textures/hotbar/fill_hp/horizontal/16" />

          </div>

          <div class="prop-row">

            <label>Bar Color</label>

            ${renderHexColorInput("prop-bar-color", el.barColor || "#FFFFFF")}

          </div>

          <div class="prop-row">

            <label title="The direction the bar depletes towards">Deplete Dir.</label>

            <select id="prop-bar-slice-direction">

              <option value="left" ${el.sliceDirection === "left" ? "selected" : ""}>Left → Right</option>

              <option value="right" ${el.sliceDirection === "right" ? "selected" : ""}>Right → Left</option>

              <option value="center" ${el.sliceDirection === "center" ? "selected" : ""}>Center Out</option>

              <option value="top" ${el.sliceDirection === "top" ? "selected" : ""}>Top → Bottom</option>

              <option value="bottom" ${el.sliceDirection === "bottom" ? "selected" : ""}>Bottom → Top</option>

            </select>

          </div>

          <div class="prop-row">

            <label>Size (16)</label>

            ${renderDualInput("prop-bar-max-w", el.barMaxSize[0], "prop-bar-max-h", el.barMaxSize[1], "W", "H", 'step="1" min="1"')}

          </div>

          <div class="prop-row">

            <label>Size (1)</label>

            ${renderDualInput("prop-bar-min-w", el.barMinSize[0], "prop-bar-min-h", el.barMinSize[1], "W", "H", 'step="1" min="1"')}

          </div>

          <div class="prop-row">

            <label>Preview</label>

            <div style="display:flex;align-items:center;gap:6px;flex:1">

              <input type="range" id="prop-bar-preview-step" value="${el.previewStep}" min="1" max="16" step="1" style="flex:1" />

              <span id="prop-bar-step-val" style="min-width:24px;text-align:right;font-size:0.75rem;color:var(--text-muted)">${el.previewStep}/16</span>

            </div>

          </div>

          <div class="prop-row">

            <label>Texture</label>

            <button class="btn" id="btn-bar-reupload" style="width:100%">

              ${el.slicedImages.length > 0 ? "🔄 Re-upload" : "📁 Upload"}

            </button>

          </div>

          ${
            el.slicedImages.length > 0
              ? `

          <div class="prop-row">

            <label>Preview</label>

            <div style="position:relative;display:inline-block;isolation:isolate;border:1px solid #333;border-radius:4px;background:#1a1a2e;padding:4px;max-width:100%">

              <img id="bar-preview-img" src="${el.slicedImages[el.previewStep - 1]}" style="max-width:100%;image-rendering:pixelated;display:block" />

              <div id="bar-color-overlay" style="position:absolute;top:4px;left:4px;right:4px;bottom:4px;background:${el.barColor || "#FFFFFF"};mix-blend-mode:multiply;pointer-events:none;border-radius:2px"></div>

            </div>

          </div>`
              : ""
          }

        </div>

      </div>

      <div class="prop-group">



      </div>`;
  }

  // XP Label specific

  if (el.type === "xp_label") {
    html += `

      <div class="prop-group">

        <div class="prop-group-title">XP Label Settings</div>

        <div class="prop-group-body">

          <div class="prop-row">

            <label>Font Size</label>

            <select id="prop-xp-font-size">

              ${FONT_SIZE_OPTIONS.map((f) => `<option value="${f}" ${el.xp_font_size === f ? "selected" : ""}>${f}</option>`).join("")}

            </select>

          </div>

          <div class="prop-row">

            <label>Color</label>

            ${renderHexColorPickerFromRgb("prop-xp-color", el.xp_color)}

          </div>

          <div class="prop-row">

            <label>Shadow</label>

            <input type="checkbox" id="prop-xp-shadow" ${el.xp_shadow ? "checked" : ""} />

          </div>

        </div>

      </div>`;
  }

  // Visibility Conditions (works for ALL element types)

  html += `

      <div class="prop-group">

        <div class="prop-group-title">Visibility Condition</div>

        <div class="prop-group-body">

          <div class="prop-row" style="margin-bottom: 8px;">

            <small style="color: #ef4444; font-size: 0.7rem; display: block; padding: 6px 8px; background: rgba(255, 255, 0, 0.12); border: 1px solid rgba(255, 255, 0, 0.3); border-radius: 6px;">⚠️ Note: This feature is optional — you don't need to use it on every element.</small>

          </div>

          <div class="prop-row">

            <label>PAPI Placeholder</label>

            <input type="text" id="prop-visibility-papi" value="${escHtml(el.visibilityPapi || "")}" placeholder="%mmocore_party_count%" />

          </div>

          <div class="prop-row">

            <label>Operator</label>

            <select id="prop-visibility-operator">

              <option value="==" ${el.visibilityOperator === "==" ? "selected" : ""}>== (Equals)</option>

              <option value="!=" ${el.visibilityOperator === "!=" ? "selected" : ""}>!= (Not Equals)</option>

              <option value=">" ${el.visibilityOperator === ">" ? "selected" : ""}>> (Greater Than)</option>

              <option value="<" ${el.visibilityOperator === "<" ? "selected" : ""}>< (Less Than)</option>

              <option value=">=" ${el.visibilityOperator === ">=" ? "selected" : ""}>>= (Greater or Equal)</option>

              <option value="<=" ${el.visibilityOperator === "<=" ? "selected" : ""}><= (Less or Equal)</option>

              <option value="in" ${el.visibilityOperator === "in" ? "selected" : ""}>in (In List: a, b, c)</option>

            </select>

          </div>

          <div class="prop-row">

            <label>Compare Value</label>

            <input type="text" id="prop-visibility-value" value="${escHtml(el.visibilityValue || "")}" placeholder="1" />

          </div>

          <div class="prop-row">

            <label>Invert Result</label>

            <input type="checkbox" id="prop-visibility-invert" ${el.visibilityInvert === true ? "checked" : ""} />

            <small style="color: var(--text-muted); font-size: 0.7rem; display: block; margin-top: 4px;">Hide when condition is true instead of show</small>

          </div>

          ${renderVisibilityExtra(el)}

        </div>

      </div>`;

  // Position (nameplates: one project-wide position instead of anchor / offset)

  if (el.type === "nameplate") {
    const np = getNameplateSettings();
    html += `

    <div class="prop-group">

      <div class="prop-group-title">Position</div>

      <div class="prop-group-body">

        <div class="prop-row">

          <label>Position</label>

          <select id="prop-np-position" title="Where every nameplate is shown (all nameplates share one row)">
            <option value="top_left" ${np.position === "top_left" ? "selected" : ""}>Top left</option>
            <option value="top_right" ${np.position === "top_right" ? "selected" : ""}>Top right</option>
            <option value="top_middle" ${np.position === "top_middle" ? "selected" : ""}>Top center</option>
          </select>

        </div>
        ${
          np.position === "top_middle"
            ? `
        <div class="prop-row">

          <label>Mobile push-down (px)</label>

          <input type="number" id="prop-np-mobile-offset" value="${np.mobileOffset}" min="0" max="200" step="1" title="On phones the row moves down by this much so it clears the 3 buttons at the top centre. PC / Windows: no push-down." />

        </div>`
            : ""
        }

      </div>

    </div>`;
  } else {
  html += `

    <div class="prop-group">

      <div class="prop-group-title">Position</div>

      <div class="prop-group-body">

        <div class="prop-row">

          <label>Linked Position</label>

          <input type="checkbox" id="prop-use-linked-position" ${el.useLinkedPosition ? "checked" : ""} />

        </div>

        <div class="prop-row">

          <label>Position Source</label>

          <select id="prop-linked-position-source" ${el.useLinkedPosition ? "" : "disabled"}>

            <option value="">Select element</option>

            ${linkablePositions.map((candidate) => `<option value="${candidate.id}" ${el.linkedPositionId === candidate.id ? "selected" : ""}>${escHtml(candidate.name)}</option>`).join("")}

          </select>

        </div>

        ${
          linkedPositionSource
            ? `

        <div class="prop-row">

          <label>Current Source</label>

          <input type="text" value="${escHtml(linkedPositionSource.name)}" readonly style="opacity:0.7" />

        </div>`
            : ""
        }

        <div class="prop-row">

          <label>Lock Position</label>

          <input type="checkbox" id="prop-lock-position" ${positionTarget.lockPosition ? "checked" : ""} />

        </div>

        <div class="prop-row">

          <label>Anchor</label>

          ${renderAnchorGrid(positionTarget.anchor_from, "anchor-grid-position")}

        </div>

        <div class="prop-row">

          <label>Offset</label>

          ${renderDualInput("prop-offset-x", positionTarget.offset[0], "prop-offset-y", positionTarget.offset[1], "X", "Y", 'step="0.5"')}

        </div>

      </div>

    </div>`;
  }

  // Display

  html += `

    <div class="prop-group">

      <div class="prop-group-title">Display</div>

      <div class="prop-group-body">

        <div class="prop-row">

          <label>Layer</label>

          <input type="number" id="prop-layer" value="${positionTarget.layer}" step="1" />

        </div>

        <div class="prop-row">

          <label>Alpha</label>

          <input type="range" id="prop-alpha" value="${el.alpha}" min="0" max="1" step="0.05" />

          <span class="range-value" id="prop-alpha-val">${el.alpha.toFixed(2)}</span>

        </div>

      </div>

    </div>`;

  // Actions

  html += `

    <div class="prop-actions">

      <button class="btn" id="btn-duplicate" title="Duplicate this element">Duplicate</button>

      <button class="btn btn-danger" id="btn-delete" title="Delete this element">Delete</button>

    </div>`;

  container.innerHTML = html;

  attachPropertyListeners(el);
}

function attachPropertyListeners(el) {
  const linkedSourcePosition =
    el && el.useLinkedPosition && el.linkedPositionId
      ? App.elements.find(
          (candidate) =>
            candidate.id === el.linkedPositionId && candidate.id !== el.id,
        )
      : null;

  const positionTarget = linkedSourcePosition || el;

  // Name

  bindInput("prop-name", "input", (val) => {
    App.updateElement(el.id, { name: val }, true);
  });

  bindInput("prop-group", "change", (val) => {
    App.updateElement(el.id, { group: val });
  });

  // Image specific

  if (el.type === "image") {
    const btnChange = document.getElementById("btn-change-img");

    if (btnChange) {
      btnChange.addEventListener("click", () => {
        // own one-off input: the shared #image-upload would also add a new Image element
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp,image/gif";
        input.style.display = "none";
        document.body.appendChild(input);

        input.onchange = async function (e) {
          const file = e.target.files[0];
          input.remove();
          if (!file) return;

          const base = file.name.replace(/\.[^.]+$/, "");
          // an animated GIF / WebP becomes an animated image
          const anim = window.KzAnim ? await KzAnim.framesFromFiles([file]).catch(() => null) : null;
          if (anim && anim.frames.length > 1) {
            App.updateElement(el.id, { imageName: base, texturePath: `textures/${App.getNamespace()}/${base}` });
            await KzAnim.setFrames(el.id, anim.frames, anim.fps);
            return;
          }

          const reader = new FileReader();

          reader.onload = async function (event) {
            let data = event.target.result;
            // the pack stores every picture as .png: convert JPEG / WebP / GIF
            if (window.KzAnim && !/^data:image\/png;/.test(data)) data = (await KzAnim.normalizeFrames([data])).frames[0];
            App.updateElement(el.id, {
              imageData: data,

              imageName: base,

              texturePath: `textures/${App.getNamespace()}/${base}`,

              // a new picture replaces the animation
              animFrames: [],
            });
          };

          reader.readAsDataURL(file);
        };

        input.click();
      });
    }

    bindInput("prop-texture", "input", (val) => {
      App.updateElement(el.id, { texturePath: val }, true);
    });

    if (window.KzAnim) KzAnim.bindSection(el);

    // Image resize (width / height) — only change size in JSON, keep original image
    const resizeImageData = (newW, newH) => {
      App.updateElement(el.id, { size: [newW, newH] }, true);
    };

    bindInput("prop-img-size-w", "change", (val) => {
      const newW = Math.max(1, parseInt(val) || 1);
      const currentEl = App.elements.find((e) => e.id === el.id);
      const newH = currentEl ? currentEl.size[1] : el.size[1];
      resizeImageData(newW, newH);
    });

    bindInput("prop-img-size-h", "change", (val) => {
      const newH = Math.max(1, parseInt(val) || 1);
      const currentEl = App.elements.find((e) => e.id === el.id);
      const newW = currentEl ? currentEl.size[0] : el.size[0];
      resizeImageData(newW, newH);
    });

    // Hex color picker handlers for image element
    const imgColorPicker = document.getElementById("prop-img-color-picker");
    const imgColorHex = document.getElementById("prop-img-color-hex");
    
    function applyImageColor(hex) {
      const rgb = hexToRgb(hex);
      App.updateElement(el.id, { color: rgb }, true);
      if (imgColorPicker) imgColorPicker.value = hex.toUpperCase();
      if (imgColorHex) imgColorHex.value = hex.toUpperCase();
    }
    
    if (imgColorPicker) {
      imgColorPicker.addEventListener("input", (e) => applyImageColor(e.target.value));
    }
    
    if (imgColorHex) {
      imgColorHex.addEventListener("change", (e) => {
        let hex = e.target.value.trim();
        if (!hex.startsWith("#")) hex = "#" + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) applyImageColor(hex);
      });
    }
  }

  // Text specific

  if (el.type === "text") {
    bindInput("prop-collection-index", "input", (val) => {
      App.updateElement(el.id, { collection_index: parseInt(val) || 0 }, true);
    });

    bindInput("prop-papi-placeholder", "input", (val) => {
      App.updateElement(el.id, { papi_placeholder: val }, true);
      refreshPadInput(el.id);
    });

    attachPadListeners(el);

    bindInput("prop-font-size", "change", (val) => {
      // Save current text_offset to text_offsets[oldSize], then load text_offsets[newSize]
      const oldSize = el.font_size || 'small';
      const offsets = getTextOffsets(el);
      offsets[oldSize] = el.text_offset ? [...el.text_offset] : (offsets[oldSize] || [0, 0]);
      const newOffset = offsets[val] || [0, 0];
      App.updateElement(el.id, { font_size: val, text_offsets: offsets, text_offset: [...newOffset] }, true);
      // Update Text Offset input values to match the new size
      const ox = document.getElementById("prop-text-offset-x");
      const oy = document.getElementById("prop-text-offset-y");
      if (ox) ox.value = newOffset[0];
      if (oy) oy.value = newOffset[1];
    });

    // Hex color picker handlers for text element
    const textColorPicker = document.getElementById("prop-color-picker");
    const textColorHex = document.getElementById("prop-color-hex");
    
    function applyTextColor(hex) {
      const rgb = hexToRgb(hex);
      App.updateElement(el.id, { color: rgb }, true);
      if (textColorPicker) textColorPicker.value = hex.toUpperCase();
      if (textColorHex) textColorHex.value = hex.toUpperCase();
    }
    
    if (textColorPicker) {
      textColorPicker.addEventListener("input", (e) => applyTextColor(e.target.value));
    }
    
    if (textColorHex) {
      textColorHex.addEventListener("change", (e) => {
        let hex = e.target.value.trim();
        if (!hex.startsWith("#")) hex = "#" + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) applyTextColor(hex);
      });
    }

    bindInput("prop-shadow", "change", (val, inputEl) => {
      App.updateElement(el.id, { shadow: inputEl.checked }, true);
    });

    // Text alignment dropdown

    bindInput("prop-text-align", "change", (val) => {
      const alignMap = { left: "top_left", center: "center", right: "top_right" };
      const anchor = alignMap[val] || "top_left";

      // Default text_offset for each alignment per font size
      const sizeAlignDefaults = {
        small:  { left: [0, -2.8], center: [0, 0.9], right: [0, -2.8] },
        normal: { left: [0, -4.1],    center: [0, 1.4],   right: [0, -4.1] },
        large:  { left: [0, -5.3], center: [0, 2],   right: [0, -5.3] }
      };
      const curSize = el.font_size || 'small';
      const newOffset = (sizeAlignDefaults[curSize] || sizeAlignDefaults.small)[val] || [0, 0];
      const offsets = getTextOffsets(el);
      offsets[curSize] = [...newOffset];

      App.updateElement(
        el.id,
        {
          text_anchor_from: anchor,
          text_anchor_to: anchor,
          text_offset: [...newOffset],
          text_offsets: offsets
        },
        true,
      );
    });

    // Text offset for fine-tuning text position within panel (per-font-size)
    bindInput("prop-text-offset-x", "input", (val) => {
      const offsetX = parseFloat(val) || 0;
      const currentOffset = el.text_offset || [0, 0];
      const newOffset = [offsetX, currentOffset[1]];
      const offsets = getTextOffsets(el);
      offsets[el.font_size || 'small'] = [...newOffset];
      App.updateElement(el.id, { text_offset: newOffset, text_offsets: offsets }, true);
    });

    bindInput("prop-text-offset-y", "input", (val) => {
      const offsetY = parseFloat(val) || 0;
      const currentOffset = el.text_offset || [0, 0];
      const newOffset = [currentOffset[0], offsetY];
      const offsets = getTextOffsets(el);
      offsets[el.font_size || 'small'] = [...newOffset];
      App.updateElement(el.id, { text_offset: newOffset, text_offsets: offsets }, true);
    });
  }

  // Nameplate specific (same properties as text)

  if (el.type === "nameplate") {
    bindInput("prop-collection-index", "input", (val) => {
      App.updateElement(el.id, { collection_index: parseInt(val) || 0 }, true);
    });

    bindInput("prop-papi-placeholder", "input", (val) => {
      App.updateElement(el.id, { papi_placeholder: val }, true);
      refreshPadInput(el.id);
    });

    attachPadListeners(el);

    bindInput("prop-font-size", "change", (val) => {
      App.updateElement(el.id, { font_size: val }, true);
    });

    // Hex color picker handlers for nameplate element
    const nameplateColorPicker = document.getElementById("prop-color-picker");
    const nameplateColorHex = document.getElementById("prop-color-hex");
    
    function applyNameplateColor(hex) {
      const rgb = hexToRgb(hex);
      App.updateElement(el.id, { color: rgb }, true);
      if (nameplateColorPicker) nameplateColorPicker.value = hex.toUpperCase();
      if (nameplateColorHex) nameplateColorHex.value = hex.toUpperCase();
    }
    
    if (nameplateColorPicker) {
      nameplateColorPicker.addEventListener("input", (e) => applyNameplateColor(e.target.value));
    }
    
    if (nameplateColorHex) {
      nameplateColorHex.addEventListener("change", (e) => {
        let hex = e.target.value.trim();
        if (!hex.startsWith("#")) hex = "#" + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) applyNameplateColor(hex);
      });
    }

    bindInput("prop-shadow", "change", (val, inputEl) => {
      App.updateElement(el.id, { shadow: inputEl.checked }, true);
    });

    // Text alignment dropdown for nameplate

    bindInput("prop-text-align", "change", (val) => {
      const alignMap = { left: "top_left", center: "center", right: "top_right" };
      const anchor = alignMap[val] || "top_left";

      // Text anchor only affects text alignment within the panel, not panel position
      // Do NOT recalculate offset - keep it unchanged
      App.updateElement(
        el.id,
        { 
          text_anchor_from: anchor, 
          text_anchor_to: anchor,
          // offset stays the same - do not include it in the update
        },
        true,
      );
    });
  }

  // XP Label specific

  if (el.type === "xp_label") {
    bindInput("prop-xp-font-size", "change", (val) => {
      App.updateElement(el.id, { xp_font_size: val }, true);
    });

    // Hex color picker handlers for xp_label element
    const xpColorPicker = document.getElementById("prop-xp-color-picker");
    const xpColorHex = document.getElementById("prop-xp-color-hex");
    
    function applyXpColor(hex) {
      const rgb = hexToRgb(hex);
      App.updateElement(el.id, { xp_color: rgb }, true);
      if (xpColorPicker) xpColorPicker.value = hex.toUpperCase();
      if (xpColorHex) xpColorHex.value = hex.toUpperCase();
    }
    
    if (xpColorPicker) {
      xpColorPicker.addEventListener("input", (e) => applyXpColor(e.target.value));
    }
    
    if (xpColorHex) {
      xpColorHex.addEventListener("change", (e) => {
        let hex = e.target.value.trim();
        if (!hex.startsWith("#")) hex = "#" + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) applyXpColor(hex);
      });
    }

    bindInput("prop-xp-shadow", "change", (val, inputEl) => {
      App.updateElement(el.id, { xp_shadow: inputEl.checked }, true);
    });
  }

  // Bossbar Text specific

  if (el.type === "bossbar_text") {
    bindInput("prop-bossbar-prefix", "input", (val) => {
      App.updateElement(el.id, { bossbar_prefix: val }, true);
    });

    bindInput("prop-bossbar-font-size", "change", (val) => {
      App.updateElement(el.id, { bossbar_font_size: val }, true);
    });

    bindInput("prop-bossbar-color-r", "input", (val) => {
      const c = [...(el.bossbar_color || [1, 1, 1])];
      c[0] = parseFloat(val) || 0;

      App.updateElement(el.id, { bossbar_color: c }, true);

      syncColorSwatch("prop-bossbar-color", c);
    });

    bindInput("prop-bossbar-color-g", "input", (val) => {
      const c = [...(el.bossbar_color || [1, 1, 1])];
      c[1] = parseFloat(val) || 0;

      App.updateElement(el.id, { bossbar_color: c }, true);

      syncColorSwatch("prop-bossbar-color", c);
    });

    bindInput("prop-bossbar-color-b", "input", (val) => {
      const c = [...(el.bossbar_color || [1, 1, 1])];
      c[2] = parseFloat(val) || 0;

      App.updateElement(el.id, { bossbar_color: c }, true);

      syncColorSwatch("prop-bossbar-color", c);
    });

    bindInput("prop-bossbar-shadow", "change", (val, inputEl) => {
      App.updateElement(el.id, { bossbar_shadow: inputEl.checked }, true);
    });
  }

  // Bar specific

  if (el.type === "bar") {
    const BAR_TYPES = getBarTypeOptions(el);

    bindInput("prop-bar-type", "change", (val) => {
      let tag;
      if (val === "custom") {
        // Auto-generate unique tag when switching to custom
        tag = el.barCustomTag || App.generateUniqueBarTag();
      } else {
        tag = getBarTypeMeta(val, "").tag;
      }

      const texPath = getDefaultBarTexturePath(val, tag);

      App.updateElement(
        el.id,
        { barType: val, barTexturePath: texPath, barCustomTag: tag },
        false,
      );
    });

    // Tag Prefix validation - max 2 chars and duplicate check

    const barTagInput = document.getElementById("prop-bar-custom-tag");

    if (barTagInput) {
      // Store used bar tags to check for duplicates

      const usedBarTags = new Set();

      // Get all bar elements and their tags

      App.elements
        .filter((e) => e.type === "bar")
        .forEach((b) => {
          const tag =
            b.barCustomTag ||
            getBarTypeMeta(b.barType, b.barCustomTag || "").tag;

          if (tag && b.id !== el.id) {
            usedBarTags.add(tag.toUpperCase());
          }
        });

      barTagInput.addEventListener("input", function (e) {
        let value = this.value.toUpperCase().trim();

        // Enforce max 2 characters

        if (value.length > 2) {
          value = value.substring(0, 2);

          this.value = value;
        } else if (this.value !== value) {
          this.value = value;
        }

        // Show error if more than 2 chars attempted

        const errorDiv = document.getElementById("prop-bar-tag-error");

        if (e.target.value.length > 2) {
          if (errorDiv) {
            errorDiv.textContent = "⚠️ Max 2 characters allowed";

            errorDiv.style.display = "block";
          }

          this.style.borderColor = "#ef4444";
        } else if (usedBarTags.has(value) && value.length > 0) {
          // Check for duplicates

          if (errorDiv) {
            errorDiv.textContent =
              "⚠️ This tag is already used by another bar!";

            errorDiv.style.display = "block";
          }

          this.style.borderColor = "#ef4444";
        } else {
          if (errorDiv) errorDiv.style.display = "none";

          this.style.borderColor = "";

          // Trigger the original update

          const texPath = getDefaultBarTexturePath("custom", value || "custom");

          App.updateElement(
            el.id,
            { barCustomTag: value, barTexturePath: texPath },
            true,
          );

          const tpInput = document.getElementById("prop-bar-texture-path");

          if (tpInput) tpInput.value = texPath;
        }
      });

      // Prevent non-alphanumeric

      barTagInput.addEventListener("keypress", function (e) {
        const char = String.fromCharCode(e.which);

        if (!/[a-zA-Z0-9]/.test(char)) {
          e.preventDefault();
        }
      });
    }

    bindInput("prop-bar-custom-papi", "input", (val) => {
      App.updateElement(el.id, { barCustomPapi: val }, true);
    });

    bindInput("prop-bar-custom-max", "input", (val) => {
      App.updateElement(el.id, { barCustomMax: val }, true);
    });

    bindInput("prop-bar-texture-path", "input", (val) => {
      App.updateElement(el.id, { barTexturePath: val }, true);
    });

    bindInput("prop-bar-max-w", "input", (val) => {
      const s = [...el.barMaxSize];
      s[0] = parseFloat(val) || 1;
      App.updateElement(el.id, { barMaxSize: s, size: s }, true);
    });

    bindInput("prop-bar-max-h", "input", (val) => {
      const s = [...el.barMaxSize];
      s[1] = parseFloat(val) || 1;

      App.updateElement(el.id, { barMaxSize: s, size: s }, true);
    });

    bindInput("prop-bar-min-w", "input", (val) => {
      const s = [...el.barMinSize];
      s[0] = parseFloat(val) || 1;

      App.updateElement(el.id, { barMinSize: s }, true);
    });

    bindInput("prop-bar-min-h", "input", (val) => {
      const s = [...el.barMinSize];
      s[1] = parseFloat(val) || 1;

      App.updateElement(el.id, { barMinSize: s }, true);
    });

    bindInput("prop-bar-preview-step", "input", (val) => {
      const step = parseInt(val) || 1;

      App.updateElement(el.id, { previewStep: step }, true);

      const stepVal = document.getElementById("prop-bar-step-val");

      if (stepVal) stepVal.textContent = step + "/16";

      const previewImg = document.getElementById("bar-preview-img");

      if (previewImg && el.slicedImages[step - 1])
        previewImg.src = el.slicedImages[step - 1];
    });

    // Bar Color: sync <input type="color"> <-> hex text, update tint overlay
    const barColorPicker = document.getElementById("prop-bar-color-picker");

    const barColorHex = document.getElementById("prop-bar-color-hex");

    function applyBarColor(hex) {
      const overlay = document.getElementById("bar-color-overlay");

      if (overlay) overlay.style.background = hex;

      App.updateElement(el.id, { barColor: hex }, true);
    }

    if (barColorPicker) {
      barColorPicker.addEventListener("input", (e) => {
        const hex = e.target.value.toUpperCase();

        if (barColorHex) barColorHex.value = hex;

        applyBarColor(hex);
      });
    }

    if (barColorHex) {
      barColorHex.addEventListener("input", (e) => {
        let hex = e.target.value.trim().toUpperCase();

        if (!hex.startsWith("#")) hex = "#" + hex;

        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          if (barColorPicker) barColorPicker.value = hex;

          applyBarColor(hex);
        }
      });

      barColorHex.addEventListener("blur", (e) => {
        let hex = e.target.value.trim().toUpperCase();

        if (!hex.startsWith("#")) hex = "#" + hex;

        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          hex =
            el.barColor && /^#[0-9A-Fa-f]{6}$/i.test(el.barColor)
              ? el.barColor.toUpperCase()
              : "#FFFFFF";

          e.target.value = hex;

          if (barColorPicker) barColorPicker.value = hex;
        }
      });
    }

    bindInput("prop-bar-slice-direction", "change", async (val) => {
      if (el.imageData) {
        const jobToken = startBarTextureJob(el.id);

        App.showToast(
          "Re-slicing bar texture for " + val + " direction...",
          "success",
        );

        try {
          const result = await sliceBarTexture(el.imageData, val);

          if (!isLatestBarTextureJob(el.id, jobToken)) return;

          App.updateElement(
            el.id,
            { sliceDirection: val, slicedImages: result.slices },
            true,
          );
        } catch (error) {
          if (!isLatestBarTextureJob(el.id, jobToken)) return;

          console.error("Failed to re-slice bar texture:", error);

          App.showToast("Failed to re-slice bar texture", "error");
        }
      } else {
        App.updateElement(el.id, { sliceDirection: val }, true);
      }
    });

    const btnReupload = document.getElementById("btn-bar-reupload");

    if (btnReupload) {
      btnReupload.addEventListener("click", () => {
        const input = document.createElement("input");

        input.type = "file";

        input.accept = "image/png,image/jpeg,image/webp";

        input.style.display = "none";

        document.body.appendChild(input);

        input.onchange = async (e) => {
          const file = e.target.files[0];

          if (!file) {
            input.remove();
            return;
          }

          const reader = new FileReader();

          reader.onload = async (event) => {
            const jobToken = startBarTextureJob(el.id);

            try {
              App.showToast("Slicing bar texture...", "success");

              const result = await sliceBarTexture(
                event.target.result,
                el.sliceDirection || "left",
              );

              if (!isLatestBarTextureJob(el.id, jobToken)) return;

              App.updateElement(el.id, {
                imageData: event.target.result,

                slicedImages: result.slices,

                barMaxSize: [result.width, result.height],

                size: [result.width, result.height],
              });
            } catch (error) {
              if (!isLatestBarTextureJob(el.id, jobToken)) return;

              console.error("Failed to re-upload bar texture:", error);

              App.showToast("Failed to load bar texture", "error");
            } finally {
              input.remove();
            }
          };

          reader.onerror = () => {
            console.error("Failed to read re-uploaded bar texture file");

            App.showToast("Failed to read bar texture file", "error");

            input.remove();
          };

          reader.readAsDataURL(file);

          e.target.value = "";
        };

        input.click();
      });
    }
  }

  // Player Head specific

  if (el.type === "player_head") {
    bindInput("prop-doll-size-w", "input", (val) => {
      const s = el.doll_size ? [...el.doll_size] : [75, 205];
      s[0] = parseFloat(val) || 1;

      App.updateElement(el.id, { doll_size: s }, true);
    });

    bindInput("prop-doll-size-h", "input", (val) => {
      const s = el.doll_size ? [...el.doll_size] : [75, 205];
      s[1] = parseFloat(val) || 1;

      App.updateElement(el.id, { doll_size: s }, true);
    });

    bindInput("prop-doll-offset-x", "input", (val) => {
      const off = el.doll_offset ? [...el.doll_offset] : [1, 18];
      off[0] = parseFloat(val) || 0;

      App.updateElement(el.id, { doll_offset: off }, true);
    });

    bindInput("prop-doll-offset-y", "input", (val) => {
      const off = el.doll_offset ? [...el.doll_offset] : [1, 18];
      off[1] = parseFloat(val) || 0;

      App.updateElement(el.id, { doll_offset: off }, true);
    });

    bindInput("prop-head-zoom", "input", (val) => {
      const z = Math.max(0.3, Math.min(3.0, parseFloat(val) || 1.0));

      const numEl = document.getElementById("prop-head-zoom-num");

      if (numEl) numEl.value = z.toFixed(2);

      App.updateElement(el.id, { head_zoom: z }, true);
    });

    bindInput("prop-head-zoom-num", "input", (val) => {
      const z = Math.max(0.3, Math.min(3.0, parseFloat(val) || 1.0));

      const rangeEl = document.getElementById("prop-head-zoom");

      if (rangeEl) rangeEl.value = z;

      App.updateElement(el.id, { head_zoom: z }, true);
    });
  }

  // Visibility Conditions (works for ALL element types)

  bindInput("prop-visibility-papi", "input", (val) => {
    App.updateElement(el.id, { visibilityPapi: val }, true);
  });

  bindInput("prop-visibility-operator", "change", (val) => {
    App.updateElement(el.id, { visibilityOperator: val }, true);
  });

  bindInput("prop-visibility-value", "input", (val) => {
    App.updateElement(el.id, { visibilityValue: val }, true);
  });

  bindInput("prop-visibility-invert", "change", (val, inputEl) => {
    App.updateElement(el.id, { visibilityInvert: inputEl.checked }, true);
  });

  attachVisibilityExtraListeners(el);

  // Position Anchor Grid

  const posAnchorGrid = document.getElementById("anchor-grid-position");

  if (posAnchorGrid) {
    posAnchorGrid.querySelectorAll(".anchor-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        const anchor = cell.dataset.anchor;

        posAnchorGrid
          .querySelectorAll(".anchor-cell")
          .forEach((c) => c.classList.remove("active"));

        cell.classList.add("active");

        const newOffset = calculateOffsetForAnchorChange(
          positionTarget.anchor_from || "top_left",
          anchor,
          positionTarget.offset || [0, 0],
          App.BEDROCK_WIDTH,
          App.BEDROCK_HEIGHT,
        );

        App.updateElement(
          positionTarget.id,
          { anchor_from: anchor, anchor_to: anchor, offset: newOffset },
          true,
        );
      });
    });
  }

  bindInput("prop-use-linked-position", "change", (val, inputEl) => {
    const availablePositions = getLinkablePositionOptions(el);

    const fallbackLinkedId =
      availablePositions.length > 0 ? availablePositions[0].id : null;

    const nextLinkedId = inputEl.checked
      ? el.linkedPositionId || fallbackLinkedId
      : null;

    App.updateElement(
      el.id,
      {
        useLinkedPosition: inputEl.checked,

        linkedPositionId: nextLinkedId,
      },
      false,
    );
  });

  bindInput("prop-linked-position-source", "change", (val) => {
    App.updateElement(
      el.id,
      {
        linkedPositionId: val ? parseInt(val, 10) : null,

        useLinkedPosition: !!val,
      },
      false,
    );
  });

  // Offset

  const updateOffsetAxis = (axis, rawVal) => {
    if (positionTarget.lockPosition) return;

    const numericVal = parseFloat(rawVal);

    const off = [...positionTarget.offset];

    off[axis] = Number.isFinite(numericVal) ? numericVal : 0;

    App.updateElement(positionTarget.id, { offset: off }, true);

    requestAnimationFrame(() => {
      renderPreview();

      updatePreviewInfo();
    });
  };

  bindInput("prop-offset-x", "input", (val) => {
    updateOffsetAxis(0, val);
  });

  bindInput("prop-offset-x", "change", (val) => {
    updateOffsetAxis(0, val);
  });

  bindInput("prop-offset-y", "input", (val) => {
    updateOffsetAxis(1, val);
  });

  bindInput("prop-offset-y", "change", (val) => {
    updateOffsetAxis(1, val);
  });

  // Nameplate position: a project setting shared by every nameplate
  bindInput("prop-np-position", "change", (val) => {
    if (!NAMEPLATE_POSITIONS.includes(val)) return;
    App.nameplatePosition = val;
    if (window.KZDoc) KZDoc.markDirty();
    renderPreview();
    renderProperties();
  });

  bindInput("prop-np-mobile-offset", "change", (val) => {
    const n = parseFloat(val);
    App.nameplateMobileOffset = Number.isFinite(n) && n >= 0 ? n : DEFAULT_NAMEPLATE_MOBILE_OFFSET;
    if (window.KZDoc) KZDoc.markDirty();
    renderPreview();
  });

  bindInput("prop-lock-position", "change", (val, inputEl) => {
    App.updateElement(
      positionTarget.id,
      { lockPosition: inputEl.checked },
      true,
    );
  });

  // // Size

  // bindInput('prop-size-w', 'input', async (val) => {
  //   const newW = parseFloat(val) || 1;
  //   const s = [...el.size]; s[0] = newW;

  //   // For toolbar bars, resize and re-slice the image
  //   if (el.type === 'bar' && el.barType === 'custom' && el.imageData) {
  //     const newH = s[1];
  //     const barMaxSize = [...(el.barMaxSize || s)]; barMaxSize[0] = newW;

  //     try {
  //       const result = await resizeAndSliceBarTexture(el.imageData, newW, newH, el.sliceDirection || 'left');
  //       App.updateElement(el.id, {
  //         size: s,
  //         barMaxSize: barMaxSize,
  //         slicedImages: result.slices,
  //         barMinSize: [Math.round(newW / 16), newH]
  //       }, true);
  //     } catch (error) {
  //       console.error('Failed to resize bar texture:', error);
  //       App.updateElement(el.id, { size: s, barMaxSize: barMaxSize }, true);
  //     }
  //   } else if (el.type === 'bar') {
  //     const barMaxSize = [...(el.barMaxSize || s)]; barMaxSize[0] = newW;
  //     App.updateElement(el.id, { size: s, barMaxSize: barMaxSize }, true);
  //   } else {
  //     App.updateElement(el.id, { size: s }, true);
  //   }
  // });

  // bindInput('prop-size-h', 'input', async (val) => {
  //   const newH = parseFloat(val) || 1;
  //   const s = [...el.size]; s[1] = newH;

  //   // For toolbar bars, resize and re-slice the image
  //   if (el.type === 'bar' && el.barType === 'custom' && el.imageData) {
  //     const newW = s[0];
  //     const barMaxSize = [...(el.barMaxSize || s)]; barMaxSize[1] = newH;

  //     try {
  //       const result = await resizeAndSliceBarTexture(el.imageData, newW, newH, el.sliceDirection || 'left');
  //       App.updateElement(el.id, {
  //         size: s,
  //         barMaxSize: barMaxSize,
  //         slicedImages: result.slices,
  //         barMinSize: [Math.round(newW / 16), newH]
  //       }, true);
  //     } catch (error) {
  //       console.error('Failed to resize bar texture:', error);
  //       App.updateElement(el.id, { size: s, barMaxSize: barMaxSize }, true);
  //     }
  //   } else if (el.type === 'bar') {
  //     const barMaxSize = [...(el.barMaxSize || s)]; barMaxSize[1] = newH;
  //     App.updateElement(el.id, { size: s, barMaxSize: barMaxSize }, true);
  //   } else {
  //     App.updateElement(el.id, { size: s }, true);
  //   }
  // });

  // Layer

  bindInput("prop-layer", "input", (val) => {
    App.updateElement(positionTarget.id, { layer: parseInt(val) || 0 }, true);
  });

  // Alpha

  bindInput("prop-alpha", "input", (val) => {
    App.updateElement(el.id, { alpha: parseFloat(val) }, true);

    const alphaVal = document.getElementById("prop-alpha-val");

    if (alphaVal) alphaVal.textContent = parseFloat(val).toFixed(2);
  });

  // Duplicate

  const btnDuplicate = document.getElementById("btn-duplicate");

  if (btnDuplicate) {
    btnDuplicate.addEventListener("click", () => App.duplicateSelected());
  }

  // Delete

  const btnDelete = document.getElementById("btn-delete");

  if (btnDelete) {
    btnDelete.addEventListener("click", () => App.removeElement(el.id));
  }

  // Collapsible sections

  document
    .querySelectorAll("#properties-content .prop-group-title")
    .forEach((title) => {
      title.addEventListener("click", () => {
        title.closest(".prop-group").classList.toggle("collapsed");
      });
    });
}

function bindInput(id, event, callback) {
  const input = document.getElementById(id);

  if (!input) return;

  input.addEventListener(event, (e) => {
    callback(e.target.value, e.target);
  });
}

// Total bossbar title length next to Pad Length (see bossbarTitleBudget in export.js)
function padBudgetText() {
  if (typeof window.bossbarTitleBudget !== "function") return { text: "", over: false };
  const b = window.bossbarTitleBudget(App.elements);
  return { text: `Bossbar ${b.total} / ${b.limit}`, over: b.over, title: `prefix 25 + bars ${b.bars} + slots ${b.pads}` };
}

/* Pad length of a bossbar text / nameplate: "Auto" sizes it from the placeholders
   (app.js autoPadLength, same rule as the export); unticking it lets the user type a value. */
function renderPadInput(el) {
  const auto = el.pad_auto !== false;
  const value = auto ? autoPadLength(el.papi_placeholder) : parseInt(el.pad_length) || 30;
  return `<label style="display:inline-flex;align-items:center;gap:3px;margin-right:6px;font-size:11px;white-space:nowrap" title="Auto: room for the longest value of the placeholders (e.g. health 4 digits, coordinates 9 each)"><input type="checkbox" id="prop-pad-auto" ${auto ? "checked" : ""} /> Auto</label>
            <input type="number" id="prop-pad-length" value="${value}" min="1" max="200" step="1" ${auto ? "disabled" : ""} title="Bytes this text takes in the bossbar; longer values are cut" style="width:64px" />`;
}

function refreshPadInput(elId) {
  const el = App.elements.find((e) => e.id === elId);
  const input = document.getElementById("prop-pad-length");
  if (el && input && el.pad_auto !== false) input.value = autoPadLength(el.papi_placeholder);
  updatePadBudget();
}

function attachPadListeners(el) {
  bindInput("prop-pad-auto", "change", (val, inputEl) => {
    const cur = App.elements.find((e) => e.id === el.id) || el;
    const patch = inputEl.checked
      ? { pad_auto: true }
      : { pad_auto: false, pad_length: autoPadLength(cur.papi_placeholder) };
    App.updateElement(el.id, patch, true);
    const input = document.getElementById("prop-pad-length");
    if (input) {
      input.disabled = inputEl.checked;
      input.value = inputEl.checked ? autoPadLength(cur.papi_placeholder) : patch.pad_length;
    }
    updatePadBudget();
  });
  bindInput("prop-pad-length", "input", (val) => {
    App.updateElement(el.id, { pad_auto: false, pad_length: parseInt(val) || 30 }, true);
    updatePadBudget();
  });
}

function renderPadBudget() {
  const b = padBudgetText();
  return `<span id="prop-pad-budget" title="${escHtml(b.title || "")}" style="margin-left:6px;font-size:11px;white-space:nowrap;color:${b.over ? "#ff5c5c" : "#8a8a8a"}">${escHtml(b.text)}</span>`;
}

function updatePadBudget() {
  const span = document.getElementById("prop-pad-budget");
  if (!span) return;
  const b = padBudgetText();
  span.textContent = b.text;
  span.title = b.title || "";
  span.style.color = b.over ? "#ff5c5c" : "#8a8a8a";
}

function escHtml(str) {
  const div = document.createElement("div");

  div.textContent = str;

  return div.innerHTML;
}

function renderMultiProperties(container) {
  const selected = App.getAllSelected();

  let html = `



  <div class="multi-select-header">



    <strong>${selected.length}</strong> items selected



  </div>







        <div class="prop-group">



            <div class="prop-group-title">Alignment</div>



            <div class="align-toolbar">



                <div class="align-btn" id="btn-align-left" title="Align Left">



                    <svg viewBox="0 0 24 24"><path d="M4 22H2V2h2v20zM22 7H6v3h16V7zm-6 7H6v3h10v-3z"/></svg>



                    <span>Left</span>



                </div>



                <div class="align-btn" id="btn-align-centerX" title="Align Center X">



                    <svg viewBox="0 0 24 24"><path d="M11 2v20h2V2h-2zm10 5H3v3h18V7zm-4 7H7v3h10v-3z"/></svg>



                    <span>Center</span>



                </div>



                <div class="align-btn" id="btn-align-right" title="Align Right">



                    <svg viewBox="0 0 24 24"><path d="M20 2h2v20h-2V2zM2 7h16v3H2V7zm6 7h10v3H8v-3z"/></svg>



                    <span>Right</span>



                </div>



                <div class="align-btn" id="btn-align-top" title="Align Top">



                    <svg viewBox="0 0 24 24"><path d="M22 4v2H2V4h20zM7 22V6h3v16H7zm7-6V6h3v10h-3z"/></svg>



                    <span>Top</span>



                </div>



                <div class="align-btn" id="btn-align-centerY" title="Align Center Y">



                    <svg viewBox="0 0 24 24"><path d="M22 11v2H2v-2h20zM7 2v18h3V2H7zm7 4v10h3V6h-3z"/></svg>



                    <span>Middle</span>



                </div>



                <div class="align-btn" id="btn-align-bottom" title="Align Bottom">



                    <svg viewBox="0 0 24 24"><path d="M2 20v2h20v-2H2zM7 2v16h3V2H7zm7 6v10h3V8h-3z"/></svg>



                    <span>Bottom</span>



                </div>



            </div>



        </div>



        <div class="prop-group">



            <div class="prop-group-title">Distribute</div>



            <div class="align-toolbar">



                <div class="align-btn" id="btn-distribute-horizontal" title="Distribute Horizontal Spacing">



                    <svg viewBox="0 0 24 24"><path d="M4 22V2H2v20h2zM22 2v20h2V2h-2zM13 7h-2v10h2V7zM9 7H7v10h2V7zm8 0h-2v10h2V7z"/></svg>



                    <span>H-Space</span>



                </div>



                <div class="align-btn" id="btn-distribute-vertical" title="Distribute Vertical Spacing">



                    <svg viewBox="0 0 24 24"><path d="M2 4h20V2H2v2zm0 18h20v-2H2v2zM7 13v-2h10v2H7zm0-4V7h10v2H7zm0 8v-2h10v2H7z"/></svg>



                    <span>V-Space</span>



                </div>



            </div>



        </div>







        <div class="prop-actions">



            <button class="btn" id="btn-multi-duplicate" title="Duplicate selected elements">Duplicate All</button>



            <button class="btn btn-danger" id="btn-multi-delete" title="Delete selected elements">Delete All</button>



        </div>



`;

  container.innerHTML = html;

  attachMultiPropertyListeners(selected);
}

function attachMultiPropertyListeners(selected) {
  const updateAllOffsets = (axis, valueFn) => {
    selected.forEach((el) => {
      const off = [...el.offset];

      off[axis] = valueFn(el);

      App.updateElement(el.id, { offset: off });
    });
  };

  // Align Left: All X offsets to minimum X

  document.getElementById("btn-align-left").addEventListener("click", () => {
    const minX = Math.min(...selected.map((el) => el.offset[0]));

    updateAllOffsets(0, () => minX);
  });

  // Align Center X: All X offsets to average X

  document.getElementById("btn-align-centerX").addEventListener("click", () => {
    const avgX =
      selected.reduce((sum, el) => sum + el.offset[0], 0) / selected.length;

    const rounded = Math.round(avgX * 10) / 10;

    updateAllOffsets(0, () => rounded);
  });

  // Align Right: All X offsets to maximum X

  document.getElementById("btn-align-right").addEventListener("click", () => {
    const maxX = Math.max(...selected.map((el) => el.offset[0]));

    updateAllOffsets(0, () => maxX);
  });

  // Align Top: All Y offsets to minimum Y

  document.getElementById("btn-align-top").addEventListener("click", () => {
    const minY = Math.min(...selected.map((el) => el.offset[1]));

    updateAllOffsets(1, () => minY);
  });

  // Align Center Y: All Y offsets to average Y

  document.getElementById("btn-align-centerY").addEventListener("click", () => {
    const avgY =
      selected.reduce((sum, el) => sum + el.offset[1], 0) / selected.length;

    const rounded = Math.round(avgY * 10) / 10;

    updateAllOffsets(1, () => rounded);
  });

  // Align Bottom: All Y offsets to maximum Y

  document.getElementById("btn-align-bottom").addEventListener("click", () => {
    const maxY = Math.max(...selected.map((el) => el.offset[1]));

    updateAllOffsets(1, () => maxY);
  });

  // Distribute Horizontal: Equal spacing between elements (X axis)

  document
    .getElementById("btn-distribute-horizontal")
    .addEventListener("click", () => {
      if (selected.length < 3) return; // Need at least 3 elements

      const sorted = [...selected].sort((a, b) => a.offset[0] - b.offset[0]);

      const minX = sorted[0].offset[0];

      const maxX = sorted[sorted.length - 1].offset[0];

      const totalSpace = maxX - minX;

      const spacing = totalSpace / (sorted.length - 1);

      sorted.forEach((el, idx) => {
        const newX = minX + spacing * idx;

        App.updateElement(el.id, {
          offset: [Math.round(newX * 10) / 10, el.offset[1]],
        });
      });
    });

  // Distribute Vertical: Equal spacing between elements (Y axis)

  document
    .getElementById("btn-distribute-vertical")
    .addEventListener("click", () => {
      if (selected.length < 3) return; // Need at least 3 elements

      const sorted = [...selected].sort((a, b) => a.offset[1] - b.offset[1]);

      const minY = sorted[0].offset[1];

      const maxY = sorted[sorted.length - 1].offset[1];

      const totalSpace = maxY - minY;

      const spacing = totalSpace / (sorted.length - 1);

      sorted.forEach((el, idx) => {
        const newY = minY + spacing * idx;

        App.updateElement(el.id, {
          offset: [el.offset[0], Math.round(newY * 10) / 10],
        });
      });
    });

  // Multi Actions

  document
    .getElementById("btn-multi-duplicate")
    .addEventListener("click", () => {
      App.duplicateSelected();
    });

  document.getElementById("btn-multi-delete").addEventListener("click", () => {
    App.removeSelected();
  });
}
