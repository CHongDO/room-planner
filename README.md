# 방 배치 시뮬레이터 (Room Planner)

방 크기와 가구 치수를 입력해 가구 배치를 미리 보는 정적 웹 도구.
여유 공간(문/의자/옷 부피), 벽 붙이기, 문 막힘·채광 차단 경고를 지원한다.
설치·회원가입 없이 브라우저에서 동작하며, 모든 계산은 기기 안에서만 이루어진다.

## 빠른 시작 (로컬 실행)
ES 모듈을 쓰므로 파일을 직접 열지 말고 정적 서버로 실행한다.

```bash
cd room-planner
python -m http.server 5500
# 브라우저에서 http://localhost:5500
```
또는 VS Code **Live Server** 확장(자동 새로고침, 권장).

## Claude Code로 작업하기
이 폴더에서 `claude` 실행. 루트 `CLAUDE.md`에 작업 규칙과
"새 기능 추가 방법"이 적혀 있다.

예) `roomPlanner.js 패턴 그대로 '채광 분석' 기능을 새 앱으로 추가해줘.`

## 구조 한눈에
- `css/theme.css` — 테마 변수. **테마/색을 바꾸려면 여기만 수정.**
- `css/shell.css` — 헤더/탭/푸터 레이아웃 + 공용 컨트롤
- `js/appHost.js` — 앱 탭 전환(셸, 건드릴 일 거의 없음)
- `js/appRegistry.js` — **기능 추가 시 한 줄 등록**
- `js/apps/` — 각 기능. 새 앱은 `roomPlanner.js` 참고
- `js/icons.js` — 인라인 SVG 아이콘
- `pages/` — 소개 / 기능 / 개인정보처리방침 (애드센스용)

## 배포
Cloudflare Pages에 GitHub 저장소 연결(빌드 명령 없음, 출력 `/`).
push 시 자동 배포. 배포 전 `CLAUDE.md` 체크리스트 확인.
