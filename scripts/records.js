/**
 * records.js
 * 활동 기록 CRUD — 필터(담임·학년·이름·활동) · 정렬 · 페이지네이션
 */

import { db } from "./firebase.js";
import {
  collection, doc,
  addDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { showAlert } from "./app.js";
import { studentList } from "./students.js";

const POINTS = {
  "금요기도회 참석":       50,
  "주일예배 찬양팀 섬김":  50,
  "주일예배 안내팀 섬김":  30,
  "주일예배 출석":         100,
  "대표기도":              300,
  "새친구 전도":           1000,
};

const BADGE = {
  "금요기도회 참석":       "badge-purple",
  "주일예배 찬양팀 섬김":  "badge-green",
  "주일예배 안내팀 섬김":  "badge-green",
  "주일예배 출석":         "badge-blue",
  "대표기도":              "badge-gold",
  "새친구 전도":           "badge-red",
  "기타 활동":             "badge-teal",
};

const PAGE_SIZE = 20;

export let recordList = [];
let currentPage   = 1;
let filteredCache = [];

// ── 활동 선택 UI 처리 ─────────────────────────────────────
function onActivityChange() {
  const v = document.getElementById("in-activity").value;
  document.getElementById("extra-row").style.display =
    v === "기타 활동" ? "flex" : "none";
  document.getElementById("earlybird-row")
    .classList.toggle("show", v === "주일예배 출석");
  if (v !== "주일예배 출석")
    document.getElementById("cb-earlybird").checked = false;
}

// ── 기록 추가 ─────────────────────────────────────────────
async function add() {
  if (!window.authState.isAdmin) {
    showAlert("record", "관리자 모드에서만 가능합니다", "error"); return;
  }
  const date     = document.getElementById("in-date").value;
  const name     = document.getElementById("in-name").value;
  const activity = document.getElementById("in-activity").value;

  if (!date || !name || !activity) {
    showAlert("record", "날짜, 활동구분, 이름을 모두 입력해주세요", "error"); return;
  }

  let pts = POINTS[activity] || 0, etcName = "", earlybird = false;

  if (activity === "기타 활동") {
    etcName = document.getElementById("in-etc-name").value.trim();
    pts     = parseInt(document.getElementById("in-etc-pts").value) || 0;
    if (!etcName || pts <= 0) {
      showAlert("record", "기타 활동 내용과 점수를 입력해주세요", "error"); return;
    }
  }
  if (activity === "주일예배 출석") {
    earlybird = document.getElementById("cb-earlybird").checked;
    if (earlybird) pts += 50;
  }

  try {
    await addDoc(collection(db, "records"), {
      date, name, activity, etcName, pts, earlybird, createdAt: Date.now(),
    });
    showAlert("record", `${name} 학생에게 ${pts}P 적립! 🎉`, "success");
    document.getElementById("in-name").value        = "";
    document.getElementById("in-etc-name").value    = "";
    document.getElementById("in-etc-pts").value     = "";
    document.getElementById("cb-earlybird").checked = false;
  } catch (e) {
    showAlert("record", "저장 실패: " + e.message, "error");
  }
}

// ── 기록 삭제 ─────────────────────────────────────────────
async function remove(id) {
  if (!window.authState.isAdmin) return;
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
  ["rec-filter-month", "rec-filter-teacher", "rec-filter-grade",
   "rec-filter-name", "rec-filter-activity"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("rec-sort").value = "date-desc";
  currentPage = 1;
  render();
}

// ── 담임/학년 → 해당 학생 이름 Set ───────────────────────
function getNameSetByClass(fTeacher, fGrade) {
  if (!fTeacher && !fGrade) return null;
  return new Set(
    studentList
      .filter(s =>
        (!fTeacher || s.teacher === fTeacher) &&
        (!fGrade   || s.grade   === fGrade)
      )
      .map(s => s.name)
  );
}

// ── 메인 렌더 ─────────────────────────────────────────────
function render() {
  const fMonth    = document.getElementById("rec-filter-month")?.value    || "";
  const fTeacher  = document.getElementById("rec-filter-teacher")?.value  || "";
  const fGrade    = document.getElementById("rec-filter-grade")?.value    || "";
  const fName     = document.getElementById("rec-filter-name")?.value     || "";
  const fActivity = document.getElementById("rec-filter-activity")?.value || "";
  const sortKey   = document.getElementById("rec-sort")?.value            || "date-desc";

  const nameSet = getNameSetByClass(fTeacher, fGrade);

  let list = recordList.filter(r => {
    if (fMonth    && !r.date.startsWith(fMonth)) return false;
    if (nameSet   && !nameSet.has(r.name))       return false;
    if (fName     && r.name     !== fName)       return false;
    if (fActivity && r.activity !== fActivity)   return false;
    return true;
  });

  list.sort((a, b) => {
    switch (sortKey) {
      case "date-desc": return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
      case "date-asc":  return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
      case "pts-desc":  return b.pts - a.pts;
      case "pts-asc":   return a.pts - b.pts;
      case "name-asc":  return a.name.localeCompare(b.name, "ko");
      default:          return 0;
    }
  });

  filteredCache = list;

  const countEl = document.getElementById("rec-count");
  if (countEl) countEl.textContent = `총 ${list.length.toLocaleString()}건`;

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageData = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  renderTable(pageData);
  renderPagination(totalPages);
}

// ── 테이블 렌더 ───────────────────────────────────────────
function renderTable(pageData) {
  const tbody = document.getElementById("record-tbody");
  const empty = document.getElementById("record-empty");
  tbody.innerHTML = "";
  empty.style.display = pageData.length ? "none" : "block";

  pageData.forEach(r => {
    let detail = "-";
    if (r.activity === "기타 활동")                        detail = r.etcName;
    else if (r.activity === "주일예배 출석" && r.earlybird) detail = "🌅 얼리버드";

    const stu  = studentList.find(s => s.name === r.name) || {};
    const meta = [stu.grade, stu.teacher].filter(Boolean).join(" · ");

    const delBtn = window.authState.isAdmin
      ? `<td><button class="btn btn-danger btn-sm admin-only"
            onclick="window.records.remove('${r._id}')">삭제</button></td>`
      : `<td class="admin-only"></td>`;

    tbody.innerHTML += `
      <tr>
        <td>${r.date}</td>
        <td>
          <strong>${r.name}</strong>
          ${meta ? `<br/><span style="font-size:10px;color:var(--gray)">${meta}</span>` : ""}
        </td>
        <td><span class="badge ${BADGE[r.activity] || "badge-purple"}">${r.activity}</span></td>
        <td class="left">${detail}</td>
        <td><strong style="color:var(--purple)">${r.pts}P</strong></td>
        ${delBtn}
      </tr>`;
  });
}

// ── 페이지네이션 ──────────────────────────────────────────
function renderPagination(totalPages) {
  const el = document.getElementById("rec-pagination");
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  let html = `<button class="page-btn" ${currentPage === 1 ? "disabled" : ""}
    onclick="window.records.goPage(${currentPage - 1})">‹</button>`;

  const pages = new Set([1, totalPages]);
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++)
    pages.add(i);

  let prev = 0;
  [...pages].sort((a, b) => a - b).forEach(p => {
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
  document.getElementById("tab-record").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── CSV 내보내기 ──────────────────────────────────────────
function exportCSV() {
  const data = filteredCache.length ? filteredCache : recordList;
  if (!data.length) { alert("내보낼 기록이 없습니다"); return; }

  const rows = [["날짜", "이름", "학년", "담임", "활동", "세부내용", "얼리버드", "마일리지(P)"]];
  [...data].sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
    const stu = studentList.find(s => s.name === r.name) || {};
    rows.push([r.date, r.name, stu.grade || "", stu.teacher || "",
               r.activity, r.etcName || "", r.earlybird ? "O" : "", r.pts]);
  });

  const csv  = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = "고등부_마일리지.csv";
  a.click();
}

// ── Firestore 실시간 리스너 ───────────────────────────────
export function startListener(onUpdate) {
  const q = query(collection(db, "records"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    recordList = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    render();
    if (onUpdate) onUpdate();
  });
}

// 전역 노출
window.records = { add, remove, onActivityChange, exportCSV, applyFilter, resetFilter, goPage };
