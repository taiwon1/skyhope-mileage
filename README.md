# ⛪ SkyHope 하늘소망고등부 마일리지 시스템

> 교회 고등부 학생들의 활동 참여를 마일리지로 적립하고 월별로 정산하는 웹 기반 관리 시스템입니다.

---

## 📌 주요 기능

| 기능 | 설명 |
|------|------|
| 📝 활동 기록 | 날짜 · 활동 · 이름 순으로 빠르게 입력, 연속 등록 지원 |
| 📊 월별 정산 | 학생별 활동 항목 합산 및 막대 그래프 시각화 |
| 🏆 랭킹 | 월별 마일리지 순위 자동 계산 |
| 👥 학생 관리 | 학생 명단 추가 / 삭제 |
| 🔐 관리자 모드 | SHA-256 해시 기반 비밀번호 인증, 읽기 전용 / 관리자 모드 분리 |
| ☁️ 실시간 동기화 | Firebase Firestore 연동 — PC · 모바일 어디서든 동일한 데이터 조회 |

---

## 🎯 마일리지 기준

| 활동 | 마일리지 |
|------|---------|
| 주일예배 출석 | 100P |
| 주일예배 출석 (얼리버드) | 150P |
| 금요기도회 참석 | 50P |
| 주일예배 찬양팀 섬김 | 50P |
| 주일예배 안내팀 섬김 | 30P |
| 대표기도 | 300P |
| 새친구 전도 | 1000P |
| 기타 활동 | 직접 입력 |

---

## 🗂️ 프로젝트 구조

```
skyhope-mileage/
├── index.html                 # HTML 뼈대
├── styles/
│   └── main.css               # 전체 스타일
└── scripts/
    ├── firebase.js            # Firebase 초기화
    ├── auth.js                # 관리자 인증 (SHA-256 해싱)
    ├── records.js             # 활동 기록 CRUD
    ├── students.js            # 학생 관리 CRUD
    ├── summary.js             # 월별 정산 + 차트
    ├── ranking.js             # 랭킹
    └── app.js                 # 탭 전환 · 초기화
```

---

## 🚀 배포

**GitHub Pages** 로 배포되어 있습니다.

```
https://taiwon1.github.io/skyhope-mileage/
```

---

## 🔐 관리자 모드 사용법

1. 우측 상단 **👁 읽기 전용** 배지 클릭
2. 관리자 비밀번호 입력
3. **🔑 관리자 모드** 전환 → 기록 입력 · 삭제 · 학생 관리 활성화

### 관리자 인증 관리
- 비밀번호는 SHA-256 해시값으로만 저장 (평문 없음)
- 로그인 시 입력값을 해싱한 뒤 저장된 해시와 비교
- isAdmin 상태를 전역(window.authState)으로 공유

### 비밀번호 변경 방법:
- 브라우저 콘솔에서 아래 실행 후 나온 해시값을 ADMIN_HASH에 붙여넣기
```
const b = new TextEncoder().encode('새비밀번호');
const h = await crypto.subtle.digest('SHA-256', b);
console.log([...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''));
```

---

## 🛠️ 기술 스택

- **Frontend** — Vanilla JS (ES Modules), HTML5, CSS3
- **Database** — Firebase Firestore (실시간 NoSQL)
- **Chart** — Chart.js 4
- **Auth** — Web Crypto API (SHA-256)
- **Hosting** — GitHub Pages

---

## 📦 로컬 실행

별도 설치 없이 브라우저에서 바로 열 수 있습니다.
단, ES Module 및 Firebase SDK 로드를 위해 **로컬 서버** 환경이 필요합니다.

```bash
# VS Code Live Server 확장 사용 시
index.html 우클릭 → Open with Live Server
```

---

*SkyHope 하늘소망고등부 | 마일리지 시스템*
