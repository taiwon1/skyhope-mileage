/**
 * records.js
 * 활동 기록 CRUD
 * [신규] 반별 학생 필터 입력폼 + 여러 명 한번에 등록 (체크박스)
 */

import { db } from "./firebase.js?v=20260915-1";
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { showAlert, validDate, activityId, escapeHTML, csvCell, listenerError } from "./utils.js?v=20260915-1";
import { studentList } from "./students.js?v=20260915-1";

const POINTS = {
  "금요기도회 참석": 50,
  "주일예배 찬양팀 섬김": 50,
  "주일예배 안내팀 섬김": 30,
  "주일예배 출석": 100,
  대표기도: 300,
  "새친구 전도": 1000,
};

const BADGE = {
  "금요기도회 참석": "badge-purple",
  "주일예배 찬양팀 섬김": "badge-green",
  "주일예배 안내팀 섬김": "badge-green",
  "주일예배 출석": "badge-blue",
  대표기도: "badge-gold",
  "새친구 전도": "badge-red",
  "기타 활동": "badge-teal",
};

const PAGE_SIZE = 20;

export let recordList = [];
let currentPage = 1;
let filteredCache = [];

// ══════════════════════════════════════════════════════════
//  입력 폼 UI
// ══════════════════════════════════════════════════════════

// ── 활동 선택 변경 ────────────────────────────────────────
function onActivityChange() {
  const v = document.getElementById("in-activity").value;
  const isAttend    = v === "주일예배 출석";
  const isEtc       = v === "기타 활동";
  const isNewcomer  = v === "새친구 전도";

  // 기타 활동
  document.getElementById("extra-row").style.display = isEtc ? "flex" : "none";

  // 새친구 전도
  document.getElementById("newcomer-row").style.display = isNewcomer ? "block" : "none";
  if (isNewcomer) {
    populateNewcomerSelects();
  } else {
    document.getElementById("in-newcomer-select").value = "";
    document.getElementById("in-referrer-select").value = "";
  }

  // 주일예배 출석 — 분리 UI 전환
  document.getElementById("student-checkbox-wrap").style.display = isAttend ? "none" : "block";
  document.getElementById("attend-split-wrap").style.display     = isAttend ? "block" : "none";

  if (isAttend) renderAttendSplit();
}

// ── 주일예배 출석 분리 렌더 ─────────────────────────────────
function renderAttendSplit() {
  const teacher = document.getElementById("in-filter-teacher").value;
  const grade   = document.getElementById("in-filter-grade").value;

  let filtered = studentList;
  if (teacher) filtered = filtered.filter(s => s.teacher === teacher);
  if (grade)   filtered = filtered.filter(s => s.grade   === grade);

  const makeChips = (wrapId, name_prefix) => {
    const wrap = document.getElementById(wrapId);
    if (!filtered.length) {
      wrap.innerHTML = `<span style="color:var(--text-sub);font-size:12px">해당 조건의 학생이 없습니다</span>`;
      return;
    }
    wrap.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
        <label class="stu-check-all">
          <input type="checkbox" id="cb-all-${name_prefix}"
            onchange="window.records.toggleAttendGroup('${name_prefix}', this.checked)" />
          <span>전체 선택</span>
        </label>
        ${filtered.map(s => `
          <label class="stu-check-item" id="chip-${name_prefix}-${s.name}">
            <input type="checkbox" name="cb-${name_prefix}" value="${s.name}"
              onchange="window.records.onAttendChipChange('${name_prefix}', '${s.name}', this.checked)" />
            <span>${s.name}</span>
          </label>`).join("")}
      </div>`;
  };

  makeChips("earlybird-checkbox-wrap", "early");
  makeChips("normal-checkbox-wrap",    "normal");
}

// ── 얼리버드 선택 시 일반에서 제외 (중복 방지) ───────────────
function onAttendChipChange(group, name, checked) {
  if (group === "early" && checked) {
    // 얼리버드 체크 → 일반에서 같은 사람 체크 해제
    const normalCb = document.querySelector(`input[name="cb-normal"][value="${name}"]`);
    if (normalCb) normalCb.checked = false;
  } else if (group === "normal" && checked) {
    // 일반 체크 → 얼리버드에서 같은 사람 체크 해제
    const earlyCb = document.querySelector(`input[name="cb-early"][value="${name}"]`);
    if (earlyCb) earlyCb.checked = false;
  }
}

function toggleAttendGroup(prefix, checked) {
  document.querySelectorAll(`input[name="cb-${prefix}"]`).forEach(cb => {
    cb.checked = checked;
    onAttendChipChange(prefix, cb.value, checked);
  });
}

// ── 새친구/전도자 드롭다운 채우기 ──────────────────────────
function populateNewcomerSelects() {
  const newcomerSel  = document.getElementById("in-newcomer-select");
  const referrerSel  = document.getElementById("in-referrer-select");
  if (!newcomerSel || !referrerSel) return;

  const opts = studentList.map(s => `<option value="${s.name}">${s.name} (${s.grade || "학년미지정"})</option>`).join("");
  newcomerSel.innerHTML = '<option value="">-- 새친구 선택 --</option>' + opts;
  referrerSel.innerHTML = '<option value="">-- 전도한 친구 선택 (선택사항) --</option>' + opts;
}

// ── 새친구 선택 시 전도자 드롭다운에서 같은 사람 제외 ──────
function onNewcomerChange() {
  const newcomerName = document.getElementById("in-newcomer-select").value;
  const referrerSel  = document.getElementById("in-referrer-select");
  if (!referrerSel) return;

  const opts = studentList
    .filter(s => s.name !== newcomerName)
    .map(s => `<option value="${s.name}">${s.name} (${s.grade || "학년미지정"})</option>`).join("");
  referrerSel.innerHTML = '<option value="">-- 전도한 친구 선택 (선택사항) --</option>' + opts;
}

// ── 입력폼 반 필터 변경 → 학생 체크박스 목록 갱신 ──────────
function onInputClassChange() {
  const teacher = document.getElementById("in-filter-teacher").value;
  const grade   = document.getElementById("in-filter-grade").value;
  const v = document.getElementById("in-activity").value;
  if (v === "주일예배 출석") {
    renderAttendSplit();
  } else {
    renderStudentCheckboxes(teacher, grade);
  }
}

// ── 학생 체크박스 목록 렌더 ───────────────────────────────
function renderStudentCheckboxes(teacher, grade) {
  const wrap = document.getElementById("student-checkbox-wrap");

  let filtered = studentList;
  if (teacher) filtered = filtered.filter((s) => s.teacher === teacher);
  if (grade) filtered = filtered.filter((s) => s.grade === grade);

  if (!filtered.length) {
    wrap.innerHTML = `<span style="color:var(--gray);font-size:12px">해당 조건의 학생이 없습니다</span>`;
    return;
  }

  wrap.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
      <label class="stu-check-all">
        <input type="checkbox" id="cb-check-all" onchange="window.records.toggleAll(this.checked)" />
        <span>전체 선택</span>
      </label>
      ${filtered
        .map(
          (s) => `
        <label class="stu-check-item">
          <input type="checkbox" name="stu-cb" value="${s.name}" />
          <span>${s.name}</span>
        </label>
      `,
        )
        .join("")}
    </div>`;
}

// ── 전체 선택/해제 ────────────────────────────────────────
function toggleAll(checked) {
  document.querySelectorAll('input[name="stu-cb"]').forEach((cb) => {
    cb.checked = checked;
  });
}

// ── 기록 추가 (단일 or 다중) ─────────────────────────────
let saving = false;
async function add() {
  if (!window.authState?.isAdmin && !window.authState?.isTeacher) return;
  if (saving) return;
  const date = document.getElementById('in-date').value;
  const activity = document.getElementById('in-activity').value;
  if (!validDate(date) || (!POINTS[activity] && activity !== '기타 활동')) {
    showAlert('record', '오늘까지의 올바른 날짜와 활동을 입력해주세요', 'error'); return;
  }
  if (activity === '새친구 전도') {
    showAlert('record', '새친구 전도 마일리지는 4주 출석 후 등반할 때 한 번만 자동 지급됩니다.', 'error'); return;
  }
  if (activity === '주일예배 출석' && new Date(date + 'T12:00:00+09:00').getUTCDay() !== 0) {
    showAlert('record', '주일예배 출석은 일요일 날짜를 선택해주세요', 'error'); return;
  }
  let pts = POINTS[activity], etcName = '';
  if (activity === '기타 활동') {
    etcName = document.getElementById('in-etc-name').value.trim();
    pts = Number(document.getElementById('in-etc-pts').value);
    if (!etcName || etcName.length > 100 || !Number.isSafeInteger(pts) || pts <= 0) {
      showAlert('record', '기타 활동명(100자 이내)과 양의 정수 점수를 입력해주세요', 'error'); return;
    }
  }
  const selected = selector => [...document.querySelectorAll(selector)].map(c=>c.value);
  let entries;
  if (activity === '주일예배 출석') {
    const early = new Set(selected('input[name="cb-early"]:checked'));
    const normal = selected('input[name="cb-normal"]:checked').filter(name=>!early.has(name));
    entries = [...early].map(name=>({name, pts:150, earlybird:true}))
      .concat(normal.map(name=>({name,pts:100,earlybird:false})));
  } else entries = selected('input[name="stu-cb"]:checked').map(name=>({name,pts,earlybird:false}));
  if (!entries.length) { showAlert('record', '학생을 한 명 이상 선택해주세요', 'error'); return; }
  entries = entries.map(r=>({...r,date,activity,etcName,createdAt:Date.now()}));
  saving = true;
  try {
    const count = await runTransaction(db, async tx => {
      // Deterministic IDs prevent duplicate writes across tabs; legacy records are also checked.
      const refs = entries.map(r=>doc(db,'records',activityId(r)));
      const saved = await Promise.all(refs.map(ref=>tx.get(ref)));
      const students = await Promise.all(entries.map(r=>tx.get(doc(db,'students',r.name))));
      if (!window.authState?.isAdmin && !window.authState?.isTeacher) throw Error('로그인 후 다시 시도해주세요');
      let count = 0;
      entries.forEach((r,i)=>{
        if (!students[i].exists()) throw Error(r.name + ' 학생 정보를 새로고침해주세요');
        const start = students[i].data().mileageStartDate;
        if (start && r.date < start) throw Error(r.name + ' 학생은 등반일(' + start + ')부터 적립할 수 있습니다');
        const duplicate = saved[i].exists() || recordList.some(old=>old.name===r.name && old.date===r.date && old.activity===r.activity && (old.etcName||'')===r.etcName);
        if (!duplicate) { tx.set(refs[i],r); count++; }
      });
      return count;
    });
    showAlert('record', count + '건 적립 완료! 이미 등록된 활동은 중복 적립하지 않았습니다.', 'success');
    document.querySelectorAll('#tab-record input[type="checkbox"]').forEach(cb=>cb.checked=false);
  } catch(e) { showAlert('record', '저장 실패: ' + e.message, 'error'); }
  finally { saving = false; }
}

// ══════════════════════════════════════════════════════════
//  기록 목록 CRUD
// ══════════════════════════════════════════════════════════

async function remove(id) {
  if (!window.authState?.isAdmin) return;
  if (!confirm("이 기록을 삭제할까요?")) return;
  try {
    await deleteDoc(doc(db, "records", id));
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

// ── 필터 & 정렬 ───────────────────────────────────────────
function applyFilter() {
  currentPage = 1;
  render();
}

function resetFilter() {
  [
    "rec-filter-month",
    "rec-filter-teacher",
    "rec-filter-grade",
    "rec-filter-name",
    "rec-filter-activity",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("rec-sort").value = "date-desc";
  currentPage = 1;
  render();
}

function getNameSetByClass(fTeacher, fGrade) {
  if (!fTeacher && !fGrade) return null;
  // studentList가 아직 로드 안 됐으면 필터 적용 안 함
  if (!studentList.length) return null;
  return new Set(
    studentList
      .filter(s => (!fTeacher || s.teacher === fTeacher) && (!fGrade || s.grade === fGrade))
      .map(s => s.name),
  );
}

function render() {
  const fMonth = document.getElementById("rec-filter-month")?.value || "";
  const fTeacher = document.getElementById("rec-filter-teacher")?.value || "";
  const fGrade = document.getElementById("rec-filter-grade")?.value || "";
  const fName = document.getElementById("rec-filter-name")?.value || "";
  const fActivity = document.getElementById("rec-filter-activity")?.value || "";
  const sortKey = document.getElementById("rec-sort")?.value || "date-desc";

  const nameSet = getNameSetByClass(fTeacher, fGrade);

  let list = recordList.filter((r) => {
    if (fMonth && !r.date.startsWith(fMonth)) return false;
    if (nameSet && !nameSet.has(r.name)) return false;
    if (fName && !r.name.includes(fName)) return false;
    if (fActivity && r.activity !== fActivity) return false;
    return true;
  });

  list.sort((a, b) => {
    switch (sortKey) {
      case "date-desc":
        return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
      case "date-asc":
        return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
      case "pts-desc":
        return b.pts - a.pts;
      case "pts-asc":
        return a.pts - b.pts;
      case "name-asc":
        return a.name.localeCompare(b.name, "ko");
      default:
        return 0;
    }
  });

  filteredCache = list;

  const countEl = document.getElementById("rec-count");
  if (countEl) countEl.textContent = `총 ${list.length.toLocaleString()}건`;

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageData = list.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  renderTable(pageData);
  renderPagination(totalPages);
}

function renderTable(pageData) {
  const tbody = document.getElementById("record-tbody");
  const empty = document.getElementById("record-empty");
  tbody.innerHTML = "";
  empty.style.display = pageData.length ? "none" : "block";

  pageData.forEach((r) => {
    let detail = "-";
    if (r.activity === "기타 활동") detail = escapeHTML(r.etcName);
    else if (r.activity === "주일예배 출석" && r.earlybird)
      detail = "🌅 얼리버드";

    const stu = studentList.find((s) => s.name === r.name) || {};
    const nameColor = stu.gender === "남" ? "#2563eb" : stu.gender === "여" ? "#db2777" : "var(--purple)";

    const delBtn = window.authState?.isAdmin
      ? `<td><button class="btn btn-danger btn-sm" onclick="window.records.remove('${r._id}')">삭제</button></td>`
      : "";

    tbody.innerHTML += `
      <tr>
        <td class="date-cell"><span class="date-full">${r.date}</span><span class="date-short">${r.date.slice(5)}</span></td>
        <td onclick="window.profile.open('${r.name}')" style="cursor:pointer">
          <strong style="color:${nameColor}">${r.name}</strong>
        </td>
        <td><span class="badge ${BADGE[r.activity] || "badge-purple"}">${r.activity}</span></td>
        <td>${detail}</td>
        <td><strong style="color:var(--purple)">${r.pts}P</strong></td>
        ${delBtn}
      </tr>`;
  });
}

function renderPagination(totalPages) {
  const el = document.getElementById("rec-pagination");
  if (!el) return;
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  let html = `<button class="page-btn" ${currentPage === 1 ? "disabled" : ""}
    onclick="window.records.goPage(${currentPage - 1})">‹</button>`;

  const pages = new Set([1, totalPages]);
  for (
    let i = Math.max(1, currentPage - 2);
    i <= Math.min(totalPages, currentPage + 2);
    i++
  )
    pages.add(i);

  let prev = 0;
  [...pages]
    .sort((a, b) => a - b)
    .forEach((p) => {
      if (prev && p - prev > 1) html += `<span class="page-ellipsis">…</span>`;
      html += `<button class="page-btn ${p === currentPage ? "active" : ""}"
      onclick="window.records.goPage(${p})">${p}</button>`;
      prev = p;
    });

  html += `<button class="page-btn" ${currentPage === totalPages ? "disabled" : ""}
    onclick="window.records.goPage(${currentPage + 1})">›</button>`;

  el.innerHTML = html;
}

function goPage(p) {
  currentPage = p;
  render();
  document
    .getElementById("tab-record")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function exportCSV() {
  if (!window.authState?.isAdmin) return;
  const data = filteredCache;
  if (!data.length) {
    alert("내보낼 기록이 없습니다");
    return;
  }

  const rows = [
    [
      "날짜",
      "이름",
      "학년",
      "담임",
      "활동",
      "세부내용",
      "얼리버드",
      "마일리지(P)",
    ],
  ];
  [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((r) => {
      const stu = studentList.find((s) => s.name === r.name) || {};
      rows.push([
        r.date,
        r.name,
        stu.grade || "",
        stu.teacher || "",
        r.activity,
        r.etcName || "",
        r.earlybird ? "O" : "",
        r.pts,
      ]);
    });

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "고등부_마일리지.csv";
  a.click();
}

// ── Firestore 실시간 리스너 ───────────────────────────────
export function startListener(onUpdate) {
  const q = query(collection(db, "records"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    recordList = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    render();
    if (onUpdate) onUpdate();
  }, listenerError("활동 기록"));
}

// ── 체크박스 새로고침 (학생 목록 변경 시 외부에서 호출) ──
function refreshCheckboxes() {
  const checked = [...document.querySelectorAll('#tab-record input[type="checkbox"]:checked')].map(c=>[c.name,c.value]);
  onInputClassChange();
  document.querySelectorAll('#tab-record input[type="checkbox"]').forEach(c=>{ c.checked = checked.some(([name,value])=>c.name===name&&c.value===value); });
}

// ── 권한 변경 시 1페이지로 리셋 후 재렌더 (auth.js에서 호출) ──
function resetToPage1() {
  currentPage = 1;
  render();
}

// 전역 노출
window.records = {
  add,
  remove,
  onActivityChange,
  onNewcomerChange,
  onAttendChipChange,
  toggleAttendGroup,
  exportCSV,
  applyFilter,
  resetFilter,
  goPage,
  onInputClassChange,
  toggleAll,
  refreshCheckboxes,
  resetToPage1,
  get recordList() { return recordList; },
};
