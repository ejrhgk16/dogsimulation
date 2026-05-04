import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defaultSceneConfig } from '../../src/config/sceneConfig';

const { mockRuntime, mockDog, createSceneRuntimeMock, createDogMock } = vi.hoisted(() => {
  const mockRuntime = {
    start: vi.fn(),
    stop: vi.fn(),
    resize: vi.fn()
  };
  const mockDog = {
    id: 'dog-1',
    name: 'Buddy',
    position: { x: 0, y: 0, z: 0 },
    speed: 2
  };

  return {
    mockRuntime,
    mockDog,
    createSceneRuntimeMock: vi.fn(() => mockRuntime),
    createDogMock: vi.fn(() => mockDog)
  };
});

vi.mock('../../src/runtime/sceneRuntime', () => ({
  createSceneRuntime: createSceneRuntimeMock
}));

vi.mock('../../src/services/dogService', () => ({
  createDog: createDogMock
}));

const mountShell = () => {
  document.body.innerHTML = `
    <header id="site-header">
      <h1>Dog Simulation</h1>
    </header>
    <section id="status-panel">
      <p id="status-text">대기 중</p>
      <button id="start-btn" type="button">시작</button>
    </section>
    <div id="app"></div>
    <footer id="site-footer">
      <span>dogsimulation-1</span>
    </footer>
  `;
};

const loadMain = async () => {
  vi.resetModules();
  await import('../../src/main');
};

describe('main bootstrap', () => {
  beforeEach(() => {
    mountShell();
    vi.clearAllMocks();
  });

  it('mounts canvas and wires runtime controls', async () => {
    await loadMain();

    const app = document.querySelector('#app');
    const startButton = document.querySelector<HTMLButtonElement>('#start-btn');
    const statusText = document.querySelector<HTMLElement>('#status-text');

    expect(app?.querySelector('canvas')).not.toBeNull();
    expect(createDogMock).toHaveBeenCalledWith(
      'dog-1',
      'Buddy',
      defaultSceneConfig.initialDogPosition,
      defaultSceneConfig.initialDogSpeed
    );
    expect(createSceneRuntimeMock).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      defaultSceneConfig,
      mockDog
    );
    expect(mockRuntime.resize).toHaveBeenCalledTimes(1);
    expect(mockRuntime.start).toHaveBeenCalledTimes(1);
    expect(statusText?.textContent).toBe('실행 중');
    expect(startButton?.textContent).toBe('정지');

    startButton?.click();

    expect(mockRuntime.stop).toHaveBeenCalledTimes(1);
    expect(statusText?.textContent).toBe('대기 중');
    expect(startButton?.textContent).toBe('시작');

    window.dispatchEvent(new Event('resize'));
    expect(mockRuntime.resize).toHaveBeenCalledTimes(2);
  });
});
