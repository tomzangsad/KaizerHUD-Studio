/* ========================================
   GUI Studio — 3D Blockbench (.bbmodel) & Multi-Namespace JSON Model Renderer
   Pure Canvas 2D software renderer for custom items, furniture, and ModelEngine / BetterModel rigs.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const imgCache = new Map();
    const DEG = Math.PI / 180;

    function loadImg(src) {
        if (!src) return Promise.resolve(null);
        if (imgCache.has(src)) return imgCache.get(src);
        const p = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
        imgCache.set(src, p);
        return p;
    }

    function rotX(p, a) {
        if (!a) return p;
        const c = Math.cos(a), s = Math.sin(a);
        return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
    }

    function rotY(p, a) {
        if (!a) return p;
        const c = Math.cos(a), s = Math.sin(a);
        return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
    }

    function rotZ(p, a) {
        if (!a) return p;
        const c = Math.cos(a), s = Math.sin(a);
        return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
    }

    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    /** Draw one textured triangle onto ctx via 2D affine transform */
    function drawTri(ctx, img, sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
        const denom = sx0 * (sy1 - sy2) - sy0 * (sx1 - sx2) + (sx1 * sy2 - sx2 * sy1);
        if (Math.abs(denom) < 1e-6) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dx0, dy0);
        ctx.lineTo(dx1, dy1);
        ctx.lineTo(dx2, dy2);
        ctx.closePath();
        ctx.clip();

        const a = (dx0 * (sy1 - sy2) - sy0 * (dx1 - dx2) + (dx1 * sy2 - dx2 * sy1)) / denom;
        const b = (dy0 * (sy1 - sy2) - sy0 * (dy1 - dy2) + (dy1 * sy2 - dy2 * sy1)) / denom;
        const c = (sx0 * (dx1 - dx2) - dx0 * (sx1 - sx2) + (sx1 * dx2 - sx2 * dx1)) / denom;
        const d = (sx0 * (dy1 - dy2) - dy0 * (sx1 - sx2) + (sx1 * dy2 - sx2 * dy1)) / denom;
        const e = (sx0 * (sy1 * dx2 - sy2 * dx1) - sy0 * (sx1 * dx2 - sx2 * dx1) + dx0 * (sx1 * sy2 - sx2 * sy1)) / denom;
        const f = (sx0 * (sy1 * dy2 - sy2 * dy1) - sy0 * (sx1 * dy2 - sx2 * dy1) + dy0 * (sx1 * sy2 - sx2 * sy1)) / denom;

        ctx.transform(a, b, c, d, e, f);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
    }

    /** Shade a projected polygon subtly for directional 3D depth */
    function shadeQuad(ctx, pts, shade) {
        if (shade >= 0.995) return;
        const alpha = Math.max(0, Math.min(0.45, 1 - shade));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
        ctx.fill();
        ctx.restore();
    }

    // Standard Minecraft cube face vertex winding (outward counter-clockwise in right-handed space)
    // Corners: 0:(x1,y1,z1), 1:(x2,y1,z1), 2:(x2,y2,z1), 3:(x1,y2,z1),
    //          4:(x1,y1,z2), 5:(x2,y1,z2), 6:(x2,y2,z2), 7:(x1,y2,z2)
    const FACE_CORNERS = {
        north: [1, 2, 3, 0], // -Z
        south: [4, 7, 6, 5], // +Z
        west:  [0, 3, 7, 4], // -X
        east:  [5, 6, 2, 1], // +X
        up:    [3, 2, 6, 7], // +Y
        down:  [4, 5, 1, 0], // -Y
    };

    const FACE_SHADE = {
        up: 1.0,
        north: 0.90,
        east: 0.84,
        south: 0.78,
        west: 0.74,
        down: 0.62,
    };

    function cubeCorners(from, to, inflate) {
        const inf = Number(inflate) || 0;
        const x1 = Number(from[0]) - inf, y1 = Number(from[1]) - inf, z1 = Number(from[2]) - inf;
        const x2 = Number(to[0]) + inf,   y2 = Number(to[1]) + inf,   z2 = Number(to[2]) + inf;
        return [
            [x1, y1, z1], [x2, y1, z1], [x2, y2, z1], [x1, y2, z1],
            [x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2],
        ];
    }

    function applyBbRotation(pt, origin, rot) {
        if (!rot || (!rot[0] && !rot[1] && !rot[2])) return pt;
        const o = origin || [0, 0, 0];
        let p = sub(pt, o);
        p = rotX(p, (Number(rot[0]) || 0) * DEG);
        p = rotY(p, (Number(rot[1]) || 0) * DEG);
        p = rotZ(p, (Number(rot[2]) || 0) * DEG);
        return add(p, o);
    }

    function applyMcRotation(pt, rotObj) {
        if (!rotObj || !rotObj.angle) return pt;
        const o = rotObj.origin || [8, 8, 8];
        let p = sub(pt, o);
        const a = Number(rotObj.angle) * DEG;
        if (rotObj.axis === 'x') p = rotX(p, a);
        else if (rotObj.axis === 'y') p = rotY(p, a);
        else if (rotObj.axis === 'z') p = rotZ(p, a);
        return add(p, o);
    }

    function resolveMcTex(textures, ref) {
        if (!ref) return null;
        let cur = String(ref);
        for (let guard = 0; guard < 6; guard++) {
            if (cur.startsWith('data:')) return cur;
            if (cur.startsWith('#')) {
                const next = textures[cur.slice(1)];
                if (!next) break;
                cur = String(next);
            } else {
                if (textures[cur]) { cur = String(textures[cur]); continue; }
                break;
            }
        }
        if (cur.startsWith('data:')) return cur;
        const first = Object.values(textures).find(v => typeof v === 'string' && v.startsWith('data:'));
        return first || null;
    }

    async function drawCubeList(ctx, width, height, cubes, opts) {
        const yaw = ((opts && opts.angle != null) ? Number(opts.angle) : -35) * DEG;
        const pitch = ((opts && opts.pitch != null) ? Number(opts.pitch) : 24) * DEG;

        const viewProj = (p) => {
            let v = rotY(p, yaw);
            v = rotX(v, pitch);
            return [v[0], -v[1], v[2]]; // screen X, screen Y (down), camera Z (toward viewer = +)
        };

        const quads = [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (const cube of cubes) {
            const pts = cube.corners.map(viewProj);
            for (const p of pts) {
                if (p[0] < minX) minX = p[0];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[1] > maxY) maxY = p[1];
            }
            for (const [fname, fdata] of Object.entries(cube.faces)) {
                const idx = FACE_CORNERS[fname];
                if (!idx || !fdata) continue;
                const q = idx.map(k => pts[k]);
                // 2D cross product in screen coords (Y down): backface cull away-facing quads
                const ax = q[1][0] - q[0][0], ay = q[1][1] - q[0][1];
                const bx = q[2][0] - q[0][0], by = q[2][1] - q[0][1];
                const cz = ax * by - ay * bx;
                if (cz >= 0) continue; // outward CCW becomes negative Z in Y-down screen space
                const depth = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) * 0.25;
                quads.push({ q, depth, fdata, shade: FACE_SHADE[fname] || 0.85, color: cube.color || '#6a82b5' });
            }
        }

        ctx.clearRect(0, 0, width, height);
        if (!quads.length || !Number.isFinite(minX)) return false;

        const spanX = Math.max(1e-3, maxX - minX);
        const spanY = Math.max(1e-3, maxY - minY);
        const pad = 0.86;
        const scale = Math.min((width * pad) / spanX, (height * pad) / spanY);
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        const ox = width * 0.5;
        const oy = height * 0.5;

        const toScreen = (p) => [(p[0] - cx) * scale + ox, (p[1] - cy) * scale + oy];

        // Sort back-to-front
        quads.sort((a, b) => a.depth - b.depth);
        ctx.imageSmoothingEnabled = false;

        for (const item of quads) {
            const sp = item.q.map(toScreen);
            const { img, u1, v1, u2, v2, rot } = item.fdata;
            if (img) {
                let uvs = [
                    [u1, v2],
                    [u1, v1],
                    [u2, v1],
                    [u2, v2],
                ];
                const rsteps = ((Math.round((Number(rot) || 0) / 90) % 4) + 4) % 4;
                for (let k = 0; k < rsteps; k++) {
                    uvs = [uvs[3], uvs[0], uvs[1], uvs[2]];
                }
                drawTri(
                    ctx, img,
                    uvs[0][0], uvs[0][1], uvs[1][0], uvs[1][1], uvs[2][0], uvs[2][1],
                    sp[0][0], sp[0][1], sp[1][0], sp[1][1], sp[2][0], sp[2][1]
                );
                drawTri(
                    ctx, img,
                    uvs[0][0], uvs[0][1], uvs[2][0], uvs[2][1], uvs[3][0], uvs[3][1],
                    sp[0][0], sp[0][1], sp[2][0], sp[2][1], sp[3][0], sp[3][1]
                );
                shadeQuad(ctx, sp, item.shade);
            } else {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(sp[0][0], sp[0][1]);
                for (let i = 1; i < 4; i++) ctx.lineTo(sp[i][0], sp[i][1]);
                ctx.closePath();
                ctx.fillStyle = item.color;
                ctx.fill();
                shadeQuad(ctx, sp, item.shade);
                ctx.restore();
            }
        }
        return true;
    }

    async function drawModelToCanvas(model, canvas, opts) {
        if (!model || !canvas) return false;
        const ctx = canvas.getContext('2d');
        const W = canvas.width || 64, H = canvas.height || 64;

        if (model.kind === 'mc_json') {
            if ((!Array.isArray(model.elements) || !model.elements.length) && model.flatBytesB64) {
                const img = await loadImg('data:image/png;base64,' + model.flatBytesB64);
                if (!img) return false;
                ctx.clearRect(0, 0, W, H);
                ctx.imageSmoothingEnabled = false;
                const s = Math.min((W * 0.88) / Math.max(1, img.width), (H * 0.88) / Math.max(1, img.height));
                const dw = img.width * s, dh = img.height * s;
                ctx.drawImage(img, (W - dw) * 0.5, (H - dh) * 0.5, dw, dh);
                return true;
            }
            const texMap = model.textures || {};
            const loadedImgs = new Map();
            for (const val of Object.values(texMap)) {
                if (typeof val === 'string' && val.startsWith('data:')) {
                    loadedImgs.set(val, await loadImg(val));
                }
            }
            const cubes = (model.elements || []).map(el => {
                const rawCorners = cubeCorners(el.from || [0, 0, 0], el.to || [16, 16, 16], 0);
                const corners = rawCorners.map(p => applyMcRotation(p, el.rotation));
                const faces = {};
                for (const fname of Object.keys(FACE_CORNERS)) {
                    const f = el.faces && el.faces[fname];
                    if (!f) continue;
                    const src = resolveMcTex(texMap, f.texture);
                    const img = src ? (loadedImgs.get(src) || null) : null;
                    const uv = Array.isArray(f.uv) && f.uv.length >= 4 ? f.uv : [0, 0, 16, 16];
                    const iw = img ? img.width : 16, ih = img ? img.height : 16;
                    faces[fname] = {
                        img,
                        u1: (Number(uv[0]) / 16) * iw,
                        v1: (Number(uv[1]) / 16) * ih,
                        u2: (Number(uv[2]) / 16) * iw,
                        v2: (Number(uv[3]) / 16) * ih,
                        rot: f.rotation || 0,
                    };
                }
                return { corners, faces };
            });
            return drawCubeList(ctx, W, H, cubes, opts);
        }

        // Default: Blockbench .bbmodel
        const resW = Number((model.resolution && model.resolution.width) || 16);
        const resH = Number((model.resolution && model.resolution.height) || 16);
        const texList = Array.isArray(model.textures) ? model.textures : [];
        const texImgs = new Map();
        const texByKey = new Map();
        for (let i = 0; i < texList.length; i++) {
            const tx = texList[i];
            const img = tx && tx.source ? await loadImg(tx.source) : null;
            if (img) texImgs.set(i, img);
            texByKey.set(String(i), img);
            if (tx && tx.id != null) texByKey.set(String(tx.id), img);
            if (tx && tx.uuid) texByKey.set(String(tx.uuid), img);
        }
        const fallbackImg = texImgs.values().next().value || null;

        const cubes = [];
        for (const el of (model.elements || [])) {
            if (!el || el.visibility === false) continue;
            if (el.type && el.type !== 'cube') continue;
            if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
            const rawCorners = cubeCorners(el.from, el.to, el.inflate);
            const corners = rawCorners.map(p => applyBbRotation(p, el.origin, el.rotation));
            const faces = {};
            for (const fname of Object.keys(FACE_CORNERS)) {
                const f = el.faces && el.faces[fname];
                if (!f || f.texture === null) continue;
                const img = f.texture === undefined ? fallbackImg : (texByKey.get(String(f.texture)) || fallbackImg);
                const uv = Array.isArray(f.uv) && f.uv.length >= 4 ? f.uv : [0, 0, resW, resH];
                const iw = img ? img.width : resW, ih = img ? img.height : resH;
                faces[fname] = {
                    img,
                    u1: (Number(uv[0]) / resW) * iw,
                    v1: (Number(uv[1]) / resH) * ih,
                    u2: (Number(uv[2]) / resW) * iw,
                    v2: (Number(uv[3]) / resH) * ih,
                    rot: f.rotation || 0,
                };
            }
            cubes.push({ corners, faces, color: el.color || '#6a82b5' });
        }
        return drawCubeList(ctx, W, H, cubes, opts);
    }

    async function renderThumbnail(model, size, opts) {
        const s = Math.max(24, Number(size) || 64);
        const cv = document.createElement('canvas');
        cv.width = s;
        cv.height = s;
        const ok = await drawModelToCanvas(model, cv, opts);
        return ok ? cv.toDataURL('image/png') : null;
    }

    GS.BbModel = { renderThumbnail, drawToCanvas: drawModelToCanvas };
})();
