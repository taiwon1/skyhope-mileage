// Run: node tests/run-browser.cjs (requires playwright and Edge/Chromium).
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const root = path.resolve(__dirname, '..');
const seed = {
  staff: {'test-admin':{role:'admin'},'test-teacher':{role:'teacher'}},
  students: { '가학생': { name:'가학생',gender:'남',grade:'1학년',teacher:'박태원T' }, '나학생': { name:'나학생',gender:'여',grade:'2학년',teacher:'김하늘T' } },
  records: { old:{name:'가학생',date:'2025-12-28',activity:'대표기도',pts:300,createdAt:1}, current:{name:'가학생',date:'2026-09-06',activity:'주일예배 출석',pts:100,createdAt:2} },
  newcomers: { visitor:{name:'새학생',grade:'1학년',gender:'남',guide:'가학생',week1:'2026-08-09',week2:'2026-08-23',week3:null,week4:null,graduated:false,createdAt:1} },
  notices: Object.fromEntries([1,2,3,4].map(i=>['notice'+i,{type:'notice',title:'공지 '+i,content:'내용 '+i,createdAt:i}])), hiddenNewcomers:{}
};
const cases = [];
const test = (name, fn) => cases.push({name,fn});
let page;
async function tab(name) { await page.evaluate(n=>window.app.showTab(n),name); }
async function role(name) {
  if(await page.evaluate(()=>window.authState.isAdmin||window.authState.isTeacher)) await page.evaluate(()=>window.auth.toggleMode());
  if(name !== 'readonly') { await page.evaluate(()=>window.auth.toggleMode()); await page.locator('#admin-pw-input').fill(name==='admin'?'admin-test-fixture':'teacher-test-fixture'); await page.evaluate(()=>window.auth.tryLogin()); }
  await page.waitForTimeout(30);
}
async function fill(values) { await page.evaluate(values=>{for(const [id,v] of Object.entries(values))document.getElementById(id).value=v},values); }
async function state(name) { return page.evaluate(n=>window.__db.state[n]||{},name); }
async function writes() { return page.evaluate(()=>window.__writeCount||0); }
test('기존 test.html 전체',async()=>{const p=await page.context().newPage();await p.goto(base+'/test.html');await p.evaluate(()=>runAll());assert.equal(await p.locator('#s-fail').innerText(),'실패 0');console.log('  '+await p.locator('#s-pass').innerText());await p.close()});
test('초기 기록/학생 로드 및 잘못된 비밀번호',async()=>{assert.equal(await page.locator('#record-tbody tr').count(),2);await page.evaluate(()=>window.auth.toggleMode());await page.locator('#admin-pw-input').fill('wrong');await page.evaluate(()=>window.auth.tryLogin());assert.equal(await page.locator('#login-error').isVisible(),true);assert.equal(await page.evaluate(()=>window.authState.isAdmin),false);await page.evaluate(()=>window.auth.closeModal())});
for(const r of ['readonly','teacher','admin']) {
  test(r+' 모든 탭 조회 및 입력 화면 권한',async()=>{await role(r);for(const t of ['newcomer','record','summary','attend','ranking','students','notice']){await tab(t);assert.equal(await page.locator('#tab-'+t).isVisible(),t==='attend'&&r==='readonly'?false:true);for(const e of await page.locator('#tab-'+t+' .admin-only').all())assert.equal(await e.isVisible(),r==='admin');}await tab('record');assert.equal(await page.locator('.record-input-card').isVisible(),r!=='readonly');await tab('ranking');await page.evaluate(()=>window.profile.open('가학생'));assert.equal(await page.locator('#profile-modal').isVisible(),true);await page.evaluate(()=>window.profile.close())});
  if(r!=='admin') test(r+' 관리자 저장 함수 직접 호출 차단',async()=>{await role(r);const before=await writes();await fill({'edit-student-name':'가학생','edit-gender':'여','edit-grade':'3학년','edit-teacher':'김하늘T','stamp-date-input':'2026-08-30'});await page.evaluate(async()=>{const m=document.getElementById('stamp-modal');m.dataset.id='visitor';m.dataset.week='3';await window.students.saveEdit();await window.newcomer.saveStamp();await window.students.add();await window.students.remove('가학생');await window.newcomer.add();await window.newcomer.remove('visitor');await window.newcomer.confirmGraduate();await window.notice.add();await window.notice.addNewcomer();await window.notice.remove('notice1');await window.records.remove('current');if(!window.authState.isTeacher)await window.records.add()});assert.equal(await writes(),before)});
}
test('등반 카드 로그인/로그아웃 즉시 권한 갱신',async()=>{await role('readonly');await tab('newcomer');assert.equal(await page.locator('.stamp-open').count(),0);await role('admin');assert.equal(await page.locator('.stamp-open').count(),1);await role('readonly');assert.equal(await page.locator('.nc-delete-btn').count(),0)});
test('공지 4개 페이지 이동 및 권한 전환',async()=>{await role('admin');await tab('notice');assert.equal(await page.locator('#notice-list .notice-card').count(),3);await page.locator('#notice-pagination button').filter({hasText:/^2$/}).click();assert.equal(await page.locator('#notice-list .notice-card').count(),1)});
test('연간 초기화: 랭킹·프로필·월별 누적에서 전년도 제외',async()=>{await tab('ranking');await page.evaluate(()=>window.ranking.setAll());assert.match(await page.locator('#ranking-list').innerText(),/100P/);assert.doesNotMatch(await page.locator('#ranking-list').innerText(),/400P/);await page.evaluate(()=>window.profile.open('가학생'));assert.match(await page.locator('.profile-total').innerText(),/100P/);await page.evaluate(()=>window.profile.close());await tab('summary');await fill({'sel-month':'2026-09'});await page.evaluate(()=>window.summary.render());assert.doesNotMatch(await page.locator('#summary-tbody').innerText(),/400P/)});
test('교사 얼리버드/일반 전체선택 상호 배제',async()=>{await role('teacher');await tab('record');await fill({'in-activity':'주일예배 출석'});await page.evaluate(()=>{window.records.onActivityChange();window.records.toggleAttendGroup('early',true);window.records.toggleAttendGroup('normal',true)});assert.equal(await page.locator('input[name="cb-early"]:checked').count(),0)});
test('교사·관리자 일반/얼리버드 출석은 월~토 수동 날짜 입력 차단',async()=>{
  for(const permission of ['teacher','admin']) {
    await role(permission);await tab('record');
    await fill({'in-activity':'주일예배 출석'});
    await page.evaluate(()=>window.records.onActivityChange());
    for(const group of ['normal','early']) {
      await page.evaluate(g=>window.records.toggleAttendGroup(g,true),group);
      const before=await writes();
      for(const date of ['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12']) {
        await fill({'in-date':date});await page.evaluate(()=>window.records.add());
        assert.equal(await writes(),before);
        assert.match(await page.locator('#alert-record').innerText(),/일요일 날짜/);
      }
    }
  }
});

test('교사 출석 저장 및 재등록 중복 방지',async()=>{await role('teacher');await tab('record');await fill({'in-date':'2026-09-13','in-activity':'주일예배 출석'});await page.evaluate(()=>{window.records.onActivityChange();window.records.toggleAttendGroup('normal',true)});await page.evaluate(()=>Promise.all([window.records.add(),window.records.add()]));let rec=Object.values(await state('records')).filter(r=>r.date==='2026-09-13');assert.equal(rec.length,2);assert.equal(rec.reduce((s,r)=>s+r.pts,0),200);await page.evaluate(()=>{window.records.toggleAttendGroup('normal',true)});await page.evaluate(()=>window.records.add());assert.equal(Object.values(await state('records')).filter(r=>r.date==='2026-09-13').length,2)});
test('출석 실패는 전체 롤백, 재시도 성공',async()=>{await role('teacher');await tab('record');await fill({'in-date':'2026-08-30','in-activity':'주일예배 출석'});await page.evaluate(()=>{window.records.onActivityChange();window.records.toggleAttendGroup('normal',true);window.__failNextWrite=true});const before=await state('records');await page.evaluate(()=>window.records.add());assert.deepEqual(await state('records'),before);await page.evaluate(()=>window.records.add());assert.equal(Object.values(await state('records')).filter(r=>r.date==='2026-08-30').length,2)});
test('기타 활동 정수 검증 및 교사 등록',async()=>{await role('teacher');await tab('record');await fill({'in-date':'2026-09-13','in-activity':'기타 활동','in-etc-name':'봉사, 준비','in-etc-pts':'1.5'});await page.evaluate(()=>{window.records.onActivityChange();window.records.toggleAll(true)});const before=await writes();await page.evaluate(()=>window.records.add());assert.equal(await writes(),before);await fill({'in-etc-pts':'20'});await page.evaluate(()=>window.records.add());assert.equal(Object.values(await state('records')).filter(r=>r.activity==='기타 활동').length,2)});
test('수동 새친구 전도 지급 차단',async()=>{await role('teacher');await tab('record');await page.evaluate(()=>{const s=document.getElementById('in-activity');if(![...s.options].some(o=>o.value==='새친구 전도'))s.add(new Option('새친구 전도','새친구 전도'));s.value='새친구 전도';window.records.onActivityChange()});await fill({'in-newcomer-select':'가학생','in-referrer-select':'나학생'});const before=await writes();await page.evaluate(()=>window.records.add());assert.equal(await writes(),before)});
test('학생 수정, 신규 등록, 중복 등록, 삭제',async()=>{await role('admin');await tab('students');await page.evaluate(()=>window.students.openEditModal('가학생'));await fill({'edit-grade':'3학년'});await page.evaluate(()=>window.students.saveEdit());assert.equal((await state('students'))['가학생'].grade,'3학년');await fill({'in-student':'다학생','in-gender':'남','in-grade':'1학년','in-teacher':'박태원T'});await page.evaluate(()=>window.students.add());assert.ok((await state('students'))['다학생']);await fill({'in-student':'다학생','in-gender':'남','in-grade':'1학년','in-teacher':'박태원T'});const before=await writes();await page.evaluate(()=>window.students.add());assert.equal(await writes(),before);await page.evaluate(()=>window.students.remove('다학생'));assert.equal((await state('students'))['다학생'],undefined)});
test('스탬프 중복 날짜 거부 및 순서 잠금',async()=>{await role('admin');await tab('newcomer');await page.evaluate(()=>window.newcomer.openStampModal('visitor',4));assert.equal(await page.locator('#stamp-modal').isVisible(),false);await page.evaluate(()=>window.newcomer.openStampModal('visitor',3));await fill({'stamp-date-input':'2026-08-23'});await page.evaluate(()=>window.newcomer.saveStamp());assert.equal((await state('newcomers')).visitor.week3,null);await fill({'stamp-date-input':'2026-08-30'});await page.evaluate(()=>window.newcomer.saveStamp());assert.equal((await state('newcomers')).visitor.week3,'2026-08-30');await page.evaluate(()=>window.newcomer.openStampModal('visitor',4));await fill({'stamp-date-input':'2026-09-06'});await page.evaluate(()=>window.newcomer.saveStamp())});
test('등반 실패 롤백·재시도·중복 방지·4주차 출석',async()=>{await role('admin');await tab('newcomer');await page.evaluate(()=>window.newcomer.openGraduateModal('visitor'));await fill({'grad-teacher-select':'박태원T'});await page.evaluate(()=>window.__failNextWrite=true);await page.evaluate(()=>window.newcomer.confirmGraduate());assert.equal((await state('newcomers')).visitor.graduated,false);assert.equal((await state('students'))['새학생'],undefined);await page.evaluate(()=>Promise.all([window.newcomer.confirmGraduate(),window.newcomer.confirmGraduate()]));assert.equal((await state('newcomers')).visitor.graduated,true);let rec=Object.values(await state('records'));assert.equal(rec.filter(r=>r.newcomerName==='새학생'&&r.pts===1000).length,2);assert.equal(rec.filter(r=>r.name==='새학생'&&r.activity==='주일예배 출석'&&r.date==='2026-09-06').length,1);await page.evaluate(()=>window.newcomer.confirmGraduate());assert.equal(Object.values(await state('records')).filter(r=>r.newcomerName==='새학생'&&r.pts===1000).length,2);await tab('notice');assert.equal(await page.locator('#newface-list .newface-card').count(),1)});
test('필터 결과가 없으면 CSV 전체 유출 없음',async()=>{await role('admin');await tab('record');await fill({'rec-filter-month':'2020-01'});await page.evaluate(()=>window.records.applyFilter());const downloads=[];page.on('download',d=>downloads.push(d));await page.evaluate(()=>window.records.exportCSV());await page.waitForTimeout(50);assert.equal(downloads.length,0);await page.evaluate(()=>window.records.resetFilter())});
test('모바일 320/375/390/768, 데스크톱 1024: 탭·월 선택·스탬프',async()=>{await role('teacher');await page.evaluate(()=>window.__db.replace('newcomers',{visitor:{name:'새학생',grade:'1학년',gender:'남',guide:'없음',week1:'2026-08-09',week2:'2026-08-23',graduated:false,createdAt:1}}));for(const width of [320,375,390,768,1024]){await page.setViewportSize({width,height:850});await tab('newcomer');const boxes=await page.locator('.nc-stamps .stamp').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {y:r.y,right:r.right}}));assert.equal(boxes.length,4);assert.equal(new Set(boxes.map(b=>b.y)).size,1);assert.ok(boxes.every(b=>b.right<=width));await tab('attend');await page.evaluate(()=>window.attendance.clickMonth(null));await page.locator('.att-month-button').filter({hasText:/^1월/}).click();assert.equal(await page.locator('.att-month-button').filter({hasText:/^1월/}).getAttribute('aria-pressed'),'true');assert.ok(await page.locator('.att-month-button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)));await page.locator('.att-month-button').filter({hasText:'올해 전체'}).click();assert.equal(await page.locator('.att-month-button').filter({hasText:'올해 전체'}).getAttribute('aria-pressed'),'true');for(const t of ['record','summary','ranking','students','notice']){await tab(t);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),t+' overflow '+width)}}});
let base;
test('각 일반 활동 포인트, 필터, 정산 펼침, 기록 삭제',async()=>{await role('teacher');await tab('record');for(const [activity,pts] of [['금요기도회 참석',50],['주일예배 찬양팀 섬김',50],['주일예배 안내팀 섬김',30],['대표기도',300]]){await fill({'in-date':'2026-09-13','in-activity':activity});await page.evaluate(()=>{window.records.onActivityChange();window.records.toggleAll(true)});await page.evaluate(()=>window.records.add());const rec=Object.values(await state('records')).filter(r=>r.activity===activity&&r.date==='2026-09-13');assert.equal(rec.length,3);assert.ok(rec.every(r=>r.pts===pts))}await fill({'rec-filter-activity':'대표기도','rec-filter-month':'2026-09'});await page.evaluate(()=>window.records.applyFilter());assert.equal(await page.locator('#record-tbody tr').count(),3);await page.evaluate(()=>window.records.resetFilter());await tab('summary');await page.evaluate(()=>window.summary.toggleRow('가학생'));assert.equal(await page.locator('.sum-detail-row').count(),1);await role('admin');const before=Object.keys(await state('records')).length;await page.evaluate(()=>window.records.remove('current'));assert.equal(Object.keys(await state('records')).length,before-1)});
test('공지 작성·문자열 안전 표시·삭제·빈 페이지',async()=>{await role('admin');await tab('notice');await fill({'notice-title':'<b>공지</b>','notice-content':'<img src=x onerror="window.injected=true">\n둘째 줄'});await page.evaluate(()=>window.notice.add());await page.evaluate(()=>window.notice.goPage('notice',1));assert.equal(await page.locator('#notice-list img').count(),0);assert.ok((await page.locator('#notice-list').innerText()).includes('<img'));const notices=await state('notices');const id=Object.keys(notices).find(k=>notices[k].title==='<b>공지</b>');assert.ok(id);await page.evaluate(id=>window.notice.remove(id),id);assert.equal((await state('notices'))[id],undefined);await page.evaluate(()=>window.__db.replace('notices',{}));assert.equal(await page.locator('#notice-pagination button').count(),0)});
test('환영 게시물 작성·숨김 실패 후 유지·성공 시 활동 유지',async()=>{await role('admin');await tab('notice');await fill({'newcomer-name':'환영학생','newcomer-date':'2026-09-13'});await page.evaluate(()=>window.notice.addNewcomer());assert.equal(await page.locator('#newface-list .newface-card').count(),1);await page.evaluate(()=>{window.__db.state.records.welcome={name:'환영친구',newcomerName:'환영친구',isNewcomer:true,activity:'새친구 전도',date:'2026-09-13',pts:1000,createdAt:1};window.__db.state.records.guide={name:'가학생',newcomerName:'환영친구',isNewcomer:false,activity:'새친구 전도',date:'2026-09-13',pts:1000,createdAt:1};window.__db.emit()});assert.equal(await page.locator('#newface-list .newface-card').count(),2);await page.evaluate(()=>window.__failNextWrite=true);await page.evaluate(()=>window.notice.remove('welcome','record'));assert.equal(await page.locator('#newface-list .newface-card').count(),2);await page.evaluate(()=>window.notice.remove('welcome','record'));assert.equal(await page.locator('#newface-list .newface-card').count(),1);assert.ok((await state('records')).welcome)});
test('새친구 신규·중복·삭제 및 인도자 없는 등반',async()=>{await role('admin');await tab('newcomer');await fill({'nc-name':'혼자학생','nc-grade':'1학년','nc-gender':'여','nc-guide':'없음','nc-week1':'2026-08-09'});await page.evaluate(()=>Promise.all([window.newcomer.add(),window.newcomer.add()]));assert.equal(Object.values(await state('newcomers')).filter(n=>n.name==='혼자학생').length,1);const nc=await state('newcomers');const id=Object.keys(nc).find(k=>nc[k].name==='혼자학생');await page.evaluate(id=>{Object.assign(window.__db.state.newcomers[id],{week2:'2026-08-16',week3:'2026-08-23',week4:'2026-08-30'});window.__db.emit();window.newcomer.openGraduateModal(id)},id);await fill({'grad-teacher-select':'박태원T'});await page.evaluate(()=>window.newcomer.confirmGraduate());const rewards=Object.values(await state('records')).filter(r=>r.newcomerName==='혼자학생');assert.equal(rewards.length,1);assert.equal(rewards[0].pts,1000);await page.evaluate(()=>window.newcomer.remove('visitor'));assert.equal((await state('newcomers')).visitor,undefined)});
test('등반 전 출석 적립 거부',async()=>{await role('teacher');await tab('record');await fill({'in-date':'2026-08-23','in-activity':'주일예배 출석'});await page.evaluate(()=>{window.records.onActivityChange();document.querySelector('input[name="cb-normal"][value="혼자학생"]').checked=true});const before=await state('records');await page.evaluate(()=>window.records.add());assert.deepEqual(await state('records'),before)});
test('기존 중복·미래·평일 출석이 출석률을 부풀리지 않음',async()=>{await page.evaluate(()=>{window.__db.replace('students',{'가학생':{name:'가학생',grade:'1학년',teacher:'박태원T'}});window.__db.replace('records',{a:{name:'가학생',activity:'주일예배 출석',date:'2026-09-06',pts:100,createdAt:1},b:{name:'가학생',activity:'주일예배 출석',date:'2026-09-06',pts:100,createdAt:2},c:{name:'가학생',activity:'주일예배 출석',date:'2026-09-20',pts:100,createdAt:3},d:{name:'가학생',activity:'주일예배 출석',date:'2026-09-07',pts:100,createdAt:4}})});await tab('attend');await page.evaluate(()=>{window.attendance.clickMonth(null);window.attendance.clickMonth('2026-09')});assert.match(await page.locator('.att-big-count').innerText(),/50\.0/);await page.evaluate(()=>window.attendance.openModal('all','전체'));assert.match(await page.locator('#att-modal-body').innerText(),/1\/2주/);await page.evaluate(()=>window.attendance.closeModal())});
test('DB 읽기 실패 시 빈 화면 대신 오류 표시',async()=>{await page.evaluate(()=>window.__db.failListener('students'));assert.equal(await page.locator('#connection-error').isVisible(),true);assert.match(await page.locator('#connection-error').innerText(),/학생/) });
test('공지 연속 탭 중복 방지',async()=>{await role('admin');await fill({'notice-title':'연속 등록','notice-content':'한 번만 저장'});await page.evaluate(()=>Promise.all([window.notice.add(),window.notice.add()]));assert.equal(Object.values(await state('notices')).filter(n=>n.title==='연속 등록').length,1)});
test('학생 501개 활동 일괄 삭제 및 실패 재시도',async()=>{await role('admin');await page.evaluate(()=>{window.__db.state.students['많은학생']={name:'많은학생',gender:'남',grade:'1학년',teacher:'박태원T'};for(let i=0;i<501;i++)window.__db.state.records['bulk-'+i]={name:'많은학생',date:'2026-09-06',activity:'기타 활동',etcName:String(i),pts:1,createdAt:i};window.__db.emit();window.__failNextWrite=true});await page.evaluate(()=>window.students.remove('많은학생'));assert.ok((await state('students'))['많은학생']);assert.equal(Object.values(await state('records')).filter(r=>r.name==='많은학생').length,501);await page.evaluate(()=>window.students.remove('많은학생'));assert.equal((await state('students'))['많은학생'],undefined);assert.equal(Object.values(await state('records')).filter(r=>r.name==='많은학생').length,0)});
test('CSV 쉼표·따옴표·수식 문자열 처리',async()=>{await role('admin');await page.evaluate(()=>{window.__db.state.records.csv={name:'가학생',date:'2026-09-13',activity:'기타 활동',etcName:'=HYPERLINK("x"),내용',pts:20,createdAt:99};window.__db.emit()});await page.evaluate(()=>window.records.resetFilter());const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>window.records.exportCSV());const download=await downloadPromise;const file=await download.path();const csv=fs.readFileSync(file,'utf8');assert.ok(csv.includes('"\'=HYPERLINK(""x""),내용"'))});
test('해외 기기 시간대에서도 KST 연초 날짜와 올해 집계',async()=>{const context=await page.context().browser().newContext({timezoneId:'America/Los_Angeles'});try{await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());const p=await context.newPage();await p.clock.install({time:new Date('2025-12-31T15:05:00Z')});await p.goto(base+'/test.html');const result=await p.evaluate(async()=>{const u=await import('/scripts/utils.js?v=20260917-1');return {today:u.toLocalDate(),year:u.kstToday().getFullYear(),month:u.kstToday().getMonth(),future:u.validDate('2026-01-02'),invalid:u.validDate('2026-02-30')}});assert.deepEqual(result,{today:'2026-01-01',year:2026,month:0,future:false,invalid:false})}finally{await context.close()}});

test('월별 그래프·상단 카드 평균 일치 및 중복·평일·미래 제외', async()=>{
  const original = await state('records');
  const originalStudents = await state('students');
  try {
    await page.evaluate(s=>window.__db.replace('students',s),seed.students);
    await page.evaluate(()=>window.__db.replace('records',{
      a:{name:'가학생',date:'2026-09-06',activity:'주일예배 출석',pts:100},
      b:{name:'나학생',date:'2026-09-06',activity:'주일예배 출석',pts:150,earlybird:true},
      duplicate:{name:'가학생',date:'2026-09-06',activity:'주일예배 출석',pts:150,earlybird:true},
      weekday:{name:'가학생',date:'2026-09-07',activity:'주일예배 출석',pts:100},
      future:{name:'가학생',date:'2026-09-20',activity:'주일예배 출석',pts:100},
      other:{name:'가학생',date:'2026-09-13',activity:'대표기도',pts:300},
    }));
    await tab('attend');
    const month=page.locator('.att-month-button').filter({hasText:/^9월/});
    assert.match(await month.innerText(),/1\.0명/);
    if(await month.getAttribute('aria-pressed')!=='true') await month.click();
    assert.match(await page.locator('.att-big-nums').innerText(),/1\.0명/);
    assert.match(await page.locator('#att-chart').innerText(),/주일당 평균/);
    const july=page.locator('.att-month-button').filter({hasText:/^7월/});
    assert.match(await july.innerText(),/0\.0명/);
    await july.click();
    assert.match(await page.locator('.att-big-nums').innerText(),/0\.0명/);
  } finally {await page.evaluate(r=>window.__db.replace('records',r),original);await page.evaluate(s=>window.__db.replace('students',s),originalStudents);}
});

test('학생 출석 현황 접근 차단 및 로그아웃 즉시 숨김',async()=>{
  await role('readonly');await tab('record');await tab('attend');
  assert.equal(await page.locator('#tab-attend').isVisible(),false);
  assert.equal(await page.locator('nav.top-nav .staff-only').isVisible(),false);
  await page.evaluate(()=>window.attendance.openModal('all','전체'));
  assert.equal(await page.locator('#att-modal').isVisible(),false);
  for(const permission of ['teacher','admin']) {
    await role(permission);await tab('attend');assert.equal(await page.locator('#tab-attend').isVisible(),true);
    await page.evaluate(()=>window.attendance.openModal('all','전체'));
    await role('readonly');assert.equal(await page.locator('#tab-attend').isVisible(),false);
    assert.equal(await page.locator('#att-modal').isVisible(),false);
    assert.equal(await page.locator('#tab-record').isVisible(),true);
  }
});
test('기기별 로그인 유지·새 탭 복원·로그아웃 동기화',async()=>{
  for(const permission of ['teacher','admin']) {
    await role('readonly');await page.evaluate(()=>document.getElementById('remember-login').checked=true);
    await role(permission);
    assert.ok(await page.evaluate(()=>localStorage.getItem('skyhope.staff-session.v1')));
    const other=await page.context().newPage();
    await other.goto(base+'/index.html');
    await other.waitForFunction(p=>window.authState?.[p],permission==='admin'?'isAdmin':'isTeacher');
    await other.reload();await other.waitForFunction(p=>window.authState?.[p],permission==='admin'?'isAdmin':'isTeacher');
    await role('readonly');
    await other.waitForFunction(()=>!window.authState.isAdmin&&!window.authState.isTeacher);
    await other.close();
    assert.equal(await page.evaluate(()=>localStorage.getItem('skyhope.staff-session.v1')),null);
  }
});
test('로그인 유지 미선택은 현재 탭에서만 복원',async()=>{
  await role('readonly');await page.evaluate(()=>document.getElementById('remember-login').checked=false);await role('teacher');
  assert.equal(await page.evaluate(()=>localStorage.getItem('skyhope.staff-session.v1')),null);
  assert.ok(await page.evaluate(()=>sessionStorage.getItem('skyhope.staff-session.v1')));
  const other=await page.context().newPage();await other.goto(base+'/index.html');
  await other.waitForFunction(()=>window.authState);assert.equal(await other.evaluate(()=>window.authState.isTeacher),false);await other.close();
  await role('readonly');
});

test('구형 새친구 자동 환영 복구: 인도자 제외·소급 출석 보완·명시 기록 우선',async()=>{
  const original=await state('records'), notices=await state('notices');
  try {
    await page.evaluate(()=>{
      window.__db.replace('notices',{});
      window.__db.replace('records',{
        newcomer:{name:'예전새친구',activity:'새친구 전도',date:'2026-06-14',pts:1000,createdAt:100},
        backfill:{name:'예전새친구',activity:'주일예배 출석',date:'2026-06-07',pts:100,createdAt:200},
        guide:{name:'기존인도자',activity:'새친구 전도',date:'2026-06-14',pts:1000,createdAt:100},
        prior:{name:'기존인도자',activity:'주일예배 출석',date:'2026-06-07',pts:100,createdAt:50},
        explicit:{name:'명시새친구',activity:'새친구 전도',date:'2026-06-14',pts:1000,createdAt:100,isNewcomer:true},
        falseFlag:{name:'인도자표시',activity:'새친구 전도',date:'2026-06-14',pts:1000,createdAt:100,isNewcomer:false}
      });
    });await tab('notice');
    assert.equal(await page.locator('#newface-list .newface-card').count(),2);
    assert.match(await page.locator('#newface-list').innerText(),/예전새친구/);
    assert.doesNotMatch(await page.locator('#newface-list').innerText(),/기존인도자|인도자표시/);
    await page.evaluate(()=>window.__db.replace('notices',{welcome:{type:'newface',newcomerName:'예전새친구',recordDate:'2026-06-14',createdAt:100}}));
    assert.equal(await page.locator('#newface-list .newface-card').count(),2);
  } finally {await page.evaluate(r=>window.__db.replace('records',r),original);await page.evaluate(n=>window.__db.replace('notices',n),notices);}
});

(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');let body=fs.readFileSync(file);if(file.endsWith(path.join('scripts','auth.js'))){let i=0;body=body.toString().replace(/"[a-f0-9]{64}"/g,()=>JSON.stringify(require('node:crypto').createHash('sha256').update(['admin-test-fixture','teacher-test-fixture'][i++]).digest('hex')))}res.end(body)}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 let browser;let failed=0;const errors=[];
 try {
  browser=await playwright.chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
  const context=await browser.newContext({timezoneId:'Asia/Seoul'});
  context.setDefaultTimeout(5000);
  await context.route('**/*',async route=>{const url=route.request().url();if(url.startsWith(base))return route.continue();if(url.includes('firebase-firestore.js'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'firestore-mock.js'),'utf8')});if(url.includes('firebase-auth.js'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'auth-mock.js'),'utf8')});if(url.includes('firebase-app.js'))return route.fulfill({contentType:'application/javascript',body:'export const initializeApp=()=>({});'});return route.abort()});
  await context.addInitScript(s=>{window.__seed=s;window.__writeCount=0},seed);
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.clock.install({time:new Date('2026-09-14T03:00:00Z')});
  await page.goto(base+'/index.html');await page.waitForFunction(()=>window.__db&&window.records?.recordList.length===2);await page.waitForTimeout(1400);
  for(const c of cases){try{await c.fn();console.log('PASS '+c.name)}catch(e){failed++;console.log('FAIL '+c.name+'\n  '+e.message)}finally{await page.evaluate(()=>document.querySelectorAll('#stamp-modal,#grad-modal,#edit-modal,#profile-modal,#login-modal,#att-modal').forEach(e=>e.classList.remove('show')))}}
  if(errors.length){failed++;console.log('PAGE ERRORS '+JSON.stringify(errors))}
  if(process.env.TEST_ARTIFACT_DIR){fs.mkdirSync(process.env.TEST_ARTIFACT_DIR,{recursive:true});const p=await context.newPage();await p.clock.install({time:new Date('2026-09-14T03:00:00Z')});await p.goto(base+'/index.html');await p.waitForTimeout(1500);await p.setViewportSize({width:390,height:850});for(const t of ['newcomer','attend']){await p.evaluate(t=>window.app.showTab(t),t);await p.screenshot({path:path.join(process.env.TEST_ARTIFACT_DIR,t+'-verified.png'),fullPage:true})}await p.close()}
  console.log(JSON.stringify({cases:cases.length,passed:cases.length-failed,failed,pageErrors:errors.length}));
 } finally {await browser?.close();await new Promise(r=>server.close(r));}
 process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
