import { defaultSceneConfig } from './config/sceneConfig';
import { generateMap } from './services/mapService';
import { createSceneRuntime } from './runtime/sceneRuntime';
import type { ScentWorldState } from './types/scent';
import type { AnimalState } from './types/animal';
import { createAnimal, moveAnimal } from './services/animalService';
import { emitTrailPoint, emitTrailPointOnMove } from './services/scentService';
import { getAnimalProfile } from './config/scentConfig';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const mapData = generateMap(defaultSceneConfig.mapConfig);

const scentState: ScentWorldState = { trailPoints: [], emitters: new Map() };

const animal: AnimalState = createAnimal('animal-1', 'dog', 0, 0, mapData);

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key));
window.addEventListener('keyup', (e) => keys.delete(e.key));

const runtime = createSceneRuntime(canvas, mapData, scentState, animal);

// Control panel
const controlsPanel = document.createElement('div');
controlsPanel.id = 'controls-panel';
controlsPanel.innerHTML = `
  <fieldset>
    <legend>Visualization</legend>
    <label>
      <input type="checkbox" id="toggle-scent" checked />
      Scent Trail
    </label>
  </fieldset>
`;
app.appendChild(controlsPanel);

const scentCheckbox = controlsPanel.querySelector<HTMLInputElement>('#toggle-scent')!;
scentCheckbox.addEventListener('change', () => {
  runtime.setScentVisible(scentCheckbox.checked);
});

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();

let lastTime = performance.now();
function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  moveAnimal(animal, keys, dt, mapData);

  const profile = getAnimalProfile(animal.animalType);
  emitTrailPoint(
    scentState,
    animal.id,
    animal.animalType,
    animal.x,
    animal.y,
    animal.height,
    dt * 1000, // dt는 초 단위이므로 ms로 변환
    now,
    profile
  );

  emitTrailPointOnMove(
    scentState,
    animal.id,
    animal.animalType,
    animal.x,
    animal.y,
    animal.height,
    now,
    profile
  );

  runtime.updateAnimal(animal);

  requestAnimationFrame(animate);
}
animate();
