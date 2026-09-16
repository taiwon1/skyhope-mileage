import { kstToday } from "./utils.js?v=20260917-1";
/**
 * app.js
 * 앱 진입점 — 탭 전환, 전체 초기화
 */

import { startListener as startNewcomers } from "./newcomer.js?v=20260917-1";
import { startListener as startRecords  } from "./records.js?v=20260917-1";
import { startListener as startStudents } from "./students.js?v=20260917-1";
import { startListener as startNotices  } from "./notice.js?v=20260917-1";
export { showAlert } from "./utils.js?v=20260917-1";

// ── 탭 전환 ──────────────────────────────────────────────
function showTab(id, el) {
  if (id === "attend" && !window.authState?.isAdmin && !window.authState?.isTeacher) return;
  // 섹션
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById("tab-" + id).classList.add("active");

  // 데스크탑 상단 탭
  document.querySelectorAll("nav.top-nav .tab").forEach(t => t.classList.remove("active"));

  // 모바일 하단 탭
  document.querySelectorAll(".bottom-tab").forEach(t => t.classList.remove("active"));

  document.querySelector('.bottom-tab[data-tab="' + id + '"]')?.classList.add("active");

  // 클릭된 요소 활성화
  if (el) el.classList.add("active");

  // 탭 이름으로 상단 탭도 동기화
  const topTab = document.querySelector(`nav.top-nav .tab:nth-child(${tabIndex(id)})`);
  if (topTab) topTab.classList.add("active");

  // 렌더
  if (id === "summary") window.summary.render();
  if (id === "ranking") window.ranking.render();
  if (id === "notice")  { window.notice.render(); window.notice.initDate(); }
  if (id === "newcomer") { window.newcomer.render?.(); window.newcomer.populateGuideSelect?.(); }
  if (id === "attend")  { window.attendance.render(); window.attendance.renderPersonSearch(); }

  // 스크롤 맨 위로
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function tabIndex(id) {
  return { newcomer:1, record:2, summary:3, attend:4, ranking:5, students:6, notice:7 }[id] || 2;
}

// ── 필터 접기/펼치기 ─────────────────────────────────────
function toggleFilter(targetId) {
  const el  = document.getElementById(targetId);
  const btn = el?.previousElementSibling;
  if (!el) return;
  const collapsed = el.classList.toggle("collapsed");
  if (btn && btn.classList.contains("filter-toggle-btn")) {
    btn.textContent = collapsed ? "⚙️ 상세 필터" : "⚙️ 필터 닫기";
  }
}

// ── 초기화 ────────────────────────────────────────────────
function init() {
  // 가장 최근 주일 자동 감지 (주일=0)
  // 오늘이 월~토면 지난 주일, 단 지난 주일로부터 7일 이내만 유지
  // 로컬 날짜 포맷 (UTC 오프셋 문제 방지)
  function toLocalDateStr(d) {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  function getLastSunday() {
    const today = kstToday();
    const day   = today.getDay(); // 0=일, 1=월 ... 6=토
    const sun   = new Date(today);
    sun.setDate(today.getDate() - day); // 항상 이번 주 일요일
    return sun;
  }
  const lastSun  = getLastSunday();
  const today    = kstToday();
  const diffDays = Math.floor((today - lastSun) / 86400000);
  // 주일로부터 7일 이내면 주일 날짜, 아니면 오늘
  const defaultDate = diffDays < 7 ? lastSun : today;
  document.getElementById("in-date").value = toLocalDateStr(defaultDate);

  const now       = kstToday();
  const thisMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  document.getElementById("sel-month").value = thisMonth;

  startRecords(() => {
    if (document.getElementById("tab-summary").classList.contains("active"))
      window.summary.render();
    if (document.getElementById("tab-ranking").classList.contains("active"))
      window.ranking.render();
    if (document.getElementById("tab-notice").classList.contains("active"))
      window.notice.render();
    if (document.getElementById("tab-attend")?.classList.contains("active"))
      window.attendance.render();
    // records 업데이트 시 학생 칩 미출석 상태 갱신
    if (window.students && window.students.rerender)
      window.students.rerender();
  });

  startStudents();
  startNotices();
  startNewcomers();

  setTimeout(() => {
    document.getElementById("loading-overlay").style.display = "none";
  }, 1200);
}

window.app = { showTab, toggleFilter };
document.addEventListener("DOMContentLoaded", init);