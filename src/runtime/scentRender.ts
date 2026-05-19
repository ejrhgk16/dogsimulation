import {
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  BufferGeometry
} from 'three';
import type { Scene } from 'three';
import type { ScentPoint, ScentVisualConfig, AnimalScentProfile } from '../types/scent';

export const SCENT_RENDER_MAX_INSTANCES = 10000;

export interface ScentRender {
  update(trailPoints: ScentPoint[], now: number): void;
  dispose(): void;
  setVisible(visible: boolean): void;
  setPointSize(size: number): void;
}

function createCircleTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;
  const radius = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uPointSize;
  uniform float uMinHeight;
  uniform vec3 uAnimalColors[3];

  attribute float aTimestamp;
  attribute float aHeight;
  attribute float aTauDecay;
  attribute float aTypeIndex;

  varying vec3 vColor;

  void main() {
    float age = uTime - aTimestamp;
    float decay = exp(-age / aTauDecay);
    float ratio = 1.0 - decay;

    // height lerp: 새 점 = aHeight, 오래된 점 = uMinHeight
    vec3 pos = position;
    pos.y = aHeight * (1.0 - ratio) + uMinHeight * ratio;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uPointSize * (1.0 - ratio * 0.85) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // color dim: 새 점 = 원색, 오래된 점 = 원색 * 0.4
    int idx = int(aTypeIndex);
    vec3 baseColor = uAnimalColors[idx];
    vColor = baseColor * (1.0 - ratio * 0.6);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D pointTexture;
  varying vec3 vColor;
  void main() {
    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
    gl_FragColor = vec4(vColor * texColor.rgb, texColor.a);
  }
`;

const ANIMAL_TYPE_INDEX: Record<string, number> = {
  dog: 0,
  cow: 1,
  pig: 2
};

/** 향기 입자를 Points + ShaderMaterial + circle sprite로 렌더링 */
export function createScentRender(
  scene: Scene,
  config: ScentVisualConfig,
  profileMap: Record<string, AnimalScentProfile>
): ScentRender {
  const circleTexture = createCircleTexture();

  // Map animalColorMap to uniform array [dog=0, cow=1, pig=2]
  const animalColorValues = [
    new Color(config.animalColorMap['dog'] ?? 0xffffff),
    new Color(config.animalColorMap['cow'] ?? 0xffffff),
    new Color(config.animalColorMap['pig'] ?? 0xffffff)
  ];

  const material = new ShaderMaterial({
    uniforms: {
      pointTexture: { value: circleTexture },
      uTime: { value: 0 },
      uPointSize: { value: config.pointSize },
      uMinHeight: { value: config.minHeight },
      uAnimalColors: { value: animalColorValues }
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false
  });

  const geometry = new BufferGeometry();
  const points = new Points(geometry, material);
  scene.add(points);

  /** 점 개수 변경 시에만 버퍼 재업로드 */
  const rebuildBuffer = (trailPoints: ScentPoint[]): void => {
    const count = trailPoints.length;
    const positions = new Float32Array(count * 3);
    const timestamps = new Float32Array(count);
    const heights = new Float32Array(count);
    const tauDecays = new Float32Array(count);
    const typeIndices = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const point = trailPoints[i];
      const profile = profileMap[point.animalType];
      const tauDecay = point.tauDecay ?? profile?.tauDecay ?? 8000;

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = 0; // height는 GPU에서 계산 (초기값 0)
      positions[i * 3 + 2] = point.y;

      timestamps[i] = point.t;
      heights[i] = point.height;
      tauDecays[i] = tauDecay;
      typeIndices[i] = ANIMAL_TYPE_INDEX[point.animalType] ?? 0;
    }

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aTimestamp', new Float32BufferAttribute(timestamps, 1));
    geometry.setAttribute('aHeight', new Float32BufferAttribute(heights, 1));
    geometry.setAttribute('aTauDecay', new Float32BufferAttribute(tauDecays, 1));
    geometry.setAttribute('aTypeIndex', new Float32BufferAttribute(typeIndices, 1));
  };

  let _lastCount = 0;

  /** 매 프레임 uTime만 업데이트, 점 개수 변경 시 rebuildBuffer 호출 */
  const update = (trailPoints: ScentPoint[], now: number): void => {
    if (trailPoints.length !== _lastCount) {
      rebuildBuffer(trailPoints);
      _lastCount = trailPoints.length;
    }
    material.uniforms.uTime.value = now;
  };

  /** Points/지오메트리/재질 정리 */
  const dispose = (): void => {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
    circleTexture.dispose();
  };

  /** 향기 입자 표시/숨김 */
  const setVisible = (visible: boolean): void => {
    points.visible = visible;
  };

  /** 향기 입자 크기 변경 */
  const setPointSize = (size: number): void => {
    material.uniforms.uPointSize.value = size;
  };

  return { update, dispose, setVisible, setPointSize };
}
