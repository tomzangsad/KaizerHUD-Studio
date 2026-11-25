/*
 * KaizerHUD — frame-by-frame animation for Image elements.
 *
 * An Image element is animated when it has 2+ frames:
 *   animFrames    : [dataURL, ...]   frame 1 is also kept in imageData (thumbnails, Java export, old code)
 *   animFps       : frames per second (1–60, whole numbers in the Bedrock export)
 *   animFrameSize : [w, h] texture pixels of one frame (all frames are scaled to frame 1)
 *
 * Bedrock export (src-tauri codegen.rs / export.rs): one horizontal strip of all frames +
 * a `flip_book` animation on the image's `uv`. Java export (javaexport.js): BetterHud
 * `sequence` image; MythicHUD gets frame 1.
 */
(function () {
    'use strict';

    const MAX_STRIP = 4096;      // widest texture every Bedrock device loads
    const MAX_FRAMES = 120;
    const LS_PLAY = 'kzAnimPreview';

    let playing = true;
    try { playing = localStorage.getItem(LS_PLAY) !== '0'; } catch (e) { /* storage unavailable */ }

    const isAnimated = (el) => !!(el && el.type === 'image' && Array.isArray(el.animFrames) && el.animFrames.length > 1);
    const fpsOf = (el) => {
        const f = Math.round(+el.animFps || 10);
        return Math.min(60, Math.max(1, f));
    };
    const stripWidth = (el) => (isAnimated(el) ? (el.animFrameSize ? el.animFrameSize[0] : 0) * el.animFrames.length : 0);

    const hasApp = () => typeof App !== 'undefined' && App && Array.isArray(App.elements);
    const toast = (msg, type) => (hasApp() && App.showToast ? App.showToast(msg, type || 'info') : console.log(msg));
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ───────────── image helpers ───────────── */

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Could not read the picture'));
            img.src = src;
        });
    }

    function canvasOf(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        return { c, ctx };
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(file);
        });
    }

    /** All frames as PNG data URLs of frame 1's size (other sizes are scaled, pixel-sharp) */
    async function normalizeFrames(urls) {
        const imgs = [];
        for (const u of urls) imgs.push(await loadImage(u));
        const w = imgs[0].naturalWidth;
        const h = imgs[0].naturalHeight;
        let scaled = 0;
        const frames = imgs.map((img, i) => {
            const same = img.naturalWidth === w && img.naturalHeight === h;
            if (same && /^data:image\/png;/.test(urls[i])) return urls[i];
            if (!same) scaled++;
            const { c, ctx } = canvasOf(w, h);
            ctx.drawImage(img, 0, 0, w, h);
            return c.toDataURL('image/png');
        });
        return { frames, w, h, scaled };
    }

    /** Cuts a sprite sheet into `count` frames (`dir`: 'horizontal' | 'vertical' | 'grid') */
    async function splitSheet(url, count, dir, cols) {
        const img = await loadImage(url);
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        let fw;
        let fh;
        let per;
        if (dir === 'vertical') { fw = W; fh = Math.floor(H / count); per = 1; }
        else if (dir === 'grid') { per = Math.max(1, cols | 0); fw = Math.floor(W / per); fh = Math.floor(H / Math.ceil(count / per)); }
        else { fw = Math.floor(W / count); fh = H; per = count; }
        if (fw < 1 || fh < 1) throw new Error('Too many frames for this picture');
        const out = [];
        for (let i = 0; i < count; i++) {
            const { c, ctx } = canvasOf(fw, fh);
            const sx = dir === 'vertical' ? 0 : (i % per) * fw;
            const sy = dir === 'vertical' ? i * fh : Math.floor(i / per) * fh;
            ctx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
            out.push(c.toDataURL('image/png'));
        }
        return out;
    }

    /**
     * Frames of an animated GIF / WebP / APNG through the browser's ImageDecoder
     * (WebView2 / Chromium). Returns null when the file has one frame or can't be decoded.
     */
    async function decodeAnimatedFile(file) {
        if (typeof window.ImageDecoder !== 'function') return null;
        try {
            if (!(await ImageDecoder.isTypeSupported(file.type))) return null;
            const dec = new ImageDecoder({ data: await file.arrayBuffer(), type: file.type });
            await dec.tracks.ready;
            const n = Math.min(MAX_FRAMES, dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1);
            if (n < 2) return null;
            const frames = [];
            let total = 0;
            for (let i = 0; i < n; i++) {
                const { image } = await dec.decode({ frameIndex: i });
                const { c, ctx } = canvasOf(image.displayWidth, image.displayHeight);
                ctx.drawImage(image, 0, 0);
                total += image.duration || 0; // microseconds
                image.close();
                frames.push(c.toDataURL('image/png'));
            }
            dec.close();
            const fps = total > 0 ? Math.round((n * 1e6) / total) : 10;
            return { frames, fps: Math.min(60, Math.max(1, fps)) };
        } catch (e) {
            console.warn('Animated picture could not be decoded', e);
            return null;
        }
    }

    const natural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

    /** Picked files → { frames, fps? }: several PNGs (sorted by name) or one animated GIF/WebP/APNG */
    async function framesFromFiles(fileList) {
        const files = [...fileList].sort(natural);
        if (files.length === 1) {
            const anim = await decodeAnimatedFile(files[0]);
            if (anim) return anim;
            return { frames: [await readFile(files[0])], single: true };
        }
        const frames = [];
        for (const f of files.slice(0, MAX_FRAMES)) frames.push(await readFile(f));
        return { frames, dropped: Math.max(0, files.length - MAX_FRAMES) };
    }

    /** Applies frames to an element (one undo step); `fps` / `extra` (more props) optional */
    async function setFrames(elId, urls, fps, extra) {
        const el = App.elements.find((e) => e.id === elId);
        if (!el) return;
        if (!urls || urls.length < 2) {
            toast('An animation needs at least 2 frames', 'error');
            return;
        }
        const n = await normalizeFrames(urls.slice(0, MAX_FRAMES));
        const props = {
            animFrames: n.frames,
            animFrameSize: [n.w, n.h],
            animFps: fps || el.animFps || 10,
            imageData: n.frames[0],
        };
        // a new element (or one still at its picture size) follows the frame size
        if (!el.imageData || (el.animFrameSize && el.size[0] === el.animFrameSize[0] && el.size[1] === el.animFrameSize[1])) {
            props.size = [n.w, n.h];
        }
        Object.assign(props, extra || {});
        App.updateElement(elId, props);
        if (n.scaled) toast(`${n.scaled} frame(s) had another size and were scaled to ${n.w}×${n.h}`, 'info');
        if (n.w * n.frames.length > MAX_STRIP) {
            toast(`The animation strip is ${n.w * n.frames.length}px wide — some phones only load ${MAX_STRIP}px. Use fewer or smaller frames.`, 'error');
        }
    }

    function removeAnimation(elId) {
        const el = App.elements.find((e) => e.id === elId);
        if (!el) return;
        App.updateElement(elId, { animFrames: [], imageData: (el.animFrames && el.animFrames[0]) || el.imageData });
    }

    /* ───────────── editor preview ───────────── */

    /** Frame shown now (frame 1 while paused) */
    function currentFrame(el, now) {
        if (!isAnimated(el)) return el.imageData;
        if (!playing) return el.animFrames[0];
        const i = Math.floor(((now || performance.now()) / 1000) * fpsOf(el)) % el.animFrames.length;
        return el.animFrames[i];
    }

    function tick() {
        if (!hasApp()) return;
        const imgs = document.querySelectorAll('img[data-kz-anim]');
        if (!imgs.length) return;
        const now = performance.now();
        const byId = new Map();
        for (const e of App.elements) if (isAnimated(e)) byId.set(String(e.id), e);
        imgs.forEach((img) => {
            const el = byId.get(img.dataset.kzAnim);
            if (!el) return;
            const src = currentFrame(el, now);
            if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
        });
    }
    setInterval(tick, 33);

    function setPlaying(on) {
        playing = !!on;
        try { localStorage.setItem(LS_PLAY, playing ? '1' : '0'); } catch (e) { /* ignore */ }
        document.querySelectorAll('.kz-anim-play').forEach((b) => {
            b.textContent = playing ? '❚❚ Pause preview' : '▶ Play preview';
        });
        tick();
    }

    /* ───────────── Properties panel ───────────── */

    function renderSection(el) {
        const anim = isAnimated(el);
        if (!anim) {
            return `
          <div class="prop-row kz-anim-row">
            <label>Animation</label>
            <div class="kz-anim-actions">
              <button class="btn btn-sm" id="kz-anim-add" title="Pick 2+ PNG frames (sorted by file name) or one animated GIF / WebP / APNG">+ Frames…</button>
              <button class="btn btn-sm" id="kz-anim-sheet" title="Cut this element's picture into frames">From sprite sheet…</button>
            </div>
          </div>`;
        }
        const [fw, fh] = el.animFrameSize || [0, 0];
        const strip = stripWidth(el);
        const n = el.animFrames.length;
        const secs = (n / fpsOf(el)).toFixed(2);
        const thumbs = el.animFrames
            .slice(0, 40)
            .map((f, i) => `<img src="${f}" title="Frame ${i + 1}" draggable="false" />`)
            .join('');
        return `
          <div class="kz-anim-box">
            <div class="kz-anim-head">
              <span class="kz-anim-badge">▶ ${n} frames</span>
              <span class="kz-anim-meta">${fw}×${fh}px · ${secs}s loop</span>
            </div>
            <div class="kz-anim-strip">${thumbs}${n > 40 ? `<span class="kz-anim-more">+${n - 40}</span>` : ''}</div>
            <div class="prop-row">
              <label>FPS</label>
              <input type="number" id="kz-anim-fps" value="${fpsOf(el)}" min="1" max="60" step="1" title="Frames per second (whole numbers in Bedrock)" />
            </div>
            ${strip > MAX_STRIP ? `<div class="kz-anim-warn">Strip ${strip}px wide — some phones only load ${MAX_STRIP}px textures</div>` : ''}
            <div class="kz-anim-actions">
              <button class="btn btn-sm kz-anim-play" id="kz-anim-play">${playing ? '❚❚ Pause preview' : '▶ Play preview'}</button>
              <button class="btn btn-sm" id="kz-anim-replace" title="Pick new frames">Replace…</button>
              <button class="btn btn-sm" id="kz-anim-remove" title="Keep frame 1 as a still picture">Remove</button>
            </div>
          </div>`;
    }

    function pickFiles(multiple, accept) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept || 'image/png,image/gif,image/webp,image/apng';
            input.multiple = !!multiple;
            input.style.display = 'none';
            input.addEventListener('change', () => {
                resolve(input.files && input.files.length ? [...input.files] : null);
                input.remove();
            });
            document.body.appendChild(input);
            input.click();
        });
    }

    async function pickFrames(el) {
        const files = await pickFiles(true);
        if (!files) return;
        try {
            const r = await framesFromFiles(files);
            if (r.single) {
                // one still picture: frame 1 = the element's picture, the file = frame 2
                if (!el.imageData) { toast('Pick 2 or more frames (or one animated GIF / WebP)', 'error'); return; }
                await setFrames(el.id, [el.imageData, r.frames[0]], r.fps);
                return;
            }
            if (r.dropped) toast(`Only the first ${MAX_FRAMES} frames were used`, 'info');
            await setFrames(el.id, r.frames, r.fps);
        } catch (e) {
            toast(`Could not add frames: ${e.message}`, 'error');
        }
    }

    async function fromSheet(el) {
        if (!el.imageData) { toast('Load a picture first (Change Image)', 'error'); return; }
        const ask = window.kzPrompt || window.prompt;
        const answer = await ask('How many frames are in this picture?\nAdd "v" for a vertical sheet (e.g. 8v) or "x4" for 4 per row (e.g. 16x4).', '8');
        if (answer === null || answer === undefined) return;
        const m = String(answer).trim().toLowerCase().match(/^(\d+)\s*(v|x\s*(\d+))?$/);
        if (!m) { toast('Write a number, e.g. 8, 8v or 16x4', 'error'); return; }
        const count = Math.min(MAX_FRAMES, +m[1]);
        if (count < 2) { toast('An animation needs at least 2 frames', 'error'); return; }
        const dir = m[2] === 'v' ? 'vertical' : m[3] ? 'grid' : 'horizontal';
        try {
            const frames = await splitSheet(el.imageData, count, dir, +m[3]);
            // the element showed the whole sheet: shrink it to one frame
            const k = dir === 'vertical' ? [1, 1 / count] : dir === 'grid' ? [1 / +m[3], 1 / Math.ceil(count / +m[3])] : [1 / count, 1];
            const size = [Math.max(1, Math.round(el.size[0] * k[0])), Math.max(1, Math.round(el.size[1] * k[1]))];
            await setFrames(el.id, frames, null, { size });
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    function bindSection(el) {
        const on = (id, ev, fn) => {
            const n = document.getElementById(id);
            if (n) n.addEventListener(ev, fn);
        };
        on('kz-anim-add', 'click', () => pickFrames(el));
        on('kz-anim-replace', 'click', () => pickFrames(el));
        on('kz-anim-sheet', 'click', () => fromSheet(el));
        on('kz-anim-remove', 'click', () => removeAnimation(el.id));
        on('kz-anim-play', 'click', () => setPlaying(!playing));
        on('kz-anim-fps', 'change', (e) => {
            const v = Math.min(60, Math.max(1, Math.round(+e.target.value || 10)));
            e.target.value = v;
            App.updateElement(el.id, { animFps: v });
        });
    }

    window.KzAnim = {
        MAX_STRIP,
        isAnimated,
        fpsOf,
        stripWidth,
        currentFrame,
        normalizeFrames,
        splitSheet,
        framesFromFiles,
        setFrames,
        removeAnimation,
        renderSection,
        bindSection,
        setPlaying,
        get playing() { return playing; },
    };
})();
