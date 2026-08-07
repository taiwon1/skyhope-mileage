/**
 * summary.js
 * 월별 마일리지 정산 — 합계만 노출, 클릭 시 항목 + 출석횟수 펼침
 */

import { recordList } from "./records.js";
import { studentList, getStudent } from "./students.js";

const ACTIVITY_KEYS = [
  { key: "attend", label: "주일출석" },
  { key: "early",  label: "얼리버드" },
  { key: "fri",    label: "금요기도회" },
  { key: "choir",  label: "찬양팀" },
  { key: "guide",  label: "안내팀" },
  { key: "prayer", label: "대표기도" },
  { key: "friend", label: "새친구 전도" },
  { key: "etc",    label: "기타" },
];

let expandedRows = new Set();

function setThisMonth() {
  const now = new Date();
  document.getElementById("sel-month").value =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  render();
}

function render() {
  const month    = document.getElementById("sel-month").value;
  const fTeacher = document.getElementById("sum-filter-teacher").value;
  const fGrade   = document.getElementById("sum-filter-grade").value;
  const fName    = document.getElementById("sum-filter-name")?.value.trim() || "";
  const sortKey  = document.getElementById("sum-sort").value;

  const monthRecs = month ? recordList.filter(r => r.date.startsWith(month)) : recordList;
  const prevRecs  = month ? recordList.filter(r => r.date < month + "-01") : [];

  renderStatCards(monthRecs, studentList);
  renderTable(monthRecs, prevRecs, fTeacher, fGrade, fName, sortKey);
}

// ── 통계 카드 — 평균 출석 횟수 추가 ─────────────────────
function renderStatCards(filtered, students) {
  const totalPts       = filtered.reduce((s, r) => s + r.pts, 0);
  const activeStudents = new Set(filtered.map(r => r.name)).size;

  // 주일출석 횟수 평균
  const attendRecs = filtered.filter(r => r.activity === "주일예배 출석");
  const avgAttend  = activeStudents > 0
    ? (attendRecs.length / activeStudents).toFixed(1)
    : "0";

  document.getElementById("stat-grid").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">총 마일리지</div>
      <div class="stat-value">${totalPts.toLocaleString()}<span class="stat-unit">P</span></div>
    </div>
    <div class="stat-card gold">
      <div class="stat-label">참여 학생 수</div>
      <div class="stat-value">${activeStudents}<span class="stat-unit">명</span></div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">평균 주일 출석</div>
      <div class="stat-value">${avgAttend}<span class="stat-unit">회</span></div>
    </div>`;
}

// ── 정산 테이블 ───────────────────────────────────────────
function renderTable(monthRecs, prevRecs, fTeacher, fGrade, fName, sortKey) {
  const tbody = document.getElementById("summary-tbody");
  const empty = document.getElementById("summary-empty");
  tbody.innerHTML = "";

  const map     = buildMap(monthRecs);
  const prevMap = buildPrevTotals(prevRecs);

  let rows = Object.entries(map).map(([name, d]) => {
    const info = getStudent(name);
    return {
      name, grade: info.grade || "-", teacher: info.teacher || "-", gender: info.gender || "",
      ...d, prevTotal: prevMap[name] || 0, cumTotal: (prevMap[name] || 0) + d.total,
    };
  });

  if (fTeacher) rows = rows.filter(r => r.teacher === fTeacher);
  if (fGrade)   rows = rows.filter(r => r.grade   === fGrade);
  if (fName)    rows = rows.filter(r => r.name.includes(fName));

  if (!rows.length) { empty.style.display = "block"; return; }
  empty.style.display = "none";


  rows.sort((a, b) => {
    switch (sortKey) {
      case "total-desc":   return b.total - a.total;
      case "total-asc":    return a.total - b.total;
      case "cum-desc":     return b.cumTotal - a.cumTotal;
      case "attend-desc":  return b.attendCount - a.attendCount;
      case "name-asc":     return a.name.localeCompare(b.name, "ko");
      default: return 0;
    }
  });

  const GRADE_BADGE = { "1학년": "badge-green", "2학년": "badge-gold", "3학년": "badge-red" };

  rows.forEach(d => {
    const isExpanded = expandedRows.has(d.name);
    const nameColor  = d.gender === "남" ? "#2563eb" : d.gender === "여" ? "#db2777" : "var(--purple)";
    const activeItems = ACTIVITY_KEYS.filter(k => d[k.key] > 0);

    const detailHtml = activeItems.length ? `
      <div class="sum-detail-chips">
        ${activeItems.map(k => `
          <span class="sum-detail-item">
            <span class="sum-detail-label">${k.label}</span>
            <span class="sum-detail-pts">${d[k.key]}P</span>
          </span>`).join("")}
      </div>` : `<div style="padding:12px 16px;font-size:12px;color:var(--text-sub)">활동 기록 없음</div>`;

    tbody.innerHTML += `
      <tr class="sum-row ${isExpanded ? "expanded" : ""}"
          onclick="window.summary.toggleRow('${d.name}')" style="cursor:pointer">
        <td style="text-align:left;padding-left:14px">
          <strong style="color:${nameColor}">${d.name}</strong>
        </td>
        <td><span class="badge ${GRADE_BADGE[d.grade] || "badge-purple"}" style="font-size:10px">${d.grade}</span></td>
        <td style="font-weight:900;color:var(--purple);font-size:13px">${d.total.toLocaleString()}P</td>
        <td style="color:var(--text-sub);font-size:11px">${d.cumTotal.toLocaleString()}P</td>
        <td class="sum-chevron">${isExpanded ? "▲" : "▼"}</td>
      </tr>
      ${isExpanded ? `
      <tr class="sum-detail-row">
        <td colspan="5">${detailHtml}</td>
      </tr>` : ""}`;
  });
}

function toggleRow(name) {
  if (expandedRows.has(name)) expandedRows.delete(name);
  else expandedRows.add(name);
  render();
}

// ── buildMap — attendCount, earlyCount 추가 ───────────────
function buildMap(recs) {
  const map = {};
  recs.forEach(r => {
    if (!map[r.name]) map[r.name] = {
      attend:0, early:0, fri:0, choir:0, guide:0, prayer:0, friend:0, etc:0,
      total:0, attendCount:0, earlyCount:0,
    };
    const m = map[r.name];
    switch (r.activity) {
      case "주일예배 출석":
        m.attend += 100;
        m.attendCount += 1;
        if (r.earlybird) { m.early += 50; m.earlyCount += 1; }
        break;
      case "금요기도회 참석":      m.fri    += r.pts; break;
      case "주일예배 찬양팀 섬김": m.choir  += r.pts; break;
      case "주일예배 안내팀 섬김": m.guide  += r.pts; break;
      case "대표기도":             m.prayer += r.pts; break;
      case "새친구 전도":          m.friend += r.pts; break;
      default:                     m.etc    += r.pts;
    }
    m.total += r.pts;
  });
  return map;
}

function buildPrevTotals(prevRecs) {
  const map = {};
  prevRecs.forEach(r => { map[r.name] = (map[r.name] || 0) + r.pts; });
  return map;
}

window.summary = { render, setThisMonth, toggleRow };