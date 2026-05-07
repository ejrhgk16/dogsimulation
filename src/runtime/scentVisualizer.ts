import { SphereGeometry, MeshStandardMaterial, InstancedMesh, Object3D, Color } from 'three';
import type { Scene } from 'three';
import type { ScentPoint, ScentVisualConfig, AnimalScentProfile } from '../types/scent';

export const MAX_INSTANCES = 2000;

export interface ScentVisualizer {
  update(trailPoints: ScentPoint[], now: number): void;
  dispose(): void;
  setVisible(visible: boolean): void;
  setPointSize(size: number): void;
}

export function createScentVisualizer(
  scene: Scene,
  config: ScentVisualConfig,
  profileMap: Record<string, AnimalScentProfile>
): ScentVisualizer {
  const geometry = new SphereGeometry(1, 8, 8);
  const material = new MeshStandardMaterial({
    transparent: true,
    depthWrite: false
  });

  const mesh = new InstancedMesh(geometry, material, MAX_INSTANCES);
  scene.add(mesh);

  const tempObject = new Object3D();
  const tempColor = new Color();
  let pointSize = config.pointSize;

  const update = (trailPoints: ScentPoint[], now: number): void => {
    const count = Math.min(trailPoints.length, MAX_INSTANCES);

    for (let i = 0; i < count; i++) {
      const point = trailPoints[i];
      const age = now - point.t;
      const profile = profileMap[point.animalType];
      const tauDecay = point.tauDecay ?? profile?.tauDecay ?? 10000;
      const decayFactor = Math.exp(-age / tauDecay);
      const ratio = 1 - decayFactor;

      // Height lerp: age 0 = point.height, age ≈ maxTrailAge = minHeight
      const height = point.height * (1 - ratio) + config.minHeight * ratio;

      tempObject.position.set(point.x, height, point.y);
      const scale = pointSize * (1 - ratio * 0.85);
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);

      const colorHex = config.animalColorMap[point.animalType] ?? 0xffffff;
      tempColor.setHex(colorHex);
      tempColor.multiplyScalar(1 - ratio * 0.6);
      mesh.setColorAt(i, tempColor);
    }

    // Hide remaining instances (point count < MAX_INSTANCES)
    for (let i = count; i < MAX_INSTANCES; i++) {
      tempObject.position.set(0, 0, 0);
      tempObject.scale.set(0, 0, 0);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
      tempColor.setHex(0xffffff);
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  };

  const dispose = (): void => {
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
  };

  const setVisible = (visible: boolean): void => {
    mesh.visible = visible;
  };

  const setPointSize = (size: number): void => {
    pointSize = size;
  };

  // Initialize all instances as hidden
  update([], 0);

  return { update, dispose, setVisible, setPointSize };
}
