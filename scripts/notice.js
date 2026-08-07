/**
 * notice.js
 * 공지사항 + 새친구 환영 게시판
 *
 * notices 컬렉션 문서 구조:
 *   type: "notice" | "newface"
 *   title, content, createdAt (공통)
 *   newcomerName (새친구 전용)
 *   recordDate   (새친구 — 활동기록 날짜, "YYYY-MM-DD")
 */

import { db } from "./firebase.js";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, orderBy, query, serverTimestamp,
  setDoc, getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert } from "./utils.js";
import { recordList } from "./records.js";
import { studentList } from "./students.js";

let noticeList = [];
let hiddenNewcomers = new Set(); // records에서 숨긴 환영카드 _id 목록

// ── 날짜 포맷 헬퍼 ────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ── 일반 공지 등록 ────────────────────────────────────────
async function add() {
  if (!window.authState?.isAdmin) {
    showAlert("notice", "관리자 모드에서만 가능합니다", "error"); return;
  }
  const title   = document.getElementById("notice-title").value.trim();
  const content = document.getElementById("notice-content").value.trim();
  if (!title)   { showAlert("notice", "제목을 입력해주세요", "error"); return; }
  if (!content) { showAlert("notice", "내용을 입력해주세요", "error"); return; }

  try {
    await addDoc(collection(db, "notices"), {
      type: "notice", title, content, createdAt: serverTimestamp(),
    });
    document.getElementById("notice-title").value   = "";
    document.getElementById("notice-content").value = "";
    showAlert("notice", "공지가 등록되었습니다!", "success");
  } catch (e) {
    showAlert("notice", "등록 실패: " + e.message, "error");
  }
}

// ── 새친구 등록 ───────────────────────────────────────────
async function addNewcomer() {
  if (!window.authState?.isAdmin) {
    showAlert("notice", "관리자 모드에서만 가능합니다", "error"); return;
  }
  const name = document.getElementById("newcomer-name").value.trim();
  const date = document.getElementById("newcomer-date").value;
  if (!name) { showAlert("notice", "새친구 이름을 입력해주세요", "error"); return; }
  if (!date) { showAlert("notice", "등록 날짜를 선택해주세요", "error"); return; }

  const content = `${name} 친구가 고등부 가족이 되었습니다! 따뜻하게 맞이해주세요 🎉`;

  try {
    await addDoc(collection(db, "notices"), {
      type: "newface",
      title: `🎉 새친구 ${name}`,
      content,
      newcomerName: name,
      recordDate: date,
      createdAt: serverTimestamp(),
    });
    document.getElementById("newcomer-name").value = "";
    document.getElementById("newcomer-date").value = "";
    showAlert("notice", `${name} 새친구 환영 게시물이 등록되었습니다! 🎉`, "success");
  } catch (e) {
    showAlert("notice", "등록 실패: " + e.message, "error");
  }
}

// ── 삭제 ─────────────────────────────────────────────────
async function remove(id, source) {
  if (!window.authState?.isAdmin) return;
  if (!confirm("이 환영 게시물을 숨길까요?\n(활동기록은 유지됩니다)")) return;
  try {
    if (source === "record") {
      // records는 숨김 목록에 추가 (실제 삭제 안 함)
      hiddenNewcomers.add(id);
      await setDoc(doc(db, "hiddenNewcomers", id), { hiddenAt: serverTimestamp() });
    } else {
      await deleteDoc(doc(db, "notices", id));
    }
    render();
  } catch (e) {
    alert("처리 실패: " + e.message);
  }
}

// ── 렌더링 ───────────────────────────────────────────────
function render() {
  const isAdmin  = window.authState?.isAdmin;
  const notices  = noticeList.filter(n => n.type !== "newface");

  // ── 새친구: records의 isNewcomer:true + notices의 "newface" 합산
  const fromRecords = recordList
    .filter(r => r.activity === "새친구 전도" && !hiddenNewcomers.has(r._id))
    .map(r => ({
      _id: r._id, source: "record",
      newcomerName: r.newcomerName || r.name,
      recordDate: r.date,
      pts: r.pts,
    }));

  // notices 컬렉션의 newface
  const fromNotices = noticeList
    .filter(n => n.type === "newface")
    .map(n => ({ ...n, source: "notice" }));

  // 합산 후 날짜 내림차순
  const allNewfaces = [...fromRecords, ...fromNotices]
    .sort((a, b) => (b.recordDate || "").localeCompare(a.recordDate || ""));

  // 새친구 섹션
  const nfWrap  = document.getElementById("newface-list");
  const nfEmpty = document.getElementById("newface-empty");
  if (!nfWrap) return;

  if (!allNewfaces.length) {
    nfWrap.innerHTML  = "";
    nfEmpty.style.display = "block";
  } else {
    nfEmpty.style.display = "none";
    const GREETINGS = [
      (name) => `${name} 친구, 하늘소망 고등부에 온 걸 진심으로 환영해! 🙌 함께해서 정말 기뻐!`,
      (name) => `와! ${name} 친구가 왔다! 🎊 우리 고등부가 더 빛날 것 같아. 잘 왔어!`,
      (name) => `${name} 친구, 이제 우리 가족이 됐어! 💛 편하게 지내고 좋은 추억 많이 만들자!`,
      (name) => `${name} 친구를 기다리고 있었어! ✨ 하늘소망 고등부와 함께 멋진 시간 보내자!`,
    ];

    const PALETTES = [
      { bg: "linear-gradient(135deg,#fdf4ff,#fce7f3)", border: "#f9a8d4", nameColor: "#be185d", dateColor: "#9d174d", msgColor: "#831843", emoji: "🎉" },
      { bg: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "#93c5fd", nameColor: "#1d4ed8", dateColor: "#1e40af", msgColor: "#1e3a8a", emoji: "🎊" },
      { bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "#86efac", nameColor: "#15803d", dateColor: "#166534", msgColor: "#14532d", emoji: "✨" },
      { bg: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "#fcd34d", nameColor: "#b45309", dateColor: "#92400e", msgColor: "#78350f", emoji: "🌟" },
      { bg: "linear-gradient(135deg,#fff1f2,#ffe4e6)", border: "#fca5a5", nameColor: "#dc2626", dateColor: "#b91c1c", msgColor: "#991b1b", emoji: "💫" },
      { bg: "linear-gradient(135deg,#f5f3ff,#ede9fe)", border: "#c4b5fd", nameColor: "#7c3aed", dateColor: "#6d28d9", msgColor: "#5b21b6", emoji: "🎈" },
    ];

    nfWrap.innerHTML = allNewfaces.map((n, i) => {
      const name    = n.newcomerName || n.title || "";
      const date    = n.recordDate || fmtDate(n.createdAt) || "";
      const stu     = studentList.find(s => s.name === name) || {};
      const gradeTag = stu.grade
        ? `<span class="newface-grade">${stu.grade}</span>`
        : "";
      const teacherTag = stu.teacher
        ? `<span class="newface-grade">${stu.teacher}</span>`
        : "";
      const palette = PALETTES[i % PALETTES.length];
      // 날짜 기반 시드로 일관된 랜덤 멘트 (같은 날짜면 항상 같은 멘트)
      const seed    = parseInt(date.replace(/-/g, ""), 10) + name.length;
      const greet   = GREETINGS[seed % GREETINGS.length](name);
      const canDel  = isAdmin && n._id;

      return `
      <div class="newface-card" style="
        background:${palette.bg};
        border-color:${palette.border};
      ">
        <div class="newface-balloon">${palette.emoji}</div>
        <div class="newface-info">
          <div class="newface-name" style="color:${palette.nameColor}">${name} ${gradeTag}${teacherTag}</div>
          <div class="newface-date" style="color:${palette.dateColor}">${date} 등록</div>
          <div class="newface-msg"  style="color:${palette.msgColor}">${greet}</div>
        </div>
        ${canDel ? `<button class="btn btn-danger btn-sm admin-only"
          onclick="window.notice.remove('${n._id}','${n.source || "notice"}')">숨기기</button>` : ""}
      </div>`;
    }).join("");
  }

  // 일반 공지 섹션
  const ntWrap  = document.getElementById("notice-list");
  const ntEmpty = document.getElementById("notice-empty");
  if (!ntWrap) return;

  if (!notices.length) {
    ntWrap.innerHTML = "";
    ntEmpty.style.display = "block";
  } else {
    ntEmpty.style.display = "none";
    ntWrap.innerHTML = notices.map(n => `
      <div class="notice-card">
        <div class="notice-card-header">
          <div class="notice-card-title">📢 ${n.title}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="notice-date">${fmtDate(n.createdAt)}</span>
            ${isAdmin ? `<button class="btn btn-danger btn-sm admin-only"
              onclick="window.notice.remove('${n._id}')">삭제</button>` : ""}
          </div>
        </div>
        <div class="notice-card-content">${n.content.replace(/\n/g, "<br>")}</div>
      </div>`).join("");
  }
}

// ── Firestore 리스너 ──────────────────────────────────────
export function startListener() {
  // 숨김 목록 먼저 로드
  onSnapshot(collection(db, "hiddenNewcomers"), snap => {
    hiddenNewcomers = new Set(snap.docs.map(d => d.id));
    render();
  });

  const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    noticeList = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    render();
  });
}

// ── 입력 탭 전환 ─────────────────────────────────────────
function switchInputTab(tab) {
  const isNewface = tab === "newface";
  document.getElementById("input-newface").style.display  = isNewface ? "block" : "none";
  document.getElementById("input-general").style.display  = isNewface ? "none"  : "block";
  document.getElementById("tab-btn-newface").className =
    "notice-input-tab" + (isNewface ? " active" : "");
  document.getElementById("tab-btn-general").className =
    "notice-input-tab" + (!isNewface ? " active" : "");
}

// ── 탭 열릴 때 날짜 초기화 ───────────────────────────────
function initDate() {
  const el = document.getElementById("newcomer-date");
  if (el && !el.value) el.value = new Date().toISOString().split("T")[0];
}

window.notice = { add, addNewcomer, remove, render, switchInputTab, initDate };