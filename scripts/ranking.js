/**
 * ranking.js
 * 마일리지 랭킹 — 기본: 전체 누적 / 선택: 월별
 */

import { recordList } from "./records.js";

const MEDAL_CLASS = ["top1", "top2", "top3"];
const MEDAL_ICON = ["🥇", "🥈", "🥉"];

// ── 전체 누적 보기 ────────────────────────────────────────
function setAll() {
  document.getElementById("rank-month").value = "";
  updateModeBtn(false);
  render();
}

// ── 이번 달로 설정 ────────────────────────────────────────
function setThisMonth() {
  const now = new Date();
  document.getElementById("rank-month").value =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  updateModeBtn(true);
  render();
}

// ── 월 선택 변경 시 ──────────────────────────────────────
function onMonthChange() {
  const val = document.getElementById("rank-month").value;
  updateModeBtn(!!val);
  render();
}

// ── 모드 버튼 표시 업데이트 ──────────────────────────────
function updateModeBtn(isMonthly) {
  const allBtn = document.getElementById("rank-btn-all");
  const monBtn = document.getElementById("rank-btn-month");
  if (!allBtn || !monBtn) return;
  allBtn.className = isMonthly
    ? "btn btn-sm btn-secondary"
    : "btn btn-sm btn-primary";
  monBtn.className = isMonthly
    ? "btn btn-sm btn-primary"
    : "btn btn-sm btn-secondary";
}

// ── 랭킹 렌더링 ───────────────────────────────────────────
function render() {
  const month = document.getElementById("rank-month").value;
  const filtered = month
    ? recordList.filter((r) => r.date.startsWith(month))
    : recordList;

  const isMonthly = !!month;

  // 학생별 합산
  const totals = {};
  filtered.forEach((r) => {
    totals[r.name] = (totals[r.name] || 0) + r.pts;
  });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const list = document.getElementById("ranking-list");

  // 제목 업데이트
  const title = document.getElementById("ranking-title");
  if (title)
    title.textContent = isMonthly
      ? `🏆 ${month} 월별 랭킹`
      : "🏆 전체 누적 랭킹";

  if (!sorted.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🏆</div>
        <div class="empty-text">${isMonthly ? "해당 월의 기록이 없습니다" : "기록이 없습니다"}</div>
      </div>`;
    return;
  }

  list.innerHTML = sorted
    .map(
      ([name, pts], i) => `
    <div class="rank-item">
      <div class="rank-num ${MEDAL_CLASS[i] || ""}">
        ${i < 3 ? MEDAL_ICON[i] : i + 1}
      </div>
      <div class="rank-name" onclick="window.profile.open('${name}')" style="cursor:pointer">${name}</div>
      <div class="rank-pts">${pts.toLocaleString()}P</div>
    </div>
  `,
    )
    .join("");
}

window.ranking = { render, setThisMonth, setAll, onMonthChange };
