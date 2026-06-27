/* ============================================================
   appHost.js — 앱(기능) 전환 호스트
   ------------------------------------------------------------
   appRegistry 의 앱 목록을 읽어 헤더 탭을 만들고,
   선택된 앱을 #app-root 에 마운트합니다.
   각 앱은 자기 영역(container) 안만 책임집니다. (관심사 분리)
   ============================================================ */

import { apps } from './appRegistry.js';

let current = null;        // 현재 마운트된 앱 id
let unmountFn = null;      // 현재 앱의 정리 함수(있으면)

export function initAppHost() {
  const tabsEl = document.querySelector('.app-tabs');
  const root = document.getElementById('app-root');

  // 탭 생성
  apps.forEach((app) => {
    const tab = document.createElement('button');
    tab.className = 'app-tab';
    tab.dataset.appId = app.id;
    tab.innerHTML = `<span aria-hidden="true">${app.icon || ''}</span><span>${app.title}</span>`;
    tab.addEventListener('click', () => activate(app.id));
    tabsEl.appendChild(tab);
  });

  function activate(appId) {
    if (current === appId) return;
    const app = apps.find((a) => a.id === appId);
    if (!app) return;

    // 이전 앱 정리
    if (typeof unmountFn === 'function') {
      try { unmountFn(); } catch (e) { console.error(e); }
    }
    unmountFn = null;
    root.innerHTML = '';

    // 탭 활성 표시
    document.querySelectorAll('.app-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.appId === appId);
    });

    // 마운트 (앱이 정리함수를 반환하면 보관)
    try {
      const ret = app.mount(root);
      if (typeof ret === 'function') unmountFn = ret;
    } catch (err) {
      root.innerHTML = `<div class="card"><p class="muted">앱을 불러오지 못했습니다. (${app.id})</p></div>`;
      console.error('[app mount error]', app.id, err);
    }

    current = appId;
    // URL 해시로 앱 상태 공유/북마크 가능 (#app=resize)
    history.replaceState(null, '', `#app=${appId}`);
    document.title = `${app.title} - 룸 플래너`;
  }

  // 첫 앱 결정: URL 해시 우선, 없으면 첫 번째
  const hashApp = new URLSearchParams(location.hash.slice(1)).get('app');
  const first = apps.find((a) => a.id === hashApp) ? hashApp : (apps[0] && apps[0].id);
  if (first) activate(first);
}
