import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  InstancedMesh,
  LoopOnce,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AnimationAction } from 'three';
import type { MapData, ObstacleShape } from '../types/map';
import type { ScentWorldState } from '../types/scent';
import type { AnimalState } from '../types/animal';
import {
  ANIMAL_PROFILES,
  DEFAULT_SCENT_PARAMS,
  DEFAULT_SCENT_VISUAL_CONFIG
} from '../config/scentConfig';
import { ANIMAL_TYPES, ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import { setTauDecayMultiplier, setEmitRateMultiplier } from '../config/scentConfig';
import { trimExpiredTrails } from '../services/scentService';
import { createScentVisualizer } from './scentVisualizer';
import type { ScentVisualizer } from './scentVisualizer';
import { loadModel } from './modelLoader';
import { createSubClip } from './modelLoader';
import type { LoadedModel } from './modelLoader';

export interface SceneRuntime {
  resize: () => void;
  start: () => void;
  stop: () => void;
  updateScent: (now: number) => void;
  updateAnimal: (animal: AnimalState) => void;
  resetCamera: () => void;
  setScentVisible: (visible: boolean) => void;
  setAnimalScale: (scale: number) => void;
  setRotationSpeed: (radPerSec: number) => void;
  setScentDecayRate: (multiplier: number) => void;
  setEmitRate: (multiplier: number) => void;
  playAnimation: (name: string) => void;
  setHeadFrameRanges: (
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ) => void;
}

function createTerrainGeometry(mapData: MapData): BufferGeometry {
  const { grid, cellSize, width, depth } = mapData;
  const vertexCols = width + 1;
  const vertexRows = depth + 1;

  const vertices: number[] = [];
  for (let row = 0; row < vertexRows; row++) {
    for (let col = 0; col < vertexCols; col++) {
      let h = 0;
      let count = 0;
      if (row > 0 && col > 0) {
        h += grid[row - 1][col - 1].height;
        count++;
      }
      if (row > 0 && col < width) {
        h += grid[row - 1][col].height;
        count++;
      }
      if (row < depth && col > 0) {
        h += grid[row][col - 1].height;
        count++;
      }
      if (row < depth && col < width) {
        h += grid[row][col].height;
        count++;
      }
      h = count > 0 ? h / count : 0;

      const x = col * cellSize - (width * cellSize) / 2;
      const z = row * cellSize - (depth * cellSize) / 2;
      vertices.push(x, h, z);
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < depth; row++) {
    for (let col = 0; col < width; col++) {
      const a = row * vertexCols + col;
      const b = row * vertexCols + col + 1;
      const c = (row + 1) * vertexCols + col;
      const d = (row + 1) * vertexCols + col + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createSceneRuntime(
  canvas: HTMLCanvasElement,
  mapData: MapData,
  scentState?: ScentWorldState,
  animal?: AnimalState
): SceneRuntime {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new Scene();
  scene.background = new Color(0x2a3028);

  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;
  camera.position.set(0, 25, 35);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0, 0);
  controls.mouseButtons = {
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE
  };
  controls.enableZoom = true;
  controls.zoomSpeed = 1.0;

  const homePosition = new Vector3(0, 25, 35);
  const homeTarget = new Vector3(0, 0, 0);
  let isReturningToHome = false;

  let shouldResetOnEnd = false;
  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button === 2) shouldResetOnEnd = true;
  });

  controls.addEventListener('start', () => {
    isReturningToHome = false;
  });
  controls.addEventListener('end', () => {
    if (shouldResetOnEnd) {
      isReturningToHome = true;
      shouldResetOnEnd = false;
    }
  });

  const ambientLight = new AmbientLight(0xffffff, 0.6);
  const directionalLight = new DirectionalLight(0xfff4ea, 1.2);
  directionalLight.position.set(5, 10, 4);

  const terrainGeo = createTerrainGeometry(mapData);
  const terrainMat = new MeshStandardMaterial({ color: 0x4a6b4a });
  const terrainMesh = new Mesh(terrainGeo, terrainMat);

  interface ObstaclePos {
    x: number;
    y: number;
    z: number;
    shape: ObstacleShape | undefined;
  }

  const obstaclePositions: ObstaclePos[] = [];
  for (let row = 0; row < mapData.depth; row++) {
    for (let col = 0; col < mapData.width; col++) {
      const cell = mapData.grid[row][col];
      if (cell.terrain === 'obstacle') {
        const x = col * mapData.cellSize - mapWidth / 2 + mapData.cellSize / 2;
        const z = row * mapData.cellSize - mapDepth / 2 + mapData.cellSize / 2;
        const isShaped = cell.shape === 'L' || cell.shape === 'reverse-L';
        const yOffset = isShaped ? mapData.cellSize * 0.6 : 0.25;
        obstaclePositions.push({ x, y: yOffset, z, shape: cell.shape });
      }
    }
  }

  const shapedPositions = obstaclePositions.filter(
    (p) => p.shape === 'L' || p.shape === 'reverse-L'
  );
  const singlePositions = obstaclePositions.filter((p) => p.shape === 'single' || !p.shape);

  scene.add(ambientLight, directionalLight, terrainMesh);

  if (shapedPositions.length > 0) {
    const geo = new BoxGeometry(
      mapData.cellSize * 0.8,
      mapData.cellSize * 1.2,
      mapData.cellSize * 0.8
    );
    const mat = new MeshStandardMaterial({ color: 0x3d2e1f });
    const mesh = new InstancedMesh(geo, mat, shapedPositions.length);
    const temp = new Object3D();
    shapedPositions.forEach((pos, i) => {
      temp.position.set(pos.x, pos.y, pos.z);
      temp.updateMatrix();
      mesh.setMatrixAt(i, temp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  if (singlePositions.length > 0) {
    const boxGeo = new BoxGeometry(mapData.cellSize * 0.8, 0.5, mapData.cellSize * 0.8);
    const boxMat = new MeshStandardMaterial({ color: 0x5c4a33 });
    const mesh = new InstancedMesh(boxGeo, boxMat, singlePositions.length);
    const temp = new Object3D();
    singlePositions.forEach((pos, i) => {
      temp.position.set(pos.x, pos.y, pos.z);
      temp.updateMatrix();
      mesh.setMatrixAt(i, temp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  // Animal object — fallback box initially, replaced by GLTF model if loaded
  let animalObject: Object3D | null = null;
  let animalLoadedModel: LoadedModel | null = null;
  let animalWalkAction: AnimationAction | null = null;
  let animalIdleAction: AnimationAction | null = null;
  let currentAnimName: string | null = null;
  const headActionsMap: Map<string, AnimationAction> = new Map();
  let currentHeadAction: AnimationAction | null = null;
  let prevAnimalX = animal?.x ?? 0;
  let prevAnimalY = animal?.y ?? 0;
  let lastAnimFrameTime = performance.now();
  const CROSSFADE_DURATION = 0.2;
  let rotationSpeed = 8.0;
  let groundOffset = ANIMAL_HEIGHT_OFFSET;
  let currentAngle = 0;
  let lastRotationTime = performance.now();
  const initialScale = animal ? (ANIMAL_TYPES[animal.animalType]?.scale ?? 0.2) : 0.2;
  let animalScale = initialScale;

  if (animal) {
    const config = ANIMAL_TYPES[animal.animalType];
    const color = config?.color ?? 0xff9933;
    const geo = new BoxGeometry(0.5, 0.5, 0.5);
    const mat = new MeshStandardMaterial({ color });
    const fallbackMesh = new Mesh(geo, mat);
    fallbackMesh.position.set(animal.x, animal.height, animal.y);
    fallbackMesh.scale.set(animalScale, animalScale, animalScale);
    scene.add(fallbackMesh);
    animalObject = fallbackMesh;

    // Attempt to load GLTF model
    const modelPath = config?.modelPath;
    if (modelPath) {
      loadModel(modelPath).then((loaded) => {
        if (loaded) {
          scene.remove(fallbackMesh);
          loaded.group.position.set(animal.x, 0, animal.y);
          loaded.group.scale.set(animalScale, animalScale, animalScale);
          // Compute bounding box to find origin-to-feet distance
          const box = new Box3().setFromObject(loaded.group);
          groundOffset = -box.min.y;
          const terrainHeight = animal.height - ANIMAL_HEIGHT_OFFSET;
          loaded.group.position.set(animal.x, terrainHeight + groundOffset, animal.y);
          scene.add(loaded.group);
          animalObject = loaded.group;
          animalLoadedModel = loaded;

          // Find Walk/Idle clips by name pattern (case-insensitive)
          const walkClip =
            loaded.animations.find((c) => c.name.toLowerCase().includes('walk')) ?? null;
          const idleClip =
            loaded.animations.find(
              (c) => c.name.toLowerCase().includes('idle') || c.name.toLowerCase().includes('stand')
            ) ?? null;

          animalWalkAction = walkClip ? loaded.mixer.clipAction(walkClip) : null;
          animalIdleAction = idleClip ? loaded.mixer.clipAction(idleClip) : null;

          // Prepare head animation actions from sub-clips
          const headClips: Array<{ name: string; clip: typeof loaded.headDownClip }> = [
            { name: 'HeadDown', clip: loaded.headDownClip },
            { name: 'HeadBobbing', clip: loaded.headBobbingClip },
            { name: 'HeadRaise', clip: loaded.headRaiseClip }
          ];
          for (const { name, clip } of headClips) {
            if (clip) {
              const action = loaded.mixer.clipAction(clip);
              action.setLoop(LoopOnce, 1);
              action.clampWhenFinished = true;
              action.weight = 999;
              headActionsMap.set(name, action);
            }
          }

          // Start with Idle
          if (animalIdleAction) {
            animalIdleAction.play();
            currentAnimName = 'idle';
          }
        }
        // If loaded is null, keep fallback box
      });
    }
  }

  // Scent visualizer — created only if scentState is provided
  let scentVisualizer: ScentVisualizer | null = null;
  if (scentState) {
    scentVisualizer = createScentVisualizer(scene, DEFAULT_SCENT_VISUAL_CONFIG, ANIMAL_PROFILES);
  }

  const updateScent = (now: number): void => {
    if (!scentState || !scentVisualizer) return;
    trimExpiredTrails(scentState, now, DEFAULT_SCENT_PARAMS);
    scentVisualizer.update(scentState.trailPoints, now);
  };

  function crossFadeTo(nextAction: AnimationAction, prevAction: AnimationAction | null): void {
    nextAction.reset();
    nextAction.play();
    if (prevAction) {
      nextAction.crossFadeFrom(prevAction, CROSSFADE_DURATION, false);
    }
  }

  const updateAnimal = (o: AnimalState): void => {
    if (!animalObject) return;
    const terrainY = o.height - ANIMAL_HEIGHT_OFFSET;
    animalObject.position.set(o.x, terrainY + groundOffset, o.y);

    // Delta time for smooth rotation
    const now = performance.now();
    const dt = (now - lastRotationTime) / 1000;
    lastRotationTime = now;

    // Smooth rotation toward movement direction
    const moving = o.directionX !== 0 || o.directionY !== 0;
    if (moving) {
      const targetAngle = Math.atan2(o.directionX, o.directionY);
      const diff = targetAngle - currentAngle;
      const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
      const step = rotationSpeed * dt;
      if (Math.abs(wrapped) < step) {
        currentAngle = targetAngle;
      } else {
        currentAngle += Math.sign(wrapped) * step;
      }
      animalObject.rotation.y = currentAngle;
    }

    // Detect movement by comparing current position to previous
    const isMoving = o.x !== prevAnimalX || o.y !== prevAnimalY;
    prevAnimalX = o.x;
    prevAnimalY = o.y;

    if (!animalLoadedModel) return;

    const targetAnim = isMoving ? 'walk' : 'idle';
    if (targetAnim === currentAnimName) return;

    if (targetAnim === 'walk' && animalWalkAction) {
      crossFadeTo(animalWalkAction, animalIdleAction);
      currentAnimName = 'walk';
    } else if (targetAnim === 'idle' && animalIdleAction) {
      crossFadeTo(animalIdleAction, animalWalkAction);
      currentAnimName = 'idle';
    }
  };

  const setScentVisible = (visible: boolean): void => {
    scentVisualizer?.setVisible(visible);
  };

  const setAnimalScale = (scale: number): void => {
    animalScale = scale;
    if (animalObject) {
      animalObject.scale.set(scale, scale, scale);
    }
    scentVisualizer?.setPointSize(scale * 0.2);
  };

  const setRotationSpeed = (radPerSec: number): void => {
    rotationSpeed = radPerSec;
  };

  const setScentDecayRate = (multiplier: number): void => {
    setTauDecayMultiplier(multiplier);
  };

  const setEmitRate = (multiplier: number): void => {
    setEmitRateMultiplier(multiplier);
  };

  const playAnimation = (name: string): void => {
    const action = headActionsMap.get(name);
    if (!action) return;

    action.reset();
    action.weight = 999;
    action.play();
    if (currentHeadAction && currentHeadAction !== action) {
      currentHeadAction.stop();
    }
    currentHeadAction = action;
  };

  const setHeadFrameRanges = (
    downStart: number,
    downEnd: number,
    bobStart: number,
    bobEnd: number,
    raiseStart: number,
    raiseEnd: number
  ): void => {
    if (!animalLoadedModel?.eatingClip) return;

    const eating = animalLoadedModel.eatingClip;
    const fps = 30;
    const ds = downStart / fps;
    const de = downEnd / fps;
    const bs = bobStart / fps;
    const be = bobEnd / fps;
    const rs = raiseStart / fps;
    const re = raiseEnd / fps;

    // Stop current head action
    if (currentHeadAction) {
      currentHeadAction.stop();
      currentHeadAction = null;
    }

    headActionsMap.clear();

    const headDownClip = createSubClip(eating, 'HeadDown', ds, de);
    const headBobbingClip = createSubClip(eating, 'HeadBobbing', bs, be);
    const headRaiseClip = createSubClip(eating, 'HeadRaise', rs, re);

    for (const [name, clip] of [
      ['HeadDown', headDownClip],
      ['HeadBobbing', headBobbingClip],
      ['HeadRaise', headRaiseClip]
    ] as const) {
      const action = animalLoadedModel.mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.weight = 999;
      headActionsMap.set(name, action);
    }

    console.debug(
      `[HeadRanges] Down:${downStart}-${downEnd} Bob:${bobStart}-${bobEnd} Raise:${raiseStart}-${raiseEnd}`
    );
  };

  const resetCamera = (): void => {
    isReturningToHome = true;
  };

  let animationFrameId: number | null = null;

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = () => {
    if (isReturningToHome) {
      camera.position.lerp(homePosition, 0.03);
      controls.target.lerp(homeTarget, 0.03);
      if (camera.position.distanceTo(homePosition) < 0.01) {
        camera.position.copy(homePosition);
        controls.target.copy(homeTarget);
        isReturningToHome = false;
      }
    }

    // Delta time for animation mixer
    const now = performance.now();
    const dt = (now - lastAnimFrameTime) / 1000;
    lastAnimFrameTime = now;
    if (animalLoadedModel?.mixer) {
      animalLoadedModel.mixer.update(dt);
    }

    controls.update();
    updateScent(performance.now());
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
    stop,
    updateScent,
    updateAnimal,
    resetCamera,
    setScentVisible,
    setAnimalScale,
    setRotationSpeed,
    setScentDecayRate,
    setEmitRate,
    playAnimation,
    setHeadFrameRanges
  };
}
