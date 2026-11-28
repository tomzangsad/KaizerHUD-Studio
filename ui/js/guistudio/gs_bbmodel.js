/* ========================================
   GUI Studio - WebGL 3D Blockbench (.bbmodel) & Minecraft JSON Model Renderer
   Offscreen hardware Z-buffer + alpha cutout renderer with Bone Hierarchy (outliner),
   display.gui transforms, rotation rescale, and animated texture frame-0 slicing.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const imgCache = new Map();
    const DEG = Math.PI / 180;
    const HELPER_NAME_RE = /^(?:hitbox|subhitbox|shadow|mount|driver|passenger|h_|p_|b_|tag_|ob_|hit_)/i;

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

    // Cube corners 0..7 in right-handed space (+X east, +Y up, +Z south):
    // Bottom (y1): 0:(x1,y1,z1) 1:(x2,y1,z1) 2:(x2,y2,z1) 3:(x1,y2,z1)
    // Top    (y2): 4:(x1,y1,z2) 5:(x2,y1,z2) 6:(x2,y2,z2) 7:(x1,y2,z2)
    // Outward CCW [BL, BR, TR, TL]:
    const FACE_CORNERS = {
        north: [1, 0, 3, 2], // -Z
        south: [4, 5, 6, 7], // +Z
        west:  [0, 4, 7, 3], // -X
        east:  [5, 1, 2, 6], // +X
        up:    [7, 6, 2, 3], // +Y
        down:  [0, 1, 5, 4], // -Y
    };

    const FACE_SHADE = {
        up: 1.00,
        north: 0.90,
        east: 0.84,
        south: 0.80,
        west: 0.76,
        down: 0.64,
    };

    function cubeCorners(from, to, inflate) {
        const inf = Number(inflate) || 0;
        const x1 = Math.min(Number(from[0]), Number(to[0])) - inf;
        const y1 = Math.min(Number(from[1]), Number(to[1])) - inf;
        const z1 = Math.min(Number(from[2]), Number(to[2])) - inf;
        const x2 = Math.max(Number(from[0]), Number(to[0])) + inf;
        const y2 = Math.max(Number(from[1]), Number(to[1])) + inf;
        const z2 = Math.max(Number(from[2]), Number(to[2])) + inf;
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
        if (rotObj.rescale) {
            const c = Math.abs(Math.cos(a));
            const s = c > 0.1 ? (1 / c) : 1;
            if (rotObj.axis === 'x') p = [p[0], p[1] * s, p[2] * s];
            else if (rotObj.axis === 'y') p = [p[0] * s, p[1], p[2] * s];
            else if (rotObj.axis === 'z') p = [p[0] * s, p[1] * s, p[2]];
        }
        return add(p, o);
    }

    function defaultMcUv(fname, from, to) {
        const x1 = Number(from[0]), y1 = Number(from[1]), z1 = Number(from[2]);
        const x2 = Number(to[0]), y2 = Number(to[1]), z2 = Number(to[2]);
        if (fname === 'north') return [16 - x2, 16 - y2, 16 - x1, 16 - y1];
        if (fname === 'south') return [x1, 16 - y2, x2, 16 - y1];
        if (fname === 'west') return [z1, 16 - y2, z2, 16 - y1];
        if (fname === 'east') return [16 - z2, 16 - y2, 16 - z1, 16 - y1];
        return [x1, z1, x2, z2];
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

    function hexToRgbNorm(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
        if (!m) return [0.42, 0.51, 0.71];
        const v = parseInt(m[1], 16);
        return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    }

    /* ───────────── Shared Offscreen WebGL Pipeline ───────────── */

    let glState = null;

    function ensureGl() {
        if (glState !== null) return glState;
        const cv = document.createElement('canvas');
        cv.width = 128;
        cv.height = 128;
        const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true })
            || cv.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
        if (!gl) { glState = false; return false; }

        const vsSrc = `
            attribute vec3 aPos;
            attribute vec2 aUv;
            attribute float aShade;
            varying vec2 vUv;
            varying float vShade;
            void main() {
                gl_Position = vec4(aPos, 1.0);
                vUv = aUv;
                vShade = aShade;
            }
        `;
        const fsSrc = `
            precision mediump float;
            uniform sampler2D uTex;
            uniform vec3 uTint;
            uniform float uUseTex;
            varying vec2 vUv;
            varying float vShade;
            void main() {
                vec4 base = uUseTex > 0.5 ? texture2D(uTex, vUv) : vec4(uTint, 1.0);
                if (base.a < 0.1) discard;
                gl_FragColor = vec4(base.rgb * vShade, base.a);
            }
        `;

        const compile = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            return sh;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
        gl.linkProgram(prog);

        const buf = gl.createBuffer();
        const solidTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, solidTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

        glState = {
            cv, gl, prog, buf, solidTex,
            texCache: new WeakMap(),
            aPos: gl.getAttribLocation(prog, 'aPos'),
            aUv: gl.getAttribLocation(prog, 'aUv'),
            aShade: gl.getAttribLocation(prog, 'aShade'),
            uTex: gl.getUniformLocation(prog, 'uTex'),
            uTint: gl.getUniformLocation(prog, 'uTint'),
            uUseTex: gl.getUniformLocation(prog, 'uUseTex'),
        };
        return glState;
    }

    function getGlTex(st, img) {
        if (!img) return st.solidTex;
        let tex = st.texCache.get(img);
        if (tex) return tex;
        const { gl } = st;
        tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        st.texCache.set(img, tex);
        return tex;
    }

    function faceUvCorners(fdata) {
        const { u1, v1, u2, v2, rot } = fdata;
        // Quad order is [BL, BR, TR, TL]; image row 0 is v=0 (top), row H is v=1 (bottom)
        let uvs = [
            [u1, v2], // BL
            [u2, v2], // BR
            [u2, v1], // TR
            [u1, v1], // TL
        ];
        const rsteps = ((Math.round((Number(rot) || 0) / 90) % 4) + 4) % 4;
        for (let k = 0; k < rsteps; k++) {
            uvs = [uvs[1], uvs[2], uvs[3], uvs[0]];
        }
        return uvs;
    }

    function shouldSkipThinBackface(fname, from, to) {
        if (fname === 'north' || fname === 'west' || fname === 'down') return false;
        const dx = Math.abs(to[0] - from[0]);
        const dy = Math.abs(to[1] - from[1]);
        const dz = Math.abs(to[2] - from[2]);
        if (fname === 'south' && dz < 1e-4) return true;
        if (fname === 'east' && dx < 1e-4) return true;
        if (fname === 'up' && dy < 1e-4) return true;
        return false;
    }

    function drawCubeListWebGL(ctx, width, height, cubes, opts) {
        const st = ensureGl();
        if (!st) return false;
        const { gl, cv } = st;
        const W = Math.max(16, Math.min(512, Math.round(width)));
        const H = Math.max(16, Math.min(512, Math.round(height)));
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }

        const yaw = ((opts && opts.yaw != null) ? Number(opts.yaw) : 0) * DEG;
        const pitch = ((opts && opts.pitch != null) ? Number(opts.pitch) : 0) * DEG;
        const roll = ((opts && opts.roll != null) ? Number(opts.roll) : 0) * DEG;

        const viewProj = (p) => {
            let v = p;
            if (roll) v = rotZ(v, roll);
            if (yaw) v = rotY(v, yaw);
            if (pitch) v = rotX(v, pitch);
            return v;
        };

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        const projected = [];

        for (const cube of cubes) {
            const pts = cube.corners.map(viewProj);
            for (const p of pts) {
                if (p[0] < minX) minX = p[0];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[1] > maxY) maxY = p[1];
                if (p[2] < minZ) minZ = p[2];
                if (p[2] > maxZ) maxZ = p[2];
            }
            projected.push({ cube, pts });
        }

        ctx.clearRect(0, 0, width, height);
        if (!projected.length || !Number.isFinite(minX)) return false;

        const spanX = Math.max(1e-3, maxX - minX);
        const spanY = Math.max(1e-3, maxY - minY);
        const spanZ = Math.max(1e-3, maxZ - minZ);
        const pad = 0.88;
        const scale = Math.min((W * pad) / spanX, (H * pad) / spanY);
        const midX = (minX + maxX) * 0.5;
        const midY = (minY + maxY) * 0.5;
        const midZ = (minZ + maxZ) * 0.5;

        const toNdc = (p) => [
            ((p[0] - midX) * scale) / (W * 0.5),
            ((p[1] - midY) * scale) / (H * 0.5),
            -((p[2] - midZ) / spanZ) * 1.5, // closer (+Z camera) -> smaller NDC Z (-0.75)
        ];

        // Batch triangles by (img || solidColorKey)
        const batches = new Map();
        const getBatch = (img, colorHex) => {
            const key = img || ('c:' + (colorHex || '#6a82b5'));
            let b = batches.get(key);
            if (!b) {
                b = { img: img || null, tint: hexToRgbNorm(colorHex), verts: [] };
                batches.set(key, b);
            }
            return b;
        };

        for (const { cube, pts } of projected) {
            const faces = cube.faces || {};
            for (const [fname, fdata] of Object.entries(faces)) {
                const idx = FACE_CORNERS[fname];
                if (!idx || !fdata) continue;
                if (cube.from && cube.to && shouldSkipThinBackface(fname, cube.from, cube.to) && faces[oppositeFace(fname)]) {
                    continue;
                }
                const q = idx.map(k => toNdc(pts[k]));
                const uvs = faceUvCorners(fdata);
                const shade = FACE_SHADE[fname] || 0.85;
                const b = getBatch(fdata.img, cube.color);
                const v = b.verts;
                const triIdx = [0, 1, 2, 0, 2, 3];
                for (let t = 0; t < 6; t++) {
                    const ci = triIdx[t];
                    v.push(q[ci][0], q[ci][1], q[ci][2], uvs[ci][0], uvs[ci][1], shade);
                }
            }
        }

        if (!batches.size) return false;

        gl.viewport(0, 0, W, H);
        gl.clearColor(0, 0, 0, 0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(st.prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);

        const stride = 24; // 6 floats * 4 bytes
        gl.enableVertexAttribArray(st.aPos);
        gl.vertexAttribPointer(st.aPos, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(st.aUv);
        gl.vertexAttribPointer(st.aUv, 2, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(st.aShade);
        gl.vertexAttribPointer(st.aShade, 1, gl.FLOAT, false, stride, 20);
        gl.uniform1i(st.uTex, 0);
        gl.activeTexture(gl.TEXTURE0);

        for (const b of batches.values()) {
            if (!b.verts.length) continue;
            const arr = new Float32Array(b.verts);
            gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
            if (b.img) {
                gl.bindTexture(gl.TEXTURE_2D, getGlTex(st, b.img));
                gl.uniform1f(st.uUseTex, 1.0);
                gl.uniform3f(st.uTint, 1, 1, 1);
            } else {
                gl.bindTexture(gl.TEXTURE_2D, st.solidTex);
                gl.uniform1f(st.uUseTex, 0.0);
                gl.uniform3f(st.uTint, b.tint[0], b.tint[1], b.tint[2]);
            }
            gl.drawArrays(gl.TRIANGLES, 0, b.verts.length / 6);
        }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cv, 0, 0, width, height);
        return true;
    }

    function oppositeFace(f) {
        return { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' }[f] || f;
    }

    /* ───────────── Blockbench Outliner Bone Hierarchy ───────────── */

    function buildBbHierarchy(model) {
        const groupMeta = new Map();
        if (Array.isArray(model.groups)) {
            for (const g of model.groups) {
                if (g && g.uuid) groupMeta.set(String(g.uuid), g);
            }
        }
        const boneChainByUuid = new Map();
        const hiddenUuids = new Set();

        const walk = (nodes, ancestors, parentHidden) => {
            if (!Array.isArray(nodes)) return;
            for (const node of nodes) {
                if (!node) continue;
                if (typeof node === 'string') {
                    boneChainByUuid.set(node, ancestors);
                    if (parentHidden) hiddenUuids.add(node);
                    continue;
                }
                const uuid = node.uuid ? String(node.uuid) : null;
                if (typeof node === 'object' && !Array.isArray(node.children)) {
                    if (uuid) {
                        boneChainByUuid.set(uuid, ancestors);
                        if (parentHidden) hiddenUuids.add(uuid);
                    }
                    continue;
                }
                const meta = (uuid && groupMeta.get(uuid)) ? Object.assign({}, groupMeta.get(uuid), node) : node;
                const gName = String(meta.name || '');
                const isHidden = parentHidden
                    || meta.visibility === false
                    || meta.export === false
                    || HELPER_NAME_RE.test(gName);
                const bone = {
                    origin: Array.isArray(meta.origin) ? meta.origin : [0, 0, 0],
                    rotation: Array.isArray(meta.rotation) ? meta.rotation : [0, 0, 0],
                };
                const nextAncestors = [bone].concat(ancestors); // inner-most parent first, up to root
                walk(node.children, nextAncestors, isHidden);
            }
        };

        walk(model.outliner, [], false);
        return { boneChainByUuid, hiddenUuids };
    }

    /* ───────────── Main Model Entry Points ───────────── */

    function mcGuiTransform(pt, gui, extraAngleDeg) {
        let p = sub(pt, [8, 8, 8]);
        const g = gui && typeof gui === 'object' ? gui : null;
        if (g) {
            if (Array.isArray(g.scale) && g.scale.length >= 3) {
                p = [p[0] * (Number(g.scale[0]) || 1), p[1] * (Number(g.scale[1]) || 1), p[2] * (Number(g.scale[2]) || 1)];
            }
            if (Array.isArray(g.rotation) && g.rotation.length >= 3) {
                p = rotZ(p, (Number(g.rotation[2]) || 0) * DEG);
                p = rotY(p, (Number(g.rotation[1]) || 0) * DEG);
                p = rotX(p, (Number(g.rotation[0]) || 0) * DEG);
            }
        }
        if (extraAngleDeg) {
            p = rotY(p, Number(extraAngleDeg) * DEG);
        }
        return p;
    }

    async function drawModelToCanvas(model, canvas, opts) {
        if (!model || !canvas) return false;
        const ctx = canvas.getContext('2d');
        const W = canvas.width || 64, H = canvas.height || 64;
        const o = opts || {};

        if (model.kind === 'mc_json') {
            if ((!Array.isArray(model.elements) || !model.elements.length) && model.flatBytesB64) {
                const img = await loadImg('data:image/png;base64,' + model.flatBytesB64);
                if (!img) return false;
                const fw = img.width;
                const fh = (img.height >= fw * 2 && img.height % fw === 0) ? fw : img.height;
                ctx.clearRect(0, 0, W, H);
                ctx.imageSmoothingEnabled = false;
                const s = Math.min((W * 0.88) / Math.max(1, fw), (H * 0.88) / Math.max(1, fh));
                const dw = fw * s, dh = fh * s;
                ctx.drawImage(img, 0, 0, fw, fh, (W - dw) * 0.5, (H - dh) * 0.5, dw, dh);
                return true;
            }
            const texMap = model.textures || {};
            const loadedImgs = new Map();
            for (const val of Object.values(texMap)) {
                if (typeof val === 'string' && val.startsWith('data:')) {
                    loadedImgs.set(val, await loadImg(val));
                }
            }
            const hasGui = !!(model.gui && typeof model.gui === 'object' && o.useGui !== false);
            const guiExtraAngle = o.useGui ? (Number(o.angle) || 0) : ((o.angle != null) ? Number(o.angle) : 0);

            const cubes = (model.elements || []).map(el => {
                const from = el.from || [0, 0, 0];
                const to = el.to || [16, 16, 16];
                const rawCorners = cubeCorners(from, to, 0);
                let corners = rawCorners.map(p => applyMcRotation(p, el.rotation));
                if (hasGui) {
                    corners = corners.map(p => mcGuiTransform(p, model.gui, guiExtraAngle));
                } else {
                    corners = corners.map(p => sub(p, [8, 8, 8]));
                }
                const faces = {};
                for (const fname of Object.keys(FACE_CORNERS)) {
                    const f = el.faces && el.faces[fname];
                    if (!f) continue;
                    const src = resolveMcTex(texMap, f.texture);
                    const img = src ? (loadedImgs.get(src) || null) : null;
                    const uv = Array.isArray(f.uv) && f.uv.length >= 4 ? f.uv : defaultMcUv(fname, from, to);
                    let vScale = 1.0;
                    if (img && img.height >= img.width * 2 && img.height % img.width === 0) {
                        vScale = img.width / img.height;
                    }
                    faces[fname] = {
                        img,
                        u1: Number(uv[0]) / 16,
                        v1: (Number(uv[1]) / 16) * vScale,
                        u2: Number(uv[2]) / 16,
                        v2: (Number(uv[3]) / 16) * vScale,
                        rot: f.rotation || 0,
                    };
                }
                return { corners, faces, from, to };
            });

            const camOpts = hasGui
                ? { yaw: 0, pitch: 0 }
                : { yaw: (o.angle != null ? Number(o.angle) : 45), pitch: (o.pitch != null ? Number(o.pitch) : 26) };
            return drawCubeListWebGL(ctx, W, H, cubes, camOpts);
        }

        // Blockbench .bbmodel
        const defaultResW = Math.max(1, Number((model.resolution && model.resolution.width) || 16));
        const defaultResH = Math.max(1, Number((model.resolution && model.resolution.height) || 16));
        const texList = Array.isArray(model.textures) ? model.textures : [];
        const texByKey = new Map();
        let fallbackEntry = null;
        for (let i = 0; i < texList.length; i++) {
            const tx = texList[i];
            const img = tx && tx.source ? await loadImg(tx.source) : null;
            const entry = {
                img,
                uvW: Math.max(1, Number((tx && tx.uv_width) || defaultResW)),
                uvH: Math.max(1, Number((tx && tx.uv_height) || defaultResH)),
                frameH: tx && tx.frame_height ? Number(tx.frame_height) : 0,
            };
            if (!fallbackEntry && img) fallbackEntry = entry;
            texByKey.set(String(i), entry);
            if (tx && tx.id != null) texByKey.set(String(tx.id), entry);
            if (tx && tx.uuid) texByKey.set(String(tx.uuid), entry);
        }

        const { boneChainByUuid, hiddenUuids } = buildBbHierarchy(model);
        const cubes = [];
        for (const el of (model.elements || [])) {
            if (!el || el.visibility === false || el.export === false) continue;
            if (el.type && el.type !== 'cube') continue;
            if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
            const uuid = el.uuid ? String(el.uuid) : null;
            if ((uuid && hiddenUuids.has(uuid)) || HELPER_NAME_RE.test(String(el.name || ''))) continue;

            const rawCorners = cubeCorners(el.from, el.to, el.inflate);
            const boneChain = uuid ? (boneChainByUuid.get(uuid) || []) : [];
            const corners = rawCorners.map(pt => {
                let p = applyBbRotation(pt, el.origin, el.rotation);
                for (let bi = 0; bi < boneChain.length; bi++) {
                    p = applyBbRotation(p, boneChain[bi].origin, boneChain[bi].rotation);
                }
                return p;
            });

            const faces = {};
            for (const fname of Object.keys(FACE_CORNERS)) {
                const f = el.faces && el.faces[fname];
                if (!f || f.texture === null) continue;
                const tEntry = (f.texture === undefined ? fallbackEntry : (texByKey.get(String(f.texture)) || fallbackEntry));
                const img = tEntry ? tEntry.img : null;
                const uvW = tEntry ? tEntry.uvW : defaultResW;
                const uvH = tEntry ? tEntry.uvH : defaultResH;
                const uv = Array.isArray(f.uv) && f.uv.length >= 4 ? f.uv : [0, 0, uvW, uvH];
                let vScale = 1.0;
                if (img && img.height > img.width && img.height % img.width === 0 && uvH <= img.width) {
                    vScale = img.width / img.height;
                } else if (tEntry && tEntry.frameH > 0 && img && img.height > tEntry.frameH) {
                    vScale = tEntry.frameH / img.height;
                }
                faces[fname] = {
                    img,
                    u1: Number(uv[0]) / uvW,
                    v1: (Number(uv[1]) / uvH) * vScale,
                    u2: Number(uv[2]) / uvW,
                    v2: (Number(uv[3]) / uvH) * vScale,
                    rot: f.rotation || 0,
                };
            }
            cubes.push({ corners, faces, from: el.from, to: el.to, color: el.color || '#6a82b5' });
        }

        const camAngle = o.angle != null ? Number(o.angle) : 22;
        const camPitch = o.pitch != null ? Number(o.pitch) : 12;
        // Blockbench models face -Z (North), so 180 + camAngle faces the front of the model upright
        return drawCubeListWebGL(ctx, W, H, cubes, { yaw: 180 + camAngle, pitch: camPitch });
    }

    async function renderThumbnail(model, size, opts) {
        const s = Math.max(24, Number(size) || 96);
        const cv = document.createElement('canvas');
        cv.width = s;
        cv.height = s;
        const ok = await drawModelToCanvas(model, cv, opts);
        return ok ? cv.toDataURL('image/png') : null;
    }

    GS.BbModel = { VERSION: 2, renderThumbnail, drawToCanvas: drawModelToCanvas };
})();
