/* ============================================================
   roomState.js — 2D 플래너와 3D 뷰어가 공유하는 읽기 전용 상태 스토어
   roomPlanner.js가 renderRoom() 끝에 갱신하고, room3d.js가 mount 시 읽는다.
   ============================================================ */

export const roomState = {
  room: { shape:'rect', w:300, h:350, notchW:100, notchH:100, zH:240 },
  items: [
    { id:1, key:'bed',  w:110, h:200, zH:45, clrFront:0,  clrSide:40, x:10,  y:10,  rot:0, shape:'rect' },
    { id:2, key:'desk', w:120, h:60,  zH:75, clrFront:70, clrSide:0,  x:140, y:280, rot:0, shape:'rect' },
  ],
  openings: [
    { id:101, kind:'door',   type:'swing',  swingDir:0, wall:'bottom', pos:0.5, len:90,  sill:0,  zH:200 },
    { id:102, kind:'window', type:'window',             wall:'top',    pos:0.6, len:120, sill:90, zH:120 },
  ],
  showClear: true,
  snapOn: true,
  unit: 'cm',
  lang: 'ko',
};
