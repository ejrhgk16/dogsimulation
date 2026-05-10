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

const animals: AnimalState[] = [
  createAnimal('dog-1', 'dog', -4, -2, mapData, 5.0),
  createAnimal('alpaca-1', 'alpaca', 2, -2, mapData, 3.0),
  createAnimal('alpaca-2', 'alpaca', 0, 3, mapData, 3.5)
];

let selectedAnimalId = animals[0].id;

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key));
window.addEventListener('keyup', (e) => keys.delete(e.key));

// Head animation keys
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case '1':
      runtime.playAnimation(selectedAnimalId, 'HeadDown');
      break;
    case '2':
      runtime.playAnimation(selectedAnimalId, 'HeadBobbing');
      break;
    case '3':
      runtime.playAnimation(selectedAnimalId, 'HeadRaise');
      break;
  }
});

const runtime = createSceneRuntime(canvas, mapData, scentState, animals);

// Canvas click → pick animal
canvas.addEventListener('click', (e) => {
  const id = runtime.pickAnimal(e.offsetX, e.offsetY);
  if (id) {
    selectedAnimalId = id;
    updateAnimalSelectionUI();
  }
});

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

// Animal selection buttons
const animalSelector = document.createElement('fieldset');
const animalLegend = document.createElement('legend');
animalLegend.textContent = 'Animals';
animalSelector.appendChild(animalLegend);
for (const a of animals) {
  const btn = document.createElement('button');
  btn.textContent = `${a.animalType} (${a.id})`;
  btn.dataset.animalId = a.id;
  btn.addEventListener('click', () => {
    selectedAnimalId = a.id;
    updateAnimalSelectionUI();
  });
  animalSelector.appendChild(btn);
}
controlsPanel.appendChild(animalSelector);

function updateAnimalSelectionUI() {
  for (const btn of animalSelector.querySelectorAll('button')) {
    btn.classList.toggle('selected', btn.dataset.animalId === selectedAnimalId);
  }
}
updateAnimalSelectionUI();

const scentCheckbox = controlsPanel.querySelector<HTMLInputElement>('#toggle-scent')!;
scentCheckbox.addEventListener('change', () => {
  runtime.setScentVisible(scentCheckbox.checked);
});

const speedSlider = controlsPanel.querySelector<HTMLInputElement>('#speed-slider')!;
const speedValue = controlsPanel.querySelector<HTMLElement>('#speed-value')!;
speedSlider.addEventListener('input', () => {
  const val = parseFloat(speedSlider.value);
  speedValue.textContent = val.toFixed(1);
  const animal = animals.find((a) => a.id === selectedAnimalId);
  if (animal) animal.speed = val;
});

const scaleSlider = controlsPanel.querySelector<HTMLInputElement>('#scale-slider')!;
const scaleValue = controlsPanel.querySelector<HTMLElement>('#scale-value')!;
scaleSlider.addEventListener('input', () => {
  const val = parseFloat(scaleSlider.value);
  scaleValue.textContent = val.toFixed(2);
  runtime.setAnimalScale(selectedAnimalId, val);
});

const rotationSlider = controlsPanel.querySelector<HTMLInputElement>('#rotation-slider')!;
const rotationValue = controlsPanel.querySelector<HTMLElement>('#rotation-value')!;
rotationSlider.addEventListener('input', () => {
  const val = parseFloat(rotationSlider.value);
  rotationValue.textContent = val.toFixed(1);
  runtime.setRotationSpeed(selectedAnimalId, val);
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
runtime.setHeadFrameRanges(selectedAnimalId, 0, 20, 20, 60, 60, 80);

const prevKeys = new Set<string>();
let lastTime = performance.now();
function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // A/S/D head animation (press once, edge detection)
  if (keys.has('a') && !prevKeys.has('a')) runtime.playAnimation(selectedAnimalId, 'HeadDown');
  if (keys.has('s') && !prevKeys.has('s')) runtime.playAnimation(selectedAnimalId, 'HeadBobbing');
  if (keys.has('d') && !prevKeys.has('d')) runtime.playAnimation(selectedAnimalId, 'HeadRaise');
  prevKeys.clear();
  keys.forEach((k) => prevKeys.add(k));

  for (const a of animals) {
    moveAnimal(a, keys, dt, mapData);

    const profile = getAnimalProfile(a.animalType);
    emitTrailPoint(
      scentState,
      a.id,
      a.animalType,
      a.x,
      a.y,
      a.height,
      dt * 1000, // dt는 초 단위이므로 ms로 변환
      now,
      profile
    );

    emitTrailPointOnMove(scentState, a.id, a.animalType, a.x, a.y, a.height, now, profile);

    runtime.updateAnimal(a.id, a);
  }

  requestAnimationFrame(animate);
}
animate();
