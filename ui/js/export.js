/* ========================================
   .mcpack Export (ZIP)
   ======================================== */

// Bossbar title budget — mirrors plan_hud_banks() in src-tauri/src/codegen.rs:
// Single bank <= 255 bytes; overflow HUDs auto-split into up to 8 banks (@kz1:..@kz7:, 250 bytes each).
const BOSSBAR_TITLE_LIMIT = 255;
const MAX_HUD_BANKS = 8;
const OVERFLOW_BANK_CAP = 250;
function bossbarTitleBudget(elements) {
    const els = elements || App.elements || [];
    const customBars = els.filter(e => e.type === 'bar' && e.barType === 'custom');
    let bars = 5 * 6;
    customBars.forEach((bar, i) => {
        const tag = String(bar.barCustomTag || '').trim() || ('c' + String.fromCharCode(97 + (i % 26)));
        bars += new TextEncoder().encode('@' + (i + 6) + tag).length + 2;
    });
    const textPads = els.filter(e => e.type === 'text').map(e => Math.max(1, effectivePadLength(e)));
    const npPads = els.filter(e => e.type === 'nameplate').map(e => Math.max(1, effectivePadLength(e)));
    const pads = textPads.reduce((a, b) => a + b, 0) + npPads.reduce((a, b) => a + b, 0);

    const conds = new Set();
    els.forEach((e) => {
        getVisibilityConditions(e).forEach((c) => {
            const op = c.op === '!=' ? '==' : c.op;
            conds.add([c.papi, op, c.value].join('\u0001'));
        });
    });
    const atOnce = new Set();
    conds.forEach((k) => {
        const [papi, op] = k.split('\u0001');
        atOnce.add(op === '==' ? papi + '\u0001==' : k);
    });
    const markers = atOnce.size ? atOnce.size * (2 + Math.max(2, String(conds.size).length)) : 0;
    const total = 25 + bars + pads + markers;

    if (total <= BOSSBAR_TITLE_LIMIT) {
        return { total, bars, pads, markers, conditions: conds.size, banks: 1, limit: BOSSBAR_TITLE_LIMIT, singleLimit: BOSSBAR_TITLE_LIMIT, over: false };
    }

    const cap0 = Math.max(0, BOSSBAR_TITLE_LIMIT - (25 + bars + markers));
    const sumNp = npPads.reduce((a, b) => a + b, 0);
    const npInBank0 = npPads.length > 0 && sumNp <= cap0;
    let b0Rem = npInBank0 ? cap0 - sumNp : cap0;
    let banks = 1;
    let curExtra = (!npInBank0 && npPads.length > 0) ? sumNp : 0;
    let singleSlotTooLong = npPads.some(p => p > OVERFLOW_BANK_CAP) || textPads.some(p => p > OVERFLOW_BANK_CAP);

    for (const pad of textPads) {
        if (banks === 1 && curExtra === 0 && pad <= b0Rem) {
            b0Rem -= pad;
        } else {
            if (banks === 1 && curExtra === 0) banks = 2;
            if (curExtra > 0 && curExtra + pad > OVERFLOW_BANK_CAP) {
                banks++;
                curExtra = pad;
            } else {
                curExtra += pad;
            }
        }
    }
    if (!npInBank0 && npPads.length > 0 && banks < 2) banks = 2;
    const multiLimit = BOSSBAR_TITLE_LIMIT + (MAX_HUD_BANKS - 1) * OVERFLOW_BANK_CAP;
    return {
        total,
        bars,
        pads,
        markers,
        conditions: conds.size,
        banks,
        limit: multiLimit,
        singleLimit: BOSSBAR_TITLE_LIMIT,
        over: banks > MAX_HUD_BANKS || singleSlotTooLong
    };
}
window.bossbarTitleBudget = bossbarTitleBudget;

function validateElements() {
    const textElements = App.elements.filter(e => e.type === 'text');
    const barElements = App.elements.filter(e => e.type === 'bar');
    
    let hasErrors = false;
    let errorMessages = [];
    
    // Clear previous validation errors
    document.querySelectorAll('.validation-error').forEach(el => {
        el.classList.remove('validation-error');
    });
    
    // Validate text elements - check PAPI placeholder
    for (const text of textElements) {
        if (!text.papi_placeholder || text.papi_placeholder.trim() === '') {
            hasErrors = true;
            errorMessages.push(`Text "${text.name}": PAPI placeholder is required`);
            // Highlight the element
            const el = document.querySelector(`[data-element-id="${text.id}"]`);
            if (el) el.classList.add('validation-error');
        }
    }
    
    // Validate bar elements - check Bar Type
    for (const bar of barElements) {
        if (!bar.barType || bar.barType.trim() === '') {
            hasErrors = true;
            errorMessages.push(`Bar "${bar.name}": Bar Type is required`);
            // Highlight the element
            const el = document.querySelector(`[data-element-id="${bar.id}"]`);
            if (el) el.classList.add('validation-error');
        }
        
        // Validate Custom bar - check PAPI
        if (bar.barType === 'custom') {
            if (!bar.barCustomPapi || bar.barCustomPapi.trim() === '') {
                hasErrors = true;
                errorMessages.push(`Bar "${bar.name}": PAPI placeholder is required for Custom bar`);
                const el = document.querySelector(`[data-element-id="${bar.id}"]`);
                if (el) el.classList.add('validation-error');
            }
        }
    }
    
    // Check for duplicate Bar Types
    const barTypeCounts = {};
    for (const bar of barElements) {
        if (bar.barType && bar.barType.trim() !== '') {
            // For custom bars, use the tag as unique identifier (skip if no tag yet)
            if (bar.barType === 'custom') {
                const tag = String(bar.barCustomTag || '').trim();
                if (!tag) continue; // Skip custom bars without tags (still being created)
                const key = `custom_${tag}`;
                if (!barTypeCounts[key]) {
                    barTypeCounts[key] = [];
                }
                barTypeCounts[key].push(bar);
            } else {
                // For standard bars (hp, food, armor, air), use barType as key
                const key = bar.barType;
                if (!barTypeCounts[key]) {
                    barTypeCounts[key] = [];
                }
                barTypeCounts[key].push(bar);
            }
        }
    }
    
    for (const [key, bars] of Object.entries(barTypeCounts)) {
        if (bars.length > 1) {
            hasErrors = true;
            const barNames = bars.map(b => `"${b.name}"`).join(', ');
            const typeName = key.startsWith('custom_') ? `Custom (${key.replace('custom_', '')})` : key.toUpperCase();
            errorMessages.push(`Duplicate Bar Type "${typeName}" found in: ${barNames}`);
            // Highlight all duplicate elements
            bars.forEach(bar => {
                const el = document.querySelector(`[data-element-id="${bar.id}"]`);
                if (el) el.classList.add('validation-error');
            });
        }
    }
    
    // Check if custom bars have max value
    const customBars = App.elements.filter(el => el.type === 'bar' && el.barType === 'custom');
    for (const bar of customBars) {
        const maxValue = String(bar.barCustomMax || '').trim();
        const papiValue = String(bar.barCustomPapi || '').trim();
        
        if (!maxValue) {
            hasErrors = true;
            errorMessages.push(`Bar "${bar.name}" You need to enter a Max value (e.g., 20) or use a PAPI placeholder.`);
            const el = document.querySelector(`[data-element-id="${bar.id}"]`);
            if (el) el.classList.add('validation-error');
        }
    }
    
    if (hasErrors) {
        const message = errorMessages.join('\n\n');
        alert('❌ Validation Error:\n\n' + message);
        return false;
    }

    const budget = bossbarTitleBudget(App.elements);
    if (budget.over) {
        return confirm(
            `⚠️ HUD data uses ${budget.banks} banks (${budget.total} bytes, max ${MAX_HUD_BANKS} banks / single slot <= ${OVERFLOW_BANK_CAP}B).\n` +
            `Trailing slots may be truncated in game — reduce some slot Pad Lengths.\n\n` +
            `Export anyway?`
        );
    }

    return true;
}

function readStored(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
}

function writeStored(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}

async function showExportConfirmation() {
    const modal = document.getElementById('export-confirm-modal');
    if (!modal) return true;

    const confirmBtn = document.getElementById('export-confirm-btn');
    const cancelBtn  = document.getElementById('export-cancel-btn');
    const closeBtn   = document.getElementById('export-confirm-close');

    document.getElementById('export-total-elements').textContent = App.elements.length;
    const hasWidgets = window.Widgets && typeof Widgets.getWidgetsImageData === 'function' && !!Widgets.getWidgetsImageData();
    const widgetsEl = document.getElementById('export-widgets-status');
    if (widgetsEl) widgetsEl.textContent = hasWidgets ? 'Yes' : 'No';

    // Java HUD box: optional second export (off unless the user ticked it last time)
    const javaOn = document.getElementById('export-java-on');
    const javaOpts = document.getElementById('export-java-opts');
    const hasJava = !!(javaOn && javaOpts && window.JavaHudExport && JavaHudExport.mount);
    const javaBox = document.getElementById('export-java-box');
    if (javaBox) javaBox.style.display = hasJava ? '' : 'none';
    if (hasJava) {
        javaOn.checked = readStored('kz_export_java', 'off') === 'on';
        JavaHudExport.mount(javaOpts);
        const syncJava = () => { javaOpts.style.display = javaOn.checked ? '' : 'none'; };
        javaOn.onchange = syncJava;
        syncJava();
    }

    // Bedrock HUD transport: always hidden Title (Multi-Bank); Debug text is never remembered across exports
    const chDebug = document.getElementById('export-ch-debug');
    const chDebugRow = document.getElementById('export-ch-debug-row');
    if (chDebugRow) chDebugRow.style.display = '';
    if (chDebug) chDebug.checked = false;

    modal.style.display = 'flex';
    confirmBtn.disabled = false;

    return new Promise((resolve) => {
        const handleConfirm = () => {
            const options = {};
            const javaChoice = hasJava && javaOn.checked ? JavaHudExport.readOptions() : null;
            if (javaChoice && !javaChoice.groups.length) {
                App.showToast('Choose at least one group for the Java export', 'error');
                return;
            }
            options.java = javaChoice;
            if (App.hudChannel !== 'title') {
                App.hudChannel = 'title';
                if (window.KZCode && KZCode.refresh) { try { KZCode.refresh(); } catch (e) { /* code view refreshes later */ } }
            }
            options.hudChannel = 'title';
            options.hudChannelDebug = !!(chDebug && chDebug.checked);
            if (hasJava) writeStored('kz_export_java', javaOn.checked ? 'on' : 'off');
            cleanup();
            resolve(options);
        };
        const handleCancel  = () => { cleanup(); resolve(null); };
        const cleanup = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
        };
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        if (closeBtn) closeBtn.addEventListener('click', handleCancel);
    });
}

async function exportMcpack() {
    if (App.elements.length === 0) {
        App.showToast('Add at least one element first!', 'error');
        return;
    }

    // Validate elements before export
    if (!validateElements()) {
        return;
    }

    // Show confirmation dialog
    const options = await showExportConfirmation();
    if (!options) {
        App.showToast('Export cancelled', 'info');
        return;
    }

    try {
        // includes code overrides and the project's pack UUIDs
        const projectData = window.KZCode ? KZCode.fullData() : {
            elements: App.elements,
            namespace: App.getNamespace ? App.getNamespace() : '',
            widgetsImageData: window.Widgets && typeof Widgets.getWidgetsImageData === 'function' ? Widgets.getWidgetsImageData() : null
        };
        projectData.hudChannel = 'title';
        projectData.hudChannelDebug = !!options.hudChannelDebug;

        // Java HUD files (BetterHud / MythicHUD) go into the same output.zip under plugins/.
        // If they cannot be built, output.zip is still saved without them.
        let java = null;
        if (options.java) {
            try {
                App.showToast('Generating Java HUD config...', 'info');
                java = await JavaHudExport.buildForOutput(options.java);
            } catch (err) {
                console.error('Java export error:', err);
                App.showToast('Java export failed, output.zip is saved without it: ' + err.message, 'error');
                java = null;
            }
        }

        App.showToast('Generating export files...', 'info');
        const savedPath = await API.exportProject(projectData, java ? java.files : null);

        if (!savedPath) {
            App.showToast('Export cancelled', 'info');
            return;
        }
        App.showToast((java ? 'Exported output.zip (Bedrock + Java) successfully!' : 'Exported output.zip successfully!') + ' Bedrock data via hidden title (Multi-Bank).', 'success');
        if (java) JavaHudExport.showResult({ saved: savedPath, res: java, readme: 'README_KaizerHUD_Java.txt' });
    } catch (err) {
        console.error('Export error:', err);
        App.showToast('Export failed: ' + err.message, 'error');
        return;
    }
}

// Separate save dialog for the Java HUD config zip (BetterHud / MythicHUD).
// No longer used by the Export button (the Java files now go into output.zip); kept for reference.
async function exportJavaAfter(javaOptions) {
    try {
        App.showToast('Generating Java HUD config...', 'info');
        const r = await JavaHudExport.exportZip(javaOptions);
        if (!r) {
            App.showToast('Java export cancelled', 'info');
            return;
        }
        JavaHudExport.showResult(r);
    } catch (err) {
        console.error('Java export error:', err);
        App.showToast('Java export failed: ' + err.message, 'error');
    }
}
