/**
 * profile.js
 * 학생 프로필 모달 — 월별 추이 그래프 + 활동 이력
 */

import { recordList } from "./records.js";
import { studentList } from "./students.js";

const ACTIVITY_COLOR = {
  "주일예배 출석": "#7C3AED",
  금요기도회: "#2563EB",
  찬양팀: "#059669",
  안내팀: "#D97706",
  대표기도: "#DC2626",
  "새친구 전도": "#DB2777",
  "기타 활동": "#6B7280",
};

// ── 프로필 모달 열기 ─────────────────────────────────────
function open(name) {
  const stu = studentList.find((s) => s.name === name) || {};
  const recs = recordList
    .filter((r) => r.name === name)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalPts = recs.reduce((s, r) => s + r.pts, 0);

  // 월별 합산
  const byMonth = {};
  recs.forEach((r) => {
    const m = r.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + r.pts;
  });
  const months = Object.keys(byMonth).sort();

  // 활동별 합산
  const byActivity = {};
  recs.forEach((r) => {
    byActivity[r.activity] = (byActivity[r.activity] || 0) + r.pts;
  });
  const actSorted = Object.entries(byActivity).sort((a, b) => b[1] - a[1]);

  const GRADE_COLOR = {
    "1학년": "#16a34a",
    "2학년": "#ca8a04",
    "3학년": "#dc2626",
  };
  const gradeColor = GRADE_COLOR[stu.grade] || "#7C3AED";

  // 그래프 SVG 생성
  const chartSVG = months.length >= 2 ? buildChart(months, byMonth) : "";

  document.getElementById("profile-modal").innerHTML = `
    <div class="profile-box">
      <button class="profile-close" onclick="window.profile.close()">✕</button>

      <!-- 헤더 -->
      <div class="profile-header">
        <div class="profile-avatar">${name[0]}</div>
        <div>
          <div class="profile-name">${name}</div>
          <div class="profile-meta">
            <span class="badge" style="background:${gradeColor};color:#fff;font-size:11px">${stu.grade || "학년 미지정"}</span>
            <span style="color:var(--gray);font-size:13px;margin-left:6px">${stu.teacher || ""}</span>
          </div>
        </div>
        <div class="profile-total">
          <div style="font-size:22px;font-weight:900;color:var(--purple)">${totalPts.toLocaleString()}P</div>
          <div style="font-size:11px;color:var(--gray)">누적 마일리지</div>
        </div>
      </div>

      <!-- 활동별 요약 -->
      <div class="profile-section-title">📊 활동별 마일리지</div>
      <div class="profile-activity-bars">
        ${actSorted
          .map(([act, pts]) => {
            const pct = Math.round((pts / totalPts) * 100);
            const color = ACTIVITY_COLOR[act] || "#7C3AED";
            return `<div class="profile-bar-row">
            <div class="profile-bar-label">${act}</div>
            <div class="profile-bar-wrap">
              <div class="profile-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="profile-bar-pts">${pts.toLocaleString()}P</div>
          </div>`;
          })
          .join("")}
      </div>

      <!-- 월별 추이 그래프 -->
      ${
        months.length >= 2
          ? `
        <div class="profile-section-title">📈 월별 마일리지 추이</div>
        <div class="profile-chart-wrap">${chartSVG}</div>
      `
          : ""
      }

      <!-- 활동 이력 -->
      <div class="profile-section-title">📋 활동 이력 (${recs.length}건)</div>
      <div class="profile-history">
        ${
          recs.length === 0
            ? '<div style="text-align:center;color:var(--gray);padding:20px">활동 기록이 없습니다</div>'
            : recs
                .map((r) => {
                  const color = ACTIVITY_COLOR[r.activity] || "#7C3AED";
                  return `<div class="profile-history-row">
                <div class="profile-history-date">${r.date}</div>
                <div class="profile-history-act">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                    background:${color};margin-right:6px"></span>${r.activity}
                  ${r.earlybird ? '<span style="font-size:10px;color:#ca8a04">🌅</span>' : ""}
                  ${r.etcName ? `<span style="font-size:11px;color:var(--gray)"> · ${r.etcName}</span>` : ""}
                </div>
                <div class="profile-history-pts" style="color:${color}">+${r.pts}P</div>
              </div>`;
                })
                .join("")
        }
      </div>
    </div>
  `;

  document.getElementById("profile-modal").classList.add("show");
}

// ── 선 그래프 SVG 빌드 ───────────────────────────────────
function buildChart(months, byMonth) {
  const W = 520,
    H = 140,
    PAD = { t: 16, r: 16, b: 32, l: 44 };
  const vals = months.map((m) => byMonth[m]);
  const maxV = Math.max(...vals) || 1;

  const xStep = (W - PAD.l - PAD.r) / (months.length - 1);
  const pts = vals.map((v, i) => {
    const x = PAD.l + i * xStep;
    const y = PAD.t + (1 - v / maxV) * (H - PAD.t - PAD.b);
    return { x, y, v, m: months[i] };
  });

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area =
    `${pts[0].x},${H - PAD.b} ` +
    pts.map((p) => `${p.x},${p.y}`).join(" ") +
    ` ${pts[pts.length - 1].x},${H - PAD.b}`;

  const circles = pts
    .map(
      (p) => `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="#7C3AED" stroke="white" stroke-width="2"/>
    <title>${p.m}: ${p.v.toLocaleString()}P</title>
  `,
    )
    .join("");

  const labels = pts
    .map(
      (p) => `
    <text x="${p.x}" y="${H - PAD.b + 14}" text-anchor="middle"
      font-size="9" fill="#888">${p.m.slice(5)}</text>
  `,
    )
    .join("");

  const yLabels = [0, 0.5, 1]
    .map((r) => {
      const y = PAD.t + (1 - r) * (H - PAD.t - PAD.b);
      const v = Math.round(maxV * r);
      return `<text x="${PAD.l - 6}" y="${y + 4}" text-anchor="end"
      font-size="9" fill="#aaa">${v}</text>
      <line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}"
        stroke="#f0f0f0" stroke-width="1"/>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
    ${yLabels}
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${area}" fill="url(#areaGrad)"/>
    <polyline points="${polyline}" fill="none" stroke="#7C3AED" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${circles}
    ${labels}
  </svg>`;
}

// ── 프로필 모달 닫기 ─────────────────────────────────────
function close() {
  document.getElementById("profile-modal").classList.remove("show");
}

window.profile = { open, close };
