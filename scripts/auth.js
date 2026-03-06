/**
 * auth.js
 * 관리자 인증 관리
 *
 * - 비밀번호는 SHA-256 해시값으로만 저장 (평문 없음)
 * - 로그인 시 입력값을 해싱한 뒤 저장된 해시와 비교
 * - isAdmin 상태를 전역(window.authState)으로 공유
 *
 * 비밀번호 변경 방법:
 *   브라우저 콘솔에서 아래 실행 후 나온 해시값을 ADMIN_HASH에 붙여넣기
 *   > const b = new TextEncoder().encode('새비밀번호');
 *   > const h = await crypto.subtle.digest('SHA-256', b);
 *   > console.log([...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''));
 */

/** 전역 인증 상태 */
window.authState = window.authState || { isAdmin: false };

const ADMIN_HASH =
  "f4036a14c2845da3850ac6bc265ce3e01c1298398d367c1c8a356472651cd29e";

/** 문자열을 SHA-256 해시 (hex 문자열) 로 변환 */
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** UI 업데이트 헬퍼 */
function applyAdminUI(isAdmin) {
  const btn = document.getElementById("mode-btn");
  if (isAdmin) {
    document.body.classList.remove("readonly");
    btn.textContent = "🔑 관리자 모드";
    btn.className = "mode-badge mode-admin";
  } else {
    document.body.classList.add("readonly");
    btn.textContent = "👁 읽기 전용";
    btn.className = "mode-badge mode-readonly";
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
  const hash = await sha256(input);

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
