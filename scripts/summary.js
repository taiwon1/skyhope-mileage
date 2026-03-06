/**
 * summary.js
 * 월별 마일리지 정산 — 필터 · 정렬 · 누적합계
 * (차트 제거 / 누적합계 색깔 버그 수정)
 */

import { recordList } from "./records.js";
import { studentList, getStudent } from "./students.js";

let showCumulative = false;

// ── 이번 달 설정 ──────────────────────────────────────────
function setThisMonth() {
  const now = new Date();
  document.getElementById("sel-month").value =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  render();
}

// ── 누적합계 토글 ─────────────────────────────────────────
function toggleCumulative() {
  showCumulative = !showCumulative;
  const btn = document.getElementById("cum-btn");
  btn.textContent = showCumulative ? "📉 누적합계 숨기기" : "📈 누적합계 보기";
  btn.className = showCumulative
    ? "btn btn-sm btn-primary"
    : "btn btn-sm btn-gold";
  render();
}

// ── 메인 렌더 ─────────────────────────────────────────────
function render() {
  const month = document.getElementById("sel-month").value;
  const fTeacher = document.getElementById("sum-filter-teacher").value;
  const fGrade = document.getElementById("sum-filter-grade").value;
  const fName = document.getElementById("sum-filter-name")?.value.trim() || "";
  const sortKey = document.getElementById("sum-sort").value;

  // 이번 달 기록
  const monthRecs = month
    ? recordList.filter((r) => r.date.startsWith(month))
    : recordList;

  // 직전 누적 기록 (선택 월 이전 전체)
  const prevRecs = month
    ? recordList.filter((r) => r.date < month + "-01")
    : [];

  renderStatCards(monthRecs);
  renderHeader();
  renderTable(monthRecs, prevRecs, fTeacher, fGrade, fName, sortKey);
}

// ── 헤더 컬럼 표시 제어 ───────────────────────────────────
function renderHeader() {
  document.querySelectorAll(".cum-col").forEach((el) => {
    el.style.display = showCumulative ? "" : "none";
  });
}

// ── 통계 카드 ─────────────────────────────────────────────
function renderStatCards(filtered) {
  const totalPts = filtered.reduce((s, r) => s + r.pts, 0);
  const activeStudents = new Set(filtered.map((r) => r.name)).size;

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

// ── 정산 테이블 ───────────────────────────────────────────
function renderTable(monthRecs, prevRecs, fTeacher, fGrade, fName, sortKey) {
  const tbody = document.getElementById("summary-tbody");
  const empty = document.getElementById("summary-empty");
  tbody.innerHTML = "";

  const map = buildMap(monthRecs);
  const prevMap = buildPrevTotals(prevRecs);

  // 학생 정보 병합
  let rows = Object.entries(map).map(([name, d]) => {
    const info = getStudent(name);
    return {
      name,
      grade: info.grade || "-",
      teacher: info.teacher || "-",
      ...d,
      prevTotal: prevMap[name] || 0,
      cumTotal: (prevMap[name] || 0) + d.total,
    };
  });

  // 담임 · 학년 · 이름 필터
  if (fTeacher) rows = rows.filter((r) => r.teacher === fTeacher);
  if (fGrade) rows = rows.filter((r) => r.grade === fGrade);
  if (fName) rows = rows.filter((r) => r.name.includes(fName));

  if (!rows.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  // 정렬
  rows.sort((a, b) => {
    switch (sortKey) {
      case "total-desc":
        return b.total - a.total;
      case "total-asc":
        return a.total - b.total;
      case "cum-desc":
        return b.cumTotal - a.cumTotal;
      case "name-asc":
        return a.name.localeCompare(b.name, "ko");
      default:
        return 0;
    }
  });

  // ── 포맷 헬퍼 ────────────────────────────────────────────
  // inline style 대신 CSS 클래스 사용 → 색깔 깨짐 방지
  const fmtPts = (v) =>
    v
      ? `<span class="pts-val">${v}P</span>`
      : `<span class="pts-empty">-</span>`;

  const fmtPrev = (v) =>
    v
      ? `<span class="pts-prev">${v.toLocaleString()}P</span>`
      : `<span class="pts-empty">-</span>`;

  const fmtCum = (v) =>
    `<strong class="pts-cum">${v.toLocaleString()}P</strong>`;

  const fmtTotal = (v) => `<strong class="pts-total">${v}P</strong>`;

  rows.forEach((d) => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td><span class="badge badge-blue" style="font-size:10px">${d.grade}</span></td>
        <td class="td-teacher">${d.teacher}</td>
        <td>${fmtPts(d.attend)}</td>
        <td>${fmtPts(d.early)}</td>
        <td>${fmtPts(d.fri)}</td>
        <td>${fmtPts(d.choir)}</td>
        <td>${fmtPts(d.guide)}</td>
        <td>${fmtPts(d.prayer)}</td>
        <td>${fmtPts(d.friend)}</td>
        <td>${fmtPts(d.etc)}</td>
        <td class="cum-col">${fmtPrev(d.prevTotal)}</td>
        <td>${fmtTotal(d.total)}</td>
        <td class="cum-col">${fmtCum(d.cumTotal)}</td>
      </tr>`;
  });

  // 헤더 표시 상태 재적용 (tbody 교체 후 DOM 변경 없으므로 thead는 유지됨)
  renderHeader();
}

// ── 이번달 집계 맵 ────────────────────────────────────────
function buildMap(recs) {
  const map = {};
  recs.forEach((r) => {
    if (!map[r.name])
      map[r.name] = {
        attend: 0,
        early: 0,
        fri: 0,
        choir: 0,
        guide: 0,
        prayer: 0,
        friend: 0,
        etc: 0,
        total: 0,
      };
    const m = map[r.name];
    switch (r.activity) {
      case "주일예배 출석":
        m.attend += 100;
        if (r.earlybird) m.early += 50;
        break;
      case "금요기도회 참석":
        m.fri += r.pts;
        break;
      case "주일예배 찬양팀 섬김":
        m.choir += r.pts;
        break;
      case "주일예배 안내팀 섬김":
        m.guide += r.pts;
        break;
      case "대표기도":
        m.prayer += r.pts;
        break;
      case "새친구 전도":
        m.friend += r.pts;
        break;
      default:
        m.etc += r.pts;
    }
    m.total += r.pts;
  });
  return map;
}

// ── 직전 누적 합계 맵 ────────────────────────────────────
function buildPrevTotals(prevRecs) {
  const map = {};
  prevRecs.forEach((r) => {
    map[r.name] = (map[r.name] || 0) + r.pts;
  });
  return map;
}

// 전역 노출
window.summary = { render, setThisMonth, toggleCumulative };
