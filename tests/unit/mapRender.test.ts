import { describe, it, expect } from 'vitest';
import { buildMapRender } from '../../src/runtime/mapRender';
import { generateMap } from '../../src/services/mapService';
import { defaultSceneConfig } from '../../src/config/sceneConfig';
import { Mesh, InstancedMesh } from 'three';

describe('mapRender', () => {
  it('buildMapRender returns terrainMesh and obstacleMeshes', () => {
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const result = buildMapRender(mapData, defaultSceneConfig);
    expect(result).toHaveProperty('terrainMesh');
    expect(result.terrainMesh).toBeInstanceOf(Mesh);
    expect(result).toHaveProperty('obstacleMeshes');
    expect(result.obstacleMeshes).toHaveProperty('shaped');
    expect(result.obstacleMeshes).toHaveProperty('single');
  });

  it('terrainMesh geometry has expected vertex count from mapData dimensions', () => {
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const result = buildMapRender(mapData, defaultSceneConfig);
    const geometry = result.terrainMesh.geometry;
    const position = geometry.getAttribute('position');
    const vertexCols = mapData.width + 1;
    const vertexRows = mapData.depth + 1;
    expect(position.count).toBe(vertexCols * vertexRows);
    expect(position.itemSize).toBe(3);
  });

  it('terrainMesh has correct number of indices (width * depth * 6)', () => {
    const mapData = generateMap(defaultSceneConfig.mapConfig);
    const result = buildMapRender(mapData, defaultSceneConfig);
    const index = result.terrainMesh.geometry.getIndex();
    expect(index).not.toBeNull();
    expect(index!.count).toBe(mapData.width * mapData.depth * 6);
  });

  it('obstacleMeshes are null when map has no obstacles', () => {
    const noObstacleConfig = { ...defaultSceneConfig.mapConfig, obstacleRatio: 0, seed: 1 };
    const mapData = generateMap(noObstacleConfig);
    const result = buildMapRender(mapData, defaultSceneConfig);
    expect(result.obstacleMeshes.shaped).toBeNull();
    expect(result.obstacleMeshes.single).toBeNull();
  });

  it('single obstacleMeshes is InstancedMesh when all cells are obstacles', () => {
    const allObstacleConfig = { ...defaultSceneConfig.mapConfig, obstacleRatio: 1, seed: 1 };
    const mapData = generateMap(allObstacleConfig);
    const result = buildMapRender(mapData, defaultSceneConfig);
    // With obstacleRatio=1, all cells become 'single' obstacles
    expect(result.obstacleMeshes.single).toBeInstanceOf(InstancedMesh);
    expect(result.obstacleMeshes.shaped).toBeNull();
  });

  it('buildMapRender with small map produces correct structure', () => {
    const smallConfig = { ...defaultSceneConfig.mapConfig, width: 3, depth: 3, obstacleRatio: 0 };
    const mapData = generateMap(smallConfig);
    const result = buildMapRender(mapData, defaultSceneConfig);
    expect(result.terrainMesh).toBeInstanceOf(Mesh);
    const vertexCols = mapData.width + 1;
    const vertexRows = mapData.depth + 1;
    expect(result.terrainMesh.geometry.getAttribute('position').count).toBe(
      vertexCols * vertexRows
    );
    expect(result.obstacleMeshes.shaped).toBeNull();
    expect(result.obstacleMeshes.single).toBeNull();
  });
});
