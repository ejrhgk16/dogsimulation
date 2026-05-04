import { defaultSceneConfig } from './config/sceneConfig';
import { createDog } from './services/dogService';
import { createSceneRuntime } from './runtime/sceneRuntime';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const statusText = document.querySelector<HTMLElement>('#status-text');
if (!statusText) throw new Error('Missing #status-text element.');

const startButton = document.querySelector<HTMLButtonElement>('#start-btn');
if (!startButton) throw new Error('Missing #start-btn element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const dog = createDog(
  'dog-1',
  'Buddy',
  defaultSceneConfig.initialDogPosition,
  defaultSceneConfig.initialDogSpeed
);

const runtime = createSceneRuntime(canvas, defaultSceneConfig, dog);

let isRunning = false;

const setRunningState = (running: boolean) => {
  isRunning = running;
  statusText.textContent = running ? '실행 중' : '대기 중';
  startButton.textContent = running ? '정지' : '시작';
};

const start = () => {
  if (isRunning) {
    return;
  }

  runtime.start();
  setRunningState(true);
};

const stop = () => {
  if (!isRunning) {
    return;
  }

  runtime.stop();
  setRunningState(false);
};

startButton.addEventListener('click', () => {
  if (isRunning) {
    stop();
    return;
  }

  start();
});

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
start();
