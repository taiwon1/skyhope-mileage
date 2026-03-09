/**
 * notice.js
 * 공지사항 게시판 — 관리자 등록 / 전체 조회
 */

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert } from "./utils.js";

let noticeList = [];

// ── 공지 등록 ─────────────────────────────────────────────
async function add() {
  if (!window.authState?.isAdmin) {
    showAlert("notice", "관리자 모드에서만 가능합니다", "error");
    return;
  }
  const title = document.getElementById("notice-title").value.trim();
  const content = document.getElementById("notice-content").value.trim();
  if (!title) {
    showAlert("notice", "제목을 입력해주세요", "error");
    return;
  }
  if (!content) {
    showAlert("notice", "내용을 입력해주세요", "error");
    return;
  }

  try {
    await addDoc(collection(db, "notices"), {
      title,
      content,
      createdAt: serverTimestamp(),
    });
    document.getElementById("notice-title").value = "";
    document.getElementById("notice-content").value = "";
    showAlert("notice", "공지가 등록되었습니다!", "success");
  } catch (e) {
    showAlert("notice", "등록 실패: " + e.message, "error");
  }
}

// ── 공지 삭제 ─────────────────────────────────────────────
async function remove(id) {
  if (!window.authState?.isAdmin) return;
  if (!confirm("이 공지를 삭제할까요?")) return;
  try {
    await deleteDoc(doc(db, "notices", id));
  } catch (e) {
    alert("삭제 실패: " + e.message);
  }
}

// ── 공지 목록 렌더링 ──────────────────────────────────────
function render() {
  const list = document.getElementById("notice-list");
  const empty = document.getElementById("notice-empty");
  if (!list) return;

  if (!noticeList.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = noticeList
    .map((n) => {
      const date = n.createdAt?.toDate
        ? n.createdAt
            .toDate()
            .toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })
        : "";
      const isAdmin = window.authState?.isAdmin;
      return `
      <div class="notice-card">
        <div class="notice-card-header">
          <div class="notice-card-title">📢 ${n.title}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="notice-date">${date}</span>
            ${
              isAdmin
                ? `<button class="btn btn-danger btn-sm admin-only"
              onclick="window.notice.remove('${n._id}')">삭제</button>`
                : ""
            }
          </div>
        </div>
        <div class="notice-card-content">${n.content.replace(/\n/g, "<br>")}</div>
      </div>`;
    })
    .join("");
}

// ── Firestore 리스너 ──────────────────────────────────────
export function startListener() {
  const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    noticeList = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    render();
  });
}

window.notice = { add, remove, render };
