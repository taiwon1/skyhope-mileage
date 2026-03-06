/**
 * summary.js
 * 월별 마일리지 정산 테이블 + Chart.js 막대 그래프
 */

import { recordList } from "./records.js";

const CHART_PALETTE = [
  "#6B4FA0", "#9B7FD0", "#E8A020", "#388E3C", "#1565C0",
  "#C62828", "#00838F", "#6A1B9A", "#558B2F", "#E65100",
];

let chartInstance = null;

// ── 이번 달로 설정 ────────────────────────────────────────
function setThisMonth() {
  const now = new Date();
  document.getElementById("sel-month").value =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  render();
}

// ── 정산 렌더링 ───────────────────────────────────────────
function render() {
  const month    = document.getElementById("sel-month").value;
  const filtered = month
    ? recordList.filter(r => r.date.startsWith(month))
    : recordList;

  renderStatCards(filtered);
  renderTable(filtered);
  renderChart(filtered);
}

// ── 상단 통계 카드 ────────────────────────────────────────
function renderStatCards(filtered) {
  const totalPts       = filtered.reduce((s, r) => s + r.pts, 0);
  const activeStudents = new Set(filtered.map(r => r.name)).size;

  document.getElementById("stat-grid").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">총 마일리지</div>
      <div class="stat-value">${totalPts.toLocaleString()}<span class="stat-unit">P</span></div>
    </div>
    <div class="stat-card gold">
      <div class="stat-label">총 활동 기록</div>
      <div class="stat-value">${filtered.length}<span class="stat-unit">건</span></div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">참여 학생 수</div>
      <div class="stat-value">${activeStudents}<span class="stat-unit">명</span></div>
    </div>`;
}

// ── 학생별 정산 테이블 ────────────────────────────────────
function renderTable(filtered) {
  const tbody = document.getElementById("summary-tbody");
  const empty = document.getElementById("summary-empty");
  tbody.innerHTML = "";

  if (!filtered.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  // 학생별 집계
  const map = {};
  filtered.forEach(r => {
    if (!map[r.name])
      map[r.name] = { attend: 0, early: 0, fri: 0, choir: 0, guide: 0, prayer: 0, friend: 0, etc: 0, total: 0 };
    const m = map[r.name];

    switch (r.activity) {
      case "주일예배 출석":        m.attend += 100; if (r.earlybird) m.early += 50; break;
      case "금요기도회 참석":      m.fri    += r.pts; break;
      case "주일예배 찬양팀 섬김": m.choir  += r.pts; break;
      case "주일예배 안내팀 섬김": m.guide  += r.pts; break;
      case "대표기도":             m.prayer += r.pts; break;
      case "새친구 전도":          m.friend += r.pts; break;
      default:                     m.etc    += r.pts;
    }
    m.total += r.pts;
  });

  const fmt = v => v
    ? `<span style="color:var(--purple); font-weight:700">${v}P</span>`
    : `<span style="color:#CCC">-</span>`;

  Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([name, d]) => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${name}</strong></td>
          <td>${fmt(d.attend)}</td>
          <td>${fmt(d.early)}</td>
          <td>${fmt(d.fri)}</td>
          <td>${fmt(d.choir)}</td>
          <td>${fmt(d.guide)}</td>
          <td>${fmt(d.prayer)}</td>
          <td>${fmt(d.friend)}</td>
          <td>${fmt(d.etc)}</td>
          <td><strong style="color:var(--purple); font-size:15px">${d.total}P</strong></td>
        </tr>`;
    });
}

// ── 막대 그래프 ───────────────────────────────────────────
function renderChart(filtered) {
  const chartCard = document.getElementById("chart-card");

  if (!filtered.length) {
    chartCard.style.display = "none";
    return;
  }

  // 학생별 합계 집계
  const totals = {};
  filtered.forEach(r => { totals[r.name] = (totals[r.name] || 0) + r.pts; });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const labels = sorted.map(([name]) => name);
  const data   = sorted.map(([, pts]) => pts);
  const colors = labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

  chartCard.style.display = "block";

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(document.getElementById("summary-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "마일리지 (P)",
        data,
        backgroundColor: colors,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString()}P` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "Noto Sans KR", weight: "700" } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#F0EBF9" },
          ticks: {
            font: { family: "Noto Sans KR" },
            callback: v => v.toLocaleString() + "P",
          },
        },
      },
    },
  });
}

// 전역 노출
window.summary = { render, setThisMonth };
