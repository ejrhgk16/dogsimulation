import { defaultSceneConfig } from './config/sceneConfig';
import { generateMap, isObstacleInFootprint, getHeightAt } from './services/mapService';
import { createSceneRuntime } from './runtime/sceneRuntime';
import type { ScentWorldState } from './types/scent';
import type { OwnerState } from './types/owner';
import { createOwner, moveOwner } from './services/ownerService';
import { emitTrailPoint, emitTrailPointOnMove } from './services/scentService';
import { getOwnerProfile } from './config/scentConfig';
import { OWNER_HEIGHT_OFFSET } from './config/ownerConfig';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const mapData = generateMap(defaultSceneConfig.mapConfig);

const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };

const owner: OwnerState = createOwner('owner-1', 'dog', 0, 0, mapData);

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key));
window.addEventListener('keyup', (e) => keys.delete(e.key));

const runtime = createSceneRuntime(canvas, mapData, scentState, owner);

const debugOverlay = document.createElement('div');
debugOverlay.id = 'debug-camera';
Object.assign(debugOverlay.style, {
  position: 'absolute',
  top: '8px',
  left: '8px',
  color: '#fff',
  background: 'rgba(0,0,0,0.7)',
  padding: '6px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'monospace',
  pointerEvents: 'none',
  zIndex: '1000'
});
app.appendChild(debugOverlay);

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();

let isDragging = false;

canvas.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const intersection = runtime.getMouseGroundIntersection(mouseX, mouseY);
  if (intersection && !isObstacleInFootprint(mapData, intersection.x, intersection.z)) {
    owner.x = intersection.x;
    owner.y = intersection.z;
    owner.height = getHeightAt(mapData, owner.x, owner.y) + OWNER_HEIGHT_OFFSET;
    runtime.updateOwner(owner);
    isDragging = true;
  }
});

canvas.addEventListener('mousemove', (e: MouseEvent) => {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const intersection = runtime.getMouseGroundIntersection(mouseX, mouseY);
  if (intersection && !isObstacleInFootprint(mapData, intersection.x, intersection.z)) {
    owner.x = intersection.x;
    owner.y = intersection.z;
    owner.height = getHeightAt(mapData, owner.x, owner.y) + OWNER_HEIGHT_OFFSET;
    runtime.updateOwner(owner);
  }
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

let lastTime = performance.now();
let lastDebugTime = 0;
function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  moveOwner(owner, keys, dt, mapData);

  const profile = getOwnerProfile(owner.ownerType);
  emitTrailPoint(
    scentState,
    owner.id,
    owner.ownerType,
    owner.x,
    owner.y,
    owner.height,
    dt * 1000, // dt는 초 단위이므로 ms로 변환
    now,
    profile
  );

  emitTrailPointOnMove(
    scentState,
    owner.id,
    owner.ownerType,
    owner.x,
    owner.y,
    owner.height,
    now,
    profile
  );

  runtime.updateOwner(owner);

  if (now - lastDebugTime > 200) {
    lastDebugTime = now;
    const cam = runtime.getCameraState();
    debugOverlay.textContent =
      `cam pos: (${cam.pos.x.toFixed(1)}, ${cam.pos.y.toFixed(1)}, ${cam.pos.z.toFixed(1)}) | ` +
      `target: (${cam.target.x.toFixed(1)}, ${cam.target.y.toFixed(1)}, ${cam.target.z.toFixed(1)})`;
  }

  requestAnimationFrame(animate);
}
animate();
