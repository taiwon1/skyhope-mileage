import { kstToday, attendanceRecords } from "./utils.js?v=20260915-1";
/**
 * attendance.js — 출석 현황 대시보드 v2
 */

import { recordList } from "./records.js?v=20260915-1";
import { studentList } from "./students.js?v=20260915-1";

const TEACHERS      = ["박태원T", "김하늘T", "박선희T", "황인혁T"];
const GRADES        = ["1학년", "2학년", "3학년"];
const GRADE_COLOR   = { "1학년": "#16a34a", "2학년": "#ca8a04", "3학년": "#dc2626" };
const TEACHER_COLOR = ["#7c3aed", "#2563eb", "#16a34a", "#ca8a04"];

let selectedMonth = null; // null = 올해 전체 평균

// ══════════════════════════════════════════
// 헬퍼
// ══════════════════════════════════════════


function getNowMonth() {
  const n = kstToday();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
}

function getMonthsThisYear() {
  const n = kstToday(), year = n.getFullYear(), cur = n.getMonth()+1;
  return Array.from({length: cur}, (_, i) => `${year}-${String(i+1).padStart(2,"0")}`);
}

// KST 기준 해당 월의 일요일 날짜 목록 (오늘까지)
function getSundayDates(ym) {
  const [y, m] = ym.split("-").map(Number);
  const today  = new Intl.DateTimeFormat("en-CA", {year:"numeric",month:"2-digit",day:"2-digit"}).format(kstToday());
  const dates  = [];
  const last   = new Date(y, m, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d   = new Date(y, m-1, day);
    const str = ym + "-" + String(day).padStart(2,"0");
    if (d.getDay() === 0 && str <= today) dates.push(str);
  }
  return dates;
}

// 카드와 그래프가 공유하는 주일당 평균. 기록 없는 지난 주일도 분모에 포함합니다.
function getPeriodStats(studs, months) {
  const dates = new Set(months.flatMap(getSundayDates));
  const names = new Set(studs.map(s => s.name));
  const totalAtt = attendanceRecords(recordList).filter(r => dates.has(r.date) && names.has(r.name)).length;
  const totalSun = dates.size;
  const maxPossible = names.size * totalSun;
  return {
    avg: maxPossible ? (totalAtt / maxPossible * 100).toFixed(1) : "0.0",
    avgPerson: totalSun ? (totalAtt / totalSun).toFixed(1) : "0.0",
    totalSun,
  };
}

// 특정 달 학생별 출석 횟수
function getPersonAttendCount(name, ym) {
  return attendanceRecords(recordList).filter(r =>
    r.name === name && r.date.startsWith(ym) && r.activity === "주일예배 출석"
  ).length;
}

// 개인 올해 월별 출석 횟수
function getPersonYearData(name) {
  return getMonthsThisYear().map(ym => ({
    ym,
    cnt:  getPersonAttendCount(name, ym),
    suns: getSundayDates(ym).length,
  }));
}

// ══════════════════════════════════════════
// 진입점
// ══════════════════════════════════════════
function render() {
  renderSummaryCards();
  renderChart();
  renderPersonSearch();
}

// ══════════════════════════════════════════
// 1. 요약 카드
// ══════════════════════════════════════════
function renderSummaryCards() {
  const isYearly = !selectedMonth;
  const ym       = selectedMonth || getNowMonth();
  const sundays  = getSundayDates(ym);
  const sunCnt   = sundays.length;

  // 카드 데이터 계산
  function calcCard(studs) {
    return getPeriodStats(studs, isYearly ? getMonthsThisYear() : [ym]);
  }

  const all       = calcCard(studentList);
  const byGrade   = GRADES.map(g   => ({ ...calcCard(studentList.filter(s => s.grade   === g)), label: g }));
  const byTeacher = TEACHERS.map((t,i) => ({ ...calcCard(studentList.filter(s => s.teacher === t)), label: t, i }));

  const modeLabel = isYearly
    ? `올해 전체 평균 (${getMonthsThisYear().length}개월)`
    : `${selectedMonth} 월별 현황 · 주일 ${sunCnt}번`;

  document.getElementById("att-summary").innerHTML = `
    <div style="font-size:11px;color:var(--text-sub);margin-bottom:14px">
      📅 ${modeLabel}
    </div>

    <!-- 전체 카드 -->
    <div class="att-big-card" onclick="window.attendance.openModal('all','전체')" style="cursor:pointer">
      <div class="att-big-label">🏫 전체 평균 출석률</div>
      <div class="att-big-nums" style="align-items:baseline;gap:10px">
        <span class="att-big-count">${all.avg}<span style="font-size:20px">%</span></span>
        <span style="font-size:15px;opacity:0.85">${all.avgPerson}명 / ${studentList.length}명</span>
      </div>
      <div class="att-bar-wrap" style="margin-top:10px">
        <div class="att-bar" style="width:${all.avg}%"></div>
      </div>
    </div>

    <!-- 학년별 -->
    <div class="att-group-title">학년별</div>
    <div class="att-cards-row">
      ${byGrade.map((g, gi) => `
        <div class="att-card" style="border-color:${GRADE_COLOR[g.label]}40;background:${GRADE_COLOR[g.label]}08;cursor:pointer"
          onclick="window.attendance.openModal('grade','${g.label}')">
          <div class="att-card-label" style="color:${GRADE_COLOR[g.label]}">${g.label}</div>
          <div class="att-card-count">
            <span style="font-size:18px;font-weight:900">${g.avg}%</span>
            <span class="att-card-total" style="font-size:11px;margin-left:6px">${g.avgPerson}명 / ${studentList.filter(s=>s.grade===g.label).length}명</span>
          </div>
          <div class="att-bar-wrap">
            <div class="att-bar" style="width:${g.avg}%;background:${GRADE_COLOR[g.label]}"></div>
          </div>
        </div>`).join("")}
    </div>

    <!-- 반별 -->
    <div class="att-group-title">담임반별</div>
    <div class="att-cards-row">
      ${byTeacher.map(t => `
        <div class="att-card" style="border-color:${TEACHER_COLOR[t.i]}40;cursor:pointer"
          onclick="window.attendance.openModal('teacher','${t.label}')">
          <div class="att-card-label" style="color:${TEACHER_COLOR[t.i]}">${t.label}</div>
          <div class="att-card-count">
            <span style="font-size:18px;font-weight:900">${t.avg}%</span>
            <span class="att-card-total" style="font-size:11px;margin-left:6px">${t.avgPerson}명 / ${studentList.filter(s=>s.teacher===t.label).length}명</span>
          </div>
          <div class="att-bar-wrap">
            <div class="att-bar" style="width:${t.avg}%;background:${TEACHER_COLOR[t.i]}"></div>
          </div>
        </div>`).join("")}
    </div>`;
}

// ══════════════════════════════════════════
// 2. 팝업 모달
// ══════════════════════════════════════════
let modalSortKey = "pct"; // pct | name | grade

function openModal(type, value) {
  const isYearly = !selectedMonth;
  const ym       = selectedMonth || getNowMonth();
  const color    = type === "grade"
    ? GRADE_COLOR[value]
    : TEACHER_COLOR[TEACHERS.indexOf(value)] || "var(--purple)";
  const studs = type === "all"
    ? studentList
    : type === "grade"
      ? studentList.filter(s => s.grade   === value)
      : studentList.filter(s => s.teacher === value);

  let rows = "";
  if (isYearly) {
    // 올해 전체 — 학생별 출석률
    rows = studs.map(s => {
      const data    = getPersonYearData(s.name);
      const totSun  = data.reduce((a, d) => a + d.suns, 0);
      const totAtt  = data.reduce((a, d) => a + d.cnt,  0);
      const pct     = totSun ? (totAtt / totSun * 100).toFixed(1) : "0";
      const barW    = totSun ? Math.round(totAtt / totSun * 100) : 0;
      const nc      = s.gender === "남" ? "#2563eb" : s.gender === "여" ? "#db2777" : "var(--purple)";
      return `
        <div class="drill-row">
          <div class="drill-name" style="color:${nc}">${s.name}</div>
          <div class="drill-bar-wrap">
            <div class="drill-bar" style="width:${barW}%;background:${color}"></div>
          </div>
          <div class="drill-stat">${totAtt}/${totSun}주 <span class="drill-pct">${pct}%</span></div>
        </div>`;
    }).join("");
  } else {
    // 월별 — 해당 달 출석 여부
    const sunDates = getSundayDates(ym);
    rows = studs.map(s => {
      const cnt  = getPersonAttendCount(s.name, ym);
      const pct  = sunDates.length ? (cnt / sunDates.length * 100).toFixed(1) : "0";
      const barW = sunDates.length ? Math.round(cnt / sunDates.length * 100) : 0;
      const nc   = s.gender === "남" ? "#2563eb" : s.gender === "여" ? "#db2777" : "var(--purple)";
      return `
        <div class="drill-row">
          <div class="drill-name" style="color:${nc}">${s.name}</div>
          <div class="drill-bar-wrap">
            <div class="drill-bar" style="width:${barW}%;background:${color}"></div>
          </div>
          <div class="drill-stat">${cnt}/${sunDates.length}주 <span class="drill-pct">${pct}%</span></div>
        </div>`;
    }).join("");
  }

  // 모달 상태 저장 (정렬용)
  window._attModal = { type, value, color, studs, isYearly, ym };
  renderModalContent();
}

function renderModalContent() {
  const { type, value, color, studs, isYearly, ym } = window._attModal;
  const sunDates = getSundayDates(ym);

  // 데이터 계산
  let rows = studs.map(s => {
    const nc = s.gender === "남" ? "#2563eb" : s.gender === "여" ? "#db2777" : "var(--purple)";
    if (isYearly) {
      const data   = getPersonYearData(s.name);
      const totSun = data.reduce((a, d) => a + d.suns, 0);
      const totAtt = data.reduce((a, d) => a + d.cnt,  0);
      const pct    = totSun ? totAtt / totSun * 100 : 0;
      return { s, nc, cnt: totAtt, sun: totSun, pct };
    } else {
      const cnt = getPersonAttendCount(s.name, ym);
      const pct = sunDates.length ? cnt / sunDates.length * 100 : 0;
      return { s, nc, cnt, sun: sunDates.length, pct };
    }
  });

  // 정렬
  if (modalSortKey === "pct")   rows.sort((a, b) => b.pct - a.pct);
  if (modalSortKey === "name")  rows.sort((a, b) => a.s.name.localeCompare(b.s.name, "ko"));
  if (modalSortKey === "grade") rows.sort((a, b) => (a.s.grade || "").localeCompare(b.s.grade || ""));

  const GRADE_BADGE = { "1학년": "#16a34a", "2학년": "#ca8a04", "3학년": "#dc2626" };

  const rowsHtml = rows.map(({ s, nc, cnt, sun, pct }) => `
    <div class="drill-row">
      <div class="drill-name" style="color:${nc}">${s.name}</div>
      ${type === "all" ? `<span class="badge" style="font-size:9px;padding:1px 7px;background:${GRADE_BADGE[s.grade] || "#e9d5f7"}20;color:${GRADE_BADGE[s.grade] || "var(--purple)"};margin-right:4px">${s.grade||"-"}</span>` : ""}
      <div class="drill-bar-wrap">
        <div class="drill-bar" style="width:${pct.toFixed(0)}%;background:${color}"></div>
      </div>
      <div class="drill-stat">${cnt}/${sun}주 <span class="drill-pct">${pct.toFixed(1)}%</span></div>
    </div>`).join("");

  const sortBtns = ["pct","name","grade"].map(k => `
    <button onclick="window.attendance.setModalSort('${k}')"
      style="min-height:44px;padding:0 14px;border-radius:20px;border:1.5px solid ${modalSortKey===k?"var(--purple)":"var(--border)"};
             background:${modalSortKey===k?"var(--purple)":"white"};color:${modalSortKey===k?"white":"var(--text-sub)"};
             font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
      ${{pct:"출석률순",name:"이름순",grade:"학년순"}[k]}
    </button>`).join("");

  document.getElementById("att-modal-body").innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${sortBtns}</div>
    <div style="font-size:11px;color:var(--text-sub);margin-bottom:12px">
      ${isYearly ? `올해 전체 출석률 · ${studs.length}명` : `${ym} · 주일 ${sunDates.length}번 · ${studs.length}명`}
    </div>
    ${rowsHtml}`;

  document.getElementById("att-modal-title").textContent = value;
  document.getElementById("att-modal-title").style.color = color;
  document.getElementById("att-modal").classList.add("show");
}

function setModalSort(key) {
  modalSortKey = key;
  renderModalContent();
}

function closeModal() {
  document.getElementById("att-modal").classList.remove("show");
}

// ══════════════════════════════════════════
// 3. 월별 추이 그래프
// ══════════════════════════════════════════
function renderChart() {
  const months = getMonthsThisYear();
  const data = months.map(m => Number(getPeriodStats(studentList, [m]).avgPerson));

  const W = 560, H = 180, PAD = { t: 28, r: 20, b: 36, l: 40 };
  const maxV  = Math.max(...data, 1);
  const xStep = months.length > 1 ? (W - PAD.l - PAD.r) / (months.length - 1) : 0;

  const pts = data.map((v, i) => ({
    x: PAD.l + i * xStep,
    y: PAD.t + (1 - v / maxV) * (H - PAD.t - PAD.b),
    v, m: months[i],
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area     = `${pts[0].x},${H - PAD.b} ${pts.map(p=>`${p.x},${p.y}`).join(" ")} ${pts[pts.length-1].x},${H - PAD.b}`;

  const yGrid = [0, 0.5, 1].map(r => {
    const y = PAD.t + (1-r) * (H - PAD.t - PAD.b);
    return `
      <text x="${PAD.l-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#bbb">${Math.round(maxV*r)}</text>
      <line x1="${PAD.l}" y1="${y}" x2="${W-PAD.r}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/>`;
  }).join("");

  const circles = pts.map(p => {
    const isSel = selectedMonth === p.m;
    return `
      <circle cx="${p.x}" cy="${p.y}" r="${isSel ? 8 : 5}"
        fill="${isSel ? "#6b4fa0" : "#9b7fd0"}" stroke="white" stroke-width="2"
        style="cursor:pointer" onclick="window.attendance.clickMonth('${p.m}')"/>
      <text x="${p.x}" y="${p.y-13}" text-anchor="middle" font-size="10"
        fill="${isSel ? "#6b4fa0" : "#bbb"}" font-weight="${isSel ? "900" : "400"}">${p.v.toFixed(1)}명</text>`;
  }).join("");

  const xLabels = pts.map(p => `
    <text x="${p.x}" y="${H-4}" text-anchor="middle" font-size="9"
      fill="${selectedMonth === p.m ? "#6b4fa0" : "#999"}"
      font-weight="${selectedMonth === p.m ? "800" : "400"}"
      style="cursor:pointer" onclick="window.attendance.clickMonth('${p.m}')">${p.m.slice(5)}월</text>`).join("");

  const monthButtons = '<div class="att-month-picker" role="group" aria-label="출석 조회 월 선택">'
    + '<button type="button" class="att-month-button" aria-pressed="' + !selectedMonth
    + '" onclick="window.attendance.clickMonth(null)">올해 전체</button>'
    + months.map((month, i) => '<button type="button" class="att-month-button" aria-pressed="'
      + (selectedMonth === month) + '" onclick="window.attendance.clickMonth(\'' + month + '\')">'
      + '<strong>' + Number(month.slice(5)) + '월</strong><span>' + data[i].toFixed(1) + '명</span></button>').join('')
    + '</div>';
  const hint = selectedMonth
    ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:11px;color:var(--purple);font-weight:700">📌 ${selectedMonth} 선택됨</span>
        <button onclick="window.attendance.clickMonth(null)"
          style="min-height:44px;font-size:13px;padding:2px 12px;border-radius:20px;border:1.5px solid var(--border);background:white;cursor:pointer;color:var(--text-sub)">전체 평균으로</button>
       </div>`
    : `<div class="att-chart-hint">아래 월 버튼을 누르면 월별 현황을 볼 수 있어요.</div>`;

  document.getElementById("att-chart").innerHTML = hint + `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;overflow:visible">
      ${yGrid}
      <polygon points="${area}" fill="#6b4fa0" fill-opacity="0.07"/>
      <polyline points="${polyline}" fill="none" stroke="#6b4fa0" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${circles}
      ${xLabels}
    </svg>` + '<p class="att-chart-hint">인원은 해당 월의 주일당 평균 출석 인원입니다. 오늘까지의 주일을 기준으로 계산하며, 기록이 없는 주일은 0명으로 포함합니다.</p>' + monthButtons
    + '<div class="att-month-status" role="status">' + (selectedMonth ? Number(selectedMonth.slice(5)) + '월 현황을 표시하고 있어요.' : '올해 전체 평균을 표시하고 있어요.') + '</div>';
}

// ══════════════════════════════════════════
// 4. 개인 조회
// ══════════════════════════════════════════
function renderPersonSearch() {
  const el = document.getElementById("att-person-select");
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">-- 학생 선택 --</option>' +
    studentList.map(s => `<option value="${s.name}" ${s.name===cur?"selected":""}>${s.name} (${s.grade||""})</option>`).join("");
  if (cur) showPersonChart(cur);
}

function showPersonChart(name) {
  const el = document.getElementById("att-person-chart");
  if (!el) return;
  if (!name) { el.innerHTML = ""; return; }

  const data    = getPersonYearData(name);
  const totSun  = data.reduce((a, d) => a + d.suns, 0);
  const totAtt  = data.reduce((a, d) => a + d.cnt,  0);
  const totPct  = totSun ? (totAtt / totSun * 100).toFixed(1) : "0";
  const stu     = studentList.find(s => s.name === name) || {};
  const nc      = stu.gender === "남" ? "#2563eb" : stu.gender === "여" ? "#db2777" : "#6b4fa0";

  // 막대 그래프
  const W = 560, H = 160, PAD = { t: 24, r: 20, b: 36, l: 40 };
  const maxV  = Math.max(...data.map(d => d.suns), 1);
  const bw    = data.length ? Math.max(16, Math.floor((W - PAD.l - PAD.r) / data.length - 8)) : 20;
  const xStep = data.length > 1 ? (W - PAD.l - PAD.r) / (data.length - 1) : 0;

  const bars = data.map((d, i) => {
    const x     = PAD.l + i * xStep - bw / 2;
    const sunH  = d.suns ? (d.suns  / maxV) * (H - PAD.t - PAD.b) : 0;
    const attH  = d.suns ? (d.cnt   / maxV) * (H - PAD.t - PAD.b) : 0;
    const sunY  = H - PAD.b - sunH;
    const attY  = H - PAD.b - attH;
    const pct   = d.suns ? (d.cnt / d.suns * 100).toFixed(0) : "0";
    return `
      <!-- 전체 주일 (회색) -->
      <rect x="${x}" y="${sunY}" width="${bw}" height="${sunH}"
        fill="#e9d5f7" rx="3"/>
      <!-- 출석 (보라) -->
      <rect x="${x}" y="${attY}" width="${bw}" height="${attH}"
        fill="${nc}" rx="3" opacity="0.85"/>
      <!-- 퍼센트 라벨 -->
      ${d.cnt > 0 ? `<text x="${x + bw/2}" y="${attY - 5}" text-anchor="middle"
        font-size="9" fill="${nc}" font-weight="700">${pct}%</text>` : ""}
      <!-- 월 라벨 -->
      <text x="${x + bw/2}" y="${H - 4}" text-anchor="middle"
        font-size="9" fill="#999">${d.ym.slice(5)}월</text>`;
  }).join("");

  const yGrid = [0, 0.5, 1].map(r => {
    const y = PAD.t + (1 - r) * (H - PAD.t - PAD.b);
    return `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/>`;
  }).join("");

  el.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">
      <span style="font-size:20px;font-weight:900;color:${nc}">${name}</span>
      <span style="font-size:13px;color:var(--text-sub)">${stu.grade || ""} · ${stu.teacher || ""}</span>
      <span style="margin-left:auto;font-size:22px;font-weight:900;color:${nc}">${totPct}%</span>
      <span style="font-size:12px;color:var(--text-sub)">${totAtt}/${totSun}주</span>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:10px;font-size:11px">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#e9d5f7;margin-right:4px"></span>전체 주일</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${nc};margin-right:4px;opacity:0.85"></span>출석</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;overflow:visible">
      ${yGrid}
      ${bars}
    </svg>`;
}

// ══════════════════════════════════════════
// 이벤트
// ══════════════════════════════════════════
function clickMonth(ym) {
  selectedMonth = (selectedMonth === ym) ? null : ym;
  renderSummaryCards();
  renderChart();
}

window.attendance = { render, clickMonth, openModal, closeModal, setModalSort, showPersonChart, renderPersonSearch };
