import { SceneRuntime } from './runtime/sceneRuntime';
import { ANIMAL_SCALE } from './config/animalConfig';
import {
  getEmitRateMultiplier,
  getScentPointSizeMultiplier,
  getTauDecayMultiplier
} from './config/scentConfig';
import { DEFAULT_TRACKING_PARAMS } from './config/trackingConfig';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element.');

const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Three.js scene viewport');
app.appendChild(canvas);

const runtime = new SceneRuntime(canvas);
const ALPACA_ID = runtime.alpacaId;
const DOG_ID = runtime.dogId;

const leftPanels = document.createElement('div');
leftPanels.id = 'left-panels';
app.appendChild(leftPanels);

// Control panel
const controlsPanel = document.createElement('div');
controlsPanel.id = 'controls-panel';
controlsPanel.innerHTML = `
  <fieldset>
    <legend>Set</legend>
    <label>
      <span>Speed</span>
      <input type="range" id="speed-slider" min="1" max="20" step="0.5" value="5" />
      <span class="slider-value" id="speed-value">5.0</span>
    </label>
    <label>
      <span>Scale</span>
      <input type="range" id="scale-slider" min="0.05" max="1" step="0.05" value="0.5" />
      <span class="slider-value" id="scale-value">0.5</span>
    </label>
    <label>
      <span>TauDecay</span>
      <input type="range" id="tau-decay-slider" min="0.1" max="20.0" step="0.1" value="10" />
      <span class="slider-value" id="tau-decay-value">1.0x</span>
    </label>
    <label>
      <span>PtSize</span>
      <input type="range" id="ptsize-slider" min="0.1" max="5.0" step="0.1" value="3" />
      <span class="slider-value" id="ptsize-value">1.0x</span>
    </label>
    <label>
      <span>EmitRate</span>
      <input type="range" id="emit-rate-slider" min="0.1" max="2.0" step="0.1" value="1.7" />
      <span class="slider-value" id="emit-rate-value">1.7x</span>
    </label>
    <button id="track-btn" type="button">추적 시작</button>
    <button id="reset-btn" type="button">초기화</button>
    <button id="help-btn" type="button">설명보기</button>
  </fieldset>
`;

leftPanels.appendChild(controlsPanel);

// Visual panel
const visualPanel = document.createElement('div');
visualPanel.id = 'visual-panel';
visualPanel.innerHTML = `
  <fieldset>
    <legend>Visual</legend>
    <label><input type="checkbox" id="vis-heading-arrow" checked /> Est. Heading</label>
    <label><input type="checkbox" id="vis-target-heading-arrow" checked /> Target Heading</label>
    <label><input type="checkbox" id="vis-sensor-fan" checked /> Scent Sensor</label>
    <label><input type="checkbox" id="vis-vision-debug" checked /> Vision Sensor</label>
    <label><input type="checkbox" id="vis-cast-debug" checked /> Cast Sector</label>
    <label><input type="checkbox" id="vis-grid-cells" checked /> Grid Cells</label>
    <label><input type="checkbox" id="vis-scent" checked /> Scent Trail</label>
  </fieldset>
`;
leftPanels.appendChild(visualPanel);

const visHeadingArrow = visualPanel.querySelector<HTMLInputElement>('#vis-heading-arrow')!;
visHeadingArrow.addEventListener('change', () => {
  runtime.setHeadingArrowVisible(visHeadingArrow.checked);
});

const visTargetHeadingArrow = visualPanel.querySelector<HTMLInputElement>(
  '#vis-target-heading-arrow'
)!;
visTargetHeadingArrow.addEventListener('change', () => {
  runtime.setTargetHeadingArrowVisible(visTargetHeadingArrow.checked);
});

const visSensorFan = visualPanel.querySelector<HTMLInputElement>('#vis-sensor-fan')!;
visSensorFan.addEventListener('change', () => {
  runtime.setSensorFanVisible(visSensorFan.checked);
});

const visCastDebug = visualPanel.querySelector<HTMLInputElement>('#vis-cast-debug')!;
visCastDebug.addEventListener('change', () => {
  runtime.setCastDebugVisible(visCastDebug.checked);
});

const visVisionDebug = visualPanel.querySelector<HTMLInputElement>('#vis-vision-debug')!;
visVisionDebug.addEventListener('change', () => {
  runtime.setVisionDebugVisible(visVisionDebug.checked);
});

const visGridCells = visualPanel.querySelector<HTMLInputElement>('#vis-grid-cells')!;
visGridCells.addEventListener('change', () => {
  runtime.setGridCellsVisible(visGridCells.checked);
});

const visScent = visualPanel.querySelector<HTMLInputElement>('#vis-scent')!;
visScent.addEventListener('change', () => {
  runtime.setScentVisible(visScent.checked);
});

const speedSlider = controlsPanel.querySelector<HTMLInputElement>('#speed-slider')!;
const speedValue = controlsPanel.querySelector<HTMLElement>('#speed-value')!;
speedSlider.addEventListener('input', () => {
  const val = parseFloat(speedSlider.value);
  speedValue.textContent = val.toFixed(1);
  runtime.setPursuedSpeed(ALPACA_ID, val);
});

const scaleSlider = controlsPanel.querySelector<HTMLInputElement>('#scale-slider')!;
const scaleValue = controlsPanel.querySelector<HTMLElement>('#scale-value')!;
scaleSlider.addEventListener('input', () => {
  const val = parseFloat(scaleSlider.value);
  scaleValue.textContent = val.toFixed(2);
  runtime.setAnimalScale(ALPACA_ID, val);
  runtime.setAnimalScale(DOG_ID, val);
});

const tauDecaySlider = controlsPanel.querySelector<HTMLInputElement>('#tau-decay-slider')!;
const tauDecayValue = controlsPanel.querySelector<HTMLElement>('#tau-decay-value')!;
tauDecaySlider.addEventListener('input', () => {
  const val = parseFloat(tauDecaySlider.value);
  tauDecayValue.textContent = val.toFixed(1) + 'x';
  runtime.setScentDecayRate(val);
});

const ptsizeSlider = controlsPanel.querySelector<HTMLInputElement>('#ptsize-slider')!;
const ptsizeValue = controlsPanel.querySelector<HTMLElement>('#ptsize-value')!;
ptsizeSlider.addEventListener('input', () => {
  const val = parseFloat(ptsizeSlider.value);
  ptsizeValue.textContent = val.toFixed(1) + 'x';
  runtime.setScentPointSize(val);
});

const emitRateSlider = controlsPanel.querySelector<HTMLInputElement>('#emit-rate-slider')!;
const emitRateValue = controlsPanel.querySelector<HTMLElement>('#emit-rate-value')!;
emitRateSlider.addEventListener('input', () => {
  const val = parseFloat(emitRateSlider.value);
  emitRateValue.textContent = val.toFixed(1) + 'x';
  runtime.setEmitRate(val);
});

// --- Slider initialization from config defaults ---

// Speed: no config → keep HTML value="5", init display
speedValue.textContent = parseFloat(speedSlider.value).toFixed(1);
runtime.setPursuedSpeed(ALPACA_ID, parseFloat(speedSlider.value));

// Scale: ANIMAL_SCALE
const scaleDefault = String(ANIMAL_SCALE);
scaleSlider.value = scaleDefault;
scaleValue.textContent = ANIMAL_SCALE.toFixed(2);
runtime.setAnimalScale(ALPACA_ID, ANIMAL_SCALE);
runtime.setAnimalScale(DOG_ID, ANIMAL_SCALE);

// TauDecay: getTauDecayMultiplier()
const tauDefault = getTauDecayMultiplier();
tauDecaySlider.value = String(tauDefault);
tauDecayValue.textContent = tauDefault.toFixed(1) + 'x';
runtime.setScentDecayRate(tauDefault);

// PtSize: getScentPointSizeMultiplier()
const ptsizeDefault = getScentPointSizeMultiplier();
ptsizeSlider.value = String(ptsizeDefault);
ptsizeValue.textContent = ptsizeDefault.toFixed(1) + 'x';
runtime.setScentPointSize(ptsizeDefault);

// EmitRate: getEmitRateMultiplier()
const emitDefault = getEmitRateMultiplier();
emitRateSlider.value = String(emitDefault);
emitRateValue.textContent = emitDefault.toFixed(1) + 'x';
runtime.setEmitRate(emitDefault);

const trackBtn = controlsPanel.querySelector<HTMLButtonElement>('#track-btn')!;
let tracking = false;
trackBtn.addEventListener('click', () => {
  if (!tracking) {
    runtime.startTracking();
    trackBtn.textContent = '추적 중지';
  } else {
    runtime.stopTracking();
    trackBtn.textContent = '추적 시작';
  }
  tracking = !tracking;
});

const resetBtn = controlsPanel.querySelector<HTMLButtonElement>('#reset-btn')!;
resetBtn.addEventListener('click', () => {
  runtime.resetPositions();
  runtime.resetScent();
  runtime.resetCamera();
});

// Help overlay
const helpOverlay = document.createElement('div');
helpOverlay.id = 'help-overlay';
helpOverlay.innerHTML = `
  <div id="help-panel">
    <div id="help-header">
      <span>화면 설명</span>
      <button id="help-close" type="button">닫기</button>
    </div>
    <div id="help-content">
      <h3>동작 순서</h3>
      <ol>
        <li>Set 패널에서 Speed/Scale 등 파라미터 조정</li>
        <li>WASD 키로 <span style="color:#996633">갈색 알파카</span> 이동 시작 → 지나간 자리에 <span style="color:#ffffff;background:#333">흰색 냄새흔적</span> 생성</li>
        <li>"추적 시작" 버튼 클릭 → <span style="color:#ff9933">주황색 강아지</span>가 냄새흔적을 따라 추적</li>
        <li>강아지 앞쪽 <span style="color:#ff4444">빨강</span>/<span style="color:#ffffff;background:#333">흰색</span>/<span style="color:#4488ff">파랑</span> 3색 센서팬이 냄새흔적 감지 → 좌/우 농도 차이로 <span style="color:#ffaa00">호박색 추정방향</span> 계산 → <span style="color:#ff6600">진주황 목표방향</span>으로 이동</li>
        <li>이동하며 냄새흔적 감지 시 접촉점(wx,wy)을 lastContacts에 저장(FIFO 최대 10개) → OLS 선형회귀로 <span style="color:#ffaa00">호박색 추정방향</span> 계산 → <span style="color:#ff6600">진주황 목표방향</span>으로 이동</li>
        <li><span style="color:#00ff00">초록색 시야</span> 안에 알파카 포착 시 chase(직선 추적)</li>
        <li>냄새흔적 접촉 누적 → Surge(돌진): 속도 증가, 직선 돌진</li>
        <li>냄새흔적 놓치면 Lost → <span style="color:#00ffff">청록색 경계</span>+<span style="color:#ffff00">노란색 호</span> Cast 섹터로 좌우탐색, <span style="color:#ff8800">주황색 방문셀</span> 중심 재수색. Lost 경계는 <span style="color:#9944ff">보라색</span> 표시</li>
        <li>pursuer state 패널에서 state(track/surge/cast/lost/chase), sigma, heading 등 실시간 확인</li>
        <li>Visual 패널로 시각화 요소 ON/OFF</li>
        <li>초기화 버튼으로 위치+냄새흔적+카메라+방문셀 초기화</li>
      </ol>


      <p><b>TauDecay</b>: 냄새흔적 지속시간(소멸속도). 값이 높을수록 냄새가 오래 남아 추적이 쉬워짐. 낮출수록 냄새가 빨리 사라져 추적 난이도 증가</p>
      <p><b>EmitRate</b>: 알파카 이동 시 방출하는 냄새흔적 입자 수. 값이 높을수록 냄새흔적이 촘촘히 남아 추적이 쉬워짐. 낮출수록 냄새흔적 간격이 넓어져 추적 난이도 증가</p>
      <h3>패널</h3>
      <p><b>Set (좌측 상단)</b>: Speed(이동속도), Scale(크기), TauDecay(냄새흔적 지속시간), PtSize(냄새흔적 입자크기), EmitRate(냄새흔적 방출량), 추적시작/중지, 초기화(위치+냄새흔적+카메라 초기화), 설명보기</p>
      <p><b>Visual (좌측 상단 아래)</b>: Est.Heading(추정방향, <span style="color:#ffaa00">호박색 화살표</span>), Target Heading(목표방향, <span style="color:#ff6600">진주황 화살표</span>), Scent Sensor(냄새흔적 센서팬, 좌<span style="color:#ff4444">빨강</span>+중앙<span style="color:#ffffff;background:#333">흰색</span>+우<span style="color:#4488ff">파랑</span> 3색 부채꼴), Vision Sensor(시야센서, <span style="color:#00ff00">초록색 원뿔</span>), Cast Sector(탐색섹터, 중앙<span style="color:#ffffff;background:#333">흰색</span>선+좌우<span style="color:#00ffff">청록</span>경계+<span style="color:#ffff00">노란색</span>호), Grid Cells(방문셀), Scent Trail(냄새흔적) 시각화 ON/OFF</p>
      <p><b>Tracking Params (숨김)</b>: 추적 알고리즘 파라미터. 필요시 CSS에서 display 해제</p>
      <p><b>pursuer state (좌측 하단)</b>: 추적자 상태값 실시간 표시 (state, sigma, heading, speed, 좌표 등)</p>
      <h3>3D 씬 요소</h3>
      <p><b>지형</b>: 높낮이 있는 <span style="color:#4a6b4a">녹색</span> 지형. 마우스 드래그로 카메라 회전, 휠로 줌</p>
      <p><b>강아지 (추적자/Pursuer)</b>: <span style="color:#ff9933">주황색</span>. 알파카를 추적. 냄새흔적 센서와 시야로 추적</p>
      <p><b>알파카 (도망자/Pursued)</b>: <span style="color:#996633">갈색</span>. 키보드(WASD/QE)로 이동. 이동 시 냄새흔적(Scent)을 남김</p>
      <p><b>냄새흔적</b>: 알파카가 지나간 자리에 남는 <span style="color:#ffffff;background:#333">흰색</span> 점들. 시간이 지나면 점점 투명해짐. 농도가 진할수록 최근에 지나간 자리</p>
      <p><b>냄새흔적 센서 팬</b>: 강아지 앞쪽 3색 부채꼴. 좌측<span style="color:#ff4444">빨간색</span>+중앙<span style="color:#ffffff;background:#333">흰색</span>+우측<span style="color:#4488ff">파란색</span>. 좌/우 섹터에서 감지된 냄새흔적 농도 차이로 방향 결정. 중앙 섹터는 직진 방향 확인용</p>
      <p><b>시야 센서</b>: 강아지 앞쪽 <span style="color:#00ff00">초록색 원뿔</span>. 도망자를 직접 목격할 수 있는 범위. 목격 시 곧바로 직선 추적(chase)</p>
      <p><b>탐색 섹터 (Cast)</b>: 강아지 앞쪽. 중앙<span style="color:#ffffff;background:#333">흰색</span> 직선+좌우<span style="color:#00ffff">청록색</span> 경계선+<span style="color:#ffff00">노란색</span> 호. 냄새흔적을 찾지 못했을 때 좌우로 휘젓는 탐색 범위</p>
      <p><b>Grid Cells (기억중인 방문셀)</b>: 강아지가 기억하고 있는 방문한 지형 셀. 최대 10개 FIFO.<br/>기본: <span style="color:#88ccff">하늘색</span>(냄새 있음) → 방문: <span style="color:#ffff00">노란색</span> → 마지막 접촉: <span style="color:#ff8800">주황색</span> → Lost 경계: <span style="color:#9944ff">보라색</span>.<br/>색 우선순위: <span style="color:#ff8800">주황</span> > <span style="color:#9944ff">보라</span> > <span style="color:#ffff00">노랑</span> > <span style="color:#88ccff">기본</span>. 강아지는 이 방문 기억으로 이미 수색한 영역과 안 간 영역을 구분.<br/><br/><b>※ 방문셀은 heading 추정에 직접 사용 안 됨</b>. 장애물 회피 backtracking 전용.<br/><br/><b>Last Contacts (heading 추정 기반)</b>: 냄새흔적 감지 시 월드좌표(wx,wy)를 lastContacts에 저장. 최대 <b>10개</b>(maxContacts) FIFO.<br/><b>Est.Heading 계산</b>: lastContacts에 <b>OLS(Ordinary Least Squares) 선형회귀</b> 적용. 접촉점 2개 미만=NaN, 2개=chord 방향, 3개 이상=전체 점 OLS 회귀 → 첫점/마지막점 회귀선 투영 → atan2.<br/><br/><b>Surge(돌진)</b>: lastContacts 접촉 누적 → "도망자 근접" 판단 → 속도 증가 직선 돌진. 탐색섹터 확장.<br/><br/><b>Cast(좌우탐색)</b>: 냄새흔적 놓침(lost) → 방문셀 기억 참고, 마지막 접촉 <span style="color:#ff8800">주황색 셀</span> 근처를 <span style="color:#00ffff">청록색 경계</span> 사이로 좌우 휘저으며 재탐색. 이미 방문한 셀은 피하고 새로운 셀 위주 탐색.</p>
      <p><b>Est. Heading (추정방향)</b>: <span style="color:#ffaa00">호박색 화살표</span>. lastContacts 10개 이하 접촉점의 <b>OLS 선형회귀</b>로 계산한 도망자 예상 이동 방향</p>
      <p><b>Target Heading (목표방향)</b>: <span style="color:#ff6600">진주황 화살표</span>. 실제로 강아지가 향할 목표 방향. Cast 상태에서는 좌우로 진동, Surge 상태에서는 직선 고정</p>
    </div>
  </div>
`;
helpOverlay.style.display = 'none';
app.appendChild(helpOverlay);

const helpBtn = controlsPanel.querySelector<HTMLButtonElement>('#help-btn')!;
helpBtn.addEventListener('click', () => {
  helpOverlay.style.display = 'flex';
});

const helpClose = helpOverlay.querySelector<HTMLButtonElement>('#help-close')!;
helpClose.addEventListener('click', () => {
  helpOverlay.style.display = 'none';
});

helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) helpOverlay.style.display = 'none';
});

// Tracking parameters panel
const trackingPanel = document.createElement('div');
trackingPanel.id = 'tracking-panel';
trackingPanel.innerHTML = `
  <fieldset>
    <legend>Tracking Params</legend>
    <label><span>detectThreshold</span><input type="range" id="tp-detectThreshold" min="0.01" max="2" step="0.01" value="0.25" /><span class="slider-value" id="tpv-detectThreshold">0.25</span></label>
    <label><span>tauMemory</span><input type="range" id="tp-tauMemory" min="0.1" max="10" step="0.1" value="3.0" /><span class="slider-value" id="tpv-tauMemory">3.0</span></label>
    <label><span>sigmaBase</span><input type="range" id="tp-sigmaBase" min="0.01" max="0.5" step="0.01" value="0.08" /><span class="slider-value" id="tpv-sigmaBase">0.08</span></label>
    <label><span>sigmaMin</span><input type="range" id="tp-sigmaMin" min="0.01" max="0.5" step="0.01" value="0.05" /><span class="slider-value" id="tpv-sigmaMin">0.05</span></label>
    <label><span>sigmaMax</span><input type="range" id="tp-sigmaMax" min="0.1" max="5" step="0.1" value="1.2" /><span class="slider-value" id="tpv-sigmaMax">1.2</span></label>
    <label><span>lambda</span><input type="range" id="tp-lambda" min="1" max="100" step="1" value="25" /><span class="slider-value" id="tpv-lambda">25</span></label>
    <label><span>xi</span><input type="range" id="tp-xi" min="1" max="200" step="1" value="50" /><span class="slider-value" id="tpv-xi">50</span></label>
    <label><span>kLost</span><input type="range" id="tp-kLost" min="0" max="1" step="0.01" value="0.12" /><span class="slider-value" id="tpv-kLost">0.12</span></label>
    <label><span>kPatch</span><input type="range" id="tp-kPatch" min="0" max="2" step="0.01" value="0.4" /><span class="slider-value" id="tpv-kPatch">0.40</span></label>
    <label><span>initialRadius</span><input type="range" id="tp-initialRadius" min="1" max="50" step="0.5" value="8" /><span class="slider-value" id="tpv-initialRadius">8.0</span></label>
    <label><span>kRadius</span><input type="range" id="tp-kRadius" min="1" max="100" step="0.5" value="20" /><span class="slider-value" id="tpv-kRadius">20.0</span></label>
    <label><span>castAngleMax</span><input type="range" id="tp-castAngleMax" min="0.1" max="3.14" step="0.01" value="1.0" /><span class="slider-value" id="tpv-castAngleMax">1.00</span></label>
    <label><span>castTurnTolerance</span><input type="range" id="tp-castTurnTolerance" min="0.01" max="0.5" step="0.01" value="0.08" /><span class="slider-value" id="tpv-castTurnTolerance">0.08</span></label>
    <label><span>lostRadius</span><input type="range" id="tp-lostRadius" min="10" max="200" step="1" value="80" /><span class="slider-value" id="tpv-lostRadius">80</span></label>
    <label><span>lostTurnRate</span><input type="range" id="tp-lostTurnRate" min="0.1" max="3" step="0.1" value="0.8" /><span class="slider-value" id="tpv-lostTurnRate">0.8</span></label>
    <label><span>surgeDuration</span><input type="range" id="tp-surgeDuration" min="0.1" max="3" step="0.1" value="0.5" /><span class="slider-value" id="tpv-surgeDuration">0.5</span></label>
    <label><span>maxContacts</span><input type="range" id="tp-maxContacts" min="2" max="20" step="1" value="10" /><span class="slider-value" id="tpv-maxContacts">10</span></label>
    <label><span>surgeCastScale</span><input type="range" id="tp-surgeCastThresholdScale" min="0.1" max="1.0" step="0.1" value="0.5" /><span class="slider-value" id="tpv-surgeCastThresholdScale">0.5</span></label>
    <label><span>minSpeed</span><input type="range" id="tp-minSpeed" min="0.5" max="10" step="0.5" value="1" /><span class="slider-value" id="tpv-minSpeed">1.0</span></label>
    <label><span>maxSpeed</span><input type="range" id="tp-maxSpeed" min="1" max="20" step="1" value="5" /><span class="slider-value" id="tpv-maxSpeed">5</span></label>
    <label><span>kSpeedSigma</span><input type="range" id="tp-kSpeedSigma" min="0.1" max="5" step="0.1" value="1.2" /><span class="slider-value" id="tpv-kSpeedSigma">1.2</span></label>
    <label><span>sensorRadius</span><input type="range" id="tp-sensorRadius" min="0.1" max="10" step="0.1" value="3" /><span class="slider-value" id="tpv-sensorRadius">3.0</span></label>
    <label><span>sensorFanAngle</span><input type="range" id="tp-sensorFanAngle" min="10" max="180" step="5" value="110" /><span class="slider-value" id="tpv-sensorFanAngle">110°</span></label>
    <label><span>castLostScale</span><input type="range" id="tp-castLostScale" min="0" max="5" step="0.1" value="0.5" /><span class="slider-value" id="tpv-castLostScale">0.5</span></label>
    <label><span>castFlipMargin</span><input type="range" id="tp-castFlipMargin" min="0.3" max="1.0" step="0.05" value="0.5" /><span class="slider-value" id="tpv-castFlipMargin">0.50</span></label>
    <label><span>castFlipScaleMax</span><input type="range" id="tp-castFlipScaleMax" min="0.3" max="2.0" step="0.1" value="1.7" /><span class="slider-value" id="tpv-castFlipScaleMax">1.7</span></label>
    <label><span>flipRampStart</span><input type="range" id="tp-flipRampStart" min="0.3" max="1.0" step="0.05" value="0.8" /><span class="slider-value" id="tpv-flipRampStart">0.80</span></label>
    <label><span>flipRampStep</span><input type="range" id="tp-flipRampStep" min="0.05" max="0.5" step="0.05" value="0.1" /><span class="slider-value" id="tpv-flipRampStep">0.10</span></label>
    <label><span>flipTurnRate</span><input type="range" id="tp-flipTurnRate" min="2" max="20" step="1" value="8" /><span class="slider-value" id="tpv-flipTurnRate">8</span></label>
    <label><span>visionRange</span><input type="range" id="tp-visionRange" min="1" max="30" step="0.5" value="10" /><span class="slider-value" id="tpv-visionRange">10</span></label>
    <label><span>visionConeAngle</span><input type="range" id="tp-visionConeAngle" min="10" max="120" step="5" value="80" /><span class="slider-value" id="tpv-visionConeAngle">80°</span></label>
  </fieldset>
`;

app.appendChild(trackingPanel);
const tpKeys = [
  'sensorRadius',
  'sensorFanAngle',
  'detectThreshold',
  'tauMemory',
  'sigmaBase',
  'sigmaMin',
  'sigmaMax',
  'lambda',
  'xi',
  'kLost',
  'kPatch',
  'initialRadius',
  'kRadius',
  'castAngleMax',
  'castTurnTolerance',
  'lostRadius',
  'lostTurnRate',
  'surgeDuration',
  'maxContacts',
  'surgeCastThresholdScale',
  'minSpeed',
  'maxSpeed',
  'kSpeedSigma',
  'castLostScale',
  'castFlipMargin',
  'castFlipScaleMax',
  'flipRampStart',
  'flipRampStep',
  'flipTurnRate',
  'visionRange',
  'visionConeAngle'
] as const;

function formatTp(value: number, key?: string): string {
  if (key === 'visionConeAngle') return Math.round(((value * 180) / Math.PI) * 2) + '°';
  if (key === 'sensorFanAngle') return Math.round((value * 180) / Math.PI) + '°';
  if (Number.isInteger(value)) return String(value);
  if (value < 0.1 || value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

// Initialize slider values from DEFAULT_TRACKING_PARAMS (single source of truth)
for (const key of tpKeys) {
  const slider = trackingPanel.querySelector<HTMLInputElement>(`#tp-${key}`)!;
  const display = trackingPanel.querySelector<HTMLElement>(`#tpv-${key}`)!;
  const defaultValue = DEFAULT_TRACKING_PARAMS[key as keyof typeof DEFAULT_TRACKING_PARAMS];

  if (key === 'visionConeAngle') {
    // Config stores half-angle in radians, slider shows total cone angle in degrees
    const deg = Math.round(((defaultValue * 180) / Math.PI) * 2);
    slider.value = String(deg);
    display.textContent = deg + '°';
  } else if (key === 'sensorFanAngle') {
    // Config stores total angle in radians, slider shows degrees
    const deg = Math.round((defaultValue * 180) / Math.PI);
    slider.value = String(deg);
    display.textContent = deg + '°';
  } else {
    slider.value = String(defaultValue);
    display.textContent = formatTp(defaultValue);
  }
}

for (const key of tpKeys) {
  const slider = trackingPanel.querySelector<HTMLInputElement>(`#tp-${key}`)!;
  const display = trackingPanel.querySelector<HTMLElement>(`#tpv-${key}`)!;
  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    if (key === 'visionConeAngle') {
      // Slider shows total degrees, config stores half-angle radians
      const halfRad = ((val / 2) * Math.PI) / 180;
      display.textContent = formatTp(halfRad, key);
      runtime.setTrackingParam(key, halfRad);
    } else if (key === 'sensorFanAngle') {
      const rad = (val * Math.PI) / 180;
      display.textContent = formatTp(rad, key);
      runtime.setTrackingParam(key, rad);
    } else {
      display.textContent = formatTp(val);
      runtime.setTrackingParam(key, val);
    }
  });
}

// Debug values panel
const debugPanel = document.createElement('div');
debugPanel.id = 'debug-panel';
debugPanel.innerHTML = `
  <fieldset>
    <legend>pursuer state</legend>
    <div class="debug-row"><span>state</span><span id="dv-state">-</span></div>
    <div class="debug-row"><span>sigma</span><span id="dv-sigma">-</span></div>
    <div class="debug-row"><span>estHeading</span><span id="dv-estimatedHeading">-</span></div>
    <div class="debug-row"><span>tgtHeading</span><span id="dv-targetHeading">-</span></div>
    <div class="debug-row"><span>searchR</span><span id="dv-searchRadius">-</span></div>
    <div class="debug-row"><span>lostTime</span><span id="dv-lostTime">-</span></div>
    <div class="debug-row"><span>trailSig</span><span id="dv-lastTrailSignal">-</span></div>
    <div class="debug-row"><span>L</span><span id="dv-lastContactDistance">-</span></div>
    <div class="debug-row"><span>xi</span><span id="dv-curvatureRadius">-</span></div>
    <div class="debug-row"><span>castSide</span><span id="dv-castSide">-</span></div>
    <div class="debug-row"><span>flipScale</span><span id="dv-flipScale">-</span></div>
    <div class="debug-row"><span>speed</span><span id="dv-currentSpeed">-</span></div>
    <div class="debug-row"><span>contacts</span><span id="dv-contactsCount">-</span></div>
    <div class="debug-row"><span>pos</span><span id="dv-pos">-</span></div>
  </fieldset>
`;
leftPanels.appendChild(debugPanel);

const debugKeys = [
  'state',
  'sigma',
  'estimatedHeading',
  'targetHeading',
  'searchRadius',
  'lostTime',
  'lastTrailSignal',
  'lastContactDistance',
  'curvatureRadius',
  'castSide',
  'flipScale',
  'currentSpeed',
  'contactsCount'
] as const;

function formatDebug(value: number | string): string {
  if (typeof value === 'string') return value;
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) < 0.001) return '0';
  return value.toFixed(3);
}

setInterval(() => {
  const states = runtime.getPursuerStates();
  if (states.length === 0) return;
  const s = states[0];

  // pos 특별 처리
  const posEl = debugPanel.querySelector<HTMLElement>('#dv-pos');
  if (posEl && s.x !== undefined) {
    posEl.textContent = `${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.height.toFixed(2)}`;
  }

  for (const key of debugKeys) {
    const el = debugPanel.querySelector<HTMLElement>(`#dv-${key}`);
    if (el) {
      const val = s[key as keyof typeof s];
      el.textContent =
        key === 'flipScale' ? (val as number).toFixed(2) : formatDebug(val as number | string);
    }
  }
}, 250);

window.addEventListener('resize', () => runtime.resize());

runtime.resize();
runtime.start();
