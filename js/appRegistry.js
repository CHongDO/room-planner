/* ============================================================
   appRegistry.js — 앱(기능) 목록
   ------------------------------------------------------------
   ▶ 새 기능 추가 방법 (이게 전부입니다):
     1) js/apps/ 에 새 파일 생성 (roomPlanner.js 를 참고/복사)
        export default { id, title, icon, mount(container) { ... } }
        - mount 가 정리함수를 return 하면 앱 전환 시 자동 호출됩니다(선택).
     2) 아래 import 한 줄 추가
     3) 아래 apps 배열에 추가
   그러면 헤더 탭과 화면 전환이 자동 처리됩니다. 셸은 수정 불필요.
   ============================================================ */

import roomPlanner from './apps/roomPlanner.js';
// import sunlight from './apps/sunlight.js';   // 예) 다음 기능

export const apps = [
  roomPlanner,
  // sunlight,
];

export function getApp(id) {
  return apps.find((a) => a.id === id);
}
