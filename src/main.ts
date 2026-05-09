import { defaultSceneConfig } from './config/sceneConfig';
import { generateMap } from './services/mapService';
import { createSceneRuntime } from './runtime/sceneRuntime';
import type { ScentWorldState } from './types/scent';
import type { AnimalState } from './types/animal';
import { createAnimal, moveAnimal } from './services/animalService';
import { emitTrailPoint, emitTrailPointOnMove } from './services/scentService';
import { getAnimalProfile } from './config/scentConfig';
import { setAnimalSpeed } from './config/animalConfig';

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

// Head animation keys
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case '1':
      runtime.playAnimation('HeadDown');
      break;
    case '2':
      runtime.playAnimation('HeadBobbing');
      break;
    case '3':
      runtime.playAnimation('HeadRaise');
      break;
  }
});

const runtime = createSceneRuntime(canvas, mapData, scentState, animal);

// Control panel
const controlsPanel = document.createElement('div');
controlsPanel.id = 'controls-panel';
controlsPanel.innerHTML = `
  <fieldset>
    <legend>Set</legend>
    <label>
      <input type="checkbox" id="toggle-scent" checked />
      Scent Trail
    </label>
    <label>
      <span>Speed</span>
      <input type="range" id="speed-slider" min="1" max="20" step="0.5" value="5" />
      <span class="slider-value" id="speed-value">5.0</span>
    </label>
    <label>
      <span>Scale</span>
      <input type="range" id="scale-slider" min="0.05" max="1" step="0.05" value="0.2" />
      <span class="slider-value" id="scale-value">0.2</span>
    </label>
    <label>
      <span>Rotation</span>
      <input type="range" id="rotation-slider" min="1" max="20" step="0.5" value="8" />
      <span class="slider-value" id="rotation-value">8.0</span>
    </label>
    <label>
      <span>TauDecay</span>
      <input type="range" id="tau-decay-slider" min="0.1" max="20.0" step="0.1" value="1.0" />
      <span class="slider-value" id="tau-decay-value">1.0x</span>
    </label>
    <label>
      <span>EmitRate</span>
      <input type="range" id="emit-rate-slider" min="0.1" max="2.0" step="0.1" value="1.0" />
      <span class="slider-value" id="emit-rate-value">1.0x</span>
    </label>
  </fieldset>
`;

app.appendChild(controlsPanel);

const scentCheckbox = controlsPanel.querySelector<HTMLInputElement>('#toggle-scent')!;
scentCheckbox.addEventListener('change', () => {
  runtime.setScentVisible(scentCheckbox.checked);
});

const speedSlider = controlsPanel.querySelector<HTMLInputElement>('#speed-slider')!;
const speedValue = controlsPanel.querySelector<HTMLElement>('#speed-value')!;
speedSlider.addEventListener('input', () => {
  const val = parseFloat(speedSlider.value);
  speedValue.textContent = val.toFixed(1);
  setAnimalSpeed(val);
});

const scaleSlider = controlsPanel.querySelector<HTMLInputElement>('#scale-slider')!;
const scaleValue = controlsPanel.querySelector<HTMLElement>('#scale-value')!;
scaleSlider.addEventListener('input', () => {
  const val = parseFloat(scaleSlider.value);
  scaleValue.textContent = val.toFixed(2);
  runtime.setAnimalScale(val);
});

const rotationSlider = controlsPanel.querySelector<HTMLInputElement>('#rotation-slider')!;
const rotationValue = controlsPanel.querySelector<HTMLElement>('#rotation-value')!;
rotationSlider.addEventListener('input', () => {
  const val = parseFloat(rotationSlider.value);
  rotationValue.textContent = val.toFixed(1);
  runtime.setRotationSpeed(val);
});

const tauDecaySlider = controlsPanel.querySelector<HTMLInputElement>('#tau-decay-slider')!;
const tauDecayValue = controlsPanel.querySelector<HTMLElement>('#tau-decay-value')!;
tauDecaySlider.addEventListener('input', () => {
  const val = parseFloat(tauDecaySlider.value);
  tauDecayValue.textContent = val.toFixed(1) + 'x';
  runtime.setScentDecayRate(val);
});

const emitRateSlider = controlsPanel.querySelector<HTMLInputElement>('#emit-rate-slider')!;
const emitRateValue = controlsPanel.querySelector<HTMLElement>('#emit-rate-value')!;
emitRateSlider.addEventListener('input', () => {
  const val = parseFloat(emitRateSlider.value);
  emitRateValue.textContent = val.toFixed(1) + 'x';
  runtime.setEmitRate(val);
});

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();
runtime.setHeadFrameRanges(0, 20, 20, 60, 60, 80);

const prevKeys = new Set<string>();
let lastTime = performance.now();
function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // A/S/D head animation (press once, edge detection)
  if (keys.has('a') && !prevKeys.has('a')) runtime.playAnimation('HeadDown');
  if (keys.has('s') && !prevKeys.has('s')) runtime.playAnimation('HeadBobbing');
  if (keys.has('d') && !prevKeys.has('d')) runtime.playAnimation('HeadRaise');
  prevKeys.clear();
  keys.forEach((k) => prevKeys.add(k));

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
