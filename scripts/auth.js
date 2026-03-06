// sky2026 의 SHA-256 해시값
const ADMIN_HASH = "f4036a14c2845da3850ac6bc265ce3e01c1298398d367c1c8a356472651cd29e";

/** 문자열을 SHA-256 해시 (hex 문자열) 로 변환 */
async function sha256(text) {
  const bytes  = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 전역 인증 상태 */
window.authState = { isAdmin: false };

/** UI 업데이트 헬퍼 */
function applyAdminUI(isAdmin) {
  const btn = document.getElementById("mode-btn");
  if (isAdmin) {
    document.body.classList.remove("readonly");
    btn.textContent  = "🔑 관리자 모드";
    btn.className    = "mode-badge mode-admin";
  } else {
    document.body.classList.add("readonly");
    btn.textContent  = "👁 읽기 전용";
    btn.className    = "mode-badge mode-readonly";
  }
}

/** 관리자 모드 토글 (헤더 배지 클릭) */
async function toggleMode() {
  if (window.authState.isAdmin) {
    // 로그아웃
    window.authState.isAdmin = false;
    applyAdminUI(false);
  } else {
    // 로그인 모달 열기
    document.getElementById("login-modal").classList.add("show");
    document.getElementById("admin-pw-input").focus();
  }
}

/** 로그인 시도 */
async function tryLogin() {
  const input = document.getElementById("admin-pw-input").value;
  const hash  = await sha256(input);

  if (hash === ADMIN_HASH) {
    window.authState.isAdmin = true;
    applyAdminUI(true);
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

// 전역 노출 (HTML onclick에서 호출)
window.auth = { toggleMode, tryLogin, closeModal };
