/* ========================================
   Hotbar textures (Widgets)

   Two Java resource-pack layouts are accepted:
     • Legacy (≤ 1.20.1): textures/gui/widgets.png (one sheet)
         hotbar 182×22 at (0,0), selection 24×24 at (0,22)
     • Modern (1.20.2+): textures/gui/sprites/hud/hotbar.png (182×22)
                         + textures/gui/sprites/hud/hotbar_selection.png (24×23/24)

   Either way the result is stored as ONE sheet in the legacy layout at 1×
   (widgetsImageData). The exporter slices that sheet into Bedrock's
   textures/ui/hotbar_0..8 and selected_hotbar_slot, and saved projects
   keep working unchanged.
   ======================================== */

let widgetsImageData = null;
let hotbarSprites = null; // { bar, selection } data URLs used by the canvas preview

const SHEET = 256;
const BAR = { x: 0, y: 0, w: 182, h: 22 };
const SEL = { x: 0, y: 22, w: 24, h: 24 };

// Modern-format files waiting to be combined
const modern = { hotbar: null, selection: null };

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not read the image'));
        img.src = src;
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Could not read the file'));
        r.readAsDataURL(file);
    });
}

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { c, ctx };
}

function toast(msg, type) {
    if (typeof App !== 'undefined' && typeof App.showToast === 'function') App.showToast(msg, type || 'success');
}

/** Legacy widgets.png (any integer scale) → 256×256 sheet at 1× */
async function normalizeLegacySheet(dataUrl) {
    const img = await loadImage(dataUrl);
    const scale = img.width / SHEET;
    if (scale < 1 || Math.abs(img.height / img.width - 1) > 0.01) {
        throw new Error(`widgets.png should be square and at least 256×256 (got ${img.width}×${img.height})`);
    }
    if (scale === 1) return { sheet: dataUrl, scale };
    const { c, ctx } = makeCanvas(SHEET, SHEET);
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, SHEET, SHEET);
    return { sheet: c.toDataURL('image/png'), scale };
}

/** Modern hotbar.png + hotbar_selection.png → 256×256 legacy-layout sheet at 1× */
async function composeModernSheet(hotbarUrl, selectionUrl) {
    const bar = await loadImage(hotbarUrl);
    const sel = await loadImage(selectionUrl);
    // Some packs ship the hotbar without its 1px border (180×20): centre it in 182×22
    const borderless = bar.width % 180 === 0 && bar.width / 180 === bar.height / 20;
    const barScale = borderless ? bar.width / 180 : bar.width / BAR.w;
    if (!borderless && (barScale < 1 || Math.abs(bar.height / barScale - BAR.h) > 1)) {
        throw new Error(`hotbar.png should be 182×22 (or a multiple), got ${bar.width}×${bar.height}`);
    }
    const selScale = sel.width / SEL.w;
    const selH = Math.round(sel.height / selScale);
    if (selScale < 1 || selH < 22 || selH > 24) {
        throw new Error(`hotbar_selection.png should be 24×23 or 24×24 (or a multiple), got ${sel.width}×${sel.height}`);
    }
    const { c, ctx } = makeCanvas(SHEET, SHEET);
    if (borderless) ctx.drawImage(bar, 0, 0, bar.width, bar.height, BAR.x + 1, BAR.y + 1, 180, 20);
    else ctx.drawImage(bar, 0, 0, bar.width, bar.height, BAR.x, BAR.y, BAR.w, BAR.h);
    // Top-aligned like the old sheet; a 23px sprite leaves the last row transparent
    ctx.drawImage(sel, 0, 0, sel.width, sel.height, SEL.x, SEL.y, SEL.w, selH);
    return { sheet: c.toDataURL('image/png'), scale: Math.max(barScale, selScale) };
}

/** Crops the bar + selection out of a sheet for the canvas preview */
async function buildHotbarSprites(sheetUrl) {
    const img = await loadImage(sheetUrl);
    const crop = (r) => {
        const { c, ctx } = makeCanvas(r.w, r.h);
        ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        return c.toDataURL('image/png');
    };
    return { bar: crop(BAR), selection: crop(SEL) };
}

/** Sheet → Bedrock slices (kept for compatibility; export happens in the Rust backend) */
async function sliceWidgetsImage(imageData) {
    const img = await loadImage(imageData);
    const sliced = {};
    for (let i = 0; i < 9; i++) {
        const { c, ctx } = makeCanvas(20, 22);
        ctx.drawImage(img, 1 + i * 20, 0, 20, 22, 0, 0, 20, 22);
        sliced[`hotbar_${i}`] = c.toDataURL('image/png');
    }
    const { c, ctx } = makeCanvas(24, 24);
    ctx.drawImage(img, 0, 22, 24, 24, 0, 0, 24, 24);
    sliced.selected_hotbar_slot = c.toDataURL('image/png');
    return sliced;
}

/* ───────────── state + UI ───────────── */

async function applySheet(sheetUrl, { silent } = {}) {
    widgetsImageData = sheetUrl;
    try {
        hotbarSprites = await buildHotbarSprites(sheetUrl);
    } catch (e) {
        hotbarSprites = null;
    }
    showWidgetsPreview();
    if (typeof App !== 'undefined' && typeof App.render === 'function') App.render();
    if (!silent && window.KZDoc) KZDoc.markDirty();
}

function showWidgetsPreview() {
    const preview = document.getElementById('widgets-preview');
    const previewImg = document.getElementById('widgets-preview-img');
    if (!preview || !previewImg) return;
    if (!widgetsImageData || !hotbarSprites) {
        hideWidgetsPreview();
        return;
    }
    // Show the hotbar as it looks in game: bar + selection over slot 1
    loadImage(hotbarSprites.bar).then(async (bar) => {
        const sel = await loadImage(hotbarSprites.selection);
        const { c, ctx } = makeCanvas(BAR.w + 2, BAR.h + 2);
        ctx.drawImage(bar, 1, 1);
        ctx.drawImage(sel, 0, 0);
        previewImg.src = c.toDataURL('image/png');
        preview.style.display = 'block';
    }).catch(() => hideWidgetsPreview());
}

function hideWidgetsPreview() {
    const preview = document.getElementById('widgets-preview');
    const previewImg = document.getElementById('widgets-preview-img');
    if (preview && previewImg) {
        preview.style.display = 'none';
        previewImg.removeAttribute('src');
    }
}

function setModernStatus() {
    const set = (id, ok, label) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = ok ? label : 'not chosen';
        el.classList.toggle('ok', !!ok);
    };
    set('modern-hotbar-status', modern.hotbar, '✓ loaded');
    set('modern-selection-status', modern.selection, '✓ loaded');
}

async function tryComposeModern() {
    setModernStatus();
    if (!modern.hotbar || !modern.selection) {
        toast(`Loaded — now choose ${modern.hotbar ? 'hotbar_selection.png' : 'hotbar.png'}`, 'info');
        return;
    }
    try {
        const { sheet, scale } = await composeModernSheet(modern.hotbar, modern.selection);
        await applySheet(sheet);
        toast(scale > 1 ? `Hotbar textures applied (scaled from ${scale}× to 1×)` : 'Hotbar textures applied', 'success');
    } catch (err) {
        console.error(err);
        alert('❌ ' + err.message);
    }
}

function setFormat(fmt) {
    document.querySelectorAll('.widgets-format [data-format]').forEach(b => b.classList.toggle('active', b.dataset.format === fmt));
    document.querySelectorAll('.widgets-mode').forEach(m => { m.style.display = m.dataset.mode === fmt ? '' : 'none'; });
    try { localStorage.setItem('kz_widgets_format', fmt); } catch (e) { /* ignore */ }
}

function handleWidgetsUpload() {
    const legacyInput = document.getElementById('widgets-file-input');
    const legacyBtn = document.getElementById('btn-upload-widgets');
    const removeBtn = document.getElementById('widgets-remove');
    if (!legacyInput || !legacyBtn) return;

    // Format switch
    document.querySelectorAll('.widgets-format [data-format]').forEach(b =>
        b.addEventListener('click', () => setFormat(b.dataset.format)));
    let saved = 'legacy';
    try { saved = localStorage.getItem('kz_widgets_format') || 'legacy'; } catch (e) { /* ignore */ }
    setFormat(saved);

    // Legacy widgets.png
    legacyBtn.addEventListener('click', () => legacyInput.click());
    legacyInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        legacyInput.value = '';
        if (!file) return;
        try {
            const { sheet, scale } = await normalizeLegacySheet(await readFileAsDataURL(file));
            await applySheet(sheet);
            toast(scale > 1 ? `widgets.png applied (scaled from ${scale}× to 1×)` : 'widgets.png applied', 'success');
        } catch (err) {
            console.error('Failed to process widgets image:', err);
            alert('❌ ' + err.message);
        }
    });

    // Modern hotbar.png / hotbar_selection.png
    const bindModern = (btnId, inputId, key) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;
        btn.addEventListener('click', () => input.click());
        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            input.value = '';
            for (const file of files) {
                const url = await readFileAsDataURL(file);
                // Picking both files at once: route each by its name
                const name = file.name.toLowerCase();
                const target = files.length > 1
                    ? (name.includes('selection') ? 'selection' : 'hotbar')
                    : key;
                modern[target] = url;
            }
            tryComposeModern();
        });
    };
    bindModern('btn-modern-hotbar', 'modern-hotbar-input', 'hotbar');
    bindModern('btn-modern-selection', 'modern-selection-input', 'selection');
    setModernStatus();

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            window.Widgets.clearWidgetsImageData();
            if (window.KZDoc) KZDoc.markDirty();
            toast('Custom hotbar textures removed', 'success');
        });
    }
}

// Kept for compatibility with older code paths
async function addWidgetsToMcpack(mcpack) {
    if (!widgetsImageData) return;
    const sliced = await sliceWidgetsImage(widgetsImageData);
    for (const [filename, dataUrl] of Object.entries(sliced)) {
        const bin = atob(dataUrl.split(',')[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        mcpack.file(`textures/ui/${filename}.png`, bytes, { binary: true });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleWidgetsUpload);
} else {
    handleWidgetsUpload();
}

window.Widgets = {
    getWidgetsImageData: () => widgetsImageData,
    /** Bar + selection sprites for the canvas preview, or null for the default look */
    getHotbarSprites: () => (widgetsImageData ? hotbarSprites : null),
    setWidgetsImageData: (data) => {
        if (!data) {
            window.Widgets.clearWidgetsImageData();
            return;
        }
        applySheet(data, { silent: true });
    },
    clearWidgetsImageData: () => {
        widgetsImageData = null;
        hotbarSprites = null;
        modern.hotbar = null;
        modern.selection = null;
        setModernStatus();
        hideWidgetsPreview();
        if (typeof App !== 'undefined' && typeof App.render === 'function') App.render();
    },
    addWidgetsToMcpack,
    /** Used by the Java HUD importer: legacy widgets.png */
    importLegacy: async (dataUrl) => {
        const { sheet } = await normalizeLegacySheet(dataUrl);
        await applySheet(sheet);
    },
    /** Used by the Java HUD importer: 1.20.2+ hotbar.png + hotbar_selection.png */
    importModern: async (hotbarUrl, selectionUrl) => {
        const { sheet } = await composeModernSheet(hotbarUrl, selectionUrl);
        await applySheet(sheet);
    }
};
