/**
 * auth.js
 * 인증 관리 — 관리자 / 선생님 / 읽기전용 3단계 권한
 *
 * 권한별 기능:
 *   관리자  (isAdmin=true)  : 모든 기능 (학생 추가·수정·삭제, 마일리지 등록·삭제)
 *   선생님  (isTeacher=true): 마일리지 등록만 가능 (학생 관리 불가)
 *   읽기전용               : 조회만 가능
 *
 * 비밀번호 변경 방법 (콘솔에서 실행):
 *   const b = new TextEncoder().encode('새비밀번호');
 *   const h = await crypto.subtle.digest('SHA-256', b);
 *   console.log([...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''));
 */

// sky2026 → 관리자
const ADMIN_HASH =
  "f4036a14c2845da3850ac6bc265ce3e01c1298398d367c1c8a356472651cd29e";
// tc2026  → 선생님
const TEACHER_HASH =
  "15bcefb5ecd24a4ded47db2e40ce12754c8226dda56939200d4fbaaf4575dec1";

/** 전역 인증 상태 */
window.authState = { isAdmin: false, isTeacher: false };

/** SHA-256 변환 */
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** body 클래스 & 배지 업데이트 */
function applyUI() {
  const { isAdmin, isTeacher } = window.authState;
  const btn = document.getElementById("mode-btn");

  // body 클래스: readonly / teacher-mode / admin-mode
  document.body.classList.remove("readonly", "teacher-mode", "admin-mode");

  if (isAdmin) {
    document.body.classList.add("admin-mode");
    btn.textContent = "🔑 관리자 모드";
    btn.className = "mode-badge mode-admin";
  } else if (isTeacher) {
    document.body.classList.add("teacher-mode");
    btn.textContent = "📋 선생님 모드";
    btn.className = "mode-badge mode-teacher";
  } else {
    document.body.classList.add("readonly");
    btn.textContent = "👁 읽기 전용";
    btn.className = "mode-badge mode-readonly";
  }

  // 권한 변경 시 기록 목록 재렌더 (삭제 버튼 즉시 반영, 페이지 1로 리셋)
  setTimeout(() => {
    if (window.records && window.records.resetToPage1) {
      window.records.resetToPage1();
    }
  }, 0);
}

/** 헤더 배지 클릭 → 로그아웃 or 모달 열기 */
async function toggleMode() {
  if (window.authState.isAdmin || window.authState.isTeacher) {
    window.authState.isAdmin = false;
    window.authState.isTeacher = false;
    applyUI();
  } else {
    document.getElementById("login-modal").classList.add("show");
    document.getElementById("admin-pw-input").value = "";
    document.getElementById("login-error").style.display = "none";
    document.getElementById("admin-pw-input").focus();
  }
}

/** 로그인 시도 */
async function tryLogin() {
  const input = document.getElementById("admin-pw-input").value;
  const hash = await sha256(input);

  if (hash === ADMIN_HASH) {
    window.authState.isAdmin = true;
    window.authState.isTeacher = false;
    applyUI();
    closeModal();
  } else if (hash === TEACHER_HASH) {
    window.authState.isAdmin = false;
    window.authState.isTeacher = true;
    applyUI();
    closeModal();
  } else {
    document.getElementById("login-error").style.display = "block";
    document.getElementById("admin-pw-input").value = "";
    document.getElementById("admin-pw-input").focus();
  }
}

/** 모달 닫기 */
function closeModal() {
  document.getElementById("login-modal").classList.remove("show");
  document.getElementById("admin-pw-input").value = "";
  document.getElementById("login-error").style.display = "none";
}

window.auth = { toggleMode, tryLogin, closeModal };
