import {
  BufferGeometry,
  BoxGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D
} from 'three';
import type { MapData, ObstacleShape } from '../types/map';
import type { SceneConfig } from '../config/sceneConfig';

interface ObstaclePos {
  x: number;
  y: number;
  z: number;
  shape: ObstacleShape | undefined;
}

/** MapData 그리드 → 지형 삼각형 BufferGeometry 생성 */
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

/** 지형 Mesh 생성 */
export function createTerrainMesh(mapData: MapData): Mesh {
  const terrainGeo = createTerrainGeometry(mapData);
  const terrainMat = new MeshStandardMaterial({ color: 0x4a6b4a });
  const terrainMesh = new Mesh(terrainGeo, terrainMat);
  terrainMesh.frustumCulled = false;
  return terrainMesh;
}

/** 장애물 InstancedMesh 생성 */
export function createObstacleMeshes(mapData: MapData): {
  shaped: InstancedMesh | null;
  single: InstancedMesh | null;
} {
  const mapWidth = mapData.width * mapData.cellSize;
  const mapDepth = mapData.depth * mapData.cellSize;

  const obstaclePositions: ObstaclePos[] = [];
  for (let row = 0; row < mapData.depth; row++) {
    for (let col = 0; col < mapData.width; col++) {
      const cell = mapData.grid[row][col];
      if (cell.terrain === 'obstacle') {
        const x = col * mapData.cellSize - mapWidth / 2 + mapData.cellSize / 2;
        const z = row * mapData.cellSize - mapDepth / 2 + mapData.cellSize / 2;
        const isShaped = cell.shape === 'L' || cell.shape === 'reverse-L';
        const yOffset = isShaped ? mapData.cellSize * 1.2 : 0.5;
        obstaclePositions.push({ x, y: yOffset, z, shape: cell.shape });
      }
    }
  }

  const shapedPositions = obstaclePositions.filter(
    (p) => p.shape === 'L' || p.shape === 'reverse-L'
  );
  const singlePositions = obstaclePositions.filter((p) => p.shape === 'single' || !p.shape);

  let shapedMesh: InstancedMesh | null = null;
  if (shapedPositions.length > 0) {
    const geo = new BoxGeometry(
      mapData.cellSize * 0.8,
      mapData.cellSize * 2.4,
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
    shapedMesh = mesh;
  }

  let singleMesh: InstancedMesh | null = null;
  if (singlePositions.length > 0) {
    const boxGeo = new BoxGeometry(mapData.cellSize * 0.8, 1.0, mapData.cellSize * 0.8);
    const boxMat = new MeshStandardMaterial({ color: 0x5c4a33 });
    const mesh = new InstancedMesh(boxGeo, boxMat, singlePositions.length);
    const temp = new Object3D();
    singlePositions.forEach((pos, i) => {
      temp.position.set(pos.x, pos.y, pos.z);
      temp.updateMatrix();
      mesh.setMatrixAt(i, temp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    singleMesh = mesh;
  }

  return { shaped: shapedMesh, single: singleMesh };
}

/** 장애물 mesh만 반환 (기존 인터페이스 유지) */
export function buildMapRender(
  mapData: MapData,
  _config: SceneConfig
): { shaped: InstancedMesh | null; single: InstancedMesh | null } {
  return createObstacleMeshes(mapData);
}
