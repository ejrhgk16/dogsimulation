import { defaultSceneConfig } from './config/sceneConfig';
import { generateMap } from './services/mapService';
import { createSceneRuntime } from './runtime/sceneRuntime';
import type { ScentWorldState } from './types/scent';
import type { OwnerState } from './types/owner';
import { createOwner, moveOwner } from './services/ownerService';
import { emitTrailPoint } from './services/scentService';
import { getOwnerProfile } from './config/scentConfig';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const mapData = generateMap(defaultSceneConfig.mapConfig);

const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };

const owner: OwnerState = createOwner('owner-1', 'dog', 0, 0);

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key));
window.addEventListener('keyup', (e) => keys.delete(e.key));

const runtime = createSceneRuntime(canvas, mapData, scentState, owner);

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();

let lastTime = performance.now();
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
    owner.directionX,
    owner.directionY,
    now,
    profile
  );

  runtime.updateOwner(owner);

  requestAnimationFrame(animate);
}
animate();
