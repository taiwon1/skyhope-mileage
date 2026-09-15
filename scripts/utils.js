/**
 * utils.js
 * 공통 유틸 함수 — 순환참조 방지를 위해 app.js와 분리
 */
export function showAlert(id, msg, type) {
  const el = document.getElementById("alert-" + id);
  if (!el) return;
  el.textContent = msg;
  el.className = "alert alert-" + type + " show";
  setTimeout(() => el.classList.remove("show"), 3000);
}

const kstDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
export function toLocalDate(date = new Date()) { return kstDateFormatter.format(date); }

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && value <= toLocalDate();
}

// A local calendar date carrying today's KST year/month/day, regardless of device timezone.
export function kstToday() { return new Date(toLocalDate() + 'T12:00:00'); }

const attendanceCache = new WeakMap();
export function attendanceRecords(records) {
  const today = toLocalDate();
  const cached = attendanceCache.get(records);
  if (cached?.today === today) return cached.records;
  const seen = new Set();
  const result = records.filter(r => {
    if (r.activity !== '주일예배 출석' || !validDate(r.date)) return false;
    const [y,m,d] = r.date.split('-').map(Number);
    if (new Date(y,m-1,d).getDay() !== 0) return false;
    const key = JSON.stringify([r.name,r.date]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  attendanceCache.set(records, { today, records: result });
  return result;
}

export function validName(value) {
  return value.length > 0 && value.length <= 40 && !/[<>"'&/\\\r\n]/.test(value) && value !== '.' && value !== '..';
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function activityId(record) {
  return 'activity-' + encodeURIComponent(JSON.stringify([record.name, record.date, record.activity, record.etcName || '']));
}

export function listenerError(label) {
  return () => {
    let el = document.getElementById('connection-error');
    if (!el) {
      el = document.createElement('div'); el.id = 'connection-error'; el.setAttribute('role', 'alert');
      el.style.cssText = 'padding:14px;background:#fff1f2;color:#9f1239;position:relative;z-index:10000';
      document.body.prepend(el);
    }
    el.textContent = label + ' 데이터를 불러오지 못했습니다. 연결과 권한을 확인한 후 새로고침해주세요.';
    document.getElementById('loading-overlay').style.display = 'none';
  };
}
