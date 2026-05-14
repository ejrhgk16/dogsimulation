import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  MOUSE,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MapData } from '../types/map';
import type { TrackingParams } from '../types/scent';
import { generateMap } from '../services/mapService';
import { Pursuer } from '../services/Pursuer';
import { Pursued } from '../services/Pursued';
import {
  ANIMAL_PROFILES,
  DEFAULT_SCENT_VISUAL_CONFIG,
  setTauDecayMultiplier,
  setEmitRateMultiplier,
  setScentPointSizeMultiplier
} from '../config/scentConfig';
import { DEFAULT_TRACKING_PARAMS } from '../config/trackingConfig';
import { defaultSceneConfig } from '../config/sceneConfig';
import { buildMapRender } from './mapRender';
import { createScentRender } from './scentRender';
import type { ScentRender } from './scentRender';
import { createAnimalRender } from './animalRender';
import type { AnimalRender } from './animalRender';

/** 씬/카메라/렌더러/컨트롤 초기화, 추적자·피추적자·향기 객체 생성 */
export class SceneRuntime {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private controls: OrbitControls;

  private pursuers: Pursuer[];
  private pursuedList: Pursued[];
  private mapData: MapData;

  private controllers: Map<string, AnimalRender>;
  private scentRender: ScentRender | null;

  private isReturningToHome = false;
  private homeResetDist = 0;
  private shouldResetOnEnd = false;
  private animationFrameId: number | null = null;
  private lastFrameTime = performance.now();
  private keys = new Set<string>();

  private debugVisible = false;
  private debugGroup: Group | null = null;
  private searchRing: Mesh | null = null;
  private headingArrow: Line | null = null;
  private targetHeadingArrow: Line | null = null;
  private debugInitialRadius = 0;
  private sensorFanMeshes: Mesh[] = [];
  private lastSensorRadius = 0;
  private lastSensorFanAngle = 0;

  private castDebugGroup: Group | null = null;
  private castCenterLine: Line | null = null;
  private castLeftLine: Line | null = null;
  private castRightLine: Line | null = null;
  private castArcLine: Line | null = null;

  private readonly homePosition = new Vector3(0, 25, 35);
  private readonly homeTarget = new Vector3(0, 0, 0);

  readonly alpacaId: string;

  constructor(
    canvas: HTMLCanvasElement,
    externalMapData?: MapData,
    externalPursuers?: Pursuer[],
    externalPursuedList?: Pursued[]
  ) {
    this.mapData = externalMapData ?? generateMap(defaultSceneConfig.mapConfig);

    const dogPursuer = new Pursuer('dog-1', -4, -2, this.mapData, DEFAULT_TRACKING_PARAMS);
    const alpacaPursued = new Pursued('alpaca', 'alpaca', 0, 3, this.mapData, 3.5);
    this.pursuers = externalPursuers ?? [dogPursuer];
    this.pursuedList = externalPursuedList ?? [alpacaPursued];
    this.alpacaId = this.pursuedList.find((p) => p.animalType === 'alpaca')?.id ?? 'alpaca';

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new Scene();
    this.scene.background = new Color(0x2a3028);

    this.camera = new PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 25, 35);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.mouseButtons = {
      LEFT: MOUSE.PAN,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.ROTATE
    };
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 1.0;

    const ambientLight = new AmbientLight(0xffffff, 0.6);
    const directionalLight = new DirectionalLight(0xfff4ea, 1.2);
    directionalLight.position.set(5, 10, 4);

    const { terrainMesh, obstacleMeshes } = buildMapRender(this.mapData, defaultSceneConfig);

    this.scene.add(ambientLight, directionalLight, terrainMesh);
    if (obstacleMeshes.shaped) this.scene.add(obstacleMeshes.shaped);
    if (obstacleMeshes.single) this.scene.add(obstacleMeshes.single);

    this.controllers = new Map();
    for (const p of this.pursuers) {
      this.controllers.set(p.id, createAnimalRender(this.scene, this.mapData, 'dog', p));
    }
    for (const p of this.pursuedList) {
      this.controllers.set(p.id, createAnimalRender(this.scene, this.mapData, p.animalType, p));
    }

    this.scentRender = createScentRender(this.scene, DEFAULT_SCENT_VISUAL_CONFIG, ANIMAL_PROFILES);

    window.addEventListener('keydown', (e) => this.keys.add(e.key));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));

    this.renderer.domElement.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button === 2) this.shouldResetOnEnd = true;
    });

    this.controls.addEventListener('start', () => {
      this.isReturningToHome = false;
    });

    this.controls.addEventListener('end', () => {
      if (this.shouldResetOnEnd) {
        this.homeResetDist = this.camera.position.distanceTo(this.controls.target);
        this.isReturningToHome = true;
        this.shouldResetOnEnd = false;
      }
    });

    this.resize();
  }

  /** 애니메이션 루프 시작 */
  start(): void {
    if (this.animationFrameId !== null) return;
    this.render();
  }

  /** 애니메이션 루프 중지 */
  stop(): void {
    if (this.animationFrameId === null) return;
    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  /** 캔버스 크기 변경 시 렌더러/카메라 애스펙트 재설정 */
  resize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** 카메라 홈 위치로 부드럽게 복귀 시작 */
  resetCamera(): void {
    this.homeResetDist = this.camera.position.distanceTo(this.controls.target);
    this.isReturningToHome = true;
  }

  /** 향기 시각화 표시/숨김 */
  setScentVisible(visible: boolean): void {
    this.scentRender?.setVisible(visible);
  }

  /** 디버그 시각화 표시/숨김 */
  setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    if (!visible && this.debugGroup) {
      this.scene.remove(this.debugGroup);
      this.debugGroup = null;
      this.searchRing = null;
      this.headingArrow = null;
      this.targetHeadingArrow = null;
      this.sensorFanMeshes = [];
      this.castDebugGroup = null;
      this.castCenterLine = null;
      this.castLeftLine = null;
      this.castRightLine = null;
      this.castArcLine = null;
    }
  }

  /** 동물 모델 스케일 변경 */
  setAnimalScale(id: string, scale: number): void {
    this.controllers.get(id)?.setScale(scale);
  }

  /** 동물 회전 속도 설정 (rad/s) */
  setRotationSpeed(id: string, radPerSec: number): void {
    this.controllers.get(id)?.setRotationSpeed(radPerSec);
  }

  /** 향기 감쇠율 배수 설정 */
  setScentDecayRate(multiplier: number): void {
    setTauDecayMultiplier(multiplier);
  }

  /** 향기 방출률 배수 설정 */
  setEmitRate(multiplier: number): void {
    setEmitRateMultiplier(multiplier);
  }

  /** 향기 입자 크기 배수 설정 */
  setScentPointSize(multiplier: number): void {
    setScentPointSizeMultiplier(multiplier);
    this.scentRender?.setPointSize(DEFAULT_SCENT_VISUAL_CONFIG.pointSize * multiplier);
  }

  /** 피추적자 이동 속도 설정 */
  setPursuedSpeed(id: string, speed: number): void {
    const pursued = this.pursuedList.find((p) => p.id === id);
    if (pursued) pursued.speed = speed;
  }

  /** 모든 추적자 추적 시작 */
  startTracking(): void {
    for (const p of this.pursuers) p.isTracking = true;
  }

  /** 개별 추적 파라미터 조절 */
  setTrackingParam<K extends keyof TrackingParams>(key: K, value: TrackingParams[K]): void {
    for (const p of this.pursuers) p.updateTrackingParam(key, value);
  }

  /** 모든 추적자 추적 중지 */
  stopTracking(): void {
    for (const p of this.pursuers) p.isTracking = false;
  }

  /** 추적자 디버그 상태 스냅샷 반환 */
  getPursuerStates(): ReadonlyArray<{
    id: string;
    state: string;
    sigma: number;
    estimatedHeading: number;
    targetHeading: number;
    rotationAngle: number;
    searchRadius: number;
    lostTime: number;
    lastTrailSignal: number;
    castSide: number;
    castOriginX: number;
    castOriginY: number;
    castBoundaryAngle: number;
    contactsCount: number;
    x: number;
    y: number;
    height: number;
  }> {
    return this.pursuers.map((p) => ({
      id: p.id,
      state: p.state,
      sigma: p.sigma,
      estimatedHeading: p.estimatedHeading,
      targetHeading: p.targetHeading,
      rotationAngle: p.rotationAngle,
      searchRadius: p.searchRadius,
      lostTime: p.lostTime,
      lastTrailSignal: p.lastTrailSignal,
      castSide: p.castSide,
      castOriginX: p.castOriginX,
      castOriginY: p.castOriginY,
      castBoundaryAngle: p.castBoundaryAngle,
      contactsCount: p.lastContacts.length,
      x: p.x,
      y: p.y,
      height: p.height
    }));
  }

  /** 프레임 루프: 카메라 복귀 → 시간 계산 → onFrame → render */
  private render(): void {
    if (this.isReturningToHome) {
      const homeDir = new Vector3().subVectors(this.homePosition, this.homeTarget).normalize();
      const idealPos = this.controls.target.clone().addScaledVector(homeDir, this.homeResetDist);
      this.camera.position.lerp(idealPos, 0.03);
      const currentDir = new Vector3()
        .subVectors(this.camera.position, this.controls.target)
        .normalize();
      if (currentDir.dot(homeDir) > 0.9999) {
        this.camera.position.copy(idealPos);
        this.isReturningToHome = false;
      }
    }

    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    this.onFrame(dt, now);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = window.requestAnimationFrame(() => this.render());
  }

  /** 매 프레임 실행: 애니메이션 업데이트 → 추적/이동 로직 */
  private onFrame(dt: number, now: number): void {
    if (this.debugVisible && !this.debugGroup) {
      this.debugGroup = new Group();
      this.scene.add(this.debugGroup);

      // searchRing
      this.debugInitialRadius =
        this.pursuers[0]?.trackingParams.initialRadius ?? DEFAULT_TRACKING_PARAMS.initialRadius;
      const ringGeo = new RingGeometry(this.debugInitialRadius, this.debugInitialRadius + 0.1, 64);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.4,
        side: DoubleSide
      });
      this.searchRing = new Mesh(ringGeo, ringMat);
      this.debugGroup.add(this.searchRing);

      // headingArrow
      const headingGeo = new BufferGeometry();
      headingGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -3], 3));
      const headingMat = new LineBasicMaterial({ color: 0xffaa00 });
      this.headingArrow = new Line(headingGeo, headingMat);
      this.debugGroup.add(this.headingArrow);

      // targetHeadingArrow
      const targetGeo = new BufferGeometry();
      targetGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -3], 3));
      const targetMat = new LineBasicMaterial({ color: 0xff6600 });
      this.targetHeadingArrow = new Line(targetGeo, targetMat);
      this.debugGroup.add(this.targetHeadingArrow);

      // sensorFanMeshes — 3 fan sectors (left=red, center=white, right=blue)
      const fanAngle =
        this.pursuers[0]?.trackingParams.sensorFanAngle ?? DEFAULT_TRACKING_PARAMS.sensorFanAngle;
      const sensorRadius =
        this.pursuers[0]?.trackingParams.sensorRadius ?? DEFAULT_TRACKING_PARAMS.sensorRadius;
      this.lastSensorFanAngle = fanAngle;
      this.lastSensorRadius = sensorRadius;
      const halfFan = fanAngle / 2;
      const sectorWidth = fanAngle / 3;
      const fanColors = [0xff4444, 0xffffff, 0x4488ff];
      const fanSectors = [
        { start: -halfFan, end: -sectorWidth / 2 },
        { start: -sectorWidth / 2, end: sectorWidth / 2 },
        { start: sectorWidth / 2, end: halfFan }
      ];
      this.sensorFanMeshes = [];
      for (let i = 0; i < 3; i++) {
        const shape = new Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, sensorRadius, fanSectors[i].start, fanSectors[i].end, false);
        shape.lineTo(0, 0);
        const geo = new ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        const mat = new MeshBasicMaterial({
          color: fanColors[i],
          transparent: true,
          opacity: 0.3,
          side: DoubleSide
        });
        const mesh = new Mesh(geo, mat);
        this.sensorFanMeshes.push(mesh);
        this.debugGroup.add(mesh);
      }

      // castDebugGroup — cast sector visualization
      this.castDebugGroup = new Group();
      this.debugGroup.add(this.castDebugGroup);

      const createCastLine = (color: number): Line => {
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
        const m = new LineBasicMaterial({ color });
        return new Line(g, m);
      };
      this.castCenterLine = createCastLine(0xffffff);
      this.castLeftLine = createCastLine(0x00ffff);
      this.castRightLine = createCastLine(0x00ffff);
      this.castDebugGroup.add(this.castCenterLine);
      this.castDebugGroup.add(this.castLeftLine);
      this.castDebugGroup.add(this.castRightLine);

      const arcSegments = 32;
      const arcPositions = new Float32Array((arcSegments + 1) * 3);
      const arcGeo = new BufferGeometry();
      arcGeo.setAttribute('position', new Float32BufferAttribute(arcPositions, 3));
      const arcMat = new LineBasicMaterial({ color: 0xffff00 });
      this.castArcLine = new Line(arcGeo, arcMat);
      this.castDebugGroup.add(this.castArcLine);

      this.castDebugGroup.visible = false;
    }

    for (const ctrl of this.controllers.values()) {
      const model = ctrl.getLoadedModel();
      if (model?.mixer) model.mixer.update(dt);
    }

    const allTrails = this.pursuedList.flatMap((p) => p.trailPoints);

    for (const pursuer of this.pursuers) {
      if (!pursuer.isTracking) {
        this.controllers.get(pursuer.id)?.update(pursuer);
        continue;
      }
      const others = this.pursuedList.map((p) => ({ x: p.x, y: p.y }));
      pursuer.updateDogState(allTrails, now, dt, this.mapData, others);
      this.controllers.get(pursuer.id)?.update(pursuer);
    }

    for (const pursued of this.pursuedList) {
      pursued.moveByKeys(
        this.keys,
        dt,
        this.mapData,
        this.pursuers.map((p) => ({ x: p.x, y: p.y }))
      );
      pursued.emitScent(now);
      this.controllers.get(pursued.id)?.update(pursued);
    }

    this.scentRender?.update(allTrails, now);

    if (this.debugVisible && this.debugGroup) {
      for (const pursuer of this.pursuers) {
        const baseY = pursuer.height + 0.06;
        this.debugGroup.position.set(pursuer.x, baseY, pursuer.y);

        // Recreate fan geometries if sensor radius or angle changed
        const currentRadius = pursuer.trackingParams.sensorRadius;
        const currentAngle = pursuer.trackingParams.sensorFanAngle;
        if (
          Math.abs(currentRadius - this.lastSensorRadius) > 0.001 ||
          Math.abs(currentAngle - this.lastSensorFanAngle) > 0.001
        ) {
          const halfFan = currentAngle / 2;
          const sectorWidth = currentAngle / 3;
          const fanSectors = [
            { start: -halfFan, end: -sectorWidth / 2 },
            { start: -sectorWidth / 2, end: sectorWidth / 2 },
            { start: sectorWidth / 2, end: halfFan }
          ];
          for (let i = 0; i < this.sensorFanMeshes.length; i++) {
            this.sensorFanMeshes[i].geometry.dispose();
            const shape = new Shape();
            shape.moveTo(0, 0);
            shape.absarc(0, 0, currentRadius, fanSectors[i].start, fanSectors[i].end, false);
            shape.lineTo(0, 0);
            const newGeo = new ShapeGeometry(shape);
            newGeo.rotateX(-Math.PI / 2);
            this.sensorFanMeshes[i].geometry = newGeo;
          }
          this.lastSensorRadius = currentRadius;
          this.lastSensorFanAngle = currentAngle;
        }

        // Fan rotation: -rotationAngle to match Three.js Y+ (X→-Z) with game X→+Z
        for (const mesh of this.sensorFanMeshes) {
          mesh.rotation.y = -pursuer.rotationAngle;
          mesh.position.set(0, 0, 0);
        }

        if (this.searchRing) {
          const scale =
            this.debugInitialRadius > 0 ? pursuer.searchRadius / this.debugInitialRadius : 1;
          this.searchRing.scale.setScalar(scale);
        }

        if (this.headingArrow) {
          const hdx = Math.cos(pursuer.estimatedHeading) * 3;
          const hdz = Math.sin(pursuer.estimatedHeading) * 3;
          const hPos = this.headingArrow.geometry.attributes.position;
          hPos.setXYZ(1, hdx, 0, hdz);
          hPos.needsUpdate = true;
        }

        if (this.targetHeadingArrow) {
          const tdx = Math.cos(pursuer.targetHeading) * 3;
          const tdz = Math.sin(pursuer.targetHeading) * 3;
          const tPos = this.targetHeadingArrow.geometry.attributes.position;
          tPos.setXYZ(1, tdx, 0, tdz);
          tPos.needsUpdate = true;
        }

        // cast sector visualization
        if (
          this.castDebugGroup &&
          this.castCenterLine &&
          this.castLeftLine &&
          this.castRightLine &&
          this.castArcLine
        ) {
          if (pursuer.state === 'cast') {
            this.castDebugGroup.visible = true;

            const castAngle = pursuer.castBoundaryAngle;
            const r = Math.hypot(pursuer.x - pursuer.castOriginX, pursuer.y - pursuer.castOriginY);
            const radius = Math.max(r, 0.5);

            // Place castDebugGroup at castOrigin relative to debugGroup (which is at pursuer position)
            const offsetX = pursuer.castOriginX - pursuer.x;
            const offsetZ = pursuer.castOriginY - pursuer.y;
            this.castDebugGroup.position.set(offsetX, 0, offsetZ);

            const heading = pursuer.estimatedHeading;

            // Helper: set 2-point line geometry
            const setLinePoints = (
              line: Line,
              x0: number,
              z0: number,
              x1: number,
              z1: number
            ): void => {
              const pos = line.geometry.attributes.position;
              pos.setXYZ(0, x0, 0, z0);
              pos.setXYZ(1, x1, 0, z1);
              pos.needsUpdate = true;
            };

            // Center line (estimatedHeading)
            setLinePoints(
              this.castCenterLine,
              0,
              0,
              Math.cos(heading) * radius,
              Math.sin(heading) * radius
            );

            // Left wing (estimatedHeading - castAngle)
            const leftAngle = heading - castAngle;
            setLinePoints(
              this.castLeftLine,
              0,
              0,
              Math.cos(leftAngle) * radius,
              Math.sin(leftAngle) * radius
            );

            // Right wing (estimatedHeading + castAngle)
            const rightAngle = heading + castAngle;
            setLinePoints(
              this.castRightLine,
              0,
              0,
              Math.cos(rightAngle) * radius,
              Math.sin(rightAngle) * radius
            );

            // Arc line
            const arcPos = this.castArcLine.geometry.attributes.position;
            const arcSegments = 32;
            for (let i = 0; i <= arcSegments; i++) {
              const t = i / arcSegments;
              const a = heading - castAngle + 2 * castAngle * t;
              arcPos.setXYZ(i, Math.cos(a) * radius, 0, Math.sin(a) * radius);
            }
            arcPos.needsUpdate = true;
          } else {
            this.castDebugGroup.visible = false;
          }
        }
      }
    }
  }
}
