/**
 * students.js
 * 학생 명단 CRUD 및 렌더링
 *
 * Firestore 컬렉션: "students"
 * 문서 ID = 학생 이름 (중복 방지)
 */

import { db } from "./firebase.js";
import {
  collection, doc,
  setDoc, deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { showAlert } from "./app.js";

/** 현재 학생 목록 (실시간 동기화) */
export let studentList = [];

/** 학생 추가 */
async function add() {
  if (!window.authState.isAdmin) {
    showAlert("student", "관리자 모드에서만 가능합니다", "error");
    return;
  }

  const name = document.getElementById("in-student").value.trim();
  if (!name) { showAlert("student", "이름을 입력해주세요", "error"); return; }
  if (studentList.includes(name)) { showAlert("student", "이미 있는 학생입니다", "error"); return; }

  try {
    await setDoc(doc(db, "students", name), { name, createdAt: Date.now() });
    document.getElementById("in-student").value = "";
    showAlert("student", `${name} 학생이 추가되었습니다!`, "success");
  } catch (e) {
    showAlert("student", "저장 실패: " + e.message, "error");
  }
}

/** 학생 삭제 */
async function remove(name) {
  if (!window.authState.isAdmin) return;
  if (!confirm(`${name} 학생을 삭제할까요? 기록은 유지됩니다.`)) return;

  try {
    await deleteDoc(doc(db, "students", name));
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

/** 학생 목록 렌더링 */
function render() {
  const list  = document.getElementById("student-list");
  const empty = document.getElementById("student-empty");

  if (!studentList.length) {
    empty.style.display = "block";
    list.innerHTML = "";
    return;
  }

  empty.style.display = "none";
  list.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:10px">
      ${studentList.map(s => `
        <div style="display:flex; align-items:center; gap:8px;
                    background:var(--purple-bg); border-radius:20px; padding:8px 14px;">
          <span style="font-weight:700; font-size:13px; color:var(--purple)">👤 ${s}</span>
          ${window.authState.isAdmin ? `
            <button class="btn btn-danger btn-sm admin-only"
              onclick="window.students.remove('${s}')"
              style="border-radius:20px; padding:3px 10px">✕</button>
          ` : ""}
        </div>
      `).join("")}
    </div>`;
}

/** 이름 선택 드롭다운 업데이트 */
export function updateNameSelect() {
  const sel = document.getElementById("in-name");
  sel.innerHTML =
    '<option value="">-- 학생 선택 --</option>' +
    studentList.map(s => `<option value="${s}">${s}</option>`).join("");
}

/** Firestore 실시간 리스너 시작 */
export function startListener() {
  onSnapshot(collection(db, "students"), snap => {
    studentList = snap.docs
      .map(d => d.data().name)
      .sort((a, b) => a.localeCompare(b, "ko"));

    render();
    updateNameSelect();
  });
}

// 전역 노출
window.students = { add, remove };
