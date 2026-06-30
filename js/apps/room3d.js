/* ============================================================
   apps/room3d.js — 방 3D 미리보기
   ------------------------------------------------------------
   - Three.js r128 ESM (CDN 동적 import)
   - buildFurnitureGroup(): 가구별 다중 파트 모델 (THREE.Group)
   - 그룹 로컬 좌표: 원점 = 가구 바닥 중앙
     x ∈ [-w/2, w/2], y ∈ [0, zH], z ∈ [-h/2, h/2]
   - 위치·회전은 호출부에서 group 단위로 처리
   ============================================================ */

import { icon } from '../icons.js';
import { roomState } from '../roomState.js';

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// 가구 key → role (roomPlanner.js FURNITURE_TYPES 와 동기화)
const FURN_ROLE = {
  bed:'accent', desk:'success', chair:'success', wardrobe:'warning',
  hanger:'pro', bookshelf:'neutral', dresser:'neutral', custom:'neutral',
};

// role → Three.js 16진수 색 (theme.css --canvas-border-* 계열)
const ROLE_HEX = {
  accent:  0x8fd6ff,
  success: 0x7be3b0,
  warning: 0xffd27a,
  pro:     0xc7adff,
  neutral: 0x9ab5c8,
  danger:  0xff9090,
};

// 2D 좌표계(Y↓) 기준 회전된 가구 AABB 유효 치수
function effDims(it) {
  const r = (it.rot || 0) * Math.PI / 180;
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  return { w: it.w * c + it.h * s, h: it.w * s + it.h * c };
}

/* ============================================================
   가구 3D 그룹 빌더
   w  = 가구 가로(cm), h = 가구 깊이(cm), zH = 가구 높이(cm)
   hexColor = role 기반 Three.js 16진 색
   itemShape = 'rect'|'circle'|'triangle' (custom 가구용)
   ============================================================ */
function buildFurnitureGroup(THREE, key, w, h, zH, hexColor, itemShape) {
  const group = new THREE.Group();

  // 색상 3단계: 기본 / 어두운(구조체) / 밝은(표면·디테일)
  const base  = new THREE.Color(hexColor);
  const dark  = base.clone().multiplyScalar(0.55);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.30);

  const mb = new THREE.MeshLambertMaterial({ color: base  });
  const md = new THREE.MeshLambertMaterial({ color: dark  });
  const ml = new THREE.MeshLambertMaterial({ color: light });

  // 박스 추가 헬퍼: (x, y, z) = 박스 중심 좌표
  function box(gw, gh, gd, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mat || mb);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  switch (key) {

    /* ── 침대 ─────────────────────────────────────────────────
       프레임(하부) + 매트리스 + 헤드보드(h축 한 끝, 위로 솟음) + 베개 */
    case 'bed': {
      const hbThick = h * 0.1;
      box(w, zH * 0.48, h, 0, zH * 0.24, 0, md);                              // 프레임
      box(w * 0.96, zH * 0.38, h * 0.96, 0, zH * 0.67, 0, ml);                // 매트리스
      box(w * 0.96, zH * 1.6, hbThick, 0, zH * 0.8, -h / 2 + hbThick / 2, md); // 헤드보드
      box(w * 0.44, zH * 0.14, h * 0.24, 0, zH * 0.91, -h * 0.32, ml);        // 베개
      break;
    }

    /* ── 책상 ─────────────────────────────────────────────────
       얇은 상판 + 모서리 다리 4개 (가운데 비움) */
    case 'desk': {
      const lt = Math.max(3, Math.min(w, h) * 0.06); // 다리 두께
      const tt = Math.max(3, zH * 0.055);             // 상판 두께
      box(w, tt, h, 0, zH - tt / 2, 0, mb);           // 상판
      const legH = zH - tt;
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) =>
        box(lt, legH, lt, sx * (w / 2 - lt * 0.55), legH / 2, sz * (h / 2 - lt * 0.55), md)
      );
      break;
    }

    /* ── 의자 ─────────────────────────────────────────────────
       좌판 + 다리 4개(좌판 아래) + 등받이(한쪽 끝, 위로) */
    case 'chair': {
      const seatTop = zH * 0.48;
      const seatT   = Math.max(2, zH * 0.05);
      const lt      = Math.max(2.5, Math.min(w, h) * 0.09);
      const legH    = seatTop - seatT;
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) =>
        box(lt, legH, lt, sx * (w / 2 - lt * 0.65), legH / 2, sz * (h / 2 - lt * 0.65), md)
      );
      box(w * 0.9, seatT, h * 0.72, 0, seatTop - seatT / 2, h * 0.04, mb);    // 좌판
      const brH = zH - seatTop;
      box(w * 0.88, brH, h * 0.09, 0, seatTop + brH / 2, -h / 2 + h * 0.045, md); // 등받이
      break;
    }

    /* ── 옷장 ─────────────────────────────────────────────────
       큰 본체 박스 + 앞면 세로 분할선 + 문 손잡이 2개 */
    case 'wardrobe': {
      box(w, zH, h, 0, zH / 2, 0, mb);                                          // 본체
      box(w * 0.016, zH * 0.88, h * 0.025, 0, zH / 2, h / 2 + h * 0.01, md);  // 세로 분할
      [-w * 0.16, w * 0.16].forEach((hx) =>
        box(w * 0.04, zH * 0.04, h * 0.04, hx, zH * 0.5, h / 2 + h * 0.02, ml) // 손잡이
      );
      break;
    }

    /* ── 행거 ─────────────────────────────────────────────────
       세로 기둥 2개 + 상단 가로 봉 + 하단 받침봉 + 옷 3벌 */
    case 'hanger': {
      const pt = Math.max(2.5, Math.min(w, h) * 0.12); // 기둥 두께
      const bt = Math.max(2, Math.min(w, h) * 0.08);   // 봉 두께
      box(pt, zH, pt, -w / 2 + pt / 2, zH / 2, 0, mb);  // 왼쪽 기둥
      box(pt, zH, pt,  w / 2 - pt / 2, zH / 2, 0, mb);  // 오른쪽 기둥
      box(w * 0.9, bt, bt, 0, zH * 0.92, 0, md);          // 상단 봉
      box(w * 0.9, bt, bt, 0, bt / 2, 0, md);              // 하단 받침봉
      const barY  = zH * 0.92;
      const cloH  = zH * 0.37;
      [-w * 0.27, 0, w * 0.27].forEach((cx) =>
        box(w * 0.14, cloH, h * 0.75, cx, barY - cloH / 2, 0, ml)              // 옷
      );
      break;
    }

    /* ── 책장 ─────────────────────────────────────────────────
       좌우 측판 + 뒷판 + 상하판 + 선반 3개 (앞 트임) */
    case 'bookshelf': {
      const pw2 = Math.max(2, w * 0.045); // 측판 두께
      const bk  = Math.max(2, h * 0.05);  // 뒷판 두께
      const st  = Math.max(1.5, h * 0.05); // 판재 두께 (상하판·선반)
      box(pw2, zH, h, -w / 2 + pw2 / 2, zH / 2, 0, mb);  // 왼쪽 측판
      box(pw2, zH, h,  w / 2 - pw2 / 2, zH / 2, 0, mb);  // 오른쪽 측판
      box(w, zH, bk, 0, zH / 2, -h / 2 + bk / 2, md);    // 뒷판
      box(w, st, h, 0, zH - st / 2, 0, mb);               // 상판
      box(w, st, h, 0, st / 2, 0, mb);                     // 하판
      [zH / 4, zH / 2, zH * 3 / 4].forEach((sy) =>
        box(w * 0.91, st, h * 0.85, 0, sy, h * 0.05, ml)  // 선반 3개
      );
      break;
    }

    /* ── 서랍장 ───────────────────────────────────────────────
       본체 박스 + 가로 분할선 2개(3칸) + 각 칸 손잡이 */
    case 'dresser': {
      box(w, zH, h, 0, zH / 2, 0, mb);                                           // 본체
      [zH / 3, 2 * zH / 3].forEach((dy) =>
        box(w * 0.96, zH * 0.014, h * 0.025, 0, dy, h / 2 + h * 0.01, md)      // 가로 분할선
      );
      [zH / 6, zH / 2, zH * 5 / 6].forEach((hy) =>
        box(w * 0.14, zH * 0.027, h * 0.04, 0, hy, h / 2 + h * 0.022, ml)     // 손잡이
      );
      break;
    }

    /* ── 기타(custom) ─────────────────────────────────────────
       shape에 따라 박스 / 타원형 원기둥(circle) / 삼각기둥(triangle) */
    default: {
      if (itemShape === 'circle' || itemShape === 'triangle') {
        const segs = itemShape === 'circle' ? 12 : 3;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, zH, segs), mb);
        mesh.scale.set(w, 1, h);  // x,z 스케일로 타원/삼각 비율 맞춤
        mesh.position.set(0, zH / 2, 0);
        group.add(mesh);
      } else {
        box(w, zH, h, 0, zH / 2, 0, mb);
      }
    }
  }

  return group;
}

/* ============================================================
   앱 export
   ============================================================ */
export default {
  id: 'room3d',
  title: '3D 보기',
  icon: icon('eye', 16),

  mount(container) {
    container.innerHTML = `
      <div class="card" style="padding:0; overflow:hidden; position:relative;">
        <div id="r3d-msg" style="padding:20px 16px; color:var(--text-muted); font-size:var(--font-size-sm);">
          Three.js 로딩 중…
        </div>
        <canvas id="r3d-canvas" style="display:none; width:100%; touch-action:none; cursor:grab; user-select:none;"></canvas>
        <p style="padding:6px 12px; margin:0; font-size:11px; color:var(--text-muted); background:var(--surface-2); border-top:1px solid var(--border);">
          드래그: 시점 회전 &nbsp;|&nbsp; 휠/핀치: 줌 &nbsp;|&nbsp; 읽기 전용 — 가구 편집은 2D 탭에서
        </p>
      </div>
    `;

    const canvas = container.querySelector('#r3d-canvas');
    const msg    = container.querySelector('#r3d-msg');
    let disposeAll = null;

    import(THREE_CDN).then((THREE) => {
      msg.style.display = 'none';
      canvas.style.display = 'block';

      const room  = roomState.room;
      const items = roomState.items;
      const W = room.w, D = room.h, H = room.zH;

      function getCanvasSize() {
        const cw = Math.max(300, canvas.parentElement?.clientWidth || 800);
        const ch = Math.max(360, Math.min(Math.round(cw * 0.62), 620));
        return { cw, ch };
      }

      // ---- Scene ----
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1f3a);

      // ---- 조명 (ambient + directional) ----
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
      dirLight.position.set(W * 0.8, H * 2, D * 1.2);
      scene.add(dirLight);

      // ---- 카메라 ----
      const { cw, ch } = getCanvasSize();
      const camera  = new THREE.PerspectiveCamera(45, cw / ch, 1, 20000);
      let camTheta  = Math.PI * 0.30;
      let camPhi    = 0.72;
      const minR    = Math.max(W, D) * 0.35;
      const maxR    = Math.max(W, D) * 5;
      let camRadius = Math.max(W, D) * 1.85;
      const target  = new THREE.Vector3(W / 2, H * 0.28, D / 2);

      function updateCamera() {
        camera.position.set(
          target.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta),
          target.y + camRadius * Math.cos(camPhi),
          target.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta),
        );
        camera.lookAt(target);
      }
      updateCamera();

      // ---- Renderer ----
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      function resizeRenderer() {
        const { cw: rw, ch: rh } = getCanvasSize();
        canvas.style.height = rh + 'px';
        renderer.setSize(rw, rh, false);
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
      }
      resizeRenderer();

      // ---- 바닥 ----
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(W, D),
        new THREE.MeshLambertMaterial({ color: 0x0e2748 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(W / 2, 0, D / 2);
      scene.add(floor);

      // 격자 (바닥 눈금)
      const grid = new THREE.GridHelper(Math.max(W, D) * 1.5, 20, 0x63c5ff, 0x1a3a5c);
      grid.position.set(W / 2, 0.5, D / 2);
      scene.add(grid);

      // ---- 벽 ----
      const wallMat = new THREE.MeshLambertMaterial({
        color: 0x1a3a5c, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
      });
      function addWall(planeW, planeH, px, py, pz, ry = 0) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), wallMat);
        m.rotation.y = ry;
        m.position.set(px, py, pz);
        scene.add(m);
      }
      addWall(W, H, W / 2, H / 2, 0);                  // 뒤 (Z=0)
      addWall(D, H, 0,     H / 2, D / 2, Math.PI / 2); // 왼쪽 (X=0)
      addWall(D, H, W,     H / 2, D / 2, Math.PI / 2); // 오른쪽 (X=W)
      // 앞쪽(Z=D) 벽은 생략 — 초기 시점에서 열린 방처럼 보임

      // 천장
      const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(W, D),
        new THREE.MeshLambertMaterial({ color: 0x0e2748, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
      );
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(W / 2, H, D / 2);
      scene.add(ceil);

      // ㄱ자 노치: 잘린 모서리를 불투명 블록으로 막기
      if (room.shape === 'lshape') {
        const nw = room.notchW, nh = room.notchH;
        const notch = new THREE.Mesh(
          new THREE.BoxGeometry(nw, H + 2, nh),
          new THREE.MeshLambertMaterial({ color: 0x0b1f3a }),
        );
        notch.position.set(W - nw / 2, H / 2, nh / 2);
        scene.add(notch);
      }

      // ---- 가구 그룹 배치 ----
      items.forEach((it) => {
        const role  = FURN_ROLE[it.key] || 'neutral';
        const color = ROLE_HEX[role];
        const d     = effDims(it);               // 회전 후 AABB
        const cx    = it.x + d.w / 2;           // AABB 중심 = 가구 실제 중심
        const cz    = it.y + d.h / 2;

        const group = buildFurnitureGroup(THREE, it.key, it.w, it.h, it.zH, color, it.shape);
        group.position.set(cx, 0, cz);
        group.rotation.y = -it.rot * Math.PI / 180; // 2D CSS 시계방향 → 3D Y축 -방향
        scene.add(group);
      });

      // ---- 카메라 조작: 드래그 회전 ----
      let isDragging = false, lastX = 0, lastY = 0;

      function onPointerDown(e) {
        isDragging = true; lastX = e.clientX; lastY = e.clientY;
        canvas.style.cursor = 'grabbing';
        canvas.setPointerCapture(e.pointerId);
      }
      function onPointerMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        camTheta -= dx * 0.007;
        camPhi    = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, camPhi - dy * 0.007));
        updateCamera();
      }
      function onPointerUp() { isDragging = false; canvas.style.cursor = 'grab'; }

      // ---- 휠 줌 ----
      function onWheel(e) {
        e.preventDefault();
        camRadius = Math.max(minR, Math.min(maxR, camRadius + e.deltaY * 0.5));
        updateCamera();
      }

      canvas.addEventListener('pointerdown',   onPointerDown);
      canvas.addEventListener('pointermove',   onPointerMove);
      canvas.addEventListener('pointerup',     onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      // ---- 핀치 줌 (터치) ----
      let lastPinchDist = null;
      function onTouchStart(e) {
        if (e.touches.length === 2)
          lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
      }
      function onTouchMove(e) {
        if (e.touches.length !== 2 || lastPinchDist === null) return;
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        camRadius = Math.max(minR, Math.min(maxR, camRadius - (dist - lastPinchDist) * 0.5));
        lastPinchDist = dist;
        updateCamera();
      }
      function onTouchEnd() { lastPinchDist = null; }

      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
      canvas.addEventListener('touchend',   onTouchEnd,   { passive: true });

      // ---- 창 리사이즈 ----
      let resRAFid = null;
      function onResize() {
        if (resRAFid) return;
        resRAFid = requestAnimationFrame(() => { resRAFid = null; resizeRenderer(); });
      }
      window.addEventListener('resize', onResize);

      // ---- 렌더 루프 ----
      let animId = null;
      function animate() { animId = requestAnimationFrame(animate); renderer.render(scene, camera); }
      animate();

      // ---- 정리 (탭 전환 시 호출) ----
      disposeAll = () => {
        cancelAnimationFrame(animId);
        if (resRAFid) cancelAnimationFrame(resRAFid);
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('pointerdown',   onPointerDown);
        canvas.removeEventListener('pointermove',   onPointerMove);
        canvas.removeEventListener('pointerup',     onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('wheel',         onWheel);
        canvas.removeEventListener('touchstart',    onTouchStart);
        canvas.removeEventListener('touchmove',     onTouchMove);
        canvas.removeEventListener('touchend',      onTouchEnd);
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
        renderer.dispose();
      };

    }).catch((err) => {
      msg.style.display = 'block';
      msg.textContent   = 'Three.js 로드 실패: ' + err.message;
    });

    return () => { if (disposeAll) disposeAll(); };
  },
};
