import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MapData, ObstacleShape } from '../types/map';
import type { ScentWorldState } from '../types/scent';
import type { OwnerState } from '../types/owner';
import {
  OWNER_PROFILES,
  DEFAULT_SCENT_PARAMS,
  DEFAULT_SCENT_VISUAL_CONFIG
} from '../config/scentConfig';
import { OWNER_TYPES } from '../config/ownerConfig';
import { trimExpiredTrails } from '../services/scentService';
import { createScentVisualizer } from './scentVisualizer';
import type { ScentVisualizer } from './scentVisualizer';

export interface SceneRuntime {
  resize: () => void;
  start: () => void;
  stop: () => void;
  updateScent: (now: number) => void;
  updateOwner: (owner: OwnerState) => void;
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
  owner?: OwnerState
): SceneRuntime {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new Scene();
  scene.background = new Color(0x2a3028);

  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;
  camera.position.set(mapWidth * 0.4, Math.max(mapWidth, mapDepth) * 0.5, mapDepth * 0.8);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0, 0);

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

  // Owner box mesh
  let ownerMesh: Mesh | null = null;
  if (owner) {
    const geo = new BoxGeometry(1, 1, 1);
    const color = OWNER_TYPES[owner.ownerType] ?? 0xff9933;
    const mat = new MeshStandardMaterial({ color });
    ownerMesh = new Mesh(geo, mat);
    ownerMesh.position.set(owner.x, 0.5, owner.y);
    scene.add(ownerMesh);
  }

  // Scent visualizer — created only if scentState is provided
  let scentVisualizer: ScentVisualizer | null = null;
  if (scentState) {
    scentVisualizer = createScentVisualizer(scene, DEFAULT_SCENT_VISUAL_CONFIG, OWNER_PROFILES);
  }

  const updateScent = (now: number): void => {
    if (!scentState || !scentVisualizer) return;
    trimExpiredTrails(scentState, now, DEFAULT_SCENT_PARAMS);
    scentVisualizer.update(scentState.trailPoints, now);
  };

  const updateOwner = (o: OwnerState): void => {
    if (ownerMesh) {
      ownerMesh.position.set(o.x, 0.5, o.y);
    }
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
    updateOwner
  };
}
