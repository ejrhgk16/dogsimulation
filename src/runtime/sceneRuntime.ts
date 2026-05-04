import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer
} from 'three';
import type { SceneConfig } from '../config/sceneConfig';

export interface SceneRuntime {
  resize: () => void;
  start: () => void;
  stop: () => void;
}

export function createSceneRuntime(canvas: HTMLCanvasElement, config: SceneConfig): SceneRuntime {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new Scene();
  scene.background = new Color(0xf4efe8);

  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(8, 7, 8);
  camera.lookAt(0, 0.6, 0);

  const ambientLight = new AmbientLight(0xffffff, 1.8);
  const directionalLight = new DirectionalLight(0xfff4ea, 2.2);
  directionalLight.position.set(5, 10, 4);

  const ground = new Mesh(
    new PlaneGeometry(config.groundSize, config.groundSize),
    new MeshStandardMaterial({ color: 0xd7e5dc, side: DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;

  scene.add(ambientLight, directionalLight, ground);

  let animationFrameId: number | null = null;

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = () => {
    renderer.render(scene, camera);
    animationFrameId = window.requestAnimationFrame(render);
  };

  const start = () => {
    if (animationFrameId !== null) {
      return;
    }

    render();
  };

  const stop = () => {
    if (animationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  };

  resize();

  return {
    resize,
    start,
    stop
  };
}
