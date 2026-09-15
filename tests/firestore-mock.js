// Browser integration fixture. Only served by run-browser.cjs; never loaded by the app.
const state = structuredClone(window.__seed || {});
const listeners = [];
let serial = 0;
let queue = Promise.resolve();
export const getFirestore = () => ({});
export const collection = (_, name) => ({ name });
export function doc(parent, name, id) {
  return id === undefined ? { name: parent.name, id: name || 'auto-' + (++serial) } : { name, id };
}
export const orderBy = (field, direction) => ({ sort: field, direction });
export const where = (field, operator, value) => ({ field, operator, value });
export const query = (ref, ...filters) => ({ ...ref, filters });
export const serverTimestamp = () => Date.now();
function snapshot(ref) {
  const value = state[ref.name]?.[ref.id];
  return { id: ref.id, ref, exists: () => value !== undefined, data: () => structuredClone(value) };
}
function querySnapshot(ref) {
  let docs = Object.keys(state[ref.name] || {}).map(id => snapshot({ name: ref.name, id }));
  for (const f of ref.filters || []) {
    if (f.field) docs = docs.filter(d => d.data()[f.field] === f.value);
    if (f.sort) docs.sort((a,b) => ((a.data()[f.sort] > b.data()[f.sort]) ? 1 : -1) * (f.direction === 'desc' ? -1 : 1));
  }
  return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
}
function emit() { listeners.forEach(l => l.fn(l.ref.id ? snapshot(l.ref) : querySnapshot(l.ref))); }
export function onSnapshot(ref, fn, error) {
  const entry = { ref, fn, error }; listeners.push(entry);
  setTimeout(() => fn(ref.id ? snapshot(ref) : querySnapshot(ref)), window.__listenerDelay?.[ref.name] || 0);
  return () => { const index = listeners.indexOf(entry); if (index >= 0) listeners.splice(index, 1); };
}
export const getDoc = async ref => snapshot(ref);
export const getDocs = async ref => querySnapshot(ref);
function apply(operations) {
  if (window.__failNextWrite) { window.__failNextWrite = false; throw Error('테스트 저장 실패'); }
  for (const [kind, ref, value, options] of operations) {
    state[ref.name] ||= {};
    if (kind === 'delete') delete state[ref.name][ref.id];
    else state[ref.name][ref.id] = structuredClone(kind === 'update' || options?.merge ? { ...state[ref.name][ref.id], ...value } : value);
  }
  window.__writeCount = (window.__writeCount || 0) + operations.length;
  emit();
}
export const setDoc = async (ref, value, options) => apply([['set', ref, value, options]]);
export const updateDoc = async (ref, value) => apply([['update', ref, value]]);
export const deleteDoc = async ref => apply([['delete', ref]]);
export async function addDoc(ref, value) { const r = doc(ref); await setDoc(r, value); return r; }
function writer() {
  const operations = [];
  return { get: async ref => { if (operations.length) throw Error('transaction reads must precede writes'); return snapshot(ref); }, set: (r,v,o) => operations.push(['set',r,v,o]), update: (r,v) => operations.push(['update',r,v]), delete: r => operations.push(['delete',r]), commit: async () => { if(operations.length>500)throw Error('batch too large');apply(operations); } };
}
export const writeBatch = () => writer();
export function runTransaction(_, fn) {
  const pending = queue.then(async () => { const tx = writer(); const result = await fn(tx); await tx.commit(); return result; });
  queue = pending.catch(() => {}); return pending;
}
window.__db = { state, emit, replace: (name, values) => { state[name] = structuredClone(values); emit(); }, failListener: name => listeners.filter(l=>l.ref.name===name).forEach(l=>l.error?.(Error('테스트 읽기 실패'))) };
