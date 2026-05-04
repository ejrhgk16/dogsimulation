import { defaultSceneConfig } from './config/sceneConfig';
import { generateMap } from './services/mapService';
import { createSceneRuntime } from './runtime/sceneRuntime';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const mapData = generateMap(defaultSceneConfig.mapConfig);
const runtime = createSceneRuntime(canvas, defaultSceneConfig, mapData);

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();
