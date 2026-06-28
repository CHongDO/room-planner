/* ============================================================
   apps/roomPlanner.js — 방 가구 배치 시뮬레이터 (첫 번째 기능)
   ------------------------------------------------------------
   - 방 모양(사각형/ㄱ자)·크기, 문/창 배치, 가구 드래그 배치
   - 가구 여유 공간, 벽 붙이기 스냅, 회전(드래그/숫자입력)
   - 문 막힘/채광 차단 경고, 바닥 활용률 표시
   - 위에서 보기(평면) / 정면 보기(엘리베이션, 읽기 전용) 전환
   - 단위(cm/mm/inch), 언어(한국어/English) 전환
   표준 앱 형태: export default { id, title, icon, mount(container) }
   모든 색/모양은 theme.css 변수 사용. 외부 의존성 없음(순수 정적).
   ============================================================ */

import { icon } from '../icons.js';

export default {
  id: 'room',
  title: '방 배치 시뮬레이터',
  icon: icon('logo', 16),

  mount(container) {
    // ---- 가구 카테고리 정의 (zH = 가구 실제 높이, h = 평면상 깊이) ----
    const FURNITURE_TYPES = [
      { key:'bed',      ic:'bed',      w:110, h:200, zH:45,  role:'accent',  clr:{side:40} },
      { key:'desk',     ic:'desk',     w:120, h:60,  zH:75,  role:'success', clr:{front:70} },
      { key:'chair',    ic:'chair',    w:45,  h:45,  zH:90,  role:'success', clr:{} },
      { key:'wardrobe', ic:'wardrobe', w:100, h:50,  zH:180, role:'warning', clr:{front:65} },
      { key:'hanger',   ic:'hanger',   w:90,  h:25,  zH:170, role:'pro',     clr:{front:35} },
      { key:'bookshelf',ic:'books',    w:80,  h:30,  zH:180, role:'neutral', clr:{} },
      { key:'dresser',  ic:'dresser',  w:80,  h:45,  zH:80,  role:'neutral', clr:{front:50} },
      { key:'custom',   ic:'shapes',   w:100, h:60,  zH:150, role:'neutral', clr:{}, customShape:true },
    ];

    // ---- 상태 ----
    let room = { shape:'rect', w:300, h:350, notchW:100, notchH:100, zH:240 };
    let items = [
      { id:1, key:'bed',  w:110, h:200, zH:45, clrFront:0,  clrSide:40, x:10,  y:10,  rot:0, shape:'rect' },
      { id:2, key:'desk', w:120, h:60,  zH:75, clrFront:70, clrSide:0,  x:140, y:280, rot:0, shape:'rect' },
    ];
    let openings = [
      { id:101, kind:'door',   wall:'bottom', pos:0.5, len:90,  sill:0,  zH:200 },
      { id:102, kind:'window', wall:'top',    pos:0.6, len:120, sill:90, zH:120 },
    ];
    let nextId = 3, nextOpenId = 103;
    let dragState = null, openDrag = null, rotateDrag = null;
    let showClear = true, snapOn = true;
    let view = 'plan', elevWall = 'bottom';
    let lastElevLayout = null; // renderElev()가 채워두는 {scale, offsetX, horiz} - 줄자 계산용
    const SNAP = 12, DOOR_CLR = 90, WIN_CLR = 40;
    const MAX_W = 920, MAX_H = 720;

    // ---- 단위 변환 (내부 저장은 항상 cm, 화면 표시/입력만 변환) ----
    const UNITS = {
      cm:   { label:'cm', factor:1,      decimals:0 },
      mm:   { label:'mm', factor:10,     decimals:0 },
      inch: { label:'in', factor:1/2.54, decimals:1 },
    };
    let unit = 'cm';
    function toDisplay(cmVal) {
      const u = UNITS[unit], f = 10**u.decimals;
      return Math.round((cmVal||0)*u.factor*f)/f;
    }
    function fromDisplay(val) {
      return (val||0) / UNITS[unit].factor;
    }
    function readNum(el, fallbackCm) {
      const v = Number(el.value);
      return Number.isNaN(v) ? fallbackCm : fromDisplay(v);
    }
    function convAttr(baseMin, baseMax, baseStep) {
      const u = UNITS[unit], f = 10**u.decimals;
      const round = (v) => Math.round(v*u.factor*f)/f;
      return { min: round(baseMin), max: round(baseMax), step: round(baseStep) || (u.decimals ? 0.1 : 1) };
    }

    // ---- 언어(i18n) ----
    let lang = 'ko';
    const STR = {
      shapeRect:    { ko:'사각형', en:'Rectangle' },
      shapeL:       { ko:'ㄱ자',   en:'L-shape' },
      clearLabel:   { ko:'여유 공간', en:'Clearance' },
      snapLabel:    { ko:'벽 붙이기', en:'Snap to wall' },
      unitLabel:    { ko:'단위', en:'Unit' },
      langLabel:    { ko:'언어', en:'Language' },
      widthLabel:   { ko:'가로', en:'Width' },
      depthLabel:   { ko:'세로', en:'Depth' },
      notchWLabel:  { ko:'잘린폭', en:'Notch width' },
      notchHLabel:  { ko:'잘린높이', en:'Notch height' },
      applyBtn:     { ko:'적용', en:'Apply' },
      openingsLabel:{ ko:'개구부', en:'Openings' },
      doorBtn:      { ko:'문', en:'Door' },
      windowBtn:    { ko:'창문', en:'Window' },
      openingHint:  { ko:'문/창을 끌면 벽을 따라 이동해요', en:'Drag a door or window to slide it along the wall' },
      furniturePanelLabel: { ko:'가구 추가', en:'Add furniture' },
      settingsLabel: { ko:'설정', en:'Settings' },
      usageStatLabel:{ ko:'바닥 활용률', en:'Floor usage' },
      warnStatLabel:{ ko:'경고', en:'Warnings' },
      warnUnit:     { ko:'건', en:'' },
      blockDoorMsg: { ko:'문 여는 공간이 막혀 있어요', en:"The door's opening space is blocked" },
      blockWinMsg:  { ko:'창문이 가구로 가려져 채광이 막혀요', en:'Furniture is blocking the window light' },
      helpText: {
        ko:[
          '파란 띠=문(앞 여는 공간), 하늘 띠=창문(앞 채광).',
          '빗금=가구 여유 공간(팔레트에서 앞/측 여유를 직접 조절할 수 있어요).',
          '가구가 문 여는 자리나 창문을 막으면 빨갛게 표시돼요.',
          '가구 위 회전 손잡이를 끌거나(Shift: 15° 단위 스냅), 위쪽 숫자칸에 각도를 직접 입력해 회전하세요.',
          '창문 위 숫자칸은 창틀 높이예요 — 가구 높이가 창틀보다 낮으면 채광을 막지 않아요.',
          '가구·문·창 우측 상단의 × 버튼으로 각각 삭제할 수 있어요.',
          '상단의 cm/mm/in 버튼으로 표시 단위를, 언어 버튼으로 한국어/English를 바꿀 수 있어요.',
        ],
        en:[
          'Blue band = door (swing clearance), light-blue band = window (light clearance).',
          'Hatched area = furniture clearance (adjust front/side clearance per item in the palette).',
          'Furniture blocking a door swing or window turns red.',
          'Drag the rotate handle above a furniture item (hold Shift for 15° steps), or type an angle directly in the number box above it.',
          'The number box above a window is its sill height — furniture shorter than the sill won’t block the light.',
          'Use the × button on furniture/doors/windows to delete them.',
          'Use the cm/mm/in buttons to change the display unit, and the language buttons to switch 한국어/English.',
        ],
      },
      addFurnBtn:   { ko:'추가', en:'Add' },
      unitCaptionPrefix:{ ko:'단위: ', en:'Unit: ' },
      frontClrLabel:{ ko:'앞', en:'Front' },
      sideClrLabel: { ko:'측', en:'Side' },
      deleteTitle:  { ko:'삭제', en:'Delete' },
      rotateTitle:  { ko:'드래그해서 회전 (Shift: 15° 단위)', en:'Drag to rotate (hold Shift for 15° steps)' },
      angleTitle:   { ko:'각도(0~359도) 직접 입력', en:'Enter angle directly (0–359°)' },
      sillTitle:    { ko:'창틀 높이(바닥~창문 아래까지, {u}) — 이보다 낮은 가구는 채광을 가리지 않아요', en:'Window sill height (floor to bottom of window, {u}) — furniture shorter than this won’t block the light' },
      heightWord:   { ko:'높이', en:'height' },
      rotWord:      { ko:'회전', en:'rotation' },
      positionWord: { ko:'위치', en:'position' },
      viewPlan:     { ko:'위에서 보기', en:'Top view' },
      viewElev:     { ko:'정면 보기', en:'Front view' },
      wallFront:    { ko:'앞', en:'Front' },
      wallBack:     { ko:'뒤', en:'Back' },
      wallLeft:     { ko:'좌', en:'Left' },
      wallRight:    { ko:'우', en:'Right' },
      elevHint:     { ko:'정면 보기는 높이 비교용 보기 전용 화면이에요. 가구를 옮기려면 위에서 보기로 전환하세요.', en:'Front view is read-only and for comparing heights. Switch to top view to move furniture.' },
      viewingWallLabel: { ko:'보고 있는 벽:', en:'Viewing wall:' },
      tooTallMsg:   { ko:'천장보다 높음', en:'taller than ceiling' },
      floorLabel:   { ko:'바닥', en:'Floor' },
      ceilingLabel: { ko:'천장', en:'Ceiling' },
      shapeTitle:   { ko:'모양', en:'Shape' },
      furn_bed:      { ko:'침대', en:'Bed' },
      furn_desk:     { ko:'책상', en:'Desk' },
      furn_chair:    { ko:'의자', en:'Chair' },
      furn_wardrobe: { ko:'옷장(여닫이)', en:'Wardrobe (hinged)' },
      furn_hanger:   { ko:'행거', en:'Garment rack' },
      furn_bookshelf:{ ko:'책장', en:'Bookshelf' },
      furn_dresser:  { ko:'서랍장', en:'Dresser' },
      furn_custom:   { ko:'기타', en:'Custom' },
      shape_rect:    { ko:'사각형', en:'Rectangle' },
      shape_circle:  { ko:'원', en:'Circle' },
      shape_triangle:{ ko:'삼각형', en:'Triangle' },
    };
    function t(key) {
      const e = STR[key];
      return e ? e[lang] : key;
    }
    function furnName(key) { return t('furn_'+key); }

    // ---- 마크업 ----
    container.innerHTML = `
      <style>
        .rp-palette-toggle { display: none; }
        .rp-settings-toggle { display: none; }
        .rp-settings-inline { display: contents; } /* row1에 끼워 넣는 span: 데스크탑에선 박스 없이 그대로 펼침 */
        #roomWrap { padding: 36px; }
        /* 방 그리는 영역(#room, #elev)만 다크 블루프린트. 바깥(roomWrap·줄자·툴바)은 라이트 유지. */
        .rp-canvas-surface {
          background-color: var(--canvas-bg);
          background-image:
            repeating-linear-gradient(to right, var(--canvas-grid) 0 1px, transparent 1px 20px),
            repeating-linear-gradient(to bottom, var(--canvas-grid) 0 1px, transparent 1px 20px);
          border: 1px solid var(--canvas-line);
          border-radius: var(--radius-sm);
        }
        /* 768px 이하 모바일에서만 레이아웃을 바꾼다. 데스크탑은 기존 그대로. */
        @media (max-width: 768px) {
          .rp-main { flex-direction: column; flex-wrap: nowrap; }
          .rp-canvas-col { order: 1; width: 100%; flex: 1 1 auto; min-width: 0; }
          .rp-palette-col { order: 2; width: 100%; flex: 1 1 auto; }
          .rp-palette-toggle {
            display: flex; width: 100%; align-items: center; justify-content: space-between;
            margin-bottom: var(--space-2);
          }
          #palette.rp-palette-body { display: none; }
          #palette.rp-palette-body.is-open { display: block; }
          #roomWrap { width: 100%; box-sizing: border-box; padding: 18px 26px; }

          /* 자주 안 쓰는 설정(단위/언어/토글/개구부)은 "설정" 버튼 뒤로 접어둔다 */
          .rp-settings-toggle { display: inline-flex; }
          .rp-settings-inline { display: none; }
          .rp-settings-fold { display: none; }
          .rp-settings-open .rp-settings-inline {
            display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; width: 100%;
          }
          .rp-settings-open .rp-settings-fold { display: flex; }

          /* 1차 화면에 남는 버튼들을 한 줄에 더 모이도록 살짝 축소 */
          .rp-compact-ctl.btn { height: 28px; padding: 0 8px; font-size: var(--font-size-sm); }
          .rp-compact-ctl.toggle-pill { padding: 4px 8px; font-size: var(--font-size-sm); }
        }
      </style>
      <div class="card">
        <div class="row" style="margin-bottom:8px;">
          <button class="btn rp-compact-ctl" id="shapeRectBtn" data-i18n="shapeRect">사각형</button>
          <button class="btn rp-compact-ctl" id="shapeLBtn" data-i18n="shapeL">ㄱ자</button>
          <button type="button" class="btn rp-compact-ctl rp-settings-toggle" id="settingsToggle" aria-expanded="false" aria-controls="rpSettingsGroup rpOpeningsRow">
            ${icon('settings',14)} <span data-i18n="settingsLabel">설정</span> <span class="rp-caret" aria-hidden="true">▾</span>
          </button>
          <span class="rp-settings-inline" id="rpSettingsGroup">
            <div class="toggle-pill rp-compact-ctl" id="clearToggle">
              ${icon('maximize',16)} <span data-i18n="clearLabel">여유 공간</span> <span class="state" id="clearState">ON</span>
            </div>
            <div class="toggle-pill rp-compact-ctl" id="snapToggle">
              ${icon('magnet',16)} <span data-i18n="snapLabel">벽 붙이기</span> <span class="state" id="snapState">ON</span>
            </div>
            <span class="muted" style="margin-left:8px;" data-i18n="unitLabel">단위</span>
            <button class="btn rp-compact-ctl unit-btn" data-unit="cm">cm</button>
            <button class="btn rp-compact-ctl unit-btn" data-unit="mm">mm</button>
            <button class="btn rp-compact-ctl unit-btn" data-unit="inch">in</button>
            <span class="muted" style="margin-left:8px;" data-i18n="langLabel">언어</span>
            <button class="btn rp-compact-ctl lang-btn" data-lang="ko">한국어</button>
            <button class="btn rp-compact-ctl lang-btn" data-lang="en">English</button>
          </span>
        </div>

        <div class="row" style="margin-bottom:8px;">
          <label class="muted" data-i18n="widthLabel">가로</label>
          <input class="input" type="number" id="roomW" value="300" min="150" max="700" step="10" style="width:82px;">
          <span class="muted unit-label">cm</span>
          <label class="muted" data-i18n="depthLabel">세로</label>
          <input class="input" type="number" id="roomH" value="350" min="150" max="700" step="10" style="width:82px;">
          <span class="muted unit-label">cm</span>
          <span id="notchInputs" style="display:none; gap:6px; align-items:center;">
            <label class="muted" data-i18n="notchWLabel">잘린폭</label>
            <input class="input" type="number" id="notchW" value="100" min="50" max="650" step="10" style="width:76px;">
            <span class="muted unit-label">cm</span>
            <label class="muted" data-i18n="notchHLabel">잘린높이</label>
            <input class="input" type="number" id="notchH" value="100" min="50" max="650" step="10" style="width:76px;">
            <span class="muted unit-label">cm</span>
          </span>
          <button class="btn rp-compact-ctl" id="applyBtn" data-i18n="applyBtn">적용</button>
          <span class="muted" id="pyeongLabel" style="margin-left:auto;">약 3.2평</span>
        </div>

        <div class="row rp-settings-fold" id="rpOpeningsRow" style="margin-bottom:12px; padding:8px; border:1px solid var(--border); border-radius:var(--radius-sm);">
          <span class="muted" data-i18n="openingsLabel">개구부</span>
          <button class="btn rp-compact-ctl add-open" data-kind="door">${icon('plus',14)} <span data-i18n="doorBtn">문</span></button>
          <button class="btn rp-compact-ctl add-open" data-kind="window">${icon('plus',14)} <span data-i18n="windowBtn">창문</span></button>
          <span class="muted" data-i18n="openingHint">문/창을 끌면 벽을 따라 이동해요</span>
        </div>

        <div class="rp-main" style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start;">
          <div class="rp-palette-col" style="flex:0 0 240px;">
            <button type="button" class="btn rp-palette-toggle" id="paletteToggle" aria-expanded="false" aria-controls="palette">
              <span data-i18n="furniturePanelLabel">가구 추가</span>
              <span class="rp-caret" aria-hidden="true">▾</span>
            </button>
            <div id="palette" class="rp-palette-body"></div>
          </div>
          <div class="rp-canvas-col" style="flex:1; min-width:260px;">
            <div class="row" style="margin-bottom:8px;">
              <button class="btn view-tab" data-view="plan">${icon('logo',14)} <span data-i18n="viewPlan">위에서 보기</span></button>
              <button class="btn view-tab" data-view="elev">${icon('eye',14)} <span data-i18n="viewElev">정면 보기</span></button>
              <span id="elevWalls" style="display:none; gap:4px; align-items:center;">
                <button class="btn wall-btn" data-wall="bottom" data-i18n="wallFront">앞</button>
                <button class="btn wall-btn" data-wall="top" data-i18n="wallBack">뒤</button>
                <button class="btn wall-btn" data-wall="left" data-i18n="wallLeft">좌</button>
                <button class="btn wall-btn" data-wall="right" data-i18n="wallRight">우</button>
                <span class="muted" id="elevWallLabel" style="margin-left:8px; font-weight:600;"></span>
              </span>
            </div>
            <div id="roomWrap" style="position:relative; background:var(--surface-2); border-radius:var(--radius); display:flex; justify-content:center;">
              <div id="rulerLayer" style="position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none;"></div>
              <span class="plan-wall-label" id="wallLabelTop" style="position:absolute; font-size:10px; color:var(--text-link); cursor:pointer; white-space:nowrap;"></span>
              <span class="plan-wall-label" id="wallLabelBottom" style="position:absolute; font-size:10px; color:var(--text-link); cursor:pointer; white-space:nowrap;"></span>
              <span class="plan-wall-label" id="wallLabelLeft" style="position:absolute; font-size:10px; color:var(--text-link); cursor:pointer; white-space:nowrap;"></span>
              <span class="plan-wall-label" id="wallLabelRight" style="position:absolute; font-size:10px; color:var(--text-link); cursor:pointer; white-space:nowrap;"></span>
              <div id="room" class="rp-canvas-surface" style="position:relative; overflow:hidden;"></div>
              <div id="elev" class="rp-canvas-surface" style="position:relative; overflow:hidden; display:none;"></div>
            </div>
            <p id="elevHint" class="muted" style="display:none; margin:6px 0 0; line-height:1.6;" data-i18n="elevHint"></p>
            <div class="row" style="margin-top:12px; align-items:stretch;">
              <div class="stat-box"><p class="label" data-i18n="usageStatLabel">바닥 활용률</p><p class="value" id="usageStat">0%</p></div>
              <div class="stat-box"><p class="label" data-i18n="warnStatLabel">경고</p><p class="value" id="warnStat">0건</p></div>
            </div>
            <p id="warnMsg" style="font-size:12px; color:var(--text-danger); margin:8px 0 0; min-height:1px;"></p>
            <ul id="helpList" class="muted" style="margin:6px 0 0; padding:0; list-style:none; line-height:1.6;"></ul>
          </div>
        </div>
      </div>
    `;

    const $ = (s) => container.querySelector(s);
    const roomEl = $('#room');
    const elevEl = $('#elev');
    const paletteEl = $('#palette');

    // 모바일 전용 가구 패널 토글(아코디언). 데스크탑 폭에서는 CSS가 always-open으로 덮어쓴다.
    const paletteToggleBtn = $('#paletteToggle');
    function setPaletteOpen(open) {
      paletteEl.classList.toggle('is-open', open);
      paletteToggleBtn.setAttribute('aria-expanded', String(open));
      paletteToggleBtn.querySelector('.rp-caret').textContent = open ? '▴' : '▾';
    }
    paletteToggleBtn.addEventListener('click', () => setPaletteOpen(!paletteEl.classList.contains('is-open')));
    setPaletteOpen(false);

    // 모바일 전용 "설정" 아코디언(단위/언어/토글/개구부). 데스크탑에선 CSS가 항상 펼친 상태로 둔다.
    const settingsToggleBtn = $('#settingsToggle');
    function setSettingsOpen(open) {
      container.classList.toggle('rp-settings-open', open);
      settingsToggleBtn.setAttribute('aria-expanded', String(open));
      settingsToggleBtn.querySelector('.rp-caret').textContent = open ? '▴' : '▾';
    }
    settingsToggleBtn.addEventListener('click', () => setSettingsOpen(!container.classList.contains('rp-settings-open')));
    setSettingsOpen(false);

    // 좁은 화면(768px 이하)에선 줄자 폰트/여백을 줄여 캔버스 안에 더 깔끔히 들어오게 한다.
    const isCompactUI = () => window.innerWidth <= 768;

    // ---- 기하/유틸 ----
    // 평면 캔버스가 쓸 수 있는 실제 가로 폭(모바일처럼 #roomWrap이 MAX_W보다
    // 좁을 때 그 폭에 맞춰 줌). 이 폭이 없으면(첫 렌더 전) MAX_W로 대체.
    function getPlanAvailWidth() {
      const wrap = $('#roomWrap');
      if (!wrap) return MAX_W;
      const cs = getComputedStyle(wrap);
      const pad = (parseFloat(cs.paddingLeft)||0) + (parseFloat(cs.paddingRight)||0);
      const w = wrap.clientWidth - pad;
      return w > 0 ? Math.min(w, MAX_W) : MAX_W;
    }
    const getScale = () => Math.min(getPlanAvailWidth()/room.w, MAX_H/room.h);
    const findType = (key) => FURNITURE_TYPES.find((f) => f.key === key);
    const rotatePoint = (x, y, deg) => {
      const r = deg*Math.PI/180, c = Math.cos(r), s = Math.sin(r);
      return { x: x*c - y*s, y: x*s + y*c };
    };
    const effDims = (it) => {
      const r = (it.rot||0)*Math.PI/180;
      const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
      return { w: it.w*c + it.h*s, h: it.w*s + it.h*c };
    };
    // 가구 중심 기준 로컬 사각형(lx,ly,lw,lh)을 it.rot만큼 회전했을 때
    // 충돌판정용 바운딩박스(aabb)와 표시용 중심좌표(render)를 계산
    function localRectToWorld(cx, cy, lx, ly, lw, lh, rotDeg) {
      const corners = [[lx,ly],[lx+lw,ly],[lx,ly+lh],[lx+lw,ly+lh]].map(([x,y]) => rotatePoint(x,y,rotDeg));
      const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const center = rotatePoint(lx+lw/2, ly+lh/2, rotDeg);
      return {
        aabb: { x:cx+minX, y:cy+minY, w:maxX-minX, h:maxY-minY },
        render: { cx:cx+center.x, cy:cy+center.y, w:lw, h:lh },
      };
    }
    const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
    const notchRect = () => ({ x:room.w-room.notchW, y:0, w:room.notchW, h:room.notchH });
    const inNotch = (r) => room.shape==='lshape' && overlap(r, notchRect());

    // 캔버스(다크 블루프린트) 안에서 쓰는 가구 카테고리 색. 색 의미(카테고리 구분)는
    // 라이트 UI와 동일하게 유지하되, 어두운 배경에서 보이도록 채도/명도만 다르게 잡은 세트.
    function roleColors(role) {
      if (role==='neutral') return { bg:'var(--canvas-bg-neutral)', border:'var(--canvas-border-neutral)', text:'var(--canvas-text-neutral)' };
      return { bg:`var(--canvas-bg-${role})`, border:`var(--canvas-border-${role})`, text:`var(--canvas-text-${role})` };
    }

    function clamp(it) {
      const d = effDims(it);
      it.x = Math.max(0, Math.min(it.x, room.w - d.w));
      it.y = Math.max(0, Math.min(it.y, room.h - d.h));
    }
    function applySnap(it) {
      if (!snapOn) return;
      const d = effDims(it);
      if (it.x <= SNAP) it.x = 0;
      if (it.y <= SNAP) it.y = 0;
      if (room.w - (it.x+d.w) <= SNAP) it.x = room.w-d.w;
      if (room.h - (it.y+d.h) <= SNAP) it.y = room.h-d.h;
    }
    // 중심을 고정한 채 각도만 바꿔서 회전 중 위치가 튀지 않게 함
    function setRot(it, deg) {
      const oldD = effDims(it);
      const cx = it.x + oldD.w/2, cy = it.y + oldD.h/2;
      it.rot = ((Math.round(deg) % 360) + 360) % 360;
      const newD = effDims(it);
      it.x = cx - newD.w/2;
      it.y = cy - newD.h/2;
    }

    function openingGeom(op) {
      const len = op.len, t = 8;
      if (op.wall==='top')    return { x:(room.w-len)*op.pos, y:0,         w:len, h:t };
      if (op.wall==='bottom') return { x:(room.w-len)*op.pos, y:room.h-t,  w:len, h:t };
      if (op.wall==='left')   return { x:0,        y:(room.h-len)*op.pos,  w:t,   h:len };
      return                          { x:room.w-t, y:(room.h-len)*op.pos,  w:t,   h:len };
    }
    function openingClearRect(op) {
      const g = openingGeom(op);
      const depth = op.kind==='door' ? DOOR_CLR : WIN_CLR;
      if (op.wall==='top')    return { x:g.x, y:0,            w:g.w,   h:depth };
      if (op.wall==='bottom') return { x:g.x, y:room.h-depth, w:g.w,   h:depth };
      if (op.wall==='left')   return { x:0,          y:g.y,   w:depth, h:g.h };
      return                         { x:room.w-depth, y:g.y, w:depth, h:g.h };
    }

    function clearanceRects(it) {
      if (!showClear) return [];
      const front = it.clrFront||0, side = it.clrSide||0;
      if (!front && !side) return [];
      const d = effDims(it);
      const cx = it.x + d.w/2, cy = it.y + d.h/2;
      const pieces = [];
      if (front>0) pieces.push(localRectToWorld(cx, cy, -it.w/2, it.h/2, it.w, front, it.rot));
      if (side>0) {
        pieces.push(localRectToWorld(cx, cy, -it.w/2-side, -it.h/2, side, it.h, it.rot));
        pieces.push(localRectToWorld(cx, cy,  it.w/2,      -it.h/2, side, it.h, it.rot));
      }
      return pieces;
    }

    function computeFlags() {
      const bodies = items.map((it) => { const d = effDims(it); return { id:it.id, x:it.x, y:it.y, w:d.w, h:d.h }; });
      let blockDoor = false, blockWin = false;
      items.forEach((it) => { it.invalid = false; it.clrWarn = false; });
      items.forEach((it) => {
        const d = effDims(it); const body = { x:it.x, y:it.y, w:d.w, h:d.h };
        if (inNotch(body)) it.invalid = true;
        bodies.forEach((b) => { if (b.id!==it.id && overlap(body,b)) it.invalid = true; });
        openings.forEach((op) => {
          const cr = openingClearRect(op);
          if (!overlap(body, cr)) return;
          if (op.kind==='door') { it.invalid = true; blockDoor = true; return; }
          // 창문: 가구 높이가 창틀(sill)보다 낮으면 채광을 가리지 않음
          if (it.zH > (op.sill||0)) { it.invalid = true; blockWin = true; }
        });
        clearanceRects(it).forEach((piece) => {
          const cr = piece.aabb;
          bodies.forEach((b) => { if (b.id!==it.id && overlap(cr,b)) it.clrWarn = true; });
          if (inNotch(cr)) it.clrWarn = true;
        });
      });
      return { blockDoor, blockWin };
    }

    const netArea = () => room.shape==='lshape'
      ? Math.max(0, room.w*room.h - room.notchW*room.notchH)
      : room.w*room.h;

    function nearestWall(px, py) {
      const dl=px, dr=room.w-px, dt=py, db=room.h-py;
      const m = Math.min(dl,dr,dt,db);
      if (m===dt) return 'top'; if (m===db) return 'bottom'; if (m===dl) return 'left'; return 'right';
    }

    // 가구 모양별 시각 스타일 (충돌판정은 항상 사각 바운딩박스 기준, 모양은 표시용)
    function shapeStyle(shape) {
      if (shape==='circle') return { borderRadius:'50%', clipPath:'none' };
      if (shape==='triangle') return { borderRadius:'0', clipPath:'polygon(50% 0%, 0% 100%, 100% 100%)' };
      return { borderRadius:'6px', clipPath:'none' };
    }

    // 보기 좋은 간격(1·2·5×10ⁿ)으로 줄자 눈금 단위를 고른다.
    function niceTickStep(rangeDisplay, targetTicks) {
      const raw = rangeDisplay/targetTicks;
      if (!(raw>0)) return 1;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw/mag;
      const m = norm<1.5 ? 1 : norm<3 ? 2 : norm<7 ? 5 : 10;
      return m*mag;
    }
    function fmtTick(v) {
      const r = Math.round(v*10)/10;
      return r % 1 === 0 ? String(r) : r.toFixed(1);
    }
    function mkRulerTick(layer, style) {
      const el = document.createElement('div');
      Object.assign(el.style, { position:'absolute', background:'var(--border-strong)', ...style });
      layer.appendChild(el);
    }
    function mkRulerLabel(layer, text, style) {
      const el = document.createElement('span');
      el.textContent = text;
      Object.assign(el.style, { position:'absolute', fontSize:'8px', color:'var(--text-muted)', whiteSpace:'nowrap', ...style });
      layer.appendChild(el);
    }
    // 좁은 화면에서는 줄자 눈금/숫자 크기와 여백을 줄여 캔버스 폭 안에 더 깔끔히 들어오게 한다.
    function rulerGeom() {
      const compact = isCompactUI();
      return {
        tickLen: compact ? 4 : 6,
        outerGap: compact ? 11 : 16,   // 가로 줄자: 위쪽 라벨이 캔버스 가장자리에서 떨어진 거리
        innerGap: compact ? 5 : 8,     // 가로 줄자: 아래쪽 라벨이 눈금에서 떨어진 거리
        sideGap: compact ? 6 : 9,      // 세로 줄자: 라벨이 눈금에서 떨어진 거리
        fontSize: compact ? '7px' : '8px',
      };
    }
    // 평면 뷰: 방 박스 네 변 바깥쪽에 가로·세로 줄자(눈금+숫자)를 그린다.
    function renderPlanRulerInto(layer) {
      const scale = getScale();
      const g = rulerGeom();
      const L = roomEl.offsetLeft, T = roomEl.offsetTop, W = roomEl.offsetWidth, H = roomEl.offsetHeight;
      const stepWDisp = niceTickStep(toDisplay(room.w), 7);
      const stepHDisp = niceTickStep(toDisplay(room.h), 7);
      const stepWCm = fromDisplay(stepWDisp), stepHCm = fromDisplay(stepHDisp);
      for (let k=0; k*stepWCm <= room.w+0.001; k++) {
        const x = L + Math.round(k*stepWCm*scale);
        const label = k===0 ? `0${UNITS[unit].label}` : fmtTick(k*stepWDisp);
        mkRulerTick(layer,  { left:x+'px', top:(T-g.tickLen)+'px',   width:'1px', height:g.tickLen+'px' });
        mkRulerLabel(layer, label, { left:x+'px', top:(T-g.outerGap)+'px',  transform:'translateX(-50%)', fontSize:g.fontSize });
        mkRulerTick(layer,  { left:x+'px', top:(T+H)+'px',   width:'1px', height:g.tickLen+'px' });
        mkRulerLabel(layer, label, { left:x+'px', top:(T+H+g.innerGap)+'px', transform:'translateX(-50%)', fontSize:g.fontSize });
      }
      for (let k=1; k*stepHCm <= room.h+0.001; k++) {
        const y = T + Math.round(k*stepHCm*scale);
        const label = fmtTick(k*stepHDisp);
        mkRulerTick(layer,  { left:(L-g.tickLen)+'px', top:y+'px', width:g.tickLen+'px', height:'1px' });
        mkRulerLabel(layer, label, { left:(L-g.sideGap)+'px', top:y+'px', transform:'translate(-100%,-50%)', fontSize:g.fontSize });
        mkRulerTick(layer,  { left:(L+W)+'px', top:y+'px', width:g.tickLen+'px', height:'1px' });
        mkRulerLabel(layer, label, { left:(L+W+g.sideGap)+'px', top:y+'px', transform:'translate(0,-50%)', fontSize:g.fontSize });
      }
    }
    // 정면 뷰: 캔버스(흰 영역) 바깥쪽에 가로(벽 폭)·세로(바닥~천장) 줄자를 그린다.
    // 세로 줄자는 천장 위치의 눈금은 제외(이미 "천장" 표시가 있어 중복되지 않게).
    function renderElevRulerInto(layer) {
      if (!lastElevLayout) return;
      const { scale, offsetX, horiz } = lastElevLayout;
      const g = rulerGeom();
      const L = elevEl.offsetLeft, T = elevEl.offsetTop, W = elevEl.offsetWidth, H = elevEl.offsetHeight;
      const drawLeft = L + offsetX;
      const stepHorizDisp = niceTickStep(toDisplay(horiz), 7);
      const stepHorizCm = fromDisplay(stepHorizDisp);
      for (let k=0; k*stepHorizCm <= horiz+0.001; k++) {
        const x = drawLeft + Math.round(k*stepHorizCm*scale);
        const label = k===0 ? `0${UNITS[unit].label}` : fmtTick(k*stepHorizDisp);
        mkRulerTick(layer,  { left:x+'px', top:(T+H)+'px',   width:'1px', height:g.tickLen+'px' });
        mkRulerLabel(layer, label, { left:x+'px', top:(T+H+g.innerGap)+'px', transform:'translateX(-50%)', fontSize:g.fontSize });
      }
      const stepZDisp = niceTickStep(toDisplay(room.zH), 6);
      const stepZCm = fromDisplay(stepZDisp);
      for (let k=0; k*stepZCm < room.zH-0.001; k++) {
        const y = T + H - Math.round(k*stepZCm*scale);
        const label = k===0 ? `0${UNITS[unit].label}` : fmtTick(k*stepZDisp);
        mkRulerTick(layer,  { left:(L-g.tickLen)+'px', top:y+'px', width:g.tickLen+'px', height:'1px' });
        mkRulerLabel(layer, label, { left:(L-g.sideGap)+'px', top:y+'px', transform:'translate(-100%,-50%)', fontSize:g.fontSize });
      }
    }
    function positionRulers() {
      const layer = $('#rulerLayer'); if (!layer) return;
      layer.innerHTML = '';
      if (view==='plan') renderPlanRulerInto(layer);
      else renderElevRulerInto(layer);
    }

    // ---- 렌더 (위에서 보기) ----
    function renderRoom() {
      const scale = getScale();
      roomEl.style.width = Math.round(room.w*scale)+'px';
      roomEl.style.height = Math.round(room.h*scale)+'px';
      roomEl.innerHTML = '';
      const flags = computeFlags();

      // ㄱ자 잘린 부분: clip-path 대신 덮개로 표시 → 가구가 그 위로 넘어가도
      // 잘려 보이지 않고 빨갛게(invalid) 정상적으로 표시됨
      if (room.shape==='lshape') {
        const nr = notchRect();
        const notchEl = document.createElement('div');
        Object.assign(notchEl.style, {
          position:'absolute', zIndex:'2', boxSizing:'border-box',
          background:'var(--canvas-bg-2)',
          borderLeft:'1px solid var(--canvas-line)', borderBottom:'1px solid var(--canvas-line)',
          left:Math.round(nr.x*scale)+'px', top:Math.round(nr.y*scale)+'px',
          width:Math.round(nr.w*scale)+'px', height:Math.round(nr.h*scale)+'px',
        });
        roomEl.appendChild(notchEl);
      }

      // 개구부 여유 영역
      openings.forEach((op) => {
        const cr = openingClearRect(op);
        const z = mkZone(cr, scale);
        const col = op.kind==='door' ? 'var(--canvas-door-color)' : 'var(--canvas-window-color)';
        z.style.setProperty('--cz-color', col); z.style.setProperty('--cz-border', col);
        z.style.opacity = '.45';
        roomEl.appendChild(z);
      });

      // 가구 여유 영역
      items.forEach((it) => {
        clearanceRects(it).forEach((piece) => {
          const z = mkZoneRotated(piece.render, scale, it.rot);
          const warn = it.clrWarn;
          z.style.setProperty('--cz-color', warn?'var(--canvas-border-danger)':'var(--canvas-line-soft)');
          z.style.setProperty('--cz-border', warn?'var(--canvas-border-danger)':'var(--canvas-line-soft)');
          roomEl.appendChild(z);
        });
      });

      // 개구부 본체
      openings.forEach((op) => {
        const g = openingGeom(op);
        const el = document.createElement('div');
        el.className = 'rp-opening';
        Object.assign(el.style, {
          position:'absolute', boxSizing:'border-box', display:'flex',
          alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'600',
          zIndex:'3', cursor:'pointer', touchAction:'none',
          left:Math.round(g.x*scale)+'px', top:Math.round(g.y*scale)+'px',
          width:Math.round(g.w*scale)+'px', height:Math.round(g.h*scale)+'px',
        });
        if (op.kind==='door') { el.style.background = 'var(--canvas-door-color)'; el.style.color = 'var(--canvas-bg)'; }
        else { el.style.background = 'var(--canvas-window-fill)'; el.style.color = 'var(--canvas-window-fill-text)'; }
        el.dataset.openId = op.id;
        const label = document.createElement('span');
        label.textContent = op.kind==='door' ? t('doorBtn') : t('windowBtn');
        if (op.wall==='left' || op.wall==='right') label.style.transform = 'rotate(90deg)';
        el.appendChild(label);
        el.insertAdjacentHTML('beforeend',
          `<span class="rp-rm" data-action="rm" title="${t('deleteTitle')}" style="position:absolute;top:-8px;right:-8px;width:16px;height:16px;border-radius:50%;background:var(--surface-1);border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:7;">${icon('close',10)}</span>`);
        if (op.kind==='window') {
          const sillAttr = convAttr(0, 250, 5);
          el.insertAdjacentHTML('beforeend',
            `<input type="number" class="rp-sill" data-open-id="${op.id}" value="${toDisplay(op.sill||0)}" min="${sillAttr.min}" max="${sillAttr.max}" step="${sillAttr.step}"
               title="${t('sillTitle').replace('{u}', UNITS[unit].label)}"
               style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);width:60px;height:18px;font-size:10px;text-align:center;padding:0 2px;border:1px solid var(--border-strong);border-radius:4px;background:var(--surface-1);color:var(--text-secondary);z-index:6;">`);
        }
        roomEl.appendChild(el);
      });

      // 가구 본체: 바깥 래퍼는 회전하지 않는 바운딩박스(회전/삭제 버튼 위치 고정용)이고
      // 안쪽 body만 실제 각도와 모양(사각/원/삼각)으로 표시한다.
      items.forEach((it, idx) => {
        const ft = findType(it.key); const d = effDims(it);
        const colors = it.invalid
          ? { bg:'var(--canvas-bg-danger)', border:'var(--canvas-border-danger)', text:'var(--canvas-text-danger)' }
          : roleColors(ft.role);
        const div = document.createElement('div');
        div.className = 'rp-furn';
        Object.assign(div.style, {
          position:'absolute', zIndex:'4',
          left:Math.round(it.x*scale)+'px', top:Math.round(it.y*scale)+'px',
          width:Math.round(d.w*scale)+'px', height:Math.round(d.h*scale)+'px',
        });
        div.dataset.id = it.id;

        const body = document.createElement('div');
        Object.assign(body.style, {
          position:'absolute', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:'2px',
          cursor:'grab', touchAction:'none', userSelect:'none',
          fontSize:'11px', lineHeight:'1.2', textAlign:'center', padding:'2px',
          boxSizing:'border-box', overflow:'hidden',
          left:Math.round((d.w-it.w)/2*scale)+'px', top:Math.round((d.h-it.h)/2*scale)+'px',
          width:Math.round(it.w*scale)+'px', height:Math.round(it.h*scale)+'px',
          transform:`rotate(${it.rot}deg)`,
          background:colors.bg, color:colors.text,
          border:`${it.invalid?'1.5px':'1px'} solid ${colors.border}`,
          ...shapeStyle(it.shape),
        });
        body.innerHTML = `${icon(ft.ic,16)}<span>${furnName(ft.key).replace(/\(.*?\)/,'')}</span>`;
        body.title = `#${idx+1} ${furnName(ft.key)} ${toDisplay(it.w)}×${toDisplay(it.h)}${UNITS[unit].label}, ${t('heightWord')} ${toDisplay(it.zH)}${UNITS[unit].label}, ${t('rotWord')} ${it.rot}°, ${t('positionWord')} (${toDisplay(it.x)}, ${toDisplay(it.y)})${UNITS[unit].label}`;
        div.appendChild(body);

        div.insertAdjacentHTML('beforeend',
          `<span class="rp-idx" title="${t('positionWord')} (${toDisplay(it.x)}, ${toDisplay(it.y)})${UNITS[unit].label}" style="position:absolute;bottom:-3px;left:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--surface-1);border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--text-secondary);z-index:6;pointer-events:none;">${idx+1}</span>`);

        const angleBadge = (rotateDrag && rotateDrag.id===it.id)
          ? `<span style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:10px;white-space:nowrap;background:var(--surface-1);color:var(--canvas-bg);border:1px solid var(--canvas-highlight);border-radius:4px;padding:1px 4px;z-index:7;">${it.rot}&deg;</span>`
          : '';
        div.insertAdjacentHTML('beforeend',
          `<input type="number" class="rp-angle" data-id="${it.id}" value="${it.rot}" min="0" max="359" step="1"
             title="${t('angleTitle')}"
             style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);width:52px;height:18px;font-size:10px;text-align:center;padding:0 2px;border:1px solid var(--border-strong);border-radius:4px;background:var(--surface-1);color:var(--text-secondary);z-index:6;">` +
          `<span class="rp-rot" data-action="rot" title="${t('rotateTitle')}" style="position:absolute;top:-3px;left:-3px;width:18px;height:18px;border-radius:50%;background:var(--surface-1);border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center;cursor:grab;z-index:6;">${icon('rotate',11)}</span>` +
          `<span class="rp-rm" data-action="rm" title="${t('deleteTitle')}" style="position:absolute;top:-3px;right:-3px;width:18px;height:18px;border-radius:50%;background:var(--surface-1);border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:6;">${icon('close',11)}</span>` +
          angleBadge);
        roomEl.appendChild(div);
      });

      // 통계
      const totalArea = items.reduce((s,it) => s + it.w*it.h, 0);
      const na = netArea();
      $('#usageStat').textContent = (na>0 ? Math.round(totalArea/na*100) : 0) + '%';
      $('#warnStat').textContent = items.filter((it) => it.invalid || it.clrWarn).length + (t('warnUnit') ? t('warnUnit') : '');
      $('#pyeongLabel').textContent = lang==='ko'
        ? '약 ' + (na/10000/3.3058).toFixed(1) + '평'
        : '~' + (na/10000).toFixed(1) + ' m²';
      const msgs = [];
      if (flags.blockDoor) msgs.push(t('blockDoorMsg'));
      if (flags.blockWin) msgs.push(t('blockWinMsg'));
      $('#warnMsg').textContent = msgs.join(' · ');

      positionWallLabels();
      renderElev();
      positionRulers();
    }

    function mkZone(cr, scale) {
      const z = document.createElement('div');
      Object.assign(z.style, {
        position:'absolute', borderRadius:'3px', pointerEvents:'none', boxSizing:'border-box',
        border:'1px dashed var(--cz-border)',
        backgroundImage:'repeating-linear-gradient(45deg,var(--cz-color) 0,var(--cz-color) 1px,transparent 1px,transparent 6px)',
        left:Math.round(cr.x*scale)+'px', top:Math.round(cr.y*scale)+'px',
        width:Math.round(cr.w*scale)+'px', height:Math.round(cr.h*scale)+'px',
      });
      return z;
    }

    function mkZoneRotated(render, scale, rotDeg) {
      const z = document.createElement('div');
      Object.assign(z.style, {
        position:'absolute', borderRadius:'3px', pointerEvents:'none', boxSizing:'border-box',
        border:'1px dashed var(--cz-border)',
        backgroundImage:'repeating-linear-gradient(45deg,var(--cz-color) 0,var(--cz-color) 1px,transparent 1px,transparent 6px)',
        left:Math.round((render.cx-render.w/2)*scale)+'px', top:Math.round((render.cy-render.h/2)*scale)+'px',
        width:Math.round(render.w*scale)+'px', height:Math.round(render.h*scale)+'px',
        transform:`rotate(${rotDeg}deg)`,
      });
      return z;
    }

    // ---- 렌더 (정면 보기 / 엘리베이션, 읽기 전용) ----
    // 방 안에 서서 특정 벽을 바라본다고 할 때, 마주보는 벽(top/right)은 평면의
    // x·y와 화면 좌우가 그대로 맞지만, 등 뒤쪽 벽(bottom/left)을 보려면 몸을 돌리게 되어
    // 좌우가 뒤집힌다. 그래서 bottom/left는 가로축을 좌우 반전해야 평면 위치와 일치한다.
    function elevHoriz(wall, pos, size, axisLen) {
      return (wall==='bottom' || wall==='left') ? axisLen - (pos+size) : pos;
    }
    // 실제 레이아웃에서 정면 뷰가 쓸 수 있는 가로 폭(흰 캔버스 폭)을 측정한다.
    // 고정값(MAX_W)을 그냥 쓰면 패널이 그보다 좁을 때 그림이 캔버스 밖으로 잘릴 수 있다.
    function getElevAvailWidth() {
      const wrap = $('#roomWrap');
      if (!wrap) return MAX_W;
      const cs = getComputedStyle(wrap);
      const pad = (parseFloat(cs.paddingLeft)||0) + (parseFloat(cs.paddingRight)||0);
      const w = wrap.clientWidth - pad;
      return w > 0 ? Math.min(w, MAX_W) : MAX_W;
    }
    function renderElev() {
      if (!elevEl) return;
      const wall = elevWall;
      const horiz = (wall==='top' || wall==='bottom') ? room.w : room.h;
      // 가로 기준폭 = 보는 벽의 폭(horiz), 세로 기준 = 방 높이(room.zH).
      // 둘 다 캔버스를 넘지 않도록 가용너비/가용높이 대비 더 작게 줄어드는 쪽을 택한다.
      const availW = getElevAvailWidth(), availH = MAX_H;
      const scale = Math.min(availW/horiz, availH/room.zH);
      const drawW = horiz*scale, drawH = room.zH*scale;
      // 캔버스는 항상 가용너비를 꽉 채우고(폭이 안정적인 흰 프레임), 실제 그림은
      // 그 안에서 가로 가운데 정렬. 세로는 그림 높이=캔버스 높이라 바닥선이 항상 하단에 맞음.
      const offsetX = Math.max(0, (availW-drawW)/2);
      elevEl.style.width = Math.round(availW)+'px';
      elevEl.style.height = Math.round(drawH)+'px';
      elevEl.innerHTML = '';
      lastElevLayout = { scale, offsetX, horiz };

      // 실제 벽 그림 영역을 옅은 점선으로 표시(캔버스 안에서 그림이 어디 있는지 보여줌)
      const frame = document.createElement('div');
      Object.assign(frame.style, {
        position:'absolute', boxSizing:'border-box', pointerEvents:'none', zIndex:'1',
        left:Math.round(offsetX)+'px', top:'0px',
        width:Math.round(drawW)+'px', height:Math.round(drawH)+'px',
        border:'1px dashed var(--canvas-line-soft)',
      });
      elevEl.appendChild(frame);

      const mkTag = (text, css) => {
        const s = document.createElement('span');
        s.textContent = text;
        Object.assign(s.style, {
          position:'absolute', fontSize:'10px', color:'var(--canvas-muted)',
          pointerEvents:'none', zIndex:'1', ...css,
        });
        return s;
      };
      elevEl.appendChild(mkTag(t('ceilingLabel'), { top:'2px', left:(offsetX+4)+'px' }));
      elevEl.appendChild(mkTag(t('floorLabel'), { bottom:'2px', left:(offsetX+4)+'px' }));

      // 이 벽에 있는 문/창
      openings.filter((op) => op.wall===wall).forEach((op) => {
        const g = openingGeom(op);
        const onTopBottom = (wall==='top' || wall==='bottom');
        const rawPos = onTopBottom ? g.x : g.y;
        const hSize = onTopBottom ? g.w : g.h;
        const hPos = elevHoriz(wall, rawPos, hSize, horiz);
        // 가로/높이 모두 방 프레임(0~horiz, 0~room.zH)을 벗어나지 않게 잘라준다.
        const left = Math.max(0, hPos);
        const width = Math.max(0, Math.min(hSize, horiz-left));
        const sill = op.sill||0, opH = op.zH||0;
        const floorY = Math.max(0, Math.min(sill, room.zH));
        const ceilY = Math.max(0, Math.min(sill+opH, room.zH));
        const el = document.createElement('div');
        Object.assign(el.style, {
          position:'absolute', boxSizing:'border-box', display:'flex',
          alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'600',
          zIndex:'2',
          left:Math.round(offsetX+left*scale)+'px',
          top:Math.round((room.zH-ceilY)*scale)+'px',
          width:Math.round(width*scale)+'px',
          height:Math.round((ceilY-floorY)*scale)+'px',
        });
        if (op.kind==='door') { el.style.background = 'var(--canvas-door-color)'; el.style.color = 'var(--canvas-bg)'; }
        else { el.style.background = 'var(--canvas-window-fill)'; el.style.color = 'var(--canvas-window-fill-text)'; }
        el.textContent = op.kind==='door' ? t('doorBtn') : t('windowBtn');
        elevEl.appendChild(el);
      });

      // 가구: 벽에서 먼 것부터 그려서, 벽에 가까운(앞쪽) 가구가 위(=불투명)에 오도록.
      // 벽까지 거리(depth)가 멀수록 옅게(반투명) 그려 원근감을 준다.
      const onTopBottomWall = (wall==='top' || wall==='bottom');
      const depthMax = onTopBottomWall ? room.h : room.w; // 보는 벽과 수직인 방향의 길이
      const MIN_OPACITY = 0.35;
      const withDepth = items.map((it) => {
        const d = effDims(it);
        const rawPos = onTopBottomWall ? it.x : it.y;
        const hSize = onTopBottomWall ? d.w : d.h;
        const hPos = elevHoriz(wall, rawPos, hSize, horiz);
        let depth;
        if (wall==='top')         depth = it.y;
        else if (wall==='bottom') depth = room.h - (it.y+d.h);
        else if (wall==='left')   depth = it.x;
        else                       depth = room.w - (it.x+d.w);
        return { it, hPos, hSize, depth };
      }).sort((a,b) => b.depth - a.depth);

      withDepth.forEach(({ it, hPos, hSize, depth }) => {
        const ft = findType(it.key);
        const tooTall = it.zH > room.zH;
        const colors = tooTall
          ? { bg:'var(--canvas-bg-danger)', border:'var(--canvas-border-danger)', text:'var(--canvas-text-danger)' }
          : roleColors(ft.role);
        // 천장(room.zH)보다 높은 가구는 천장선까지만 그려서 프레임을 벗어나지 않게 하고,
        // 대신 빨갛게 표시해 "천장보다 높다"는 걸 알려준다.
        const barZH = Math.min(it.zH, room.zH);
        // 가로도 방의 폭을 넘지 않도록 방어적으로 한 번 더 잘라준다.
        const left = Math.max(0, hPos);
        const width = Math.max(0, Math.min(hSize, horiz-left));
        const depthRatio = depthMax>0 ? Math.max(0, Math.min(1, depth/depthMax)) : 0;
        const opacity = 1 - depthRatio*(1-MIN_OPACITY);
        const bar = document.createElement('div');
        Object.assign(bar.style, {
          position:'absolute', boxSizing:'border-box', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:'2px', overflow:'hidden',
          fontSize:'11px', padding:'2px', borderRadius:'4px', zIndex:'3',
          left:Math.round(offsetX+left*scale)+'px',
          top:Math.round((room.zH-barZH)*scale)+'px',
          width:Math.round(width*scale)+'px',
          height:Math.round(barZH*scale)+'px',
          background:colors.bg, color:colors.text,
          border:`${tooTall?'1.5px':'1px'} solid ${colors.border}`,
          opacity:String(opacity),
        });
        bar.title = `${furnName(ft.key)} ${t('heightWord')} ${toDisplay(it.zH)}${UNITS[unit].label}` + (tooTall ? ` (${t('tooTallMsg')})` : '');
        bar.innerHTML = `${icon(ft.ic,14)}<span>${furnName(ft.key).replace(/\(.*?\)/,'')}</span>`;
        elevEl.appendChild(bar);
      });
    }

    // ---- 팔레트 ----
    function renderPalette() {
      paletteEl.innerHTML = '';
      const uLabel = UNITS[unit].label;
      const dimAttr = convAttr(10, 300, 5), heightAttr = convAttr(1, 300, 5), clrAttr = convAttr(0, 200, 5);
      FURNITURE_TYPES.forEach((ft) => {
        const clr = ft.clr||{};
        const row = document.createElement('div');
        row.className = 'pal-row';
        if (ft.customShape) row.dataset.shape = 'rect';
        Object.assign(row.style, {
          display:'flex', flexDirection:'column', gap:'6px', padding:'8px',
          borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', marginBottom:'6px',
        });
        const shapePicker = ft.customShape ? `
           <div style="display:flex;align-items:center;gap:4px;">
             <label class="muted" style="font-size:11px;">${t('shapeTitle')}</label>
             <button class="btn shape-btn btn--primary" data-shape="rect">${t('shape_rect')}</button>
             <button class="btn shape-btn" data-shape="circle">${t('shape_circle')}</button>
             <button class="btn shape-btn" data-shape="triangle">${t('shape_triangle')}</button>
           </div>` : '';
        row.innerHTML =
          `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
             <span style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);">${icon(ft.ic,16)}${furnName(ft.key)}</span>
             <span class="muted" style="font-size:10px;">${t('unitCaptionPrefix')}${uLabel}</span>
           </div>
           <div style="display:flex;align-items:center;gap:4px;">
             <input class="input dim-w" type="number" value="${toDisplay(ft.w)}" min="${dimAttr.min}" max="${dimAttr.max}" step="${dimAttr.step}" style="width:54px;height:28px;font-size:12px;padding:2px 4px;" title="${t('widthLabel')}(${uLabel})">
             <span class="muted">×</span>
             <input class="input dim-h" type="number" value="${toDisplay(ft.h)}" min="${dimAttr.min}" max="${dimAttr.max}" step="${dimAttr.step}" style="width:54px;height:28px;font-size:12px;padding:2px 4px;" title="${t('depthLabel')}(${uLabel})">
             <span class="muted">×</span>
             <input class="input dim-z" type="number" value="${toDisplay(ft.zH)}" min="${heightAttr.min}" max="${heightAttr.max}" step="${heightAttr.step}" style="width:54px;height:28px;font-size:12px;padding:2px 4px;" title="${t('heightWord')}(${uLabel})">
           </div>
           <div style="display:flex;align-items:center;gap:4px;">
             <label class="muted" style="font-size:11px;" title="${t('frontClrLabel')}(${uLabel})">${t('frontClrLabel')}</label>
             <input class="input clr-front" type="number" value="${toDisplay(clr.front||0)}" min="${clrAttr.min}" max="${clrAttr.max}" step="${clrAttr.step}" style="width:50px;height:28px;font-size:12px;padding:2px 4px;" title="${t('frontClrLabel')}(${uLabel})">
             <label class="muted" style="font-size:11px;" title="${t('sideClrLabel')}(${uLabel})">${t('sideClrLabel')}</label>
             <input class="input clr-side" type="number" value="${toDisplay(clr.side||0)}" min="${clrAttr.min}" max="${clrAttr.max}" step="${clrAttr.step}" style="width:50px;height:28px;font-size:12px;padding:2px 4px;" title="${t('sideClrLabel')}(${uLabel})">
           </div>
           ${shapePicker}
           <div style="display:flex;align-items:center;">
             <button class="btn add-furn" data-key="${ft.key}" style="margin-left:auto;padding:2px 10px;font-size:12px;height:28px;">${t('addFurnBtn')}</button>
           </div>`;
        paletteEl.appendChild(row);
      });
    }

    function addFurniture(key, w, h, zH, clrFront, clrSide, shape) {
      const offset = (items.length % 5) * 15;
      const it = { id:nextId++, key, w, h, zH, clrFront, clrSide, x:10+offset, y:10+offset, rot:0, shape: shape||'rect' };
      clamp(it); items.push(it); renderRoom();
    }

    // ---- 이벤트 ----
    paletteEl.addEventListener('click', (e) => {
      const shapeBtn = e.target.closest('.shape-btn');
      if (shapeBtn) {
        const row = shapeBtn.closest('.pal-row');
        row.dataset.shape = shapeBtn.dataset.shape;
        row.querySelectorAll('.shape-btn').forEach((b) => b.classList.toggle('btn--primary', b===shapeBtn));
        return;
      }
      const btn = e.target.closest('.add-furn'); if (!btn) return;
      const row = btn.closest('.pal-row');
      const w = Math.max(10, Math.min(300, readNum(row.querySelector('.dim-w'), 50)));
      const h = Math.max(10, Math.min(300, readNum(row.querySelector('.dim-h'), 50)));
      const zH = Math.max(1, Math.min(300, readNum(row.querySelector('.dim-z'), 50)));
      const clrFront = Math.max(0, Math.min(200, readNum(row.querySelector('.clr-front'), 0)));
      const clrSide = Math.max(0, Math.min(200, readNum(row.querySelector('.clr-side'), 0)));
      const shape = row.dataset.shape || 'rect';
      addFurniture(btn.dataset.key, w, h, zH, clrFront, clrSide, shape);
    });

    container.querySelectorAll('.add-open').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.kind;
        const defaults = kind==='door' ? { sill:0, zH:200, len:90 } : { sill:90, zH:120, len:120 };
        openings.push({ id:nextOpenId++, kind, wall:'left', pos:0.5, ...defaults });
        renderRoom();
      });
    });

    roomEl.addEventListener('change', (e) => {
      const angleInput = e.target.closest('.rp-angle');
      if (angleInput) {
        const it = items.find((x) => x.id===Number(angleInput.dataset.id)); if (!it) return;
        let v = Number(angleInput.value); if (Number.isNaN(v)) v = it.rot;
        setRot(it, v); clamp(it); renderRoom();
        return;
      }
      const sillInput = e.target.closest('.rp-sill');
      if (sillInput) {
        const op = openings.find((o) => o.id===Number(sillInput.dataset.openId)); if (!op) return;
        op.sill = Math.max(0, readNum(sillInput, 0));
        renderRoom();
      }
    });

    roomEl.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const openEl = e.target.closest('.rp-opening');
      if (openEl) {
        const oid = Number(openEl.dataset.openId);
        const openAction = e.target.closest('[data-action]');
        if (openAction && openAction.dataset.action==='rm') { openings = openings.filter((o) => o.id!==oid); renderRoom(); return; }
        if (openings.find((o) => o.id===oid)) { openDrag = { id:oid, scale:getScale() }; openEl.setPointerCapture(e.pointerId); }
        return;
      }
      const el = e.target.closest('.rp-furn'); if (!el) return;
      const action = e.target.closest('[data-action]');
      const id = Number(el.dataset.id);
      const it = items.find((x) => x.id===id); if (!it) return;
      if (action && action.dataset.action==='rm') { items = items.filter((x) => x.id!==id); renderRoom(); return; }
      if (action && action.dataset.action==='rot') {
        const scale = getScale(); const rect = roomEl.getBoundingClientRect();
        const d = effDims(it); const cx = it.x+d.w/2, cy = it.y+d.h/2;
        const px = (e.clientX-rect.left)/scale, py = (e.clientY-rect.top)/scale;
        const startAngle = Math.atan2(py-cy, px-cx) * 180/Math.PI;
        rotateDrag = { id, scale, rect, cx, cy, startAngle, startRot: it.rot };
        action.setPointerCapture(e.pointerId);
        return;
      }
      dragState = { id, startX:e.clientX, startY:e.clientY, origX:it.x, origY:it.y, scale:getScale() };
      el.setPointerCapture(e.pointerId);
    });

    roomEl.addEventListener('pointermove', (e) => {
      if (openDrag) {
        const op = openings.find((o) => o.id===openDrag.id); if (!op) return;
        const rect = roomEl.getBoundingClientRect();
        let px = (e.clientX-rect.left)/openDrag.scale;
        let py = (e.clientY-rect.top)/openDrag.scale;
        px = Math.max(0, Math.min(room.w, px)); py = Math.max(0, Math.min(room.h, py));
        op.wall = nearestWall(px, py);
        if (op.wall==='top' || op.wall==='bottom') op.pos = Math.max(0, Math.min(1, px/(room.w-op.len)));
        else op.pos = Math.max(0, Math.min(1, py/(room.h-op.len)));
        renderRoom(); return;
      }
      if (rotateDrag) {
        const it = items.find((x) => x.id===rotateDrag.id); if (!it) return;
        const px = (e.clientX-rotateDrag.rect.left)/rotateDrag.scale;
        const py = (e.clientY-rotateDrag.rect.top)/rotateDrag.scale;
        const angle = Math.atan2(py-rotateDrag.cy, px-rotateDrag.cx) * 180/Math.PI;
        let newRot = rotateDrag.startRot + (angle-rotateDrag.startAngle);
        if (e.shiftKey) newRot = Math.round(newRot/15)*15;
        setRot(it, newRot); clamp(it); renderRoom();
        return;
      }
      if (!dragState) return;
      const it = items.find((x) => x.id===dragState.id); if (!it) return;
      it.x = dragState.origX + (e.clientX-dragState.startX)/dragState.scale;
      it.y = dragState.origY + (e.clientY-dragState.startY)/dragState.scale;
      clamp(it); renderRoom();
    });

    function endDrag() {
      if (openDrag) { openDrag = null; renderRoom(); return; }
      if (rotateDrag) { rotateDrag = null; renderRoom(); return; }
      if (dragState) {
        const it = items.find((x) => x.id===dragState.id);
        if (it) { applySnap(it); clamp(it); }
        dragState = null; renderRoom();
      }
    }
    roomEl.addEventListener('pointerup', endDrag);
    roomEl.addEventListener('pointercancel', endDrag);

    $('#applyBtn').addEventListener('click', () => {
      const w = Math.max(150, Math.min(700, readNum($('#roomW'), room.w)));
      const h = Math.max(150, Math.min(700, readNum($('#roomH'), room.h)));
      room.w = w; room.h = h;
      if (room.shape==='lshape') {
        const nw = Math.max(50, Math.min(w-50, readNum($('#notchW'), room.notchW)));
        const nh = Math.max(50, Math.min(h-50, readNum($('#notchH'), room.notchH)));
        room.notchW = nw; room.notchH = nh;
        $('#notchW').value = toDisplay(nw); $('#notchH').value = toDisplay(nh);
      }
      items.forEach(clamp); renderRoom();
    });

    function applyUnitToStaticUI() {
      container.querySelectorAll('.unit-label').forEach((el) => { el.textContent = UNITS[unit].label; });
      container.querySelectorAll('.unit-btn').forEach((b) => b.classList.toggle('btn--primary', b.dataset.unit===unit));
      const wAttr = convAttr(150, 700, 10), nAttr = convAttr(50, 650, 10);
      const roomWEl = $('#roomW'), roomHEl = $('#roomH'), notchWEl = $('#notchW'), notchHEl = $('#notchH');
      roomWEl.min = wAttr.min; roomWEl.max = wAttr.max; roomWEl.step = wAttr.step; roomWEl.value = toDisplay(room.w);
      roomHEl.min = wAttr.min; roomHEl.max = wAttr.max; roomHEl.step = wAttr.step; roomHEl.value = toDisplay(room.h);
      notchWEl.min = nAttr.min; notchWEl.max = nAttr.max; notchWEl.step = nAttr.step; notchWEl.value = toDisplay(room.notchW);
      notchHEl.min = nAttr.min; notchHEl.max = nAttr.max; notchHEl.step = nAttr.step; notchHEl.value = toDisplay(room.notchH);
    }
    container.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        unit = btn.dataset.unit;
        applyUnitToStaticUI();
        renderPalette();
        renderRoom();
      });
    });

    // 정면 뷰의 앞/뒤/좌/우 버튼과 평면 뷰의 벽 라벨이 항상 같은 명칭을 쓰도록
    // 벽 이름을 여기 한 곳에서만 만든다.
    function wallDisplayName(wallKey) {
      const names = { bottom:t('wallFront'), top:t('wallBack'), left:t('wallLeft'), right:t('wallRight') };
      return names[wallKey];
    }
    function wallLabelText(wallKey) {
      return lang==='ko' ? `${wallDisplayName(wallKey)}벽` : `${wallDisplayName(wallKey)} wall`;
    }
    function updateElevWallLabel() {
      const el = $('#elevWallLabel'); if (!el) return;
      el.textContent = `${t('viewingWallLabel')} ${wallDisplayName(elevWall)}`;
    }
    function goToElevWall(wallKey) {
      elevWall = wallKey;
      container.querySelectorAll('.wall-btn').forEach((b) => b.classList.toggle('btn--primary', b.dataset.wall===elevWall));
      updateElevWallLabel();
      setView('elev');
    }
    // 평면 뷰의 방 영역 네 변 바깥에 어느 벽인지 라벨을 붙이고, 클릭하면 그 벽의
    // 정면 뷰로 바로 전환한다 (위에서 보기 로직 자체는 건드리지 않음).
    function positionWallLabels() {
      const labels = {
        top: $('#wallLabelTop'), bottom: $('#wallLabelBottom'),
        left: $('#wallLabelLeft'), right: $('#wallLabelRight'),
      };
      const show = view==='plan';
      Object.values(labels).forEach((el) => { el.style.display = show ? 'block' : 'none'; });
      if (!show) return;
      Object.keys(labels).forEach((wallKey) => { labels[wallKey].textContent = wallLabelText(wallKey); });
      // 줄자 눈금(숫자)이 방 바깥쪽에 띠를 쓰므로, 벽 라벨은 그보다 더 바깥쪽에 둬서 겹치지 않게 한다.
      // 좁은 화면에선 줄자 자체가 줄어드므로 벽 라벨 거리/글자도 함께 줄인다.
      const compact = isCompactUI();
      const topBottomGap = compact ? 16 : 26, leftRightGap = compact ? 22 : 34;
      const fontSize = compact ? '9px' : '10px';
      const L = roomEl.offsetLeft, T = roomEl.offsetTop, W = roomEl.offsetWidth, H = roomEl.offsetHeight;
      Object.assign(labels.top.style,    { left:(L+W/2)+'px', top:(T-topBottomGap)+'px',   transform:'translate(-50%,-100%)', fontSize });
      Object.assign(labels.bottom.style, { left:(L+W/2)+'px', top:(T+H+topBottomGap)+'px', transform:'translate(-50%,0)', fontSize });
      Object.assign(labels.left.style,   { left:(L-leftRightGap)+'px',  top:(T+H/2)+'px',  transform:'translate(-100%,-50%)', fontSize });
      Object.assign(labels.right.style,  { left:(L+W+leftRightGap)+'px',top:(T+H/2)+'px',  transform:'translate(0,-50%)', fontSize });
    }
    Object.entries({ Top:'top', Bottom:'bottom', Left:'left', Right:'right' }).forEach(([elName, wallKey]) => {
      $(`#wallLabel${elName}`).addEventListener('click', () => goToElevWall(wallKey));
    });

    function renderHelpList() {
      const ul = $('#helpList'); if (!ul) return;
      ul.innerHTML = '';
      STR.helpText[lang].forEach((line) => {
        const li = document.createElement('li');
        Object.assign(li.style, { display:'flex', gap:'6px', alignItems:'flex-start', marginBottom:'3px' });
        li.innerHTML = `<span style="color:var(--text-link); flex:0 0 auto;">●</span><span>${line}</span>`;
        ul.appendChild(li);
      });
    }

    function applyLangToStaticUI() {
      container.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
      container.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('btn--primary', b.dataset.lang===lang));
      updateElevWallLabel();
      renderHelpList();
    }
    container.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        lang = btn.dataset.lang;
        applyLangToStaticUI();
        renderPalette();
        renderRoom();
      });
    });

    function setShape(shape) {
      room.shape = shape;
      $('#notchInputs').style.display = shape==='lshape' ? 'inline-flex' : 'none';
      $('#shapeRectBtn').classList.toggle('btn--primary', shape==='rect');
      $('#shapeLBtn').classList.toggle('btn--primary', shape==='lshape');
    }
    $('#shapeRectBtn').addEventListener('click', () => { setShape('rect'); renderRoom(); });
    $('#shapeLBtn').addEventListener('click', () => { setShape('lshape'); renderRoom(); });

    function setView(v) {
      view = v;
      roomEl.style.display = v==='plan' ? 'block' : 'none';
      elevEl.style.display = v==='elev' ? 'block' : 'none';
      $('#elevWalls').style.display = v==='elev' ? 'inline-flex' : 'none';
      $('#elevHint').style.display = v==='elev' ? 'block' : 'none';
      container.querySelectorAll('.view-tab').forEach((b) => b.classList.toggle('btn--primary', b.dataset.view===v));
      updateElevWallLabel();
      renderRoom();
    }
    container.querySelectorAll('.view-tab').forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });
    container.querySelectorAll('.wall-btn').forEach((btn) => {
      btn.classList.toggle('btn--primary', btn.dataset.wall===elevWall);
      btn.addEventListener('click', () => {
        elevWall = btn.dataset.wall;
        container.querySelectorAll('.wall-btn').forEach((b) => b.classList.toggle('btn--primary', b.dataset.wall===elevWall));
        updateElevWallLabel();
        renderElev();
      });
    });

    $('#clearToggle').addEventListener('click', () => {
      showClear = !showClear;
      $('#clearState').textContent = showClear ? 'ON' : 'OFF';
      $('#clearToggle').classList.toggle('off', !showClear);
      renderRoom();
    });
    $('#snapToggle').addEventListener('click', () => {
      snapOn = !snapOn;
      $('#snapState').textContent = snapOn ? 'ON' : 'OFF';
      $('#snapToggle').classList.toggle('off', !snapOn);
    });

    // ---- 초기화 ----
    setShape('rect');
    applyUnitToStaticUI();
    applyLangToStaticUI();
    renderPalette();
    setView('plan');

    // 창 크기/회전 변경 시(모바일↔데스크탑 폭 전환 포함) 캔버스 폭 기준으로 다시 스케일링
    let resizeRAF = null;
    function onResize() {
      if (resizeRAF) return;
      resizeRAF = requestAnimationFrame(() => { resizeRAF = null; renderRoom(); });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  },
};
