# CLAUDE.md — 프로젝트 작업 안내서

이 파일은 Claude Code가 작업 시작 시 자동으로 읽습니다. 규칙을 지켜 구조를 일관되게 유지하세요.

## 프로젝트 개요
- **무엇**: 방 크기·가구 치수를 입력해 가구 배치를 미리 보는 시뮬레이터 (정적 사이트)
- **상태**: 와이어프레임 단계. **테마/UI/UX 미정** — 색·모양은 전부 변수로 빼둔 중립 톤.
- **배포 대상**: Cloudflare Pages (정적 호스팅, 빌드 없음)
- **수익화**: 추후 Google AdSense → 문서 페이지/SEO 유지 필수

## 절대 규칙 (어기지 말 것)
1. **빌드 도구 없음**: 번들러·트랜스파일러 금지. 순수 HTML/CSS/JS + 브라우저 ES 모듈(`type="module"`).
2. **색·폰트·모양은 `css/theme.css` 변수로만**. JS/다른 CSS에 색값(#hex, rgb) 하드코딩 금지.
   테마 교체는 theme.css 수정만으로 가능해야 한다. (XP 테마 등으로 바꿀 때 여기만 손봄)
3. **셸과 앱 분리**: 헤더/탭 전환/푸터/레이아웃은 셸(appHost.js, shell.css) 책임.
   각 기능(앱)은 자기 컨테이너 내부 UI만 책임진다.
4. **모든 계산은 브라우저 안에서**. 서버 전송·외부 API 금지(개인정보처리방침에 명시됨).
5. **접근성/반응형 유지**: 키보드 포커스, `prefers-reduced-motion`, 모바일 폭 대응.
6. **아이콘은 `js/icons.js`의 인라인 SVG 사용**. 외부 아이콘 폰트/CDN 추가 금지.

## 폴더 구조
```
index.html            진입점 (셸 뼈대 + SEO 메타)
css/theme.css         테마 변수 (← 테마 변경은 여기만)
css/shell.css         셸 레이아웃 + 공용 컨트롤(.btn .input .card .toggle-pill 등)
css/page.css          문서 페이지 공용 스타일
js/main.js            진입점
js/appHost.js         앱 탭 생성 + 전환/마운트  ← 셸
js/appRegistry.js     ★ 앱 목록 (기능 추가 시 여기 등록)
js/icons.js           인라인 SVG 아이콘
js/apps/roomPlanner.js  기능1: 방 배치 시뮬레이터 (표준 앱 템플릿)
pages/                about / features / privacy (애드센스 심사용)
robots.txt sitemap.xml  SEO
```

## ★ 새 기능(앱) 추가 방법
1. `js/apps/roomPlanner.js`를 참고해 `js/apps/<기능>.js` 생성.
2. default export 형태:
   ```js
   import { icon } from '../icons.js';
   export default {
     id: 'sunlight',          // 고유 id (URL 해시 #app=sunlight 로도 쓰임)
     title: '채광 분석',       // 탭/제목
     icon: icon('logo', 16),  // 인라인 SVG
     mount(container) {
       container.innerHTML = `...`;   // 이 컨테이너 안만 책임
       // 이벤트 바인딩 ...
       // (선택) return () => { /* 정리 로직 */ };  // 탭 전환 시 호출됨
     },
   };
   ```
3. `js/appRegistry.js`에 import 한 줄 + `apps` 배열에 추가.
4. 끝. 헤더 탭과 화면 전환은 자동. **셸 파일 수정 불필요.**
5. 기능을 추가하면 `pages/features.html`과 `sitemap.xml`도 갱신.

## 공용 컨트롤 (shell.css 제공, 앱에서 재사용)
`.btn`, `.btn--primary`, `.input`, `.field`, `.row`, `.card`, `.toggle-pill`,
`.stat-box`, `.muted`. 새 UI는 가능한 이것들을 재사용한다.

## 로컬 실행
ES 모듈이라 `file://` 직접 열기는 동작 안 함. 정적 서버로 실행:
```bash
python -m http.server 5500     # → http://localhost:5500
# 또는: npx serve  /  VS Code "Live Server" 확장(권장)
```

## 배포 (Cloudflare Pages)
- 빌드 명령: 없음 / 출력 디렉터리: `/`
- GitHub 저장소 연결 후 push 하면 자동 배포.

## 배포 전 체크리스트
- [ ] `example.pages.dev` → 실제 도메인 전부 치환 (index.html, pages/*, sitemap.xml, robots.txt)
- [ ] privacy.html 이메일·최종수정일 실제값
- [ ] AdSense 발급 후 index.html 광고 스크립트 주석 해제 + client id 입력
- [ ] assets/og-image.png, favicon 추가
- [ ] 새 기능 추가 시 features.html·sitemap.xml 갱신

## 테마 확정 시 (참고)
UI/테마가 정해지면 대부분 `css/theme.css` 변수 값만 수정하면 된다.
구조적 변화(예: 헤더를 시작메뉴형으로)가 필요하면 shell.css/appHost.js를 손본다.
앱 코드(js/apps/*)는 색을 변수로만 참조하므로 테마 변경 시 거의 건드릴 필요가 없다.
