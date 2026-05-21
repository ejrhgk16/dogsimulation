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
  LineSegments,
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
import type { ScentPoint, TrackingParams } from '../types/scent';
import { ScentGridImpl } from '../services/scentGrid';
import { generateMap, getHeightAt } from '../services/mapService';
import { Pursuer } from '../services/Pursuer';
import { Pursued } from '../services/Pursued';
import { ANIMAL_HEIGHT_OFFSET } from '../config/animalConfig';
import {
  ANIMAL_PROFILES,
  DEFAULT_SCENT_CELL_SIZE,
  DEFAULT_SCENT_PARAMS,
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

  private showSearchRing = false;
  private showHeadingArrow = false;
  private showTargetHeadingArrow = false;
  private showSensorFan = false;
  private showCastDebug = false;
  private showVisionDebug = false;
  private showGridCells = false;
  private visionFanMeshes: Mesh[] = [];
  private visionRayLine: Line | null = null;

  private initialPursuerPositions: Array<{ x: number; y: number }>;
  private initialPursuedPositions: Array<{ x: number; y: number }>;

  private debugGroup: Group | null = null;
  private gridCellGroup: Group | null = null;
  private searchRing: Mesh | null = null;
  private headingArrow: Line | null = null;
  private targetHeadingArrow: Line | null = null;
  private debugInitialRadius = 0;
  private sensorFanMeshes: Mesh[] = [];
  private lastSensorRadius = 0;
  private lastSensorFanAngle = 0;
  private lastVisionRange = 0;
  private lastVisionConeAngle = 0;

  private castDebugGroup: Group | null = null;
  private castCenterLine: Line | null = null;
  private castLeftLine: Line | null = null;
  private castRightLine: Line | null = null;
  private castArcLine: Line | null = null;
  private lastCastSide = 0;

  private fakeTrails: ScentPoint[] = [];
  private stressIntervalId: ReturnType<typeof setInterval> | null = null;

  /** 공유 ScentGrid 인스턴스 (매 프레임 rebuild 없이 실시간 insert) */
  private trailGrid: ScentGridImpl;

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
    const alpacaPursued = new Pursued('alpaca', 'alpaca', 0, 3, this.mapData, 1.0);
    this.pursuers = externalPursuers ?? [dogPursuer];
    this.pursuedList = externalPursuedList ?? [alpacaPursued];
    this.alpacaId = this.pursuedList.find((p) => p.animalType === 'alpaca')?.id ?? 'alpaca';

    this.initialPursuerPositions = this.pursuers.map((p) => ({ x: p.x, y: p.y }));
    this.initialPursuedPositions = this.pursuedList.map((p) => ({ x: p.x, y: p.y }));

    const worldWidth = this.mapData.width * this.mapData.cellSize;
    const worldDepth = this.mapData.depth * this.mapData.cellSize;
    const worldLeft = -worldWidth / 2;
    const worldTop = -worldDepth / 2;
    this.trailGrid = new ScentGridImpl(
      worldLeft,
      worldTop,
      worldWidth,
      worldDepth,
      DEFAULT_SCENT_CELL_SIZE
    );

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

    // URL-based fake scent stress injection for performance testing
    const params = new URLSearchParams(window.location.search);
    const scentStress = parseInt(params.get('count') ?? '', 10) || 0;
    if (scentStress > 0) {
      const mapWidth = this.mapData.width;
      const mapDepth = this.mapData.depth;
      this.stressIntervalId = setInterval(() => {
        for (let i = 0; i < scentStress; i++) {
          const pt: ScentPoint = {
            animalId: 'stress',
            animalType: 'dog',
            x: (Math.random() - 0.5) * mapWidth,
            y: (Math.random() - 0.5) * mapDepth,
            height: 0.5,
            t: performance.now(),
            tauDecay: 1e12
          };
          this.fakeTrails.push(pt);
          this.trailGrid.insert(pt);
        }
      }, 5000);
    }
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
    if (this.stressIntervalId !== null) {
      clearInterval(this.stressIntervalId);
      this.stressIntervalId = null;
    }
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

  /** 서치링 디버그 표시/숨김 */
  setSearchRingVisible(v: boolean): void {
    this.showSearchRing = v;
  }

  /** heading 화살표 디버그 표시/숨김 */
  setHeadingArrowVisible(v: boolean): void {
    this.showHeadingArrow = v;
  }

  /** target heading 화살표 디버그 표시/숨김 */
  setTargetHeadingArrowVisible(v: boolean): void {
    this.showTargetHeadingArrow = v;
  }

  /** 센서팬 디버그 표시/숨김 */
  setSensorFanVisible(v: boolean): void {
    this.showSensorFan = v;
  }

  /** cast 디버그 표시/숨김 */
  setCastDebugVisible(v: boolean): void {
    this.showCastDebug = v;
  }

  /** vision 디버그 표시/숨김 */
  setVisionDebugVisible(v: boolean): void {
    this.showVisionDebug = v;
  }

  /** grid cell 시각화 표시/숨김 */
  setGridCellsVisible(v: boolean): void {
    this.showGridCells = v;
    if (!v && this.gridCellGroup) {
      this.scene.remove(this.gridCellGroup);
      this.disposeGridCellGroup();
      this.gridCellGroup = null;
    }
  }

  /** 동물 모델 스케일 변경 */
  setAnimalScale(id: string, scale: number): void {
    this.controllers.get(id)?.setScale(scale);
  }
  // slider

  /** 동물 회전 속도 설정 (rad/s) */
  setRotationSpeed(id: string, radPerSec: number): void {
    this.controllers.get(id)?.setRotationSpeed(radPerSec);
  }
  // slider

  /** 향기 감쇠율 배수 설정 */
  setScentDecayRate(multiplier: number): void {
    setTauDecayMultiplier(multiplier);
  }
  // slider

  /** 향기 방출률 배수 설정 */
  setEmitRate(multiplier: number): void {
    setEmitRateMultiplier(multiplier);
  }
  // slider

  /** 향기 입자 크기 배수 설정 */
  setScentPointSize(multiplier: number): void {
    setScentPointSizeMultiplier(multiplier);
    this.scentRender?.setPointSize(DEFAULT_SCENT_VISUAL_CONFIG.pointSize * multiplier);
  }
  // slider

  /** 피추적자 이동 속도 설정 */
  setPursuedSpeed(id: string, speed: number): void {
    const pursued = this.pursuedList.find((p) => p.id === id);
    if (pursued) pursued.speed = speed;
  }
  // slider

  /** 모든 추적자 추적 시작 */
  startTracking(): void {
    for (const p of this.pursuers) p.isTracking = true;
  }

  /** 개별 추적 파라미터 조절 */
  setTrackingParam<K extends keyof TrackingParams>(key: K, value: TrackingParams[K]): void {
    for (const p of this.pursuers) p.updateTrackingParam(key, value);
  }
  // slider

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
    flipScale: number;
    currentSpeed: number;
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
      flipScale: p.flipScale,
      currentSpeed: p.currentSpeed,
      x: p.x,
      y: p.y,
      height: p.height
    }));
  }

  /** grid cell LineSegments 재생성 — 전 셀 line 그림 */
  private rebuildGridCells(): void {
    if (this.gridCellGroup) {
      this.scene.remove(this.gridCellGroup);
      this.disposeGridCellGroup();
      this.gridCellGroup = null;
    }
    if (!this.showGridCells) return;

    this.gridCellGroup = new Group();
    const entries = this.trailGrid.getAllCellEntries();
    const maxCount = Math.max(1, ...entries.map((e) => e.count));
    const cs = this.trailGrid.scentCellSize;
    const x0 = this.trailGrid.worldLeft;
    const z0 = this.trailGrid.worldTop;

    for (const entry of entries) {
      const left = x0 + entry.cx * cs;
      const right = left + cs;
      const top = z0 + entry.cy * cs;
      const bottom = top + cs;
      const positions = new Float32Array([
        left,
        0.1,
        top,
        right,
        0.1,
        top,
        right,
        0.1,
        top,
        right,
        0.1,
        bottom,
        right,
        0.1,
        bottom,
        left,
        0.1,
        bottom,
        left,
        0.1,
        bottom,
        left,
        0.1,
        top
      ]);
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const opacity = 0.15 + 0.5 * (entry.count / maxCount);
      const mat = new LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity });
      this.gridCellGroup.add(new LineSegments(geo, mat));
    }

    this.scene.add(this.gridCellGroup);
  }

  private disposeGridCellGroup(): void {
    if (!this.gridCellGroup) return;
    for (const child of this.gridCellGroup.children) {
      if (child instanceof LineSegments) {
        child.geometry.dispose();
        (child.material as LineBasicMaterial).dispose();
      }
    }
  }

  /** 모든 Pursuer/Pursued를 초기 위치로 리셋 */
  resetPositions(): void {
    for (let i = 0; i < this.pursuers.length; i++) {
      const p = this.pursuers[i];
      const init = this.initialPursuerPositions[i];
      p.x = init.x;
      p.y = init.y;
      p.height = getHeightAt(this.mapData, p.x, p.y) + ANIMAL_HEIGHT_OFFSET;
      p.directionX = 1;
      p.directionY = 0;
      p.rotationAngle = Math.atan2(1, 0);
      p.state = 'track';
      p.lastContacts = [];
      p.trailMemory = [];
      p.lostTime = 0;
      p.searchRadius = 0;
      p.sigma = p.trackingParams.sigmaBase;
      p.estimatedHeading = p.rotationAngle;
      p.targetHeading = p.rotationAngle;
      p.castOriginX = p.x;
      p.castOriginY = p.y;
      (p as unknown as { _prevXi: number })._prevXi = p.trackingParams.xi;
      this.controllers.get(p.id)?.update(p);
    }

    for (let i = 0; i < this.pursuedList.length; i++) {
      const p = this.pursuedList[i];
      const init = this.initialPursuedPositions[i];
      p.x = init.x;
      p.y = init.y;
      p.height = getHeightAt(this.mapData, p.x, p.y) + ANIMAL_HEIGHT_OFFSET;
      p.directionX = 1;
      p.directionY = 0;
      p.rotationAngle = Math.atan2(1, 0);
      this.controllers.get(p.id)?.update(p);
    }
  }

  /** 모든 Pursued의 향기 관련 상태 초기화 (grid 재생성) */
  resetScent(): void {
    this.fakeTrails = [];
    const worldWidth = this.mapData.width * this.mapData.cellSize;
    const worldDepth = this.mapData.depth * this.mapData.cellSize;
    const worldLeft = -worldWidth / 2;
    const worldTop = -worldDepth / 2;
    this.trailGrid = new ScentGridImpl(
      worldLeft,
      worldTop,
      worldWidth,
      worldDepth,
      DEFAULT_SCENT_CELL_SIZE
    );
    for (const p of this.pursuedList) {
      (p as unknown as { lastEmitTime: number }).lastEmitTime = -Infinity;
      (p as unknown as { distanceSinceLast: number }).distanceSinceLast = 0;
      (p as unknown as { lastScentX: number }).lastScentX = p.x;
      (p as unknown as { lastScentY: number }).lastScentY = p.y;
    }
    if (this.showGridCells) this.rebuildGridCells();
  }

  /** 모든 상태(위치+향기+가짜 향기) 리셋 */
  resetAll(): void {
    this.resetPositions();
    this.resetScent();
    this.fakeTrails = [];
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
    const anyDebugActive =
      this.showSearchRing ||
      this.showHeadingArrow ||
      this.showTargetHeadingArrow ||
      this.showSensorFan ||
      this.showCastDebug ||
      this.showVisionDebug;

    if (anyDebugActive && !this.debugGroup) {
      this.debugGroup = new Group();
      this.scene.add(this.debugGroup);
    }

    for (const ctrl of this.controllers.values()) {
      const model = ctrl.getLoadedModel();
      if (model?.mixer) model.mixer.update(dt);
    }

    // 1. grid trim
    this.trailGrid.removeExpired(now, DEFAULT_SCENT_PARAMS.tauDecay);

    // 2. pursued emit → grid에 insert
    for (const pursued of this.pursuedList) {
      pursued.moveByKeys(
        this.keys,
        dt,
        this.mapData,
        this.pursuers.map((p) => ({ x: p.x, y: p.y }))
      );
      pursued.emitScent(now, this.trailGrid, DEFAULT_SCENT_PARAMS.tauDecay);
      this.controllers.get(pursued.id)?.update(pursued);
    }

    // 3. scentRender용 flatten (spread로 mutable copy)
    const allTrails = [...this.trailGrid.getAllPoints()];

    // 4. pursuer 업데이트 (grid 전달)
    for (const pursuer of this.pursuers) {
      if (!pursuer.isTracking) {
        this.controllers.get(pursuer.id)?.update(pursuer);
        continue;
      }
      const others = this.pursuedList.map((p) => ({ id: p.id, x: p.x, y: p.y }));
      pursuer.updateDogState(this.trailGrid, now, dt, this.mapData, others);
      const turnRate = pursuer.state === 'cast' ? pursuer.trackingParams.flipTurnRate : 8;
      this.controllers.get(pursuer.id)?.setRotationSpeed(turnRate);
      this.controllers.get(pursuer.id)?.update(pursuer);
    }

    // 5. scentRender
    this.scentRender?.update(allTrails, now);

    if (this.debugGroup) {
      const anyDebugActive =
        this.showSearchRing ||
        this.showHeadingArrow ||
        this.showTargetHeadingArrow ||
        this.showSensorFan ||
        this.showCastDebug ||
        this.showVisionDebug;

      if (!anyDebugActive) {
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
        this.lastCastSide = 0;
        this.visionFanMeshes = [];
        this.visionRayLine = null;
      } else {
        for (const pursuer of this.pursuers) {
          const baseY = pursuer.height + 0.06;
          this.debugGroup.position.set(pursuer.x, baseY, pursuer.y);

          // --- Search Ring ---
          if (this.showSearchRing) {
            if (!this.searchRing) {
              this.debugInitialRadius =
                pursuer.trackingParams.initialRadius ?? DEFAULT_TRACKING_PARAMS.initialRadius;
              const ringGeo = new RingGeometry(
                this.debugInitialRadius,
                this.debugInitialRadius + 0.1,
                64
              );
              ringGeo.rotateX(-Math.PI / 2);
              const ringMat = new MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.4,
                side: DoubleSide
              });
              this.searchRing = new Mesh(ringGeo, ringMat);
              this.debugGroup.add(this.searchRing);
            }
            const scale =
              this.debugInitialRadius > 0 ? pursuer.searchRadius / this.debugInitialRadius : 1;
            this.searchRing.scale.setScalar(scale);
          } else if (this.searchRing) {
            this.debugGroup.remove(this.searchRing);
            this.searchRing.geometry.dispose();
            (this.searchRing.material as MeshBasicMaterial).dispose();
            this.searchRing = null;
          }

          // --- Heading Arrow ---
          if (this.showHeadingArrow) {
            if (!this.headingArrow) {
              const headingGeo = new BufferGeometry();
              headingGeo.setAttribute(
                'position',
                new Float32BufferAttribute([0, 0, 0, 0, 0, -3], 3)
              );
              const headingMat = new LineBasicMaterial({ color: 0xffaa00 });
              this.headingArrow = new Line(headingGeo, headingMat);
              this.debugGroup.add(this.headingArrow);
            }
            const hdx = Math.cos(pursuer.estimatedHeading) * 3;
            const hdz = Math.sin(pursuer.estimatedHeading) * 3;
            const hPos = this.headingArrow.geometry.attributes.position;
            hPos.setXYZ(1, hdx, 0, hdz);
            hPos.needsUpdate = true;
          } else if (this.headingArrow) {
            this.debugGroup.remove(this.headingArrow);
            this.headingArrow.geometry.dispose();
            (this.headingArrow.material as LineBasicMaterial).dispose();
            this.headingArrow = null;
          }

          // --- Target Heading Arrow ---
          if (this.showTargetHeadingArrow) {
            if (!this.targetHeadingArrow) {
              const targetGeo = new BufferGeometry();
              targetGeo.setAttribute(
                'position',
                new Float32BufferAttribute([0, 0, 0, 0, 0, -3], 3)
              );
              const targetMat = new LineBasicMaterial({ color: 0xff6600 });
              this.targetHeadingArrow = new Line(targetGeo, targetMat);
              this.debugGroup.add(this.targetHeadingArrow);
            }
            const tdx = Math.cos(pursuer.targetHeading) * 3;
            const tdz = Math.sin(pursuer.targetHeading) * 3;
            const tPos = this.targetHeadingArrow.geometry.attributes.position;
            tPos.setXYZ(1, tdx, 0, tdz);
            tPos.needsUpdate = true;
          } else if (this.targetHeadingArrow) {
            this.debugGroup.remove(this.targetHeadingArrow);
            this.targetHeadingArrow.geometry.dispose();
            (this.targetHeadingArrow.material as LineBasicMaterial).dispose();
            this.targetHeadingArrow = null;
          }

          // --- Sensor Fan ---
          if (this.showSensorFan) {
            const fanAngle =
              pursuer.trackingParams.sensorFanAngle ?? DEFAULT_TRACKING_PARAMS.sensorFanAngle;
            const sensorRadius =
              pursuer.trackingParams.sensorRadius ?? DEFAULT_TRACKING_PARAMS.sensorRadius;

            if (this.sensorFanMeshes.length === 0) {
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
              this.lastSensorFanAngle = fanAngle;
              this.lastSensorRadius = sensorRadius;
            }

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

            for (const mesh of this.sensorFanMeshes) {
              mesh.rotation.y = -pursuer.rotationAngle;
              mesh.position.set(0, 0, 0);
            }
          } else if (this.sensorFanMeshes.length > 0) {
            for (const mesh of this.sensorFanMeshes) {
              this.debugGroup.remove(mesh);
              mesh.geometry.dispose();
              (mesh.material as MeshBasicMaterial).dispose();
            }
            this.sensorFanMeshes = [];
          }

          // --- Cast Debug ---
          if (this.showCastDebug) {
            if (!this.castDebugGroup) {
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

            if (
              this.castCenterLine &&
              this.castLeftLine &&
              this.castRightLine &&
              this.castArcLine
            ) {
              if (pursuer.state === 'cast') {
                this.castDebugGroup.visible = true;

                const castAngle = pursuer.castBoundaryAngle;
                const r = Math.hypot(
                  pursuer.x - pursuer.castOriginX,
                  pursuer.y - pursuer.castOriginY
                );
                const radius = Math.max(r, 0.5);

                const offsetX = pursuer.castOriginX - pursuer.x;
                const offsetZ = pursuer.castOriginY - pursuer.y;
                this.castDebugGroup.position.set(offsetX, 0, offsetZ);

                if (pursuer.castSide !== this.lastCastSide) {
                  const heading = pursuer.estimatedHeading;

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

                  setLinePoints(
                    this.castCenterLine,
                    0,
                    0,
                    Math.cos(heading) * radius,
                    Math.sin(heading) * radius
                  );

                  const leftAngle = heading - castAngle;
                  setLinePoints(
                    this.castLeftLine,
                    0,
                    0,
                    Math.cos(leftAngle) * radius,
                    Math.sin(leftAngle) * radius
                  );

                  const rightAngle = heading + castAngle;
                  setLinePoints(
                    this.castRightLine,
                    0,
                    0,
                    Math.cos(rightAngle) * radius,
                    Math.sin(rightAngle) * radius
                  );

                  const arcPos = this.castArcLine.geometry.attributes.position;
                  const arcSegments = 32;
                  for (let i = 0; i <= arcSegments; i++) {
                    const t = i / arcSegments;
                    const a = heading - castAngle + 2 * castAngle * t;
                    arcPos.setXYZ(i, Math.cos(a) * radius, 0, Math.sin(a) * radius);
                  }
                  arcPos.needsUpdate = true;

                  this.lastCastSide = pursuer.castSide;
                }
              } else {
                this.castDebugGroup.visible = false;
              }
            }
          } else if (this.castDebugGroup) {
            this.debugGroup.remove(this.castDebugGroup);
            this.castCenterLine?.geometry.dispose();
            (this.castCenterLine?.material as LineBasicMaterial)?.dispose();
            this.castLeftLine?.geometry.dispose();
            (this.castLeftLine?.material as LineBasicMaterial)?.dispose();
            this.castRightLine?.geometry.dispose();
            (this.castRightLine?.material as LineBasicMaterial)?.dispose();
            this.castArcLine?.geometry.dispose();
            (this.castArcLine?.material as LineBasicMaterial)?.dispose();
            this.castDebugGroup = null;
            this.castCenterLine = null;
            this.castLeftLine = null;
            this.castRightLine = null;
            this.castArcLine = null;
            this.lastCastSide = 0;
          }

          // --- Vision Debug ---
          if (this.showVisionDebug) {
            const visionRange =
              pursuer.trackingParams.visionRange ?? DEFAULT_TRACKING_PARAMS.visionRange;
            const visionConeAngle =
              pursuer.trackingParams.visionConeAngle ?? DEFAULT_TRACKING_PARAMS.visionConeAngle;

            if (this.visionFanMeshes.length === 0) {
              const shape = new Shape();
              shape.moveTo(0, 0);
              shape.absarc(0, 0, visionRange, -visionConeAngle, visionConeAngle, false);
              shape.lineTo(0, 0);
              const fanGeo = new ShapeGeometry(shape);
              fanGeo.rotateX(-Math.PI / 2);
              const fanMat = new MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.3,
                side: DoubleSide
              });
              this.visionFanMeshes.push(new Mesh(fanGeo, fanMat));
              this.debugGroup.add(this.visionFanMeshes[0]);
              this.lastVisionRange = visionRange;
              this.lastVisionConeAngle = visionConeAngle;
            }

            if (
              Math.abs(visionRange - this.lastVisionRange) > 0.001 ||
              Math.abs(visionConeAngle - this.lastVisionConeAngle) > 0.001
            ) {
              for (const mesh of this.visionFanMeshes) {
                mesh.geometry.dispose();
                const shape = new Shape();
                shape.moveTo(0, 0);
                shape.absarc(0, 0, visionRange, -visionConeAngle, visionConeAngle, false);
                shape.lineTo(0, 0);
                const newGeo = new ShapeGeometry(shape);
                newGeo.rotateX(-Math.PI / 2);
                mesh.geometry = newGeo;
              }
              this.lastVisionRange = visionRange;
              this.lastVisionConeAngle = visionConeAngle;
            }

            for (const mesh of this.visionFanMeshes) {
              mesh.rotation.y = -pursuer.rotationAngle;
              mesh.position.set(0, 0, 0);
            }

            // Vision ray
            if (pursuer.visionTargetId) {
              const target = this.pursuedList.find((p) => p.id === pursuer.visionTargetId);
              if (target) {
                if (!this.visionRayLine) {
                  const rayGeo = new BufferGeometry();
                  rayGeo.setAttribute(
                    'position',
                    new Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)
                  );
                  const rayMat = new LineBasicMaterial({ color: 0x00ff00 });
                  this.visionRayLine = new Line(rayGeo, rayMat);
                  this.debugGroup.add(this.visionRayLine);
                }
                const rPos = this.visionRayLine.geometry.attributes.position;
                const dx = target.x - pursuer.x;
                const dz = target.y - pursuer.y;
                rPos.setXYZ(0, 0, 0, 0);
                rPos.setXYZ(1, dx, 0, dz);
                rPos.needsUpdate = true;
                this.visionRayLine.visible = true;
              } else {
                if (this.visionRayLine) this.visionRayLine.visible = false;
              }
            } else {
              if (this.visionRayLine) this.visionRayLine.visible = false;
            }
          } else if (this.visionFanMeshes.length > 0) {
            for (const mesh of this.visionFanMeshes) {
              this.debugGroup.remove(mesh);
              mesh.geometry.dispose();
              (mesh.material as MeshBasicMaterial).dispose();
            }
            this.visionFanMeshes = [];
            if (this.visionRayLine) {
              this.debugGroup.remove(this.visionRayLine);
              this.visionRayLine.geometry.dispose();
              (this.visionRayLine.material as LineBasicMaterial).dispose();
              this.visionRayLine = null;
            }
          }
        }
      }
    }

    // Grid cell overlay (world-space, not per-pursuer)
    if (this.showGridCells && !this.gridCellGroup) {
      this.rebuildGridCells();
    }
  }
}
