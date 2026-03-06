/**
 * records.js
 * 활동 기록 CRUD 및 렌더링
 *
 * Firestore 컬렉션: "records"
 */

import { db } from "./firebase.js";
import {
  collection, doc,
  addDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { showAlert } from "./app.js";

/** 활동별 기본 마일리지 */
const POINTS = {
  "금요기도회 참석":       50,
  "주일예배 찬양팀 섬김":  50,
  "주일예배 안내팀 섬김":  30,
  "주일예배 출석":         100,
  "대표기도":              300,
  "새친구 전도":           1000,
};

/** 활동별 배지 클래스 */
const BADGE = {
  "금요기도회 참석":       "badge-purple",
  "주일예배 찬양팀 섬김":  "badge-green",
  "주일예배 안내팀 섬김":  "badge-green",
  "주일예배 출석":         "badge-blue",
  "대표기도":              "badge-gold",
  "새친구 전도":           "badge-red",
  "기타 활동":             "badge-teal",
};

/** 현재 기록 목록 (실시간 동기화) */
export let recordList = [];

// ── 활동 선택 변경 시 UI 처리 ─────────────────────────────
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
    showAlert("record", "관리자 모드에서만 가능합니다", "error");
    return;
  }

  const date     = document.getElementById("in-date").value;
  const name     = document.getElementById("in-name").value;
  const activity = document.getElementById("in-activity").value;

  if (!date || !name || !activity) {
    showAlert("record", "날짜, 활동구분, 이름을 모두 입력해주세요", "error");
    return;
  }

  let pts      = POINTS[activity] || 0;
  let etcName  = "";
  let earlybird = false;

  if (activity === "기타 활동") {
    etcName = document.getElementById("in-etc-name").value.trim();
    pts     = parseInt(document.getElementById("in-etc-pts").value) || 0;
    if (!etcName || pts <= 0) {
      showAlert("record", "기타 활동 내용과 점수를 입력해주세요", "error");
      return;
    }
  }

  if (activity === "주일예배 출석") {
    earlybird = document.getElementById("cb-earlybird").checked;
    if (earlybird) pts += 50;
  }

  try {
    await addDoc(collection(db, "records"), {
      date, name, activity, etcName, pts, earlybird,
      createdAt: Date.now(),
    });

    showAlert("record", `${name} 학생에게 ${pts}P 적립! 🎉`, "success");

    // 날짜·활동구분 유지 — 이름만 초기화 (연속 입력용)
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

// ── 기록 목록 렌더링 ──────────────────────────────────────
function render() {
  const tbody = document.getElementById("record-tbody");
  const empty = document.getElementById("record-empty");
  const sorted = [...recordList].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );

  tbody.innerHTML = "";
  empty.style.display = sorted.length ? "none" : "block";

  sorted.forEach(r => {
    let detail = "-";
    if (r.activity === "기타 활동")                       detail = r.etcName;
    else if (r.activity === "주일예배 출석" && r.earlybird) detail = "🌅 얼리버드";

    const delBtn = window.authState.isAdmin
      ? `<td><button class="btn btn-danger btn-sm admin-only"
            onclick="window.records.remove('${r._id}')">삭제</button></td>`
      : `<td class="admin-only"></td>`;

    tbody.innerHTML += `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.name}</strong></td>
        <td><span class="badge ${BADGE[r.activity] || "badge-purple"}">${r.activity}</span></td>
        <td class="left">${detail}</td>
        <td><strong style="color:var(--purple)">${r.pts}P</strong></td>
        ${delBtn}
      </tr>`;
  });
}

// ── CSV 내보내기 ──────────────────────────────────────────
function exportCSV() {
  if (!recordList.length) { alert("내보낼 기록이 없습니다"); return; }

  const rows = [["날짜", "이름", "활동", "세부내용", "얼리버드", "마일리지(P)"]];
  [...recordList]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(r => rows.push([
      r.date, r.name, r.activity,
      r.etcName || "", r.earlybird ? "O" : "", r.pts,
    ]));

  const csv  = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = "고등부_마일리지.csv";
  a.click();
}

// ── Firestore 실시간 리스너 시작 ─────────────────────────
export function startListener(onUpdate) {
  const q = query(collection(db, "records"), orderBy("createdAt", "desc"));

  onSnapshot(q, snap => {
    recordList = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    render();
    if (onUpdate) onUpdate(); // summary·ranking 재렌더 콜백
  });
}

// 전역 노출
window.records = { add, remove, onActivityChange, exportCSV };
