/**
 * webgl.js — Hero background grid deformation effect
 *
 * Three.js + GPUComputationRenderer port of:
 *   J0SUKE/grid-deformation-effect (Codrops tutorial)
 *
 * Loaded as <script type="module"> from index.html.
 * The importmap in index.html resolves the bare "three" specifier.
 */

import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const heroImg = document.getElementById('hero-img');
const canvas  = document.getElementById('hero-canvas');

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ── Scene + Camera ────────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 10;
scene.add(camera);

function viewSize() {
    const h = 2 * 10 * Math.tan((75 * Math.PI) / 360);
    return { w: h * camera.aspect, h };
}

// ── Vertex shader ─────────────────────────────────────────────────────────────
const vertShader = /* glsl */`
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// ── Fragment shader — object-fit:cover UVs + UV warp + RGB chromatic aberration
const fragShader = /* glsl */`
    uniform sampler2D uTexture;
    uniform sampler2D uGrid;
    uniform vec2 uCon;
    uniform vec2 uImg;
    varying vec2 vUv;

    vec2 coverUvs(vec2 iR, vec2 cR) {
        vec2 r = vec2(
            min((cR.x / cR.y) / (iR.x / iR.y), 1.0),
            min((cR.y / cR.x) / (iR.y / iR.x), 1.0)
        );
        return vUv * r + (1.0 - r) * 0.5;
    }

    void main() {
        vec2 imgUv    = coverUvs(uImg, uCon);
        vec2 sqUv     = coverUvs(vec2(1.0), uCon);
        vec4 disp     = texture2D(uGrid, sqUv);
        vec2 finalUvs = imgUv - disp.rg * 0.01;
        vec4 color    = texture2D(uTexture, finalUvs);

        vec2  shift = disp.rg * 0.001;
        float str   = clamp(length(disp.rg), 0.0, 2.0);

        color.r = texture2D(uTexture, finalUvs + shift * (1.0 + str * 0.25)).r;
        color.g = texture2D(uTexture, finalUvs + shift * (1.0 + str * 2.00)).g;
        color.b = texture2D(uTexture, finalUvs + shift * (1.0 + str * 1.50)).b;

        gl_FragColor = color;
    }
`;

// ── GPGPU shader — ping-pong displacement field (runs on GPU each frame) ──────
// GPUComputationRenderer auto-injects: resolution, uGrid (previous frame)
const gpgpuShader = /* glsl */`
    uniform vec2  uMouse;
    uniform vec2  uDeltaMouse;
    uniform float uMouseMove;
    uniform float uRelaxation;

    void main() {
        vec2 uv    = gl_FragCoord.xy / resolution.xy;
        vec4 color = texture(uGrid, uv);

        float dist = distance(uv, uMouse);
        dist = 1.0 - smoothstep(0.0, 0.22, dist);

        color.rg += uDeltaMouse * dist;
        color.rg *= min(uRelaxation, uMouseMove);

        gl_FragColor = color;
    }
`;

// ── Material + fullscreen plane ───────────────────────────────────────────────
const mat = new THREE.ShaderMaterial({
    vertexShader: vertShader,
    fragmentShader: fragShader,
    uniforms: {
        uTexture: { value: null },
        uGrid:    { value: null },
        uCon:     { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uImg:     { value: new THREE.Vector2(1, 1) },
    },
});

const { w, h } = viewSize();
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
scene.add(mesh);

// ── Load hero background texture ──────────────────────────────────────────────
new THREE.TextureLoader().load('media/bg.png', tex => {
    mat.uniforms.uTexture.value = tex;
    mat.uniforms.uImg.value.set(tex.image.naturalWidth, tex.image.naturalHeight);
    heroImg.style.opacity = '0';
});

// ── GPGPU — displacement field ────────────────────────────────────────────────
// SIZE = grid resolution. Larger = smaller, finer deformation boxes.
const SIZE  = 64;
const gpgpu = new GPUComputationRenderer(SIZE, SIZE, renderer);
const initTex  = gpgpu.createTexture();
const variable = gpgpu.addVariable('uGrid', gpgpuShader, initTex);

variable.material.uniforms.uMouse      = { value: new THREE.Vector2(0.5, 0.5) };
variable.material.uniforms.uDeltaMouse = { value: new THREE.Vector2(0, 0) };
variable.material.uniforms.uMouseMove  = { value: 0 };
variable.material.uniforms.uRelaxation = { value: 0.965 };

gpgpu.setVariableDependencies(variable, [variable]);
const gpErr = gpgpu.init();
if (gpErr) console.error('GPUComputationRenderer:', gpErr);

// ── Mouse → UV coordinates via raycasting ────────────────────────────────────
const raycaster = new THREE.Raycaster();
const ndcMouse  = new THREE.Vector2();

window.addEventListener('mousemove', e => {
    ndcMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    ndcMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(ndcMouse, camera);
    const hits = raycaster.intersectObject(mesh);
    if (hits.length && hits[0].uv) {
        const uv    = hits[0].uv;
        const cur   = variable.material.uniforms.uMouse.value;
        const delta = new THREE.Vector2().subVectors(uv, cur).multiplyScalar(80);

        variable.material.uniforms.uMouseMove.value = 1;
        variable.material.uniforms.uDeltaMouse.value.copy(delta);
        variable.material.uniforms.uMouse.value.copy(uv);
    }
});

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mat.uniforms.uCon.value.set(window.innerWidth, window.innerHeight);
    const { w: nw, h: nh } = viewSize();
    mesh.scale.set(nw / w, nh / h, 1);
});

// ── Render loop ───────────────────────────────────────────────────────────────
(function animate() {
    requestAnimationFrame(animate);
    variable.material.uniforms.uMouseMove.value  *= 0.95;
    variable.material.uniforms.uDeltaMouse.value.multiplyScalar(0.965);
    gpgpu.compute();
    mat.uniforms.uGrid.value = gpgpu.getCurrentRenderTarget(variable).textures[0];
    renderer.render(scene, camera);
})();
