/**
 * app.js
 * 앱 진입점 — 탭 전환, 전체 초기화
 *
 * [순환참조 해결]
 * showAlert는 utils.js로 분리 → records.js/students.js가 app.js를 import하지 않음
 */

import { startListener as startRecords } from "./records.js";
import { startListener as startStudents } from "./students.js";
import { startListener as startNotices } from "./notice.js";
export { showAlert } from "./utils.js";

// ── 탭 전환 ───────────────────────────────────────────────
function showTab(id, el) {
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("tab-" + id).classList.add("active");
  el.classList.add("active");

  if (id === "summary") window.summary.render();
  if (id === "ranking") window.ranking.render();
  if (id === "notice") window.notice.render();
}

// ── 초기화 ────────────────────────────────────────────────
function init() {
  document.getElementById("in-date").value = new Date()
    .toISOString()
    .split("T")[0];

  const now = new Date();
  const thisMonth =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  document.getElementById("sel-month").value = thisMonth;

  startRecords(() => {
    if (document.getElementById("tab-summary").classList.contains("active"))
      window.summary.render();
    if (document.getElementById("tab-ranking").classList.contains("active"))
      window.ranking.render();
  });

  startStudents();
  startNotices();

  setTimeout(() => {
    document.getElementById("loading-overlay").style.display = "none";
  }, 1200);
}

window.app = { showTab };
document.addEventListener("DOMContentLoaded", init);
