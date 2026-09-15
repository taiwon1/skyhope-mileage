/**
 * newcomer.js — 새친구 등반 기록부
 * sky(isAdmin): 등록/스탬프/삭제/등반
 * tc + 읽기전용: 카드 조회만
 */

import { db } from "./firebase.js?v=20260915-2";
import {
  collection, deleteDoc,
  doc, onSnapshot, orderBy, query, serverTimestamp, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, validDate, validName, activityId, listenerError } from "./utils.js?v=20260915-2";
import { studentList } from "./students.js?v=20260915-2";

import { recordList } from "./records.js?v=20260915-2";
let newcomerList = [];
let graduating = false;

const CARD_PALETTES = [
  { border:"#f9a8d4", bg:"linear-gradient(135deg,#fdf2f8,#fff)", accent:"#db2777" },
  { border:"#93c5fd", bg:"linear-gradient(135deg,#eff6ff,#fff)", accent:"#2563eb" },
  { border:"#86efac", bg:"linear-gradient(135deg,#f0fdf4,#fff)", accent:"#16a34a" },
  { border:"#fcd34d", bg:"linear-gradient(135deg,#fffbeb,#fff)", accent:"#b45309" },
  { border:"#c4b5fd", bg:"linear-gradient(135deg,#f5f3ff,#fff)", accent:"#7c3aed" },
  { border:"#fb923c", bg:"linear-gradient(135deg,#fff7ed,#fff)", accent:"#ea580c" },
];
const STAMP_EMOJI = ["🌱","🌿","🌳","🏔️"];

// ── 인도자 드롭다운 채우기 (학생 목록 기반) ─────────────────
function populateGuideSelect() {
  const sel = document.getElementById("nc-guide");
  if (!sel) return;
  const selected = sel.value;
  const studs = studentList || [];
  sel.innerHTML = '<option value="">-- 선택 --</option>'
    + '<option value="없음">없음 (자발적 방문)</option>'
    + studs.map(s => '<option value="' + s.name + '">' + s.name + ' (' + (s.grade||"") + ')</option>').join("");
  sel.value = selected;
}

// ── 등록 ─────────────────────────────────────────────────
async function add() {
  if (!window.authState?.isAdmin) return;
  const name   = document.getElementById("nc-name").value.trim();
  const grade  = document.getElementById("nc-grade").value;
  const gender = document.getElementById("nc-gender").value;
  const guide  = document.getElementById("nc-guide").value.trim();
  const week1  = document.getElementById("nc-week1").value;

  if (!validName(name) || !grade || !gender || !guide || !validDate(week1)) {
    showAlert("newcomer", "모든 항목을 입력해주세요", "error"); return;
  }
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db,'newcomers','newcomer-' + encodeURIComponent(name));
      const existing = await tx.get(ref);
      const student = await tx.get(doc(db,'students',name));
      if (existing.exists() || student.exists() || newcomerList.some(n=>n.name===name)) throw Error('이미 등록된 학생 또는 새친구입니다');
      if (guide === name || (guide !== '없음' && !studentList.some(s=>s.name===guide))) throw Error('올바른 인도자를 선택해주세요');
      if (!window.authState?.isAdmin) throw Error('관리자 모드에서만 가능합니다');
      tx.set(ref,{name,grade,gender,guide,week1,week2:null,week3:null,week4:null,graduated:false,teacher:null,createdAt:serverTimestamp()});
    });
    ["nc-name","nc-guide","nc-week1","nc-grade","nc-gender"]
      .forEach(id => { document.getElementById(id).value = ""; });
    showAlert("newcomer", name + " 새친구 등록 완료! 🎉", "success");
  } catch(e) {
    showAlert("newcomer", "저장 실패: " + e.message, "error");
  }
}

// ── 스탬프 모달 ───────────────────────────────────────────
function openStampModal(id, week) {
  if (!window.authState?.isAdmin) return;
  const nc = newcomerList.find(n => n._id === id);
  if (!nc || nc.graduated || ![2,3,4].includes(week)) return;
  if (week === 2 && !nc.week1) return;
  if (week === 3 && !nc.week2) return;
  if (week === 4 && !nc.week3) return;
  if (nc["week" + week]) return;

  document.getElementById("stamp-modal-title").textContent = nc.name + " — " + week + "주차 출석일";
  document.getElementById("stamp-date-input").value = "";
  document.getElementById("stamp-modal").dataset.id   = id;
  document.getElementById("stamp-modal").dataset.week = week;
  document.getElementById("stamp-modal").classList.add("show");
}

async function saveStamp() {
  if (!window.authState?.isAdmin) return;
  const modal = document.getElementById('stamp-modal');
  const id = modal.dataset.id, week = Number(modal.dataset.week);
  const date = document.getElementById('stamp-date-input').value;
  if (![2,3,4].includes(week) || !validDate(date)) { alert('오늘까지의 올바른 출석일을 선택해주세요'); return; }
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db,'newcomers',id), snap = await tx.get(ref);
      if (!snap.exists()) throw Error('새친구 기록이 없습니다');
      const nc = snap.data();
      if (nc.graduated || nc['week'+week] || !nc['week'+(week-1)]) throw Error('출석 순서를 확인해주세요');
      const dates = [nc.week1,nc.week2,nc.week3,nc.week4].filter(Boolean);
      if (dates.includes(date)) throw Error('이미 입력한 출석일입니다');
      dates.push(date); dates.sort();
      const result = {week1:null,week2:null,week3:null,week4:null};
      dates.forEach((d,i)=>result['week'+(i+1)]=d);
      if (!window.authState?.isAdmin) throw Error('관리자 모드에서만 가능합니다');
      tx.update(ref,result);
    });
    closeStampModal();
  } catch(e) { alert('저장 실패: ' + e.message); }
}

function closeStampModal() {
  document.getElementById("stamp-modal").classList.remove("show");
}

// ── 삭제 ──────────────────────────────────────────────────
async function remove(id) {
  if (!window.authState?.isAdmin) return;
  if (!confirm("이 새친구 카드를 삭제할까요?")) return;
  try {
    await deleteDoc(doc(db, "newcomers", id));
  } catch(e) {
    alert("삭제 실패: " + e.message);
  }
}

// ── 등반 모달 ─────────────────────────────────────────────
function openGraduateModal(id) {
  if (!window.authState?.isAdmin) return;
  const nc = newcomerList.find(n => n._id === id);
  if (!nc || nc.graduated || !nc.week4) return;
  document.getElementById("grad-modal-name").textContent = nc.name;
  document.getElementById("grad-teacher-select").value   = "";
  document.getElementById("grad-modal").dataset.id       = id;
  document.getElementById("grad-modal").classList.add("show");
}

async function confirmGraduate() {
  if (!window.authState?.isAdmin || graduating) return;
  const modal = document.getElementById('grad-modal');
  const id = modal.dataset.id, teacher = document.getElementById('grad-teacher-select').value;
  if (!id || !teacher) { alert('담임 선생님을 선택해주세요'); return; }
  graduating = true;
  try {
    const name = await runTransaction(db, async tx => {
      const ncRef = doc(db,'newcomers',id), snap = await tx.get(ncRef);
      if (!snap.exists()) throw Error('새친구 기록이 없습니다');
      const nc = snap.data();
      const weeks = [nc.week1,nc.week2,nc.week3,nc.week4];
      if (nc.graduated) throw Error('이미 등반한 새친구입니다');
      if (!weeks.every(validDate) || new Set(weeks).size !== 4 || weeks.join() !== [...weeks].sort().join()) throw Error('4주 출석 기록을 확인해주세요');
      if (new Date(nc.week4+'T12:00:00+09:00').getUTCDay() !== 0) throw Error('등반일은 주일 출석일을 선택해주세요');
      const studentRef = doc(db,'students',nc.name), student = await tx.get(studentRef);
      if (student.exists()) throw Error('이미 학생 명단에 있는 이름입니다. 중복 등록 여부를 확인해주세요');
      const rewardRef = doc(db,'records','graduation-' + encodeURIComponent(nc.name));
      const reward = await tx.get(rewardRef);
      const attendance = {name:nc.name,date:nc.week4,activity:'주일예배 출석',pts:100,earlybird:false,etcName:'',createdAt:Date.now()};
      const attendanceRef = doc(db,'records',activityId(attendance));
      const existingAttendance = await tx.get(attendanceRef);
      const guideRef = nc.guide && nc.guide !== '없음' ? doc(db,'students',nc.guide) : null;
      const guide = guideRef ? await tx.get(guideRef) : null;
      if (guideRef && (!guide.exists() || nc.guide === nc.name)) throw Error('인도자 학생 정보를 확인해주세요');
      if (!window.authState?.isAdmin) throw Error('관리자 모드에서만 가능합니다');
      tx.update(ncRef,{graduated:true,teacher});
      tx.set(studentRef,{name:nc.name,grade:nc.grade,gender:nc.gender,teacher,mileageStartDate:nc.week4,createdAt:Date.now()});
      tx.set(doc(db,'notices','graduation-'+id),{type:'newface',title:'🎊 등반 축하 — '+nc.name,content:nc.name+' 친구가 4주 출석을 마치고 '+teacher+'반으로 등반했습니다! 함께 축하해주세요 🎉',newcomerName:nc.name,recordDate:nc.week4,graduationId:id,createdAt:serverTimestamp()});
      const legacyReward = recordList.some(r=>r.activity==='새친구 전도' && (r.newcomerName||r.name)===nc.name);
      if (!reward.exists() && !legacyReward) {
        const base = {date:nc.week4,activity:'새친구 전도',etcName:'',newcomerName:nc.name,pts:1000,earlybird:false,graduationId:id,createdAt:Date.now()};
        tx.set(rewardRef,{...base,name:nc.name,isNewcomer:true});
        if (guideRef) tx.set(doc(db,'records','graduation-guide-'+encodeURIComponent(nc.name)),{...base,name:nc.guide,isNewcomer:false});
      }
      if (!existingAttendance.exists() && !recordList.some(r=>r.name===nc.name&&r.date===nc.week4&&r.activity==='주일예배 출석')) tx.set(attendanceRef,attendance);
      return nc.name;
    });
    closeGraduateModal();
    alert(name + ' 등반 완료! 반 배정과 등반일 출석을 등록했습니다. 전도 마일리지는 기존 지급 여부를 확인해 한 번만 지급합니다.');
  } catch(e) { alert('등반 처리 실패: ' + e.message); }
  finally { graduating = false; }
}

function closeGraduateModal() {
  document.getElementById("grad-modal").classList.remove("show");
}

// ── 스탬프 HTML 생성 ──────────────────────────────────────
function makeStamp(nc, w, isAdmin, pal) {
  const date     = nc["week" + w];
  const prevDone = w === 1 || !!nc["week" + (w - 1)];
  const canClick = isAdmin && !date && prevDone;
  const emoji    = STAMP_EMOJI[w - 1];

  if (date) {
    return '<div class="stamp stamp-done" style="border-color:' + pal.accent + '40;background:' + pal.accent + '18">'
      + '<div class="stamp-emoji">' + emoji + '</div>'
      + '<div class="stamp-week" style="color:' + pal.accent + '">' + w + '주</div>'
      + '<div class="stamp-date" style="color:' + pal.accent + '">' + date.slice(5) + '</div>'
      + '</div>';
  }
  if (canClick) {
    return '<button type="button" class="stamp stamp-open" aria-label="' + w + '주차 출석일 입력" onclick="window.newcomer.openStampModal(\'' + nc._id + '\',' + w + ')">'
      + '<div class="stamp-emoji" style="opacity:0.5">' + emoji + '</div>'
      + '<div class="stamp-week">' + w + '주</div>'
      + '<div class="stamp-plus">터치!</div>'
      + '</button>';
  }
  return '<div class="stamp stamp-locked">'
    + '<div class="stamp-emoji" style="opacity:0.2">' + emoji + '</div>'
    + '<div class="stamp-week">' + w + '주</div>'
    + '</div>';
}

// ── 렌더링 ────────────────────────────────────────────────
function render() {
  const container = document.getElementById("newcomer-list");
  const empty     = document.getElementById("newcomer-empty");
  if (!container) return;

  const isAdmin = window.authState?.isAdmin;
  const active  = newcomerList.filter(n => !n.graduated);

  if (!active.length) {
    container.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  container.innerHTML = active.map(function(nc, idx) {
    const pal     = CARD_PALETTES[idx % CARD_PALETTES.length];
    const done    = [nc.week1, nc.week2, nc.week3, nc.week4].filter(Boolean).length;
    const pct     = Math.round(done / 4 * 100);
    const allDone = done === 4;

    const stamps = [1,2,3,4].map(function(w) {
      return makeStamp(nc, w, isAdmin, pal);
    }).join('<div class="stamp-connector" style="background:' + pal.border + '"></div>');

    const deleteBtnHtml = isAdmin
      ? '<button class="nc-delete-btn" aria-label="새친구 카드 삭제" onclick="window.newcomer.remove(\'' + nc._id + '\')">✕</button>'
      : "";

    const completeBannerHtml = allDone
      ? '<div class="nc-complete-banner" style="background:' + pal.accent + '">'
        + '🏔️ 4주 완료! 등반 준비 완료!'
        + (isAdmin
          ? ' <button class="nc-grad-btn-inline" onclick="window.newcomer.openGraduateModal(\'' + nc._id + '\')">🎊 등반하기</button>'
          : '')
        + '</div>'
      : "";

    return '<div class="nc-card" style="border-color:' + pal.border + ';background:' + pal.bg + '">'
      + completeBannerHtml
      + '<div style="position:relative;padding:16px 16px 0">'
        + deleteBtnHtml
        + '<div class="nc-card-header" style="margin-bottom:12px">'
          + '<div class="nc-avatar" style="background:' + pal.accent + '">' + nc.name[0] + '</div>'
          + '<div class="nc-info">'
            + '<div class="nc-name" style="color:' + pal.accent + '">' + nc.name
              + '<span class="nc-student-detail">' + nc.gender + ' · ' + nc.grade + '</span>'
            + '</div>'
            + '<div class="nc-meta" style="margin-top:5px">'
              + '<span class="nc-guide-tag">' + (nc.guide === '없음' || !nc.guide ? '🚪 스스로 찾아왔어요!' : '🤝 ' + nc.guide + ' 친구가 데려왔어요') + '</span>'
            + '</div>'
            + '<div class="nc-meta" style="margin-top:4px">'
              + '<span class="nc-meta-item">첫출석 ' + nc.week1 + '</span>'
            + '</div>'
          + '</div>'
        + '</div>'
        + '<div class="nc-journey-label" style="color:' + pal.accent + '">✨ 4주 등반 여정 · ' + done + '/4주 완료</div>'
      + '</div>'
      + '<div class="nc-stamps-wrap">'
        + '<div class="nc-stamps">'
          + stamps
        + '</div>'
      + '</div>'
    + '</div>';
  }).join("");
}

// ── Firestore 리스너 ──────────────────────────────────────
export function startListener() {
  const q = query(collection(db, "newcomers"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    newcomerList = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    render();
    populateGuideSelect();
  }, listenerError("등반 기록"));
}

window.newcomer = {
  render,
  add, openStampModal, saveStamp, closeStampModal,
  remove, openGraduateModal, confirmGraduate, closeGraduateModal,
  populateGuideSelect,
};
