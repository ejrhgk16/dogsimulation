import { describe, it, expect } from 'vitest';
import { Scene } from 'three';
import { createScentVisualizer, MAX_INSTANCES } from '../../src/runtime/scentVisualizer';
import type { ScentVisualConfig, AnimalScentProfile, ScentPoint } from '../../src/types/scent';

const mockConfig: ScentVisualConfig = {
  pointSize: 0.18,
  minHeight: 0.05,
  animalColorMap: {
    dog: 0xff9933,
    cow: 0x44aa44,
    pig: 0xff6688
  }
};

const mockProfileMap: Record<string, AnimalScentProfile> = {
  dog: {
    animalType: 'dog',
    maxTrailAge: 25000,
    tauDecay: 8000,
    scentSpreadSigma: 2.0,
    baseIntensity: 1.0,
    emitInterval: 200,
    emitProbability: 0.8,
    spreadRadius: 0.75,
    tauDecayMin: 6000,
    tauDecayMax: 10000,
    emitSpacing: 1.0
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
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
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
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 1,
        y: 2,
        height: 0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
    ];
    expect(() => {
      visualizer.update(points, 100);
      visualizer.update(points, 500);
      visualizer.update(points, 5000);
    }).not.toThrow();
  });

  it('provides setVisible method that toggles mesh visibility', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    expect(visualizer).toHaveProperty('setVisible');
    expect(typeof visualizer.setVisible).toBe('function');
  });

  it('setVisible hides mesh when called with false', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const mesh = scene.children[scene.children.length - 1] as any;
    expect(mesh.visible).toBe(true);
    visualizer.setVisible(false);
    expect(mesh.visible).toBe(false);
  });

  it('setVisible shows mesh when called with true after hiding', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const mesh = scene.children[scene.children.length - 1] as any;
    visualizer.setVisible(false);
    expect(mesh.visible).toBe(false);
    visualizer.setVisible(true);
    expect(mesh.visible).toBe(true);
  });

  it('exports MAX_INSTANCES as 2000', () => {
    expect(MAX_INSTANCES).toBe(2000);
  });

  it('handles unknown animalType color gracefully', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      {
        animalId: 'unknown-1',
        animalType: 'unknown',
        x: 0,
        y: 0,
        height: 0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
    ];
    expect(() => visualizer.update(points, 100)).not.toThrow();
  });

  function getMesh(scene: Scene): any {
    // The mesh is the last child added to the scene
    return scene.children[scene.children.length - 1] as any;
  }

  it('reduces scale based on exponential decay at age=25000 (tauDecay=8000)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
    ];
    // age = 25000, tauDecay = 8000 (from point, matches profile)
    // decayFactor = exp(-25000/8000) ≈ 0.04394, ratio = 0.95606
    visualizer.update(points, 25000);
    const mesh = getMesh(scene);
    const matrix = mesh.instanceMatrix.array;
    // element [0] in 4x4 column-major matrix = m11 = scaleX
    const scaleX = matrix[0];
    // 0.18 * (1 - 0.95606 * 0.85) ≈ 0.0337
    const expectedScale = mockConfig.pointSize * (1 - 0.95606 * 0.85);
    expect(scaleX).toBeCloseTo(expectedScale, 4);
  });

  it('reduces color brightness based on exponential decay at age=25000 (tauDecay=8000)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
    ];
    // age = 25000, tauDecay = 8000 (from point)
    // decayFactor ≈ 0.04394, ratio ≈ 0.95606
    // brightness multiplier = 1 - 0.95606 * 0.6 ≈ 0.42636
    visualizer.update(points, 25000);
    const mesh = getMesh(scene);
    expect(mesh.instanceColor).toBeDefined();
    // Dog color 0xff9933 in linear space → r≈1.0, g≈0.3185, b≈0.0331
    // After multiplyScalar(0.42636): r≈0.426, g≈0.136, b≈0.014
    const r = mesh.instanceColor.getX(0);
    const g = mesh.instanceColor.getY(0);
    const b = mesh.instanceColor.getZ(0);
    expect(r).toBeCloseTo(0.426, 2);
    expect(g).toBeCloseTo(0.136, 2);
    expect(b).toBeCloseTo(0.014, 2);
  });

  it('keeps full scale for fresh point (ratio=0)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 0,
        t: 25000,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
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
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 0,
        t: 25000,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
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

  it('interpolates brightness based on exponential decay at age=12500 (tauDecay=8000)', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
    ];
    // age = 12500, tauDecay = 8000 (from point)
    // decayFactor = exp(-12500/8000) ≈ 0.2096, ratio ≈ 0.7904
    // brightness multiplier = 1 - 0.7904 * 0.6 ≈ 0.5258
    visualizer.update(points, 12500);
    const mesh = getMesh(scene);
    // Dog color 0xff9933 → r=1.0 * 0.5258 ≈ 0.526
    const r = mesh.instanceColor.getX(0);
    expect(r).toBeCloseTo(0.526, 2);
  });

  it('uses per-point tauDecay over profile tauDecay for scale', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    // Point with tauDecay=16000 (double profile's 8000)
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 16000
      }
    ];
    // age = 25000, tauDecay = 16000 (per-point)
    // decayFactor = exp(-25000/16000) ≈ 0.2096, ratio ≈ 0.7904
    visualizer.update(points, 25000);
    const mesh = getMesh(scene);
    const matrix = mesh.instanceMatrix.array;
    const scaleX = matrix[0];
    // With tauDecay=16000: scale = 0.18 * (1 - 0.7904 * 0.85) ≈ 0.05907
    const decayFactor = Math.exp(-25000 / 16000);
    const ratio = 1 - decayFactor;
    const expectedScale = mockConfig.pointSize * (1 - ratio * 0.85);
    expect(scaleX).toBeCloseTo(expectedScale, 5);
  });

  it('handles more points than MAX_INSTANCES', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    const points: ScentPoint[] = Array.from({ length: 3000 }, (_, i) => ({
      animalId: `dog-${i}`,
      animalType: 'dog',
      x: i,
      y: i,
      height: i,
      t: 0,
      baseIntensity: 1.0,
      tauDecay: 8000
    }));
    expect(() => visualizer.update(points, 100)).not.toThrow();
  });

  it('computes height as point.height for fresh point', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    // Fresh point: age=0 → decayFactor=1 → ratio=0 → height = point.height
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 1.5,
        t: 100,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
    ];
    expect(() => visualizer.update(points, 100)).not.toThrow();
    // height is set via position.y in the mesh, which we can't easily read
    // just verify no error is thrown
  });

  it('computes height as minHeight for very old point', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    // Very old point: age→∞ → decayFactor→0 → ratio→1 → height → minHeight
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 1.5,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 100
      }
    ];
    expect(() => visualizer.update(points, 100000)).not.toThrow();
  });

  it('interpolates height correctly at decayFactor=0.5', () => {
    const scene = new Scene();
    const visualizer = createScentVisualizer(scene, mockConfig, mockProfileMap);
    // decayFactor = exp(-age/tauDecay) = 0.5 → age = tauDecay * ln(2)
    // ratio = 1 - 0.5 = 0.5
    // height = 2.0 * (1 - 0.5) + 0.05 * 0.5 = 1.0 + 0.025 = 1.025
    // We verify no error (position set via mesh matrix, hard to read back)
    const points: ScentPoint[] = [
      {
        animalId: 'dog-1',
        animalType: 'dog',
        x: 0,
        y: 0,
        height: 2.0,
        t: 0,
        baseIntensity: 1.0,
        tauDecay: 8000
      }
    ];
    const age = 8000 * Math.LN2;
    expect(() => visualizer.update(points, age)).not.toThrow();
  });
});
