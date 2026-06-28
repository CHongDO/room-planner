/* ============================================================
   icons.js — 인라인 SVG 아이콘 (외부 아이콘 폰트 의존성 제거)
   ------------------------------------------------------------
   icon('bed') 처럼 호출하면 SVG 문자열을 반환합니다.
   새 아이콘이 필요하면 여기에 path 만 추가하세요.
   stroke=currentColor 이므로 색은 상위 요소 color 를 따릅니다.
   ============================================================ */

const PATHS = {
  bed:      '<path d="M3 7v11M3 13h18M21 18v-5a3 3 0 0 0-3-3H8M7 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
  desk:     '<rect x="3" y="5" width="18" height="11" rx="1"/><path d="M3 16v3M21 16v3"/>',
  chair:    '<path d="M6 9V5a2 2 0 0 1 2-2h2v6M14 9V3h2a2 2 0 0 1 2 2v4M5 9h14l-1 5H6L5 9zM7 14v6M17 14v6"/>',
  wardrobe: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18M10 11h.01M14 11h.01"/>',
  hanger:   '<path d="M12 6a2 2 0 1 1 1 1.7L4 14h16l-7-4"/>',
  books:    '<path d="M5 4h4v16H5zM9 4h4v16H9zM14 6l4-1 3 14-4 1z"/>',
  dresser:  '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M9 8h.01M9 16h.01"/>',
  rotate:   '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  maximize: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  magnet:   '<path d="M6 3v7a6 6 0 0 0 12 0V3M6 7h4M14 7h4"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  logo:     '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  shapes:   '<rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17.5" cy="6.5" r="3.5"/><path d="M7 21l5-9 5 9z"/>',
  eye:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H2a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8a1.7 1.7 0 0 0 1.04-1.56V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8a1.7 1.7 0 0 0 1.56 1.04H22a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z"/>',
};

export function icon(name, size = 18) {
  const body = PATHS[name] || PATHS.logo;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${body}</svg>`;
}
