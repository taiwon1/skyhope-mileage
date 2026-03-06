/**
 * students.js - 학생 명단 CRUD 및 수정 로직 최적화
 */
import { db } from "./firebase.js";
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert } from "./app.js";

export let studentList = [];
let filterTeacher = "";
let filterGrade = "";

async function add() {
  if (!window.authState?.isAdmin) {
    showAlert("student", "관리자 모드에서만 가능합니다", "error");
    return;
  }
  const name = document.getElementById("in-student").value.trim();
  const grade = document.getElementById("in-grade").value;
  const teacher = document.getElementById("in-teacher").value;

  if (!name || !grade || !teacher) {
    showAlert("student", "모든 정보를 입력해주세요", "error");
    return;
  }

  if (studentList.find((s) => s.name === name)) {
    showAlert("student", "이미 있는 학생입니다", "error");
    return;
  }

  try {
    await setDoc(doc(db, "students", name), {
      name, grade, teacher, createdAt: Date.now(),
    });
    document.getElementById("in-student").value = "";
    showAlert("student", `${name} 학생이 추가되었습니다!`, "success");
  } catch (e) {
    showAlert("student", "저장 실패: " + e.message, "error");
  }
}

async function remove(name) {
  if (!window.authState?.isAdmin) return;
  if (!confirm(`${name} 학생을 삭제할까요? 기록은 유지됩니다.`)) return;
  try {
    await deleteDoc(doc(db, "students", name));
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

function openEditModal(name) {
  // 배포 환경에서 authState 체크가 늦을 수 있으므로 안전하게 처리
  if (!window.authState?.isAdmin) {
    alert("관리자 로그인이 필요합니다.");
    return;
  }
  const stu = studentList.find((s) => s.name === name);
  if (!stu) return;

  document.getElementById("edit-student-name").value = name;
  document.getElementById("edit-modal-name").textContent = `👤 ${name}`;
  document.getElementById("edit-grade").value = stu.grade || "";
  document.getElementById("edit-teacher").value = stu.teacher || "";
  document.getElementById("edit-modal").classList.add("show");
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.remove("show");
}

async function saveEdit() {
  const name = document.getElementById("edit-student-name").value;
  const grade = document.getElementById("edit-grade").value;
  const teacher = document.getElementById("edit-teacher").value;

  if (!grade || !teacher) {
    document.getElementById("edit-error").style.display = "block";
    return;
  }

  try {
    await updateDoc(doc(db, "students", name), { grade, teacher });
    closeEditModal();
  } catch (e) {
    alert("수정 실패: " + e.message);
  }
}

function render() {
  const list = document.getElementById("student-list");
  const empty = document.getElementById("student-empty");

  let filtered = studentList;
  if (filterTeacher) filtered = filtered.filter((s) => s.teacher === filterTeacher);
  if (filterGrade) filtered = filtered.filter((s) => s.grade === filterGrade);

  if (!filtered.length) {
    empty.style.display = "block";
    list.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  const grouped = {};
  filtered.forEach((s) => {
    const key = s.teacher || "미지정";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  list.innerHTML = Object.entries(grouped).map(([teacher, students]) => `
    <div style="margin-bottom:24px">
      <div style="font-size:12px; font-weight:800; color:var(--gray); margin-bottom:10px">
        ${teacher} · ${students.length}명
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:10px">
        ${students.map((s) => `
          <div class="student-chip">
            <div class="student-chip-info">
              <span class="student-chip-name">👤 ${s.name}</span>
              <span class="student-chip-meta">${s.grade || "학년 미지정"}</span>
            </div>
            ${window.authState?.isAdmin ? `
              <button class="btn btn-sm" style="background:var(--purple-bg);color:var(--purple);"
                onclick="window.students.openEditModal('${s.name}')">수정</button>
              <button class="btn btn-danger btn-sm"
                onclick="window.students.remove('${s.name}')">삭제</button>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

export function startListener() {
  onSnapshot(collection(db, "students"), (snap) => {
    studentList = snap.docs.map((d) => d.data()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    render();
    const sel = document.getElementById("in-name");
    if (sel) {
      sel.innerHTML = '<option value="">-- 학생 선택 --</option>' + 
        studentList.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    }
  });
}

// 전역 노출 (배포 환경 안전성 확보)
window.students = { add, remove, openEditModal, closeEditModal, saveEdit, applyFilter: () => {
  filterTeacher = document.getElementById("stu-filter-teacher").value;
  filterGrade = document.getElementById("stu-filter-grade").value;
  render();
}};