import { SceneRuntime } from './runtime/sceneRuntime';
import { ANIMAL_SCALE, ANIMAL_TYPES } from './config/animalConfig';
import {
  getEmitRateMultiplier,
  getScentPointSizeMultiplier,
  getTauDecayMultiplier
} from './config/scentConfig';
import { DEFAULT_TRACKING_PARAMS } from './config/trackingConfig';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const runtime = new SceneRuntime(canvas);
const ALPACA_ID = runtime.alpacaId;
const DOG_ID = runtime.dogId;

const leftPanels = document.createElement('div');
leftPanels.id = 'left-panels';
app.appendChild(leftPanels);

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
      <input type="range" id="scale-slider" min="0.05" max="1" step="0.05" value="0.5" />
      <span class="slider-value" id="scale-value">0.5</span>
    </label>
    <label>
      <span>Rotation</span>
      <input type="range" id="rotation-slider" min="1" max="20" step="0.5" value="8" />
      <span class="slider-value" id="rotation-value">8.0</span>
    </label>
    <label>
      <span>Turn Rate</span>
      <input type="range" id="turn-rate-slider" min="1" max="20" step="0.5" value="8" />
      <span class="slider-value" id="turn-rate-value">8.0</span>
    </label>
    <label>
      <span>TauDecay</span>
      <input type="range" id="tau-decay-slider" min="0.1" max="20.0" step="0.1" value="10" />
      <span class="slider-value" id="tau-decay-value">1.0x</span>
    </label>
    <label>
      <span>PtSize</span>
      <input type="range" id="ptsize-slider" min="0.1" max="5.0" step="0.1" value="3" />
      <span class="slider-value" id="ptsize-value">1.0x</span>
    </label>
    <label>
      <span>EmitRate</span>
      <input type="range" id="emit-rate-slider" min="0.1" max="2.0" step="0.1" value="1.7" />
      <span class="slider-value" id="emit-rate-value">1.7x</span>
    </label>
    <button id="track-btn" type="button">추적 시작</button>
  </fieldset>
`;

leftPanels.appendChild(controlsPanel);

// Visual panel
const visualPanel = document.createElement('div');
visualPanel.id = 'visual-panel';
visualPanel.innerHTML = `
  <fieldset>
    <legend>Visual</legend>
    <label><input type="checkbox" id="vis-heading-arrow" checked /> Est. Heading</label>
    <label><input type="checkbox" id="vis-target-heading-arrow" checked /> Target Heading</label>
    <label><input type="checkbox" id="vis-sensor-fan" checked /> Scent Sensor</label>
    <label><input type="checkbox" id="vis-vision-debug" checked /> Vision Sensor</label>
    <label><input type="checkbox" id="vis-cast-debug" checked /> Cast Sector</label>
    <label><input type="checkbox" id="vis-grid-cells" checked /> Grid Cells</label>
    <label><input type="checkbox" id="vis-scent" checked /> Scent Trail</label>
    <button id="reset-btn" type="button">Reset (Pos+Scent+Camera)</button>
  </fieldset>
`;
leftPanels.appendChild(visualPanel);

const visHeadingArrow = visualPanel.querySelector<HTMLInputElement>('#vis-heading-arrow')!;
visHeadingArrow.addEventListener('change', () => {
  runtime.setHeadingArrowVisible(visHeadingArrow.checked);
});

const visTargetHeadingArrow = visualPanel.querySelector<HTMLInputElement>(
  '#vis-target-heading-arrow'
)!;
visTargetHeadingArrow.addEventListener('change', () => {
  runtime.setTargetHeadingArrowVisible(visTargetHeadingArrow.checked);
});

const visSensorFan = visualPanel.querySelector<HTMLInputElement>('#vis-sensor-fan')!;
visSensorFan.addEventListener('change', () => {
  runtime.setSensorFanVisible(visSensorFan.checked);
});

const visCastDebug = visualPanel.querySelector<HTMLInputElement>('#vis-cast-debug')!;
visCastDebug.addEventListener('change', () => {
  runtime.setCastDebugVisible(visCastDebug.checked);
});

const visVisionDebug = visualPanel.querySelector<HTMLInputElement>('#vis-vision-debug')!;
visVisionDebug.addEventListener('change', () => {
  runtime.setVisionDebugVisible(visVisionDebug.checked);
});

const visGridCells = visualPanel.querySelector<HTMLInputElement>('#vis-grid-cells')!;
visGridCells.addEventListener('change', () => {
  runtime.setGridCellsVisible(visGridCells.checked);
});

const visScent = visualPanel.querySelector<HTMLInputElement>('#vis-scent')!;
visScent.addEventListener('change', () => {
  runtime.setScentVisible(visScent.checked);
});

const resetBtn = visualPanel.querySelector<HTMLButtonElement>('#reset-btn')!;
resetBtn.addEventListener('click', () => {
  runtime.resetPositions();
  runtime.resetScent();
  runtime.resetCamera();
});

const scentCheckbox = controlsPanel.querySelector<HTMLInputElement>('#toggle-scent')!;
scentCheckbox.addEventListener('change', () => {
  runtime.setScentVisible(scentCheckbox.checked);
});

const speedSlider = controlsPanel.querySelector<HTMLInputElement>('#speed-slider')!;
const speedValue = controlsPanel.querySelector<HTMLElement>('#speed-value')!;
speedSlider.addEventListener('input', () => {
  const val = parseFloat(speedSlider.value);
  speedValue.textContent = val.toFixed(1);
  runtime.setPursuedSpeed(ALPACA_ID, val);
});

const scaleSlider = controlsPanel.querySelector<HTMLInputElement>('#scale-slider')!;
const scaleValue = controlsPanel.querySelector<HTMLElement>('#scale-value')!;
scaleSlider.addEventListener('input', () => {
  const val = parseFloat(scaleSlider.value);
  scaleValue.textContent = val.toFixed(2);
  runtime.setAnimalScale(ALPACA_ID, val);
  runtime.setAnimalScale(DOG_ID, val);
});

const rotationSlider = controlsPanel.querySelector<HTMLInputElement>('#rotation-slider')!;
const rotationValue = controlsPanel.querySelector<HTMLElement>('#rotation-value')!;
rotationSlider.addEventListener('input', () => {
  const val = parseFloat(rotationSlider.value);
  rotationValue.textContent = val.toFixed(1);
  runtime.setRotationSpeed(ALPACA_ID, val);
});

const turnRateSlider = controlsPanel.querySelector<HTMLInputElement>('#turn-rate-slider')!;
const turnRateValue = controlsPanel.querySelector<HTMLElement>('#turn-rate-value')!;
turnRateSlider.addEventListener('input', () => {
  const val = parseFloat(turnRateSlider.value);
  turnRateValue.textContent = val.toFixed(1);
  runtime.setTrackTurnRate(val);
});

const tauDecaySlider = controlsPanel.querySelector<HTMLInputElement>('#tau-decay-slider')!;
const tauDecayValue = controlsPanel.querySelector<HTMLElement>('#tau-decay-value')!;
tauDecaySlider.addEventListener('input', () => {
  const val = parseFloat(tauDecaySlider.value);
  tauDecayValue.textContent = val.toFixed(1) + 'x';
  runtime.setScentDecayRate(val);
});

const ptsizeSlider = controlsPanel.querySelector<HTMLInputElement>('#ptsize-slider')!;
const ptsizeValue = controlsPanel.querySelector<HTMLElement>('#ptsize-value')!;
ptsizeSlider.addEventListener('input', () => {
  const val = parseFloat(ptsizeSlider.value);
  ptsizeValue.textContent = val.toFixed(1) + 'x';
  runtime.setScentPointSize(val);
});

const emitRateSlider = controlsPanel.querySelector<HTMLInputElement>('#emit-rate-slider')!;
const emitRateValue = controlsPanel.querySelector<HTMLElement>('#emit-rate-value')!;
emitRateSlider.addEventListener('input', () => {
  const val = parseFloat(emitRateSlider.value);
  emitRateValue.textContent = val.toFixed(1) + 'x';
  runtime.setEmitRate(val);
});

// --- Slider initialization from config defaults ---

// Speed: no config → keep HTML value="5", init display
speedValue.textContent = parseFloat(speedSlider.value).toFixed(1);
runtime.setPursuedSpeed(ALPACA_ID, parseFloat(speedSlider.value));

// Scale: ANIMAL_SCALE
const scaleDefault = String(ANIMAL_SCALE);
scaleSlider.value = scaleDefault;
scaleValue.textContent = ANIMAL_SCALE.toFixed(2);
runtime.setAnimalScale(ALPACA_ID, ANIMAL_SCALE);
runtime.setAnimalScale(DOG_ID, ANIMAL_SCALE);

// Rotation: ANIMAL_TYPES.dog.rotationSpeed
const rotDefault = String(ANIMAL_TYPES.dog.rotationSpeed!);
rotationSlider.value = rotDefault;
rotationValue.textContent = ANIMAL_TYPES.dog.rotationSpeed!.toFixed(1);
runtime.setRotationSpeed(ALPACA_ID, ANIMAL_TYPES.dog.rotationSpeed!);

// Turn Rate: DEFAULT_TRACKING_PARAMS.trackTurnRate
const trDefault = String(DEFAULT_TRACKING_PARAMS.trackTurnRate);
turnRateSlider.value = trDefault;
turnRateValue.textContent = DEFAULT_TRACKING_PARAMS.trackTurnRate.toFixed(1);
runtime.setTrackTurnRate(DEFAULT_TRACKING_PARAMS.trackTurnRate);

// TauDecay: getTauDecayMultiplier()
const tauDefault = getTauDecayMultiplier();
tauDecaySlider.value = String(tauDefault);
tauDecayValue.textContent = tauDefault.toFixed(1) + 'x';
runtime.setScentDecayRate(tauDefault);

// PtSize: getScentPointSizeMultiplier()
const ptsizeDefault = getScentPointSizeMultiplier();
ptsizeSlider.value = String(ptsizeDefault);
ptsizeValue.textContent = ptsizeDefault.toFixed(1) + 'x';
runtime.setScentPointSize(ptsizeDefault);

// EmitRate: getEmitRateMultiplier()
const emitDefault = getEmitRateMultiplier();
emitRateSlider.value = String(emitDefault);
emitRateValue.textContent = emitDefault.toFixed(1) + 'x';
runtime.setEmitRate(emitDefault);

const trackBtn = controlsPanel.querySelector<HTMLButtonElement>('#track-btn')!;
let tracking = false;
trackBtn.addEventListener('click', () => {
  if (!tracking) {
    runtime.startTracking();
    trackBtn.textContent = '추적 중지';
  } else {
    runtime.stopTracking();
    trackBtn.textContent = '추적 시작';
  }
  tracking = !tracking;
});

// Tracking parameters panel
const trackingPanel = document.createElement('div');
trackingPanel.id = 'tracking-panel';
trackingPanel.innerHTML = `
  <fieldset>
    <legend>Tracking Params</legend>
    <label><span>detectThreshold</span><input type="range" id="tp-detectThreshold" min="0.01" max="2" step="0.01" value="0.25" /><span class="slider-value" id="tpv-detectThreshold">0.25</span></label>
    <label><span>tauMemory</span><input type="range" id="tp-tauMemory" min="0.1" max="10" step="0.1" value="3.0" /><span class="slider-value" id="tpv-tauMemory">3.0</span></label>
    <label><span>sigmaBase</span><input type="range" id="tp-sigmaBase" min="0.01" max="0.5" step="0.01" value="0.08" /><span class="slider-value" id="tpv-sigmaBase">0.08</span></label>
    <label><span>sigmaMin</span><input type="range" id="tp-sigmaMin" min="0.01" max="0.5" step="0.01" value="0.05" /><span class="slider-value" id="tpv-sigmaMin">0.05</span></label>
    <label><span>sigmaMax</span><input type="range" id="tp-sigmaMax" min="0.1" max="5" step="0.1" value="1.2" /><span class="slider-value" id="tpv-sigmaMax">1.2</span></label>
    <label><span>lambda</span><input type="range" id="tp-lambda" min="1" max="100" step="1" value="25" /><span class="slider-value" id="tpv-lambda">25</span></label>
    <label><span>xi</span><input type="range" id="tp-xi" min="1" max="200" step="1" value="50" /><span class="slider-value" id="tpv-xi">50</span></label>
    <label><span>kLost</span><input type="range" id="tp-kLost" min="0" max="1" step="0.01" value="0.12" /><span class="slider-value" id="tpv-kLost">0.12</span></label>
    <label><span>kPatch</span><input type="range" id="tp-kPatch" min="0" max="2" step="0.01" value="0.4" /><span class="slider-value" id="tpv-kPatch">0.40</span></label>
    <label><span>initialRadius</span><input type="range" id="tp-initialRadius" min="1" max="50" step="0.5" value="8" /><span class="slider-value" id="tpv-initialRadius">8.0</span></label>
    <label><span>kRadius</span><input type="range" id="tp-kRadius" min="1" max="100" step="0.5" value="20" /><span class="slider-value" id="tpv-kRadius">20.0</span></label>
    <label><span>castAngleMax</span><input type="range" id="tp-castAngleMax" min="0.1" max="3.14" step="0.01" value="1.0" /><span class="slider-value" id="tpv-castAngleMax">1.00</span></label>
    <label><span>castTurnTolerance</span><input type="range" id="tp-castTurnTolerance" min="0.01" max="0.5" step="0.01" value="0.08" /><span class="slider-value" id="tpv-castTurnTolerance">0.08</span></label>
    <label><span>lostRadius</span><input type="range" id="tp-lostRadius" min="10" max="200" step="1" value="80" /><span class="slider-value" id="tpv-lostRadius">80</span></label>
    <label><span>lostTurnRate</span><input type="range" id="tp-lostTurnRate" min="0.1" max="3" step="0.1" value="0.8" /><span class="slider-value" id="tpv-lostTurnRate">0.8</span></label>
    <label><span>surgeDuration</span><input type="range" id="tp-surgeDuration" min="0.1" max="3" step="0.1" value="0.5" /><span class="slider-value" id="tpv-surgeDuration">0.5</span></label>
    <label><span>maxContacts</span><input type="range" id="tp-maxContacts" min="2" max="20" step="1" value="6" /><span class="slider-value" id="tpv-maxContacts">6</span></label>
    <label><span>surgeCastScale</span><input type="range" id="tp-surgeCastThresholdScale" min="0.1" max="1.0" step="0.1" value="0.5" /><span class="slider-value" id="tpv-surgeCastThresholdScale">0.5</span></label>
    <label><span>minSpeed</span><input type="range" id="tp-minSpeed" min="0.5" max="10" step="0.5" value="1" /><span class="slider-value" id="tpv-minSpeed">1.0</span></label>
    <label><span>maxSpeed</span><input type="range" id="tp-maxSpeed" min="1" max="20" step="1" value="5" /><span class="slider-value" id="tpv-maxSpeed">5</span></label>
    <label><span>kSpeedSigma</span><input type="range" id="tp-kSpeedSigma" min="0.1" max="5" step="0.1" value="1.2" /><span class="slider-value" id="tpv-kSpeedSigma">1.2</span></label>
    <label><span>sensorRadius</span><input type="range" id="tp-sensorRadius" min="0.1" max="10" step="0.1" value="3" /><span class="slider-value" id="tpv-sensorRadius">3.0</span></label>
    <label><span>sensorFanAngle</span><input type="range" id="tp-sensorFanAngle" min="10" max="180" step="5" value="110" /><span class="slider-value" id="tpv-sensorFanAngle">110°</span></label>
    <label><span>castLostScale</span><input type="range" id="tp-castLostScale" min="0" max="5" step="0.1" value="0.5" /><span class="slider-value" id="tpv-castLostScale">0.5</span></label>
    <label><span>castFlipMargin</span><input type="range" id="tp-castFlipMargin" min="0.3" max="1.0" step="0.05" value="0.5" /><span class="slider-value" id="tpv-castFlipMargin">0.50</span></label>
    <label><span>castFlipScaleMax</span><input type="range" id="tp-castFlipScaleMax" min="0.3" max="2.0" step="0.1" value="1.7" /><span class="slider-value" id="tpv-castFlipScaleMax">1.7</span></label>
    <label><span>flipRampStart</span><input type="range" id="tp-flipRampStart" min="0.3" max="1.0" step="0.05" value="0.7" /><span class="slider-value" id="tpv-flipRampStart">0.70</span></label>
    <label><span>flipRampStep</span><input type="range" id="tp-flipRampStep" min="0.05" max="0.5" step="0.05" value="0.1" /><span class="slider-value" id="tpv-flipRampStep">0.10</span></label>
    <label><span>flipTurnRate</span><input type="range" id="tp-flipTurnRate" min="2" max="20" step="1" value="8" /><span class="slider-value" id="tpv-flipTurnRate">8</span></label>
    <label><span>visionRange</span><input type="range" id="tp-visionRange" min="1" max="30" step="0.5" value="10" /><span class="slider-value" id="tpv-visionRange">10</span></label>
    <label><span>visionConeAngle</span><input type="range" id="tp-visionConeAngle" min="10" max="120" step="5" value="80" /><span class="slider-value" id="tpv-visionConeAngle">80°</span></label>
  </fieldset>
`;

app.appendChild(trackingPanel);
const tpKeys = [
  'sensorRadius',
  'sensorFanAngle',
  'detectThreshold',
  'tauMemory',
  'sigmaBase',
  'sigmaMin',
  'sigmaMax',
  'lambda',
  'xi',
  'kLost',
  'kPatch',
  'initialRadius',
  'kRadius',
  'castAngleMax',
  'castTurnTolerance',
  'lostRadius',
  'lostTurnRate',
  'surgeDuration',
  'maxContacts',
  'surgeCastThresholdScale',
  'minSpeed',
  'maxSpeed',
  'kSpeedSigma',
  'castLostScale',
  'castFlipMargin',
  'castFlipScaleMax',
  'flipRampStart',
  'flipRampStep',
  'flipTurnRate',
  'visionRange',
  'visionConeAngle'
] as const;

function formatTp(value: number, key?: string): string {
  if (key === 'visionConeAngle') return Math.round(((value * 180) / Math.PI) * 2) + '°';
  if (key === 'sensorFanAngle') return Math.round((value * 180) / Math.PI) + '°';
  if (Number.isInteger(value)) return String(value);
  if (value < 0.1 || value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

// Initialize slider values from DEFAULT_TRACKING_PARAMS (single source of truth)
for (const key of tpKeys) {
  const slider = trackingPanel.querySelector<HTMLInputElement>(`#tp-${key}`)!;
  const display = trackingPanel.querySelector<HTMLElement>(`#tpv-${key}`)!;
  const defaultValue = DEFAULT_TRACKING_PARAMS[key as keyof typeof DEFAULT_TRACKING_PARAMS];

  if (key === 'visionConeAngle') {
    // Config stores half-angle in radians, slider shows total cone angle in degrees
    const deg = Math.round(((defaultValue * 180) / Math.PI) * 2);
    slider.value = String(deg);
    display.textContent = deg + '°';
  } else if (key === 'sensorFanAngle') {
    // Config stores total angle in radians, slider shows degrees
    const deg = Math.round((defaultValue * 180) / Math.PI);
    slider.value = String(deg);
    display.textContent = deg + '°';
  } else {
    slider.value = String(defaultValue);
    display.textContent = formatTp(defaultValue);
  }
}

for (const key of tpKeys) {
  const slider = trackingPanel.querySelector<HTMLInputElement>(`#tp-${key}`)!;
  const display = trackingPanel.querySelector<HTMLElement>(`#tpv-${key}`)!;
  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    if (key === 'visionConeAngle') {
      // Slider shows total degrees, config stores half-angle radians
      const halfRad = ((val / 2) * Math.PI) / 180;
      display.textContent = formatTp(halfRad, key);
      runtime.setTrackingParam(key, halfRad);
    } else if (key === 'sensorFanAngle') {
      const rad = (val * Math.PI) / 180;
      display.textContent = formatTp(rad, key);
      runtime.setTrackingParam(key, rad);
    } else {
      display.textContent = formatTp(val);
      runtime.setTrackingParam(key, val);
    }
  });
}

// Debug values panel
const debugPanel = document.createElement('div');
debugPanel.id = 'debug-panel';
debugPanel.innerHTML = `
  <fieldset>
    <legend>Debug Live</legend>
    <div class="debug-row"><span>state</span><span id="dv-state">-</span></div>
    <div class="debug-row"><span>sigma</span><span id="dv-sigma">-</span></div>
    <div class="debug-row"><span>estHeading</span><span id="dv-estimatedHeading">-</span></div>
    <div class="debug-row"><span>tgtHeading</span><span id="dv-targetHeading">-</span></div>
    <div class="debug-row"><span>searchR</span><span id="dv-searchRadius">-</span></div>
    <div class="debug-row"><span>lostTime</span><span id="dv-lostTime">-</span></div>
    <div class="debug-row"><span>trailSig</span><span id="dv-lastTrailSignal">-</span></div>
    <div class="debug-row"><span>L</span><span id="dv-lastContactDistance">-</span></div>
    <div class="debug-row"><span>xi</span><span id="dv-curvatureRadius">-</span></div>
    <div class="debug-row"><span>castSide</span><span id="dv-castSide">-</span></div>
    <div class="debug-row"><span>flipScale</span><span id="dv-flipScale">-</span></div>
    <div class="debug-row"><span>speed</span><span id="dv-currentSpeed">-</span></div>
    <div class="debug-row"><span>contacts</span><span id="dv-contactsCount">-</span></div>
    <div class="debug-row"><span>x</span><span id="dv-x">-</span></div>
    <div class="debug-row"><span>y</span><span id="dv-y">-</span></div>
    <div class="debug-row"><span>height</span><span id="dv-height">-</span></div>
  </fieldset>
`;
app.appendChild(debugPanel);

const debugKeys = [
  'state',
  'sigma',
  'estimatedHeading',
  'targetHeading',
  'searchRadius',
  'lostTime',
  'lastTrailSignal',
  'lastContactDistance',
  'curvatureRadius',
  'castSide',
  'flipScale',
  'currentSpeed',
  'contactsCount',
  'x',
  'y',
  'height'
] as const;

function formatDebug(value: number | string): string {
  if (typeof value === 'string') return value;
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) < 0.001) return '0';
  return value.toFixed(3);
}

setInterval(() => {
  const states = runtime.getPursuerStates();
  if (states.length === 0) return;
  const s = states[0];
  for (const key of debugKeys) {
    const el = debugPanel.querySelector<HTMLElement>(`#dv-${key}`);
    if (el) {
      const val = s[key as keyof typeof s];
      el.textContent =
        key === 'flipScale' ? (val as number).toFixed(2) : formatDebug(val as number | string);
    }
  }
}, 250);

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();
