/**
 * utils.js
 * 공통 유틸 함수 — 순환참조 방지를 위해 app.js와 분리
 */
export function showAlert(id, msg, type) {
  const el = document.getElementById("alert-" + id);
  if (!el) return;
  el.textContent = msg;
  el.className = "alert alert-" + type + " show";
  setTimeout(() => el.classList.remove("show"), 3000);
}
