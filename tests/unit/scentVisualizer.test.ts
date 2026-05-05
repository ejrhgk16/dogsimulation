import { describe, it, expect } from 'vitest';
import { Scene } from 'three';
import { createScentVisualizer, MAX_INSTANCES } from '../../src/runtime/scentVisualizer';
import type { ScentVisualConfig, OwnerScentProfile, ScentPoint } from '../../src/types/scent';

const mockConfig: ScentVisualConfig = {
  pointSize: 0.15,
  minHeight: 0.1,
  maxHeight: 0.6,
  ownerColorMap: {
    dog: 0xff9933,
    cow: 0x44aa44,
    pig: 0xff6688
  }
};

const mockProfileMap: Record<string, OwnerScentProfile> = {
  dog: {
    ownerType: 'dog',
    maxTrailAge: 10000,
    tauDecay: 3000,
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
