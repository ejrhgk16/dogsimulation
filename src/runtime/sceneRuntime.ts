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
  SphereGeometry,
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
  setEmitRateMultiplier
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
  private sensorSpheres: Mesh[] = [];
  private searchRing: Mesh | null = null;
  private headingArrow: Line | null = null;
  private targetHeadingArrow: Line | null = null;
  private sensorTriangle: Mesh | null = null;
  private sensorRings: Mesh[] = [];
  private debugInitialRadius = 0;

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

    const dogPursuer = new Pursuer(
      'dog-1',
      -4,
      -2,
      this.mapData,
      5.0,
      7.0,
      DEFAULT_TRACKING_PARAMS
    );
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
      this.sensorSpheres = [];
      this.searchRing = null;
      this.headingArrow = null;
      this.targetHeadingArrow = null;
      this.sensorTriangle = null;
      this.sensorRings = [];
    }
  }

  /** 동물 모델 스케일 변경 */
  setAnimalScale(id: string, scale: number): void {
    this.controllers.get(id)?.setScale(scale);
    this.scentRender?.setPointSize(scale * 0.2);
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

      const sphereGeo = new SphereGeometry(0.15, 8, 8);
      const leftMat = new MeshBasicMaterial({ color: 0xff4444 });
      const centerMat = new MeshBasicMaterial({ color: 0xffffff });
      const rightMat = new MeshBasicMaterial({ color: 0x4488ff });
      this.sensorSpheres = [
        new Mesh(sphereGeo, leftMat),
        new Mesh(sphereGeo, centerMat),
        new Mesh(sphereGeo, rightMat)
      ];
      for (const s of this.sensorSpheres) this.debugGroup.add(s);

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

      const headingGeo = new BufferGeometry();
      headingGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -3], 3));
      const headingMat = new LineBasicMaterial({ color: 0xffaa00 });
      this.headingArrow = new Line(headingGeo, headingMat);
      this.debugGroup.add(this.headingArrow);

      const targetGeo = new BufferGeometry();
      targetGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -3], 3));
      const targetMat = new LineBasicMaterial({ color: 0xff6600 });
      this.targetHeadingArrow = new Line(targetGeo, targetMat);
      this.debugGroup.add(this.targetHeadingArrow);

      const triGeo = new BufferGeometry();
      triGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
      const triMat = new MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.4,
        side: DoubleSide
      });
      this.sensorTriangle = new Mesh(triGeo, triMat);
      this.debugGroup.add(this.sensorTriangle);

      const sensorRadius =
        this.pursuers[0]?.trackingParams.sensorRadius ?? DEFAULT_TRACKING_PARAMS.sensorRadius;
      const sensorRingGeo = new RingGeometry(Math.max(0, sensorRadius - 0.15), sensorRadius, 32);
      sensorRingGeo.rotateX(-Math.PI / 2);
      const sensorRingMat = new MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.35,
        side: DoubleSide
      });
      this.sensorRings = [
        new Mesh(sensorRingGeo, sensorRingMat),
        new Mesh(sensorRingGeo, sensorRingMat.clone()),
        new Mesh(sensorRingGeo, sensorRingMat.clone())
      ];
      for (const r of this.sensorRings) this.debugGroup.add(r);
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

        const sensors = pursuer.getDogSensorPositions();
        const lx = sensors.center.x - pursuer.x;
        const ly = sensors.center.y - pursuer.y;
        const lLeftX = sensors.left.x - pursuer.x;
        const lLeftY = sensors.left.y - pursuer.y;
        const lRightX = sensors.right.x - pursuer.x;
        const lRightY = sensors.right.y - pursuer.y;

        this.sensorSpheres[0]?.position.set(lLeftX, -0.01, lLeftY);
        this.sensorSpheres[1]?.position.set(lx, -0.01, ly);
        this.sensorSpheres[2]?.position.set(lRightX, -0.01, lRightY);

        for (let i = 0; i < this.sensorRings.length; i++) {
          const sp = this.sensorSpheres[i];
          if (sp && this.sensorRings[i]) {
            this.sensorRings[i].position.copy(sp.position);
            this.sensorRings[i].position.y += 0.01;
          }
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

        if (this.sensorTriangle) {
          const triPos = this.sensorTriangle.geometry.attributes.position;
          triPos.setXYZ(0, lx, 0, ly);
          triPos.setXYZ(1, lLeftX, 0, lLeftY);
          triPos.setXYZ(2, lRightX, 0, lRightY);
          triPos.needsUpdate = true;
        }
      }
    }
  }
}
