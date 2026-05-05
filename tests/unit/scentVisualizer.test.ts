import { describe, it, expect } from 'vitest';
import { Scene } from 'three';
import { createScentVisualizer, MAX_INSTANCES } from '../../src/runtime/scentVisualizer';
import type { ScentVisualConfig, OwnerScentProfile, ScentPoint } from '../../src/types/scent';

const mockConfig: ScentVisualConfig = {
  pointSize: 0.18,
  minHeight: 0.05,
  maxHeight: 0.7,
  ownerColorMap: {
    dog: 0xff9933,
    cow: 0x44aa44,
    pig: 0xff6688
  }
};

const mockProfileMap: Record<string, OwnerScentProfile> = {
  dog: {
    ownerType: 'dog',
    maxTrailAge: 25000,
    tauDecay: 8000,
    scentSpreadSigma: 2.0,
    baseIntensity: 1.0,
    emitSpacing: 0.5,
    emitProbability: 0.8,
    lateralSpreadSigma: 0.3
  }
};

describe('createScentVisualizer', () => {
  it('returns ScentVisualizer interface with update and dispose', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    expect(visualizer).toHaveProperty('update');
    expect(visualizer).toHaveProperty('dispose');
    expect(typeof visualizer.update).toBe('function');
    expect(typeof visualizer.dispose).toBe('function');
  });

  it('handles empty trailPoints in update without throwing', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    expect(() => visualizer.update([], 1000)).not.toThrow();
  });

  it('handles trailPoints with content in update without throwing', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'dog-1', ownerType: 'dog', x: 0, y: 0, t: 0, baseIntensity: 1.0 }
    ];
    expect(() => visualizer.update(points, 500)).not.toThrow();
  });

  it('dispose removes mesh from scene', () => {
    const scene = new Scene();
    const initialCount = scene.children.length;
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    expect(scene.children.length).toBe(initialCount + 1);
    visualizer.dispose();
    expect(scene.children.length).toBe(initialCount);
  });

  it('dispose does not throw when called', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    expect(() => visualizer.dispose()).not.toThrow();
  });

  it('handles multiple update calls sequentially', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'dog-1', ownerType: 'dog', x: 1, y: 2, t: 0, baseIntensity: 1.0 }
    ];
    expect(() => {
      visualizer.update(points, 100);
      visualizer.update(points, 500);
      visualizer.update(points, 5000);
    }).not.toThrow();
  });

  it('exports MAX_INSTANCES as 2000', () => {
    expect(MAX_INSTANCES).toBe(2000);
  });

  it('handles unknown ownerType color gracefully', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'unknown-1', ownerType: 'unknown', x: 0, y: 0, t: 0, baseIntensity: 1.0 }
    ];
    expect(() => visualizer.update(points, 100)).not.toThrow();
  });

  function getMesh(scene: Scene): any {
    // The mesh is the last child added to the scene
    return scene.children[scene.children.length - 1] as any;
  }

  it('reduces scale to 15% of pointSize for fully aged point (ratio=1)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'dog-1', ownerType: 'dog', x: 0, y: 0, t: 0, baseIntensity: 1.0 }
    ];
    // age = 25000 - 0 = 25000, ratio = 1.0
    visualizer.update(points, 25000);
    const mesh = getMesh(scene);
    const matrix = mesh.instanceMatrix.array;
    // element [0] in 4x4 column-major matrix = m11 = scaleX
    const scaleX = matrix[0];
    // 0.18 * (1 - 1.0 * 0.85) = 0.18 * 0.15 = 0.027
    const expectedScale = mockConfig.pointSize * (1 - 1.0 * 0.85);
    expect(scaleX).toBeCloseTo(expectedScale, 4);
  });

  it('reduces color brightness to 40% for fully aged point (ratio=1)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'dog-1', ownerType: 'dog', x: 0, y: 0, t: 0, baseIntensity: 1.0 }
    ];
    // age = 25000, ratio = 1.0
    visualizer.update(points, 25000);
    const mesh = getMesh(scene);
    expect(mesh.instanceColor).toBeDefined();
    // Dog color 0xff9933 in linear space → r≈1.0, g≈0.3185, b≈0.0331
    // After multiplyScalar(0.4): r≈0.4, g≈0.1274, b≈0.0132
    const r = mesh.instanceColor.getX(0);
    const g = mesh.instanceColor.getY(0);
    const b = mesh.instanceColor.getZ(0);
    expect(r).toBeCloseTo(0.4, 2);
    expect(g).toBeCloseTo(0.127, 2);
    expect(b).toBeCloseTo(0.013, 2);
  });

  it('keeps full scale for fresh point (ratio=0)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'dog-1', ownerType: 'dog', x: 0, y: 0, t: 25000, baseIntensity: 1.0 }
    ];
    // age = 25000 - 25000 = 0, ratio = 0.0
    visualizer.update(points, 25000);
    const mesh = getMesh(scene);
    const matrix = mesh.instanceMatrix.array;
    const scaleX = matrix[0];
    const expectedScale = mockConfig.pointSize * (1 - 0.0 * 0.85); // 0.18
    expect(scaleX).toBeCloseTo(expectedScale, 4);
  });

  it('keeps full brightness for fresh point (ratio=0)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'dog-1', ownerType: 'dog', x: 0, y: 0, t: 25000, baseIntensity: 1.0 }
    ];
    // age = 0, ratio = 0.0, no multiplyScalar applied
    visualizer.update(points, 25000);
    const mesh = getMesh(scene);
    expect(mesh.instanceColor).toBeDefined();
    // Dog color 0xff9933 in linear space → r≈1.0, g≈0.3185, b≈0.0331
    const r = mesh.instanceColor.getX(0);
    const g = mesh.instanceColor.getY(0);
    const b = mesh.instanceColor.getZ(0);
    expect(r).toBeCloseTo(1.0, 2);
    expect(g).toBeCloseTo(0.318, 2);
    expect(b).toBeCloseTo(0.033, 2);
  });

  it('linearly interpolates brightness between ratio 0 and 1', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      { ownerId: 'dog-1', ownerType: 'dog', x: 0, y: 0, t: 0, baseIntensity: 1.0 }
    ];
    // age = 12500, ratio = 0.5
    // brightness multiplier = 1 - 0.5 * 0.6 = 0.7
    visualizer.update(points, 12500);
    const mesh = getMesh(scene);
    // Dog color 0xff9933 → r=1.0 * 0.7 = 0.7
    const r = mesh.instanceColor.getX(0);
    expect(r).toBeCloseTo(0.7, 2);
  });

  it('handles more points than MAX_INSTANCES', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = Array.from({ length: 3000 }, (_, i) => ({
      ownerId: `dog-${i}`,
      ownerType: 'dog',
      x: i,
      y: i,
      t: 0,
      baseIntensity: 1.0
    }));
    expect(() => visualizer.update(points, 100)).not.toThrow();
  });
});
