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
import type { SceneConfig } from '../config/sceneConfig';
import type { MapData } from '../types/map';

export interface SceneRuntime {
  resize: () => void;
  start: () => void;
  stop: () => void;
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
  _config: SceneConfig,
  mapData: MapData
): SceneRuntime {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new Scene();
  scene.background = new Color(0xf4efe8);

  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;
  camera.position.set(mapWidth * 0.4, 7, mapDepth * 0.6);
  camera.lookAt(0, 0, 0);

  const ambientLight = new AmbientLight(0xffffff, 1.8);
  const directionalLight = new DirectionalLight(0xfff4ea, 2.2);
  directionalLight.position.set(5, 10, 4);

  const terrainGeo = createTerrainGeometry(mapData);
  const terrainMat = new MeshStandardMaterial({ color: 0xd7e5dc });
  const terrainMesh = new Mesh(terrainGeo, terrainMat);

  const obstaclePositions: { x: number; y: number; z: number }[] = [];
  for (let row = 0; row < mapData.depth; row++) {
    for (let col = 0; col < mapData.width; col++) {
      const cell = mapData.grid[row][col];
      if (cell.terrain === 'obstacle') {
        const x = col * mapData.cellSize - mapWidth / 2 + mapData.cellSize / 2;
        const z = row * mapData.cellSize - mapDepth / 2 + mapData.cellSize / 2;
        obstaclePositions.push({ x, y: cell.height / 2, z });
      }
    }
  }

  let obstacleMesh: InstancedMesh | null = null;
  if (obstaclePositions.length > 0) {
    const boxGeo = new BoxGeometry(mapData.cellSize * 0.8, 0.5, mapData.cellSize * 0.8);
    const boxMat = new MeshStandardMaterial({ color: 0x8b7355 });
    obstacleMesh = new InstancedMesh(boxGeo, boxMat, obstaclePositions.length);
    const temp = new Object3D();
    obstaclePositions.forEach((pos, i) => {
      temp.position.set(pos.x, pos.y, pos.z);
      temp.updateMatrix();
      obstacleMesh!.setMatrixAt(i, temp.matrix);
    });
    obstacleMesh.instanceMatrix.needsUpdate = true;
  }

  scene.add(ambientLight, directionalLight, terrainMesh);
  if (obstacleMesh) scene.add(obstacleMesh);

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
