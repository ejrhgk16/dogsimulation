import { Vector3 } from 'three';
import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface RenderLoopConfig {
  homePosition: Vector3;
  homeTarget: Vector3;
}

export interface RenderLoop {
  start: () => void;
  stop: () => void;
  resize: (width: number, height: number) => void;
  resetCamera: () => void;
  setOnFrame: (callback: ((deltaTime: number, now: number) => void) | null) => void;
}

export function createRenderLoop(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  config: RenderLoopConfig
): RenderLoop {
  const { homePosition, homeTarget } = config;
  let isReturningToHome = false;
  let homeResetDist = 0;
  let shouldResetOnEnd = false;
  let animationFrameId: number | null = null;
  let lastFrameTime = performance.now();
  let onFrame: ((deltaTime: number, now: number) => void) | null = null;

  renderer.domElement.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button === 2) shouldResetOnEnd = true;
  });

  controls.addEventListener('start', () => {
    isReturningToHome = false;
  });
  controls.addEventListener('end', () => {
    if (shouldResetOnEnd) {
      homeResetDist = camera.position.distanceTo(controls.target);
      isReturningToHome = true;
      shouldResetOnEnd = false;
    }
  });

  const resetCamera = (): void => {
    homeResetDist = camera.position.distanceTo(controls.target);
    isReturningToHome = true;
  };

  const resize = (width: number, height: number): void => {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = (): void => {
    if (isReturningToHome) {
      const homeDir = new Vector3().subVectors(homePosition, homeTarget).normalize();
      const idealPos = controls.target.clone().addScaledVector(homeDir, homeResetDist);
      camera.position.lerp(idealPos, 0.03);
      const currentDir = new Vector3().subVectors(camera.position, controls.target).normalize();
      if (currentDir.dot(homeDir) > 0.9999) {
        camera.position.copy(idealPos);
        isReturningToHome = false;
      }
    }

    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    onFrame?.(dt, now);

    controls.update();
    renderer.render(scene, camera);
    animationFrameId = window.requestAnimationFrame(render);
  };

  const start = (): void => {
    if (animationFrameId !== null) return;
    render();
  };

  const stop = (): void => {
    if (animationFrameId === null) return;
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  };

  const setOnFrame = (callback: ((deltaTime: number, now: number) => void) | null): void => {
    onFrame = callback;
  };

  return {
    start,
    stop,
    resize,
    resetCamera,
    setOnFrame
  };
}
