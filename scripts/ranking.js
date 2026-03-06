/**
 * ranking.js
 * 월별 마일리지 랭킹 렌더링
 */

import { recordList } from "./records.js";

const MEDAL_CLASS = ["top1", "top2", "top3"];
const MEDAL_ICON  = ["🥇", "🥈", "🥉"];

// ── 이번 달로 설정 ────────────────────────────────────────
function setThisMonth() {
  const now = new Date();
  document.getElementById("rank-month").value =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  render();
}

// ── 랭킹 렌더링 ───────────────────────────────────────────
function render() {
  const month    = document.getElementById("rank-month").value;
  const filtered = month
    ? recordList.filter(r => r.date.startsWith(month))
    : recordList;

  // 학생별 합산
  const totals = {};
  filtered.forEach(r => { totals[r.name] = (totals[r.name] || 0) + r.pts; });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const list = document.getElementById("ranking-list");

  if (!sorted.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🏆</div>
        <div class="empty-text">해당 월의 기록이 없습니다</div>
      </div>`;
    return;
  }

  list.innerHTML = sorted.map(([name, pts], i) => `
    <div class="rank-item">
      <div class="rank-num ${MEDAL_CLASS[i] || ""}">
        ${i < 3 ? MEDAL_ICON[i] : i + 1}
      </div>
      <div class="rank-name">${name}</div>
      <div class="rank-pts">${pts.toLocaleString()}P</div>
    </div>
  `).join("");
}

// 전역 노출
window.ranking = { render, setThisMonth };
