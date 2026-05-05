import { defaultSceneConfig } from './config/sceneConfig';
import { generateMap } from './services/mapService';
import { createSceneRuntime } from './runtime/sceneRuntime';
import { getOwnerProfile } from './config/scentConfig';
import { emitTrailPoint } from './services/scentService';
import type { ScentWorldState } from './types/scent';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const mapData = generateMap(defaultSceneConfig.mapConfig);

// 임시 테스트용 ScentWorldState (실제 Owner 구현 시 교체)
const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };
const runtime = createSceneRuntime(canvas, mapData, scentState);

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();

// ============================================
// 임시 테스트용 Owner 움직임 — scent trail 시각화 확인
// 실제 Owner 구현 시 제거
// ============================================
const cowProfile = getOwnerProfile('cow');
const pigProfile = getOwnerProfile('pig');
let angle = 0;

setInterval(() => {
  angle += 0.02;
  const now = performance.now();

  // Cow: larger circle
  emitTrailPoint(
    scentState,
    'cow-1',
    'cow',
    Math.cos(angle) * 8,
    Math.sin(angle) * 8,
    now,
    cowProfile
  );

  // Pig: smaller, faster circle
  emitTrailPoint(
    scentState,
    'pig-1',
    'pig',
    Math.cos(angle * 1.5) * 4,
    Math.sin(angle * 1.5) * 4,
    now,
    pigProfile
  );
}, 50);
