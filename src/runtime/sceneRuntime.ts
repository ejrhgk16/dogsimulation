import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer
} from 'three';
import type { Dog } from '../types/dog';
import type { SceneConfig } from '../config/sceneConfig';

export interface SceneRuntime {
  resize: () => void;
  start: () => void;
  stop: () => void;
}

export function createSceneRuntime(
  canvas: HTMLCanvasElement,
  config: SceneConfig,
  dog: Dog
): SceneRuntime {
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

  const dogMesh = new Mesh(
    new SphereGeometry(0.55, 32, 24),
    new MeshStandardMaterial({ color: 0xb67b4a, roughness: 0.8, metalness: 0 })
  );
  dogMesh.position.set(dog.position.x, dog.position.y + 0.55, dog.position.z);

  scene.add(ambientLight, directionalLight, ground, dogMesh);

  const clock = new Clock();
  let animationFrameId: number | null = null;

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = () => {
    const elapsed = clock.getElapsedTime();

    dogMesh.rotation.y = elapsed * 0.9;
    dogMesh.position.y = dog.position.y + 0.55 + Math.sin(elapsed * 1.6) * 0.08;

    renderer.render(scene, camera);
    animationFrameId = window.requestAnimationFrame(render);
  };

  const start = () => {
    if (animationFrameId !== null) {
      return;
    }

    clock.start();
    render();
  };

  const stop = () => {
    if (animationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    clock.stop();
  };

  resize();

  return {
    resize,
    start,
    stop
  };
}
