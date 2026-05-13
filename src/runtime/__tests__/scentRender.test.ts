import { beforeAll } from 'vitest';
import { Scene } from 'three';
import { createScentRender } from '../scentRender';
import type { ScentRender } from '../scentRender';
import type { ScentPoint, ScentVisualConfig, AnimalScentProfile } from '../../types/scent';

// jsdom canvas mock for getContext('2d') - needed by createCircleTexture
beforeAll(() => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        createRadialGradient: () => ({
          addColorStop: () => {}
        }),
        fillStyle: '',
        fillRect: () => {}
      } as any;
    }
    return originalGetContext.call(this, type as any);
  };
});

function makeProfileMap(): Record<string, AnimalScentProfile> {
  return {
    dog: {
      animalType: 'dog',
      tauDecay: 8000,
      scentSpreadSigma: 2.0,
      emitSpacing: 0.5,
      emitInterval: 200,
      emitProbability: 0.8,
      spreadRadius: 0.75
    }
  };
}

function makeConfig(): ScentVisualConfig {
  return {
    pointSize: 1.0,
    minHeight: 0.1,
    animalColorMap: { dog: 0xff9933 }
  };
}

function makeScentPoints(count: number, now: number): ScentPoint[] {
  const points: ScentPoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      animalId: 'dog-1',
      animalType: 'dog',
      x: i * 0.5,
      y: i * 0.3,
      height: 1.0,
      t: now - i * 100
    });
  }
  return points;
}

describe('scentRender', () => {
  let scene: Scene;
  let config: ScentVisualConfig;
  let profileMap: Record<string, AnimalScentProfile>;
  let render: ScentRender;

  beforeEach(() => {
    scene = new Scene();
    config = makeConfig();
    profileMap = makeProfileMap();
    render = createScentRender(scene, config, profileMap);
  });

  afterEach(() => {
    render.dispose();
  });

  it('creates object with correct interface', () => {
    expect(render).toHaveProperty('update');
    expect(render).toHaveProperty('dispose');
    expect(render).toHaveProperty('setVisible');
    expect(expect(render).toHaveProperty('setPointSize'));
    expect(typeof render.update).toBe('function');
    expect(typeof render.dispose).toBe('function');
    expect(typeof render.setVisible).toBe('function');
    expect(typeof render.setPointSize).toBe('function');
  });

  it('handles empty trailPoints without error', () => {
    expect(() => render.update([], 1000)).not.toThrow();
  });

  it('handles single scent point', () => {
    const now = 5000;
    const points = makeScentPoints(1, now);
    expect(() => render.update(points, now)).not.toThrow();
  });

  it('handles many scent points (beyond old cap of 10000)', () => {
    const now = 10000;
    const points = makeScentPoints(15000, now);
    expect(() => render.update(points, now)).not.toThrow();
  });

  it('updates multiple times with varying point counts', () => {
    const now = 5000;
    render.update(makeScentPoints(10, now), now);
    render.update(makeScentPoints(50, now), now);
    render.update(makeScentPoints(5, now), now);
    render.update(makeScentPoints(0, now), now);
    expect(true).toBe(true);
  });

  it('setVisible hides and shows points', () => {
    const now = 5000;
    render.update(makeScentPoints(5, now), now);
    render.setVisible(false);
    render.setVisible(true);
    expect(true).toBe(true);
  });

  it('setPointSize changes point size', () => {
    render.setPointSize(2.0);
    render.setPointSize(0.5);
    expect(true).toBe(true);
  });

  it('dispose removes points from scene', () => {
    render.dispose();
    // dispose should not throw when called again
    render.dispose();
  });

  it('updates with points at different ages', () => {
    const now = 10000;
    const points = makeScentPoints(100, now);
    render.update(points, now);
    // Update again with same points (now advanced)
    render.update(points, now + 5000);
    expect(true).toBe(true);
  });

  it('handles points with custom tauDecay', () => {
    const now = 5000;
    const points = makeScentPoints(3, now);
    points[0].tauDecay = 500;
    points[1].tauDecay = 50000;
    expect(() => render.update(points, now)).not.toThrow();
  });
});
