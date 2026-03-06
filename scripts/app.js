/**
 * app.js
 * 앱 진입점 — 탭 전환, 공통 유틸, 전체 초기화
 *
 * 실행 순서:
 *   1. Firestore 리스너 시작 (records, students)
 *   2. 기본 날짜·월 설정
 *   3. 로딩 오버레이 제거
 */

import { startListener as startRecords } from "./records.js";
import { startListener as startStudents } from "./students.js";

// ── 탭 전환 ───────────────────────────────────────────────
function showTab(id, el) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById("tab-" + id).classList.add("active");
  el.classList.add("active");

  // 탭별 재렌더
  if (id === "summary") window.summary.render();
  if (id === "ranking") window.ranking.render();
}

// ── 공통 알림 헬퍼 ───────────────────────────────────────
export function showAlert(id, msg, type) {
  const el = document.getElementById("alert-" + id);
  el.textContent  = msg;
  el.className    = `alert alert-${type} show`;
  setTimeout(() => el.classList.remove("show"), 3000);
}

// ── 초기화 ────────────────────────────────────────────────
function init() {
  // 오늘 날짜 기본값
  document.getElementById("in-date").value = new Date().toISOString().split("T")[0];

  // 이번 달 기본값
  const now       = new Date();
  const thisMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  document.getElementById("sel-month").value  = thisMonth;
  document.getElementById("rank-month").value = thisMonth;

  // Firestore 실시간 리스너 시작
  // records 업데이트 시 → 현재 열린 summary/ranking 자동 재렌더
  startRecords(() => {
    if (document.getElementById("tab-summary").classList.contains("active"))
      window.summary.render();
    if (document.getElementById("tab-ranking").classList.contains("active"))
      window.ranking.render();
  });

  startStudents();

  // 로딩 오버레이 제거
  setTimeout(() => {
    document.getElementById("loading-overlay").style.display = "none";
  }, 1200);
}

// 전역 노출
window.app = { showTab };

// DOM 준비 후 실행
document.addEventListener("DOMContentLoaded", init);
