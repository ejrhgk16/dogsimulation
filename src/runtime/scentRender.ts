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
  attribute vec3 color;
  attribute float size;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
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

/** 향기 입자를 Points + ShaderMaterial + circle sprite로 렌더링 */
export function createScentRender(
  scene: Scene,
  config: ScentVisualConfig,
  profileMap: Record<string, AnimalScentProfile>
): ScentRender {
  const circleTexture = createCircleTexture();

  const material = new ShaderMaterial({
    uniforms: {
      pointTexture: { value: circleTexture }
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false
  });

  const geometry = new BufferGeometry();
  const points = new Points(geometry, material);
  scene.add(points);

  const tempColor = new Color();
  let pointSize = config.pointSize;

  /** trailPoints를 Points 객체로 렌더링 (나이에 따라 페이드·축소) */
  const update = (trailPoints: ScentPoint[], now: number): void => {
    const count = trailPoints.length;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const point = trailPoints[i];
      const age = now - point.t;
      const profile = profileMap[point.animalType];
      const tauDecay = point.tauDecay ?? profile?.tauDecay ?? 10000;
      const decayFactor = Math.exp(-age / tauDecay);
      const ratio = 1 - decayFactor;

      // Height lerp: age 0 = point.height, age → ∞ = minHeight
      const height = point.height * (1 - ratio) + config.minHeight * ratio;

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = point.y;

      sizes[i] = pointSize * (1 - ratio * 0.85);

      const colorHex = config.animalColorMap[point.animalType] ?? 0xffffff;
      tempColor.setHex(colorHex);
      tempColor.multiplyScalar(1 - ratio * 0.6);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
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
    pointSize = size;
  };

  return { update, dispose, setVisible, setPointSize };
}
