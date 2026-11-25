/* ========================================
   GUI Studio — Motion (animations)
   One set of presets and one keyframe evaluator, used by:
     • the editor preview (CSS transforms on the canvas)
     • the export (clips written to menus/<id>.yml for KaizerUI, and Bedrock JSON UI anims)
   A clip = { length (s), delay (s), loop, pivot [0..1, 0..1], tracks: { name: [[t, value, ease], ...] } }
   Tracks: x, y (GUI px, y down) · scale, sx, sy, alpha (%) · rot (degrees, clockwise).
   The ease of a key shapes the way to the next key.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};

    const TRACKS = {
        x: { rest: 0, label: 'Move X', unit: 'px' },
        y: { rest: 0, label: 'Move Y', unit: 'px' },
        scale: { rest: 100, label: 'Scale', unit: '%' },
        sx: { rest: 100, label: 'Stretch X', unit: '%' },
        sy: { rest: 100, label: 'Stretch Y', unit: '%' },
        rot: { rest: 0, label: 'Rotate', unit: '°' },
        alpha: { rest: 100, label: 'Opacity', unit: '%' }
    };
    const TRACK_IDS = Object.keys(TRACKS);
    const EASES = ['linear', 'in', 'out', 'inout', 'back', 'bounce', 'elastic', 'steps', 'hold'];

    function bounceOut(t) {
        const n = 7.5625, d = 2.75;
        if (t < 1 / d) return n * t * t;
        if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
        if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
        return n * (t -= 2.625 / d) * t + 0.984375;
    }

    /** 0..1 → 0..1 (back / elastic overshoot) */
    function ease(name, t) {
        t = Math.max(0, Math.min(1, t));
        switch (name) {
            case 'in': return t * t;
            case 'out': return t * (2 - t);
            case 'inout': return t * t * (3 - 2 * t);
            case 'back': return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
            case 'bounce': return bounceOut(t);
            case 'elastic': return t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
            case 'steps': return Math.floor(t * 4) / 4;
            case 'hold': return t >= 1 ? 1 : 0;
            default: return t;
        }
    }

    /* ───────────── presets ─────────────
       [label, length, tracks, pivot?]  (key = [t, v, ease]) */

    /** The whole menu when it opens */
    const OPEN = {
        none: ['None — appears at once', 0, {}],
        fade: ['Fade in', 0.3, { alpha: [[0, 0, 'inout'], [0.3, 100]] }],
        pop: ['Pop', 0.35, { scale: [[0, 85, 'out'], [0.25, 102, 'inout'], [0.35, 100]], alpha: [[0, 0, 'out'], [0.2, 100]] }],
        zoom: ['Zoom in', 0.4, { scale: [[0, 60, 'out'], [0.4, 100]], alpha: [[0, 0, 'out'], [0.25, 100]] }],
        rise: ['Rise up', 0.4, { y: [[0, 40, 'out'], [0.4, 0]], alpha: [[0, 0, 'out'], [0.3, 100]] }],
        drop: ['Drop down', 0.4, { y: [[0, -40, 'out'], [0.4, 0]], alpha: [[0, 0, 'out'], [0.3, 100]] }],
        'slide-left': ['Slide from left', 0.45, { x: [[0, -90, 'out'], [0.45, 0]], alpha: [[0, 0, 'out'], [0.3, 100]] }],
        'slide-right': ['Slide from right', 0.45, { x: [[0, 90, 'out'], [0.45, 0]], alpha: [[0, 0, 'out'], [0.3, 100]] }],
        crt: ['Screen on (CRT)', 0.35, { sy: [[0, 2, 'out'], [0.22, 100]], sx: [[0, 115, 'inout'], [0.12, 115, 'out'], [0.3, 100]], alpha: [[0, 0, 'out'], [0.08, 100]] }],
        unfold: ['Unfold from corner', 0.45, { scale: [[0, 0, 'out'], [0.45, 100]], alpha: [[0, 0, 'out'], [0.2, 100]] }, [0, 0]],
        bounce: ['Bounce down', 0.8, { y: [[0, -160, 'bounce'], [0.8, 0]] }],
        swing: ['Swing in', 0.5, { rot: [[0, -10, 'back'], [0.5, 0]], scale: [[0, 90, 'out'], [0.5, 100]], alpha: [[0, 0, 'out'], [0.25, 100]] }],
        spin: ['Spin in', 0.6, { rot: [[0, -180, 'out'], [0.6, 0]], scale: [[0, 0, 'out'], [0.6, 100]] }]
    };

    /** One element when it appears (also the cascade effect) */
    const INTRO = {
        fade: ['Fade in', 0.3, { alpha: [[0, 0, 'inout'], [0.3, 100]] }],
        pop: ['Pop', 0.35, { scale: [[0, 30, 'out'], [0.25, 110, 'inout'], [0.35, 100]], alpha: [[0, 0, 'out'], [0.2, 100]] }],
        zoom: ['Zoom in', 0.3, { scale: [[0, 0, 'back'], [0.3, 100]] }],
        rise: ['Rise up', 0.35, { y: [[0, 12, 'out'], [0.35, 0]], alpha: [[0, 0, 'out'], [0.25, 100]] }],
        drop: ['Drop down', 0.35, { y: [[0, -12, 'out'], [0.35, 0]], alpha: [[0, 0, 'out'], [0.25, 100]] }],
        'slide-left': ['Slide from left', 0.35, { x: [[0, -24, 'out'], [0.35, 0]], alpha: [[0, 0, 'out'], [0.25, 100]] }],
        'slide-right': ['Slide from right', 0.35, { x: [[0, 24, 'out'], [0.35, 0]], alpha: [[0, 0, 'out'], [0.25, 100]] }],
        crt: ['Screen on (CRT)', 0.3, { sy: [[0, 4, 'out'], [0.2, 100]], alpha: [[0, 0, 'out'], [0.06, 100]] }],
        bounce: ['Bounce in', 0.6, { y: [[0, -30, 'bounce'], [0.6, 0]], alpha: [[0, 0, 'out'], [0.1, 100]] }],
        swing: ['Swing in', 0.45, { rot: [[0, -12, 'back'], [0.45, 0]], alpha: [[0, 0, 'out'], [0.2, 100]] }],
        spin: ['Spin in', 0.5, { rot: [[0, -180, 'out'], [0.5, 0]], scale: [[0, 0, 'out'], [0.5, 100]] }]
    };

    /** Repeats while the menu is open */
    const LOOP = {
        pulse: ['Pulse', 1, { scale: [[0, 100, 'inout'], [0.5, 108, 'inout'], [1, 100]] }],
        breathe: ['Breathe', 2.4, { scale: [[0, 100, 'inout'], [1.2, 103, 'inout'], [2.4, 100]], alpha: [[0, 100, 'inout'], [1.2, 82, 'inout'], [2.4, 100]] }],
        bob: ['Bob', 1.5, { y: [[0, 0, 'inout'], [0.75, -3, 'inout'], [1.5, 0]] }],
        float: ['Float', 3, { y: [[0, 0, 'inout'], [1.5, -5, 'inout'], [3, 0]] }],
        sway: ['Sway', 2, { x: [[0, 0, 'inout'], [0.5, 3, 'inout'], [1.5, -3, 'inout'], [2, 0]] }],
        swing: ['Swing', 2, { rot: [[0, -6, 'inout'], [1, 6, 'inout'], [2, -6]] }],
        spin: ['Spin', 2, { rot: [[0, 0], [2, 360]] }],
        blink: ['Blink', 1, { alpha: [[0, 100, 'inout'], [0.5, 25, 'inout'], [1, 100]] }],
        wiggle: ['Wiggle now and then', 2.5, { rot: [[0, 0, 'inout'], [0.1, -8, 'inout'], [0.2, 8, 'inout'], [0.3, -5, 'inout'], [0.4, 3, 'inout'], [0.5, 0], [2.5, 0]] }],
        heartbeat: ['Heartbeat', 1.2, { scale: [[0, 100, 'out'], [0.1, 114, 'in'], [0.2, 100, 'out'], [0.3, 110, 'in'], [0.45, 100], [1.2, 100]] }]
    };

    /** Java: while the cursor is on a button (state reached in `length` s) */
    const HOVER = {
        none: ['None', 0, {}],
        grow: ['Grow', 0.12, { scale: 106 }],
        lift: ['Lift', 0.12, { y: -2, scale: 103 }],
        tilt: ['Tilt', 0.14, { rot: -4, scale: 105 }],
        pop: ['Pop out', 0.1, { scale: 112 }],
        nudge: ['Nudge right', 0.12, { x: 3 }]
    };

    /** Java: plays once when a button is clicked */
    const PRESS = {
        none: ['None', 0, {}],
        squish: ['Squish', 0.18, { scale: [[0, 100, 'out'], [0.06, 90, 'inout'], [0.18, 100]] }],
        sink: ['Sink', 0.18, { y: [[0, 0, 'out'], [0.06, 2, 'inout'], [0.18, 0]], scale: [[0, 100, 'out'], [0.06, 96, 'inout'], [0.18, 100]] }],
        bump: ['Bump', 0.25, { scale: [[0, 100, 'out'], [0.08, 115, 'inout'], [0.25, 100]] }],
        shake: ['Shake', 0.25, { x: [[0, 0], [0.05, -3], [0.1, 3], [0.15, -2], [0.2, 2], [0.25, 0]] }]
    };

    const round = (v, d) => { const k = Math.pow(10, d == null ? 3 : d); return Math.round(v * k) / k; };

    /** Preset → clip, stretched to `ms` (0 = the preset's own length) and with loop strength `amount` */
    function clip(table, id, opts) {
        const def = table[id];
        if (!def || !def[1]) return null;
        opts = opts || {};
        const len0 = def[1];
        const len = opts.ms > 0 ? opts.ms / 1000 : len0;
        const k = len / len0;
        const amount = opts.amount != null ? Math.max(0, Number(opts.amount) || 0) : 1;
        const tracks = {};
        for (const [name, keys] of Object.entries(def[2])) {
            const rest = TRACKS[name].rest;
            tracks[name] = keys.map(([t, v, e]) => [round(t * k), round(rest + (v - rest) * amount, 2), e || 'linear']);
        }
        return { length: round(len), delay: round(Math.max(0, (opts.delay || 0) / 1000)), loop: !!opts.loop, pivot: def[3] || [0.5, 0.5], tracks };
    }

    /** Hover preset → { length, state } (state values like the tracks) */
    function hoverOf(id, ms) {
        const def = HOVER[id];
        if (!def || !def[1]) return null;
        return { length: round(ms > 0 ? ms / 1000 : def[1]), state: Object.assign({}, def[2]) };
    }

    function valueAt(keys, t, rest) {
        if (!keys || !keys.length) return rest;
        if (t <= keys[0][0]) return keys[0][1];
        const last = keys[keys.length - 1];
        if (t >= last[0]) return last[1];
        let i = 0;
        while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
        const a = keys[i], b = keys[i + 1];
        const span = b[0] - a[0];
        return a[1] + (b[1] - a[1]) * ease(a[2], span > 0 ? (t - a[0]) / span : 1);
    }

    /** Clip values at time t (s from the clip start, before its delay) as a state */
    function sample(c, t) {
        const st = rest();
        if (!c) return st;
        let tt = t - (c.delay || 0);
        if (tt < 0) tt = 0;
        if (c.loop && c.length > 0) tt %= c.length;
        for (const name of TRACK_IDS) {
            const keys = c.tracks[name];
            if (keys) st[name] = valueAt(keys, tt, TRACKS[name].rest);
        }
        return st;
    }

    function rest() { return { x: 0, y: 0, scale: 100, sx: 100, sy: 100, rot: 0, alpha: 100 }; }

    /** a then b (b on top of a, same pivot) */
    function combine(a, b) {
        return {
            x: a.x + b.x, y: a.y + b.y, rot: a.rot + b.rot,
            scale: a.scale * b.scale / 100, sx: a.sx * b.sx / 100, sy: a.sy * b.sy / 100, alpha: a.alpha * b.alpha / 100
        };
    }

    function lerpState(a, b, w) {
        const o = {};
        for (const k of TRACK_IDS) o[k] = a[k] + (b[k] - a[k]) * w;
        return o;
    }

    function hoverState(h, w) {
        const target = Object.assign(rest(), h ? h.state : {});
        return lerpState(rest(), target, ease('out', w));
    }

    /** true when t is past the end of a one-shot clip */
    function done(c, t) { return !c || (!c.loop && t >= (c.delay || 0) + c.length); }

    /* ───────────── what a project asks for ───────────── */

    function defaults() {
        return { open: 'none', openMs: 0, cascade: 'none', cascadeMs: 0, cascadeGap: 40 };
    }
    function elementDefaults(type) {
        return { intro: 'auto', introMs: 0, introDelay: 0, loop: 'none', loopMs: 0, loopAmount: 1, hover: type === 'button' ? 'grow' : 'none', hoverMs: 0, press: type === 'button' ? 'squish' : 'none' };
    }

    /** Every clip of a menu page: { open, elements: { id: { intro, loop, hover, press } } } */
    function resolve(menu) {
        const mm = Object.assign(defaults(), menu.motion || {});
        const out = { open: clip(OPEN, mm.open, { ms: mm.openMs }), elements: {} };
        const openLen = out.open ? out.open.length : 0;
        // the whole cascade takes at most 1.5 s, however many elements take part
        const joins = (menu.elements || []).filter(e => !e.hidden && (Object.assign(elementDefaults(e.type), e.motion || {})).intro === 'auto').length;
        const gap = Math.min(Math.max(0, Number(mm.cascadeGap) || 0), joins > 1 ? 1500 / (joins - 1) : Infinity);
        let n = 0;
        (menu.elements || []).forEach(e => {
            if (e.hidden) return;
            const em = Object.assign(elementDefaults(e.type), e.motion || {});
            const r = {};
            if (em.intro === 'auto') {
                if (mm.cascade && mm.cascade !== 'none') {
                    // elements appear one after another (in layer order), starting with the menu
                    const start = Math.max(0, openLen * 1000 * 0.4) + n * gap;
                    r.intro = clip(INTRO, mm.cascade, { ms: mm.cascadeMs, delay: start + (Number(em.introDelay) || 0) });
                    n++;
                }
            } else if (em.intro && em.intro !== 'none') {
                r.intro = clip(INTRO, em.intro, { ms: em.introMs, delay: Number(em.introDelay) || 0 });
            }
            if (em.loop && em.loop !== 'none') {
                r.loop = clip(LOOP, em.loop, { ms: em.loopMs, amount: em.loopAmount, loop: true });
                // loops start when the element has arrived
                if (r.loop) r.loop.delay = round(r.intro ? r.intro.delay + r.intro.length : openLen);
            }
            if (e.type === 'button') {
                r.hover = hoverOf(em.hover, em.hoverMs);
                r.press = clip(PRESS, em.press, {});
            }
            out.elements[e.id] = r;
        });
        return out;
    }

    function hasAny(resolved) {
        if (resolved.open) return true;
        return Object.values(resolved.elements).some(r => r.intro || r.loop || r.hover || r.press);
    }

    /** CSS transform for a state, applied around transform-origin = pivot */
    function css(st) {
        const sx = st.scale * st.sx / 10000, sy = st.scale * st.sy / 10000;
        return `translate(${round(st.x, 2)}px, ${round(st.y, 2)}px) rotate(${round(st.rot, 2)}deg) scale(${round(sx, 4)}, ${round(sy, 4)})`;
    }

    const options = (table, extra) => (extra || []).concat(Object.entries(table).map(([id, d]) => [id, d[0]]));

    GS.Motion = {
        TRACKS, TRACK_IDS, EASES, OPEN, INTRO, LOOP, HOVER, PRESS,
        ease, clip, hoverOf, sample, valueAt, rest, combine, lerpState, hoverState, done,
        defaults, elementDefaults, resolve, hasAny, css, options
    };
})();
