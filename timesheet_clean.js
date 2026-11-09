<script>
/* ---------------- State ---------------- */
try{ if(window.parent!==window) document.documentElement.classList.add('embedded'); }catch(e){ document.documentElement.classList.add('embedded'); }
const state = {
  name:'',
  startDate:'',
  endDate:'',             // last day to log; only used when periodMode==='custom'
  periodMode:'twoWeeks',  // 'twoWeeks' = start + 14 days, 'custom' = start..endDate
  workedWeekends:false,
  wageLevel:'M',
  weekAsked:{},   // weeks where the 'reuse job # for the rest of the week?' prompt was already shown
  days:[],
  receipts:[]   // {name, dataUrl, w, h, bytes} — photos of expense receipts
};
const WAGE_LEVELS = [
  {v:'H',label:'H — Helper'},
  {v:'M',label:'M — Mechanic'},
  {v:'MIC',label:'MIC — Mechanic in Charge'},
  {v:'ADJ',label:'ADJ — Adjuster'},
  {v:'TM',label:'TM — Temporary Mechanic'},
  {v:'TA',label:'TA — Temporary Adjuster'}
];
let steps = ['name','payperiod','wage'];
let stepIndex = 0;
let editReturn = false; // true when we jumped into a day from the summary

const DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtDate(d){
  return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function fmtShort(d){
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

function toISODate(d){
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function periodStart(){
  return state.startDate ? new Date(state.startDate+'T00:00:00') : null;
}
/* Last day of the pay period. The 2-week window always frames the timesheet;
   in custom mode it stops at the chosen finish date and the rest stays blank. */
function periodEnd(){
  const start = periodStart();
  if(!start) return null;
  const full = new Date(start); full.setDate(start.getDate()+13);
  if(state.periodMode==='custom' && state.endDate){
    const e = new Date(state.endDate+'T00:00:00');
    if(isNaN(e.getTime())) return full;
    if(e.getTime() < start.getTime()) return start;
    return e.getTime() > full.getTime() ? full : e;
  }
  return full;
}
function currentPeriodMode(){
  const btns = document.querySelectorAll('#periodSeg .seg-btn');
  for(let i=0;i<btns.length;i++){
    if(btns[i].classList.contains('active')) return btns[i].getAttribute('data-mode');
  }
  return state.periodMode;
}
/* Pay-period dates as printed on the PDF and shown on the review screen */
function periodRangeText(){
  if(state.days.length){
    return `${fmtShort(state.days[0].date)} - ${fmtShort(state.days[state.days.length-1].date)}`;
  }
  const s = periodStart(), e = periodEnd();
  return (s && e) ? `${fmtShort(s)} - ${fmtShort(e)}` : '';
}

function buildDays(){
  const start = periodStart();
  const end = periodEnd();
  if(!start || !end) { state.days = []; return; }
  // keep anything already entered for matching dates (so going Back doesn't wipe data)
  const prev = {};
  (state.days||[]).forEach(d=>{ prev[d.date.toDateString()] = d; });
  const days = [];
  for(let i=0;i<14;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    // custom range: stop at the finish date — the remaining days of the
    // two weeks are simply never offered, so they print blank
    if(d.getTime() > end.getTime()) break;
    const dow = d.getDay();
    const isWeekend = dow===0||dow===6;
    if(isWeekend && !state.workedWeekends) continue;
    const old = prev[d.toDateString()] || {};
    days.push({
      date:d,
      dayName:DOW_NAMES[dow],
      week: i<7?1:2,
      jobAddress:old.jobAddress||'', desc:old.desc||'', rt:old.rt||'', ot:old.ot||'',
      travel:old.travel||'', mileage:old.mileage||'', expenses:old.expenses||'', notes:old.notes||''
    });
  }
  state.days = days;
}

/* Dry run of buildDays() so we can warn about an empty range before moving on */
function countLoggableDays(startDate, endDate, workedWeekends){
  if(!startDate) return 0;
  const start = new Date(startDate+'T00:00:00');
  let end = new Date(start); end.setDate(start.getDate()+13);
  if(endDate){
    const e = new Date(endDate+'T00:00:00');
    if(!isNaN(e.getTime())){
      if(e.getTime() < start.getTime()) end = start;
      else if(e.getTime() < end.getTime()) end = e;
    }
  }
  let n = 0;
  for(let i=0;i<14;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    if(d.getTime() > end.getTime()) break;
    const dow = d.getDay();
    if((dow===0||dow===6) && !workedWeekends) continue;
    n++;
  }
  return n;
}

function rebuildSteps(){
  steps = ['name','payperiod','wage'];
  state.days.forEach((d,i)=>steps.push('day:'+i));
  steps.push('summary');
}

/* ---------------- Nav ---------------- */
function goNext(){
  const cur = steps[stepIndex];
  if(!validateStep(cur)) return;
  saveStep(cur);
  if(cur.startsWith('day:')){
    dayGate(parseInt(cur.split(':')[1],10), ()=>advance(cur));
    return;
  }
  advance(cur);
}
function advance(cur){

  if(cur.startsWith('day:') && editReturn){
    editReturn = false;
    stepIndex = steps.indexOf('summary');
    render();
    return;
  }
  if(cur==='payperiod'){
    buildDays();
    rebuildSteps();
    stepIndex = steps.indexOf('wage');
    render();
    return;
  }
  if(stepIndex < steps.length-1){
    stepIndex++;
    render();
  }
}
function goBack(){
  window.__dir=-1;
  if(editReturn){
    editReturn = false;
    stepIndex = steps.indexOf('summary');
    render();
    return;
  }
  if(stepIndex>0){
    stepIndex--;
    render();
  }
}
function editDay(i){
  editReturn = true;
  stepIndex = steps.indexOf('day:'+i);
  render();
}

/* ---------------- Validation / Save ---------------- */
function validateStep(step){
  if(step==='name'){
    const v = document.getElementById('inpName').value.trim();
    if(!v){ flash('inpName'); return false; }
  }
  if(step==='payperiod'){
    syncPayPeriodInputs();
    setPayError('');
    if(!state.startDate){
      flash('inpStart');
      setPayError('Pick the first day of your pay period.');
      return false;
    }
    if(state.periodMode==='custom'){
      if(!state.endDate){
        flash('inpEnd');
        setPayError('Pick the last day you worked.');
        return false;
      }
      const s = periodStart();
      const e = new Date(state.endDate+'T00:00:00');
      const full = new Date(s); full.setDate(s.getDate()+13);
      if(e.getTime() < s.getTime()){
        flash('inpEnd');
        setPayError('The finish date can\u2019t be before the start date.');
        return false;
      }
      if(e.getTime() > full.getTime()){
        flash('inpEnd');
        setPayError('A pay period is two weeks \u2014 pick a finish date within 14 days of the start.');
        return false;
      }
    }
    if(countLoggableDays(state.startDate, state.periodMode==='custom'?state.endDate:'', state.workedWeekends) === 0){
      setPayError('No days to log in that range. Turn on \u201cWorked the weekend?\u201d or pick a wider range.');
      return false;
    }
  }
  return true;
}
function setPayError(msg){
  const el = document.getElementById('payError');
  if(!el) return;
  el.textContent = msg||'';
  el.style.display = msg ? 'block' : 'none';
}
/* Pull the pay-period controls into state (called on every change + on Next) */
function syncPayPeriodInputs(){
  const s = document.getElementById('inpStart');
  const e = document.getElementById('inpEnd');
  const w = document.getElementById('inpWeekend');
  if(s) state.startDate = s.value;
  state.periodMode = currentPeriodMode();
  if(e) state.endDate = e.value;
  if(w) state.workedWeekends = w.checked;
}
function flash(id){
  const el = document.getElementById(id);
  el.style.borderColor = 'var(--danger)';
  const fc = el.closest('.field'); if(fc){ fc.classList.remove('shake'); void fc.offsetWidth; fc.classList.add('shake'); }
  setTimeout(()=>{ el.style.borderColor=''; if(fc) fc.classList.remove('shake'); },900);
}
function saveStep(step){
  if(step==='name'){ state.name = document.getElementById('inpName').value.trim(); window.__editName=false; try{parent.postMessage({rem:'ts-name',name:state.name},'*')}catch(e){} }
  if(step==='payperiod'){
    syncPayPeriodInputs();
  }
  if(step==='wage') state.wageLevel = document.getElementById('inpWage').value;
  if(step.startsWith('day:')){
    const i = parseInt(step.split(':')[1]);
    const d = state.days[i];
    d.jobAddress = cleanJob(document.getElementById('inpJob').value);
    d.desc = document.getElementById('inpDesc').value.replace(/\s+$/,'');
    d.rt = document.getElementById('inpRT').value.trim();
    d.ot = document.getElementById('inpOT').value.trim();
    d.travel = document.getElementById('inpTravel').value.trim();
    d.mileage = document.getElementById('inpMileage').value.trim();
    d.expenses = document.getElementById('inpExpenses').value.trim();
    d.notes = document.getElementById('inpNotes').value.trim();
    const ws = document.getElementById('inpDayWage');
    if(ws) d.wage = (ws.value===state.wageLevel) ? '' : ws.value;
  }
}

/* ---------------- Rendering ---------------- */
function updateShaft(){
  const pct = Math.round(((stepIndex+1)/steps.length)*100);
  document.getElementById('shaftFill').style.width = pct+'%';
  document.getElementById('floorPct').textContent = pct+'%';
  const cur = steps[stepIndex];
  let label = 'Setting up';
  if(cur==='name') label='Floor 1 · Your name';
  else if(cur==='payperiod') label='Floor 2 · Pay period';
  else if(cur==='wage') label='Floor 3 · Wage level';
  else if(cur.startsWith('day:')){
    const i = parseInt(cur.split(':')[1]);
    const d = state.days[i];
    label = `Week ${d.week} · ${d.dayName} ${fmtShort(d.date)}`;
  } else if(cur==='summary') label='Top floor · Review';
  document.getElementById('floorText').textContent = label;
}

function render(){
  updateShaft();
  const step = steps[stepIndex];
  const main = document.getElementById('main');
  const footer = document.getElementById('footer');
  main.classList.remove('fwd','back'); void main.offsetWidth; main.classList.add(window.__dir===-1?'back':'fwd'); window.__dir=1;
  main.innerHTML = '';
  footer.innerHTML = '';

  if(step==='name') return renderName(main,footer);
  if(step==='payperiod') return renderPayPeriod(main,footer);
  if(step==='wage') return renderWage(main,footer);
  if(step.startsWith('day:')) return renderDay(main,footer,parseInt(step.split(':')[1]));
  if(step==='summary') return renderSummary(main,footer);
}

function editName(){window.__editName=true;render();}
function renderName(main,footer){
  const known = state.name && !window.__editName;
  main.innerHTML = `
    <div class="step-eyebrow">Step 1 of ${steps.length}</div>
    <h1>${known ? 'Is this you?' : "What's your name?"}</h1>
    <p class="sub">This goes at the top of every page of your timesheet.</p>
    ${known ? `<div class="field"><label>Name</label>
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:13px 14px;font-size:18px;font-weight:600">
        <span>${escHtml(state.name)}</span>
        <button type="button" aria-label="Edit name" onclick="editName()" style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;width:38px;height:38px;color:var(--amber);display:grid;place-items:center;cursor:pointer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
      </div><input type="hidden" id="inpName" value="${escAttr(state.name)}"></div>` : `
    <div class="field">
      <label for="inpName">First and last name</label>
      <input type="text" id="inpName" placeholder="e.g. Alex Chen" value="${escAttr(state.name)}" autocomplete="name">
    </div>`}
  `;
  footer.innerHTML = `<button class="primary" onclick="goNext()">Next</button>`;
  if(!known) document.getElementById('inpName').focus();
}

function renderPayPeriod(main,footer){
  const mode = state.periodMode==='custom' ? 'custom' : 'twoWeeks';
  main.innerHTML = `
    <div class="step-eyebrow">Step 2 of ${steps.length}</div>
    <h1>Pay period</h1>
    <p class="sub">Pick the first day (Week 1, Monday) of your two-week pay period.</p>
    <div class="field">
      <label>Days to log</label>
      <div class="seg" id="periodSeg" role="group" aria-label="Days to log">
        <button type="button" class="seg-btn${mode==='twoWeeks'?' active':''}" data-mode="twoWeeks" aria-pressed="${mode==='twoWeeks'}" onclick="setPeriodMode('twoWeeks')">Full 2 weeks</button>
        <button type="button" class="seg-btn${mode==='custom'?' active':''}" data-mode="custom" aria-pressed="${mode==='custom'}" onclick="setPeriodMode('custom')">Custom</button>
      </div>
      <div class="hint" id="modeHint"></div>
    </div>
    <div class="field">
      <label for="inpStart">Pay period start date</label>
      <input type="date" id="inpStart" value="${escAttr(state.startDate)}">
      <div class="hint" id="rangeHint"></div>
    </div>
    <div class="field" id="customEnd" style="display:${mode==='custom'?'block':'none'}">
      <label for="inpEnd">Finish date <span style="font-weight:400;color:#6b7482">(last day you worked)</span></label>
      <input type="date" id="inpEnd" value="${escAttr(mode==='custom'?state.endDate:'')}">
      <div class="hint">You\u2019ll only fill in the days up to this one \u2014 the rest of the two weeks prints blank.</div>
    </div>
    <div class="hint err" id="payError" style="display:none;margin:-8px 0 18px;"></div>
    <div class="toggle-row">
      <div>
        <div class="t-label">Worked the weekend?</div>
        <div class="t-sub">Toggle on to log Saturday &amp; Sunday too</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="inpWeekend" ${state.workedWeekends?'checked':''} onchange="payPeriodChanged()">
        <div class="track"><div class="knob"></div></div>
      </label>
    </div>
  `;
  footer.innerHTML = `
    <button class="secondary" onclick="goBack()">Back</button>
    <button class="primary" onclick="goNext()">Next</button>
  `;
  document.getElementById('inpStart').addEventListener('change', ()=>{
    state.startDate = document.getElementById('inpStart').value;
    syncEndBounds();
    // keep an already-chosen finish date inside the (new) two-week window
    const endEl = document.getElementById('inpEnd');
    if(endEl && endEl.value && state.startDate){
      if(endEl.value < endEl.min) endEl.value = endEl.min;
      else if(endEl.value > endEl.max) endEl.value = endEl.max;
      state.endDate = endEl.value;
    }
    applyPeriodMode(currentPeriodMode());
    updateRangeHint();
  });
  document.getElementById('inpEnd').addEventListener('change', ()=>{
    state.endDate = document.getElementById('inpEnd').value;
    updateRangeHint();
  });
  syncEndBounds();
  applyPeriodMode(mode);
  updateRangeHint();
}
/* Segmented control tap */
function setPeriodMode(mode){
  state.periodMode = mode;
  setPayError('');
  applyPeriodMode(mode);
  updateRangeHint();
}
function applyPeriodMode(mode){
  const btns = document.querySelectorAll('#periodSeg .seg-btn');
  for(let i=0;i<btns.length;i++){
    const on = btns[i].getAttribute('data-mode')===mode;
    btns[i].classList.toggle('active', on);
    btns[i].setAttribute('aria-pressed', on?'true':'false');
  }
  const wrap = document.getElementById('customEnd');
  if(wrap) wrap.style.display = mode==='custom' ? 'block' : 'none';
  const mh = document.getElementById('modeHint');
  if(mh){
    mh.textContent = mode==='custom'
      ? 'Log just the days you worked \u2014 pick your first and last day.'
      : 'Standard pay period: 14 days from your start date.';
  }
  if(mode==='custom'){
    const endEl = document.getElementById('inpEnd');
    // sensible default: the end of the two weeks, ready to be pulled back
    if(endEl && !endEl.value && state.startDate){
      const s = new Date(state.startDate+'T00:00:00');
      const e = new Date(s); e.setDate(s.getDate()+13);
      endEl.value = toISODate(e);
      state.endDate = endEl.value;
    }
    syncEndBounds();
  }
}
/* Keep the finish date picker inside the two-week pay period */
function syncEndBounds(){
  const endEl = document.getElementById('inpEnd');
  if(!endEl) return;
  if(state.startDate){
    const s = new Date(state.startDate+'T00:00:00');
    const e = new Date(s); e.setDate(s.getDate()+13);
    endEl.min = toISODate(s);
    endEl.max = toISODate(e);
  }else{
    endEl.removeAttribute('min');
    endEl.removeAttribute('max');
  }
}
function payPeriodChanged(){
  syncPayPeriodInputs();
  setPayError('');
  updateRangeHint();
}
function updateRangeHint(){
  const startEl = document.getElementById('inpStart');
  const hint = document.getElementById('rangeHint');
  if(!startEl || !hint) return;
  const v = startEl.value;
  if(!v){ hint.textContent=''; return; }
  const start = new Date(v+'T00:00:00');
  if(currentPeriodMode()==='custom'){
    const endEl = document.getElementById('inpEnd');
    const ev = endEl ? endEl.value : '';
    if(!ev){ hint.textContent = 'Now pick the last day you worked.'; return; }
    const end = new Date(ev+'T00:00:00');
    const n = Math.round((end.getTime()-start.getTime())/86400000)+1;
    if(n < 1){ hint.textContent = 'Finish date is before the start date.'; return; }
    if(n > 14){ hint.textContent = 'That\u2019s more than two weeks \u2014 a pay period ends '+fmtShort(new Date(start.getFullYear(),start.getMonth(),start.getDate()+13))+'.'; return; }
    const loggable = countLoggableDays(v, ev, state.workedWeekends);
    hint.textContent = `Covers ${fmtShort(start)} \u2013 ${fmtShort(end)} \u00b7 ${loggable} day${loggable===1?'':'s'} to fill in`;
  }else{
    const end = new Date(start); end.setDate(start.getDate()+13);
    hint.textContent = `Covers ${fmtShort(start)} \u2013 ${fmtShort(end)} (2 weeks)`;
  }
}

function renderWage(main,footer){
  main.innerHTML = `
    <div class="step-eyebrow">Step 3 of ${steps.length}</div>
    <h1>Wage level</h1>
    <p class="sub">This sets every day of the pay period. You can change a single day (or several) on each day\u2019s screen.</p>
    <div class="field">
      <label for="inpWage">Wage level</label>
      <select id="inpWage">
        ${WAGE_LEVELS.map(w=>`<option value="${w.v}" ${w.v===state.wageLevel?'selected':''}>${w.label}</option>`).join('')}
      </select>
    </div>
  `;
  footer.innerHTML = `
    <button class="secondary" onclick="goBack()">Back</button>
    <button class="primary" onclick="goNext()">Next</button>
  `;
}

function renderDay(main,footer,i){
  const d = state.days[i];
  const dayNumInWeek = state.days.filter((x,idx)=>idx<=i && x.week===d.week).length;
  main.innerHTML = `
    <div class="day-badge"><span class="dot">${dayNumInWeek}</span> Week ${d.week} — ${d.dayName}, ${fmtShort(d.date)}</div>
    <h1>${d.dayName}</h1>
    <p class="sub">Blank regular time = 8 hrs (enter 0 if you didn't work). Blank address / description = same as the last day you filled in.</p>
    <div class="field">
      <label for="inpJob">Job #</label>
      <input type="text" id="inpJob" placeholder="e.g. H-4521" value="${escAttr(d.jobAddress || 'H-')}">
      <div class="hint">Just add the number after H-. After your first day you\u2019ll be asked if you want it for the rest of the week.</div>
    </div>
    <div class="field">
      <label for="inpDesc">Address / description</label>
      <textarea id="inpDesc" rows="3" placeholder="Where you were &amp; what you did — one line per entry, e.g.&#10;120 King St — replaced door rollers&#10;88 Main St — call-back, adjust leveling">${escHtml(d.desc)}</textarea>
      <div class="hint">Fills the right-hand “Address / Description” column (up to 5 lines print). Leave blank to repeat the previous day's.</div>
    </div>
    <div class="field">
      <label for="inpDayWage">Wage level for this day</label>
      <select id="inpDayWage">
        ${WAGE_LEVELS.map(w=>`<option value="${w.v}" ${w.v===wageOf(d)?'selected':''}>${w.label}</option>`).join('')}
      </select>
      <div class="hint">Starts as your pay-period choice (${escHtml(state.wageLevel)}). <a href="#" class="gl-link" id="wageMore">Apply to other days…</a></div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="inpRT">Regular time (hrs)</label>
        <input type="number" step="0.25" inputmode="decimal" id="inpRT" placeholder="8 (auto if blank)" value="${escAttr(d.rt)}">
      </div>
      <div class="field">
        <label for="inpOT">Overtime 1.5 (hrs)</label>
        <input type="number" step="0.25" inputmode="decimal" id="inpOT" placeholder="0.0" value="${escAttr(d.ot)}">
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="inpTravel">Travel time (hrs)</label>
        <input type="number" step="0.25" inputmode="decimal" id="inpTravel" placeholder="0.0" value="${escAttr(d.travel)}">
      </div>
      <div class="field">
        <label for="inpMileage">Mileage</label>
        <input type="number" step="1" inputmode="decimal" id="inpMileage" placeholder="0" value="${escAttr(d.mileage)}">
      </div>
    </div>
    <div class="field">
      <label for="inpExpenses">Expenses ($)</label>
      <input type="number" step="0.01" inputmode="decimal" id="inpExpenses" placeholder="0.00" value="${escAttr(d.expenses)}">
    </div>
    <div class="field">
      <label for="inpNotes">Notes for this day</label>
      <input type="text" id="inpNotes" placeholder="e.g. waiting on parts, rain delay" value="${escAttr(d.notes)}">
      <div class="hint">Prints in this day's NOTES row on the timesheet.</div>
    </div>
  `;
  footer.innerHTML = `
    <button class="secondary" onclick="goBack()">Back</button>
    <button class="primary" onclick="goNext()">${editReturn ? 'Save' : 'Next'}</button>
  `;
  // Live auto-save: every keystroke goes straight into state, so nothing is
  // lost even if a button tap misfires with the iOS keyboard open.
  [['inpJob','jobAddress'],['inpDesc','desc'],['inpRT','rt'],['inpOT','ot'],
   ['inpTravel','travel'],['inpMileage','mileage'],['inpExpenses','expenses'],['inpNotes','notes']].forEach(([id,key])=>{
    const el = document.getElementById(id);
    el.addEventListener('input', ()=>{ d[key] = el.value; });
  });
  const wsel = document.getElementById('inpDayWage');
  wsel.addEventListener('change', ()=>{ d.wage = (wsel.value===state.wageLevel) ? '' : wsel.value; });
  document.getElementById('wageMore').addEventListener('click', e=>{ e.preventDefault(); wageMoreSheet(i, wsel.value); });
}

function renderSummary(main,footer){
  const totals = computeTotals();
  const isCustom = state.periodMode==='custom';
  main.innerHTML = `
    <div class="step-eyebrow">Review</div>
    <h1>${isCustom ? 'Your days, ready to go' : 'Two weeks, ready to go'}</h1>
    <p class="sub">${escHtml(state.name)} · ${periodRangeText()} · Wage ${state.wageLevel}</p>
    ${isCustom ? `<div class="day-badge" style="margin:-6px 0 20px;"><span class="dot">${state.days.length}</span> Custom range · the other days of the two weeks print blank</div>` : ''}

    <div class="totals-card">
      <div class="t-row"><span>Regular hours</span><span>${totals.rt.toFixed(2)}</span></div>
      <div class="t-row"><span>Overtime hours</span><span>${totals.ot.toFixed(2)}</span></div>
      <div class="t-row"><span>Travel time</span><span>${totals.travel.toFixed(2)}</span></div>
      <div class="t-row"><span>Mileage</span><span>${totals.mileage}</span></div>
      <div class="t-row"><span>Expenses</span><span>$${totals.expenses.toFixed(2)}</span></div>
      <div class="t-row"><span>Total pay-period hours</span><span>${(totals.rt+totals.ot).toFixed(2)}</span></div>
    </div>

    ${totals.expenses > 0 ? receiptCardHtml() : ''}

    <ul class="summary-list">
      ${state.days.map((d,i)=>{
        const ed = effectiveDays()[i];
        const ownJob = cleanJob(d.jobAddress);
        let jobHtml;
        if(ownJob) jobHtml = escHtml(ownJob);
        else if(ed.jobAddress) jobHtml = `<span style="color:var(--paper-dim)">${escHtml(ed.jobAddress)} <em>(same as previous)</em></span>`;
        else jobHtml = '<em style="color:var(--paper-dim)">No job entered</em>';
        return `
        <li>
          <div class="d-info">
            <span class="d-date">Week ${d.week} · ${fmtDate(d.date)}</span>
            ${jobHtml}
            ${d.desc ? `<div style="font-size:11.5px;color:var(--paper-dim);margin-top:2px;">${escHtml(d.desc.split('\n')[0])}${d.desc.includes('\n')?' …':''}</div>` : ''}
            <div class="d-hours">RT ${ed.rt||'0'}${String(d.rt||'').trim()===''&&ed.rt?' (auto)':''} · OT ${d.ot||'0'}${ed.wage!==state.wageLevel?`<span class="wage-chip">${escHtml(ed.wage)}</span>`:''}</div>
          </div>
          <button class="edit-btn" onclick="editDay(${i})">Edit</button>
        </li>
      `;}).join('')}
    </ul>
    <div id="genStatus" class="status-msg"></div>
  `;
  footer.innerHTML = `
    <div class="final-actions" style="width:100%">
      <button class="primary" onclick="finalizeAndGenerate()">Continue → Generate PDF</button>
    </div>
  `;
  countUp();
}
function countUp(){
  document.querySelectorAll('.totals-card .t-row span:last-child').forEach(el=>{
    const raw = el.textContent, m = raw.match(/-?\d+(\.\d+)?/);
    if(!m) return;
    const end = parseFloat(m[0]); if(!isFinite(end) || end===0) return;
    const dec = (m[0].split('.')[1]||'').length, pre = raw.slice(0,m.index), post = raw.slice(m.index+m[0].length);
    const t0 = performance.now(), D = 800;
    const step = t=>{ const k=Math.min(1,(t-t0)/D), e=1-Math.pow(1-k,3);
      el.textContent = pre+(end*e).toFixed(dec)+post;
      if(k<1) requestAnimationFrame(step); else el.textContent = raw; };
    requestAnimationFrame(step);
  });
}

function computeTotals(){
  const t = {rt:0,ot:0,travel:0,mileage:0,expenses:0};
  effectiveDays().forEach(d=>{
    t.rt += parseFloat(d.rt)||0;
    t.ot += parseFloat(d.ot)||0;
    t.travel += parseFloat(d.travel)||0;
    t.mileage += parseFloat(d.mileage)||0;
    t.expenses += parseFloat(d.expenses)||0;
  });
  return t;
}

/* An untouched "H-" prefill counts as blank */
function cleanJob(s){
  s = String(s||'').trim();
  return /^h-?$/i.test(s) ? '' : s;
}
/* Carry-forward: a blank job # or address/description repeats the last day
   that had one, so entering it once on Monday covers the whole pay period. */
function effectiveDays(){
  let lastDesc = '';
  return state.days.map(d=>{
    // job # is no longer silently repeated: the app asks once per week instead
    const job = cleanJob(d.jobAddress);
    const desc = (d.desc||'').trim() ? d.desc : lastDesc;
    if((d.desc||'').trim()) lastDesc = d.desc;
    // blank regular time on a weekday counts as a standard 8-hour day
    const isWeekend = d.dayName==='Sat' || d.dayName==='Sun';
    const rt = String(d.rt||'').trim()==='' ? (isWeekend ? '' : '8') : d.rt;
    return Object.assign({}, d, {jobAddress: job, desc: desc, rt: rt, wage: d.wage || state.wageLevel});
  });
}


/* ---------------- Day gate: reuse-job prompt + missing-job warning ---------------- */
function wageOf(d){ return (d && d.wage) || state.wageLevel; }
function dayGate(i, proceed){
  const d = state.days[i];
  const job = cleanJob(d.jobAddress);
  if(job){
    // first time this week a job # is entered: offer it for the remaining days of the week
    const needs = [];
    state.days.forEach((x,k)=>{ if(k>i && x.week===d.week && !cleanJob(x.jobAddress)) needs.push(k); });
    if(!editReturn && !state.weekAsked[d.week] && needs.length){
      state.weekAsked[d.week] = true;
      glassSheet({
        icon:'\u21BB',
        title:`Use ${job} for the rest of the week?`,
        msg:`Fills the ${needs.length} remaining day${needs.length===1?'':'s'} of Week ${d.week} with this job #. You can still change any day.`,
        yes:'Yes, fill the week', no:'No, leave them blank',
        onYes:()=>{ needs.forEach(k=>{ state.days[k].jobAddress = job; }); proceed(); },
        onNo:proceed
      });
      return;
    }
    proceed();
    return;
  }
  // no job # on this day. A 0-hour day (or an unused weekend day) doesn't need one.
  const rt = String(d.rt||'').trim();
  const isWeekend = d.dayName==='Sat' || d.dayName==='Sun';
  if((rt!=='' && parseFloat(rt)===0) || (isWeekend && rt==='')){ proceed(); return; }
  glassSheet({
    warn:true, icon:'!',
    title:'No job # entered',
    msg:`${d.dayName}, ${fmtShort(d.date)} has no job number. Add one, or continue and leave this day without a job.`,
    yes:'Add job #', no:'Continue anyway',
    onYes:()=>{ const el=document.getElementById('inpJob'); if(el){ el.focus(); try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){} } },
    onNo:proceed
  });
}

/* Glass bottom sheet. o: {icon,title,msg,body,yes,no,warn,collect(ov),onYes,onNo} */
function glassSheet(o){
  const ov = document.createElement('div');
  ov.className = 'gl-ov';
  ov.innerHTML = `
    <div class="gl-sheet" role="dialog" aria-modal="true">
      <div class="gl-grab"></div>
      <div class="gl-ic${o.warn?' warn':''}">${o.icon||'\u2713'}</div>
      <h2>${escHtml(o.title)}</h2>
      <p>${escHtml(o.msg)}</p>
      ${o.body||''}
      <div class="gl-btns">
        <button type="button" class="gl-btn main" data-r="y">${escHtml(o.yes)}</button>
        <button type="button" class="gl-btn" data-r="n">${escHtml(o.no)}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>requestAnimationFrame(()=>ov.classList.add('show')));
  let done = false;
  ov.addEventListener('click', e=>{
    const b = e.target.closest && e.target.closest('[data-r]');
    if(!b || done) return;
    done = true;
    const yes = b.getAttribute('data-r')==='y';
    if(yes && o.collect) o.collect(ov);
    ov.classList.remove('show');
    setTimeout(()=>{ ov.remove(); const cb = yes ? o.onYes : o.onNo; if(cb) cb(); }, 320);
  });
  return ov;
}

/* "Apply to other days…" — pick any days and give them the wage level shown on this day */
function wageMoreSheet(i, wage){
  const label = (WAGE_LEVELS.find(w=>w.v===wage)||{label:wage}).label;
  const boxes = state.days.map((x,k)=> k===i ? '' : `
    <label class="gl-chk"><input type="checkbox" value="${k}"><span>${x.dayName} ${fmtShort(x.date)}</span><em>${escHtml(wageOf(x))}</em></label>`).join('');
  const ov = glassSheet({
    icon:'\u2630',
    title:`Apply ${wage} to other days`,
    msg:label,
    body:`<div class="gl-days"><label class="gl-chk gl-all"><input type="checkbox" id="glAll"><span>Select all days</span></label>${boxes}</div>`,
    yes:'Apply', no:'Cancel',
    collect:(el)=>{
      el.querySelectorAll('.gl-days input[type=checkbox]:checked').forEach(c=>{
        if(c.id==='glAll') return;
        state.days[parseInt(c.value,10)].wage = (wage===state.wageLevel) ? '' : wage;
      });
      const cur = state.days[i];
      cur.wage = (wage===state.wageLevel) ? '' : wage;
    }
  });
  const all = ov.querySelector('#glAll');
  all.addEventListener('change', ()=>{
    ov.querySelectorAll('.gl-days input[type=checkbox]').forEach(c=>{ c.checked = all.checked; });
  });
}

function escHtml(s){
  return (s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function escAttr(s){ return escHtml(s); }

/* ---------------- Expense receipts ---------------- */
const MAX_RECEIPTS = 12;
const MAX_RECEIPT_EDGE = 1400;    // px — long edge cap before JPEG re-encode
const RECEIPT_JPEG_QUALITY = 0.82;

function receiptCardHtml(){
  return `
    <div class="receipts-card" id="receiptsCard">
      <div class="r-title">Expense receipts</div>
      <p class="r-sub">Add up to ${MAX_RECEIPTS} receipt photos — up to six are neatly arranged on each PDF page.</p>
      <label class="add-receipts-btn" for="receiptInput">+ Add receipt photos</label>
      <input type="file" id="receiptInput" class="visually-hidden-input" accept="image/*" multiple onchange="handleReceiptFiles(this)">
      <div class="receipt-thumbs" id="receiptThumbs">${receiptThumbsHtml()}</div>
      <div class="receipt-status" id="receiptStatus">${escHtml(defaultReceiptStatus())}</div>
    </div>
  `;
}
function receiptThumbsHtml(){
  return (state.receipts||[]).map((r,i)=>`
    <div class="receipt-thumb">
      <img src="${r.dataUrl}" alt="${escAttr(r.name || ('Receipt '+(i+1)))}">
      <button type="button" class="rm" aria-label="Remove receipt ${i+1}" onclick="removeReceipt(${i})">&times;</button>
    </div>`).join('');
}
function fmtBytes(n){
  if(n >= 1024*1024) return (n/(1024*1024)).toFixed(1)+' MB';
  return Math.max(1, Math.round(n/1024))+' KB';
}
function defaultReceiptStatus(){
  const n = (state.receipts||[]).length;
  if(!n) return 'No photos attached yet.';
  const bytes = state.receipts.reduce((a,r)=>a+(r.bytes||0), 0);
  return `${n} of ${MAX_RECEIPTS} photos attached (${fmtBytes(bytes)}).`;
}
function setReceiptStatus(msg, isErr){
  const el = document.getElementById('receiptStatus');
  if(!el) return;
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
}
/* Read one photo, shrink it on a canvas (max 1400px long edge) and re-encode
   as JPEG q0.82 so multi-megapixel phone shots don't blow up the PDF. */
function processReceiptFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        try{
          const sw = img.naturalWidth || img.width;
          const sh = img.naturalHeight || img.height;
          if(!sw || !sh) throw new Error('empty image');
          const scale = Math.min(1, MAX_RECEIPT_EDGE / Math.max(sw, sh));
          const w = Math.max(1, Math.round(sw*scale));
          const h = Math.max(1, Math.round(sh*scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const cx = canvas.getContext('2d');
          cx.fillStyle = '#ffffff';   // transparent pixels -> white, JPEG has no alpha
          cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', RECEIPT_JPEG_QUALITY);
          const b64 = dataUrl.slice(dataUrl.indexOf(',')+1);
          const bytes = Math.floor(b64.length*3/4) - (b64.endsWith('==')?2 : b64.endsWith('=')?1 : 0);
          resolve({name:file.name||'receipt', dataUrl:dataUrl, w:w, h:h, bytes:bytes});
        }catch(err){ reject(err); }
      };
      img.onerror = ()=>reject(new Error('could not decode image'));
      img.src = reader.result;
    };
    reader.onerror = ()=>reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
}
async function handleReceiptFiles(input){
  const files = Array.prototype.slice.call(input.files || []);
  input.value = '';   // so picking the same photo again still fires change
  if(!files.length) return;
  // the card only exists on the summary screen; nothing to do otherwise
  if(!document.getElementById('receiptThumbs')) return;

  let skippedByCap = 0;
  const failed = [];
  const total = files.length;
  for(let i=0;i<files.length;i++){
    const f = files[i];
    if((state.receipts||[]).length >= MAX_RECEIPTS){ skippedByCap += total - i; break; }
    setReceiptStatus(`Adding photo ${i+1} of ${total}\u2026`, false);
    try{
      const r = await processReceiptFile(f);
      state.receipts.push(r);
    }catch(e){
      failed.push(f && f.name ? f.name : 'a file');
    }
  }
  const thumbs = document.getElementById('receiptThumbs');
  if(thumbs) thumbs.innerHTML = receiptThumbsHtml();
  let msg = defaultReceiptStatus();
  if(skippedByCap) msg += ` Limit is ${MAX_RECEIPTS} \u2014 ${skippedByCap} skipped.`;
  if(failed.length) msg += ` Couldn\u2019t read: ${failed.join(', ')}.`;
  setReceiptStatus(msg, failed.length>0);
}
function removeReceipt(i){
  (state.receipts||[]).splice(i,1);
  const thumbs = document.getElementById('receiptThumbs');
  if(thumbs) thumbs.innerHTML = receiptThumbsHtml();
  setReceiptStatus(defaultReceiptStatus(), false);
}

/* ---------------- PDF generation ---------------- */
async function finalizeAndGenerate(){
  const status = document.getElementById('genStatus');
  const main = document.getElementById('main');
  const footer = document.getElementById('footer');

  // Expenses on the sheet but no receipt photos attached: ask first.
  // OK = go back to the receipts card (no PDF), Cancel = generate anyway.
  const totals = computeTotals();
  if(totals.expenses > 0 && (!state.receipts || state.receipts.length === 0)){
    const addReceipts = window.confirm(
      `You entered $${totals.expenses.toFixed(2)} in expenses, but no receipt photos are attached.\n\n` +
      'Press OK to go back and add your receipts, or Cancel to generate the PDF without them.'
    );
    if(addReceipts){
      const card = document.getElementById('receiptsCard');
      if(card && card.scrollIntoView) card.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }
  }

  status.textContent = 'Building your PDF…';

  try{
    const bytes = await buildPdf();
    const blob = new Blob([bytes], {type:'application/pdf'});
    const filename = `Timesheet_${escFileSafe(state.name)}_${state.startDate}.pdf`;
    window.__pdfBlob = blob;
    window.__pdfName = filename;
    try{const t=computeTotals(),s=JSON.parse(JSON.stringify(state));s.receipts=[];window.__tsId=window.__tsId||String(Date.now());parent.postMessage({rem:'ts-saved',rec:{id:window.__tsId,type:'ts',name:state.name,range:periodRangeText(),rt:t.rt,ot:t.ot,exp:t.expenses,state:s}},'*')}catch(e){}

    main.innerHTML = `
      <div style="padding-top:30px;text-align:center;">
        <div class="checkmark">✓</div>
        <h1 style="text-align:center;">Timesheet ready</h1>
        <p class="sub" style="text-align:center;">${escHtml(state.name)} · ${periodRangeText()}</p>
      </div>
    `;
    footer.innerHTML = `
      <div class="final-actions" style="width:100%">
        <button class="primary" onclick="sharePdf()">Save / Share PDF</button>
        <button class="secondary" style="flex:1;" onclick="viewPdf()">View PDF</button>
        <button class="secondary" style="flex:1;background:none;border:none;color:var(--paper-dim);" onclick="backToSummary()">← Back to review</button>
      </div>
      <div class="status-msg" style="position:absolute;left:0;right:0;bottom:calc(100% - 6px);">On iPhone: tap Save / Share, then “Save to Files” or attach to an email.</div>
    `;
  }catch(e){
    console.error(e);
    status.textContent = 'Something went wrong generating the PDF. Please try again.';
  }
}
function backToSummary(){
  stepIndex = steps.indexOf('summary');
  render();
}
function escFileSafe(s){ return (s||'timesheet').replace(/[^a-z0-9]+/gi,'_'); }

function downloadPdf(){
  if(window.parent!==window){parent.postMessage({rem:'ts-file',name:window.__pdfName,blob:window.__pdfBlob},'*');return;}
  const url = URL.createObjectURL(window.__pdfBlob);
  const a = document.createElement('a');
  a.href = url; a.download = window.__pdfName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}
function viewPdf(){
  // Open the generated PDF itself in a new tab so the preview shows all pages.
  const url = URL.createObjectURL(window.__pdfBlob);
  const w = window.open(url, '_blank');
  if(!w) location.href = url; // popup blocked (common in in-app browsers)
}
async function sharePdf(){
  const file = new File([window.__pdfBlob], window.__pdfName, {type:'application/pdf'});
  // On iPhone the share sheet is the only reliable way to save the real PDF
  // ("Save to Files", AirDrop, Mail…). <a download> in in-app browsers saves
  // the HTML page instead of the PDF.
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file], title:'Timesheet', text:`Timesheet for ${state.name}`});
      return;
    }catch(e){
      if(e && e.name==='AbortError') return; // user closed the share sheet
      /* fall through to download */
    }
  }
  downloadPdf();
  alert('Sharing isn\'t supported in this browser — the PDF was downloaded instead. Attach it from your Downloads/Files app to an email.');
}

async function buildPdf(){
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const eff = effectiveDays();
  const week1 = eff.filter(d=>d.week===1);
  const week2 = eff.filter(d=>d.week===2);

  const receipts = state.receipts || [];
  const receiptsPerPage = 6;
  const receiptPages = Math.ceil(receipts.length / receiptsPerPage);
  const totalPages = 3 + receiptPages;

  drawWeekPage(doc, font, bold, 1, week1, `Page 1 of ${totalPages}`);
  drawWeekPage(doc, font, bold, 2, week2, `Page 2 of ${totalPages}`);
  drawSummaryPage(doc, font, bold, `Page 3 of ${totalPages}`);

  // Collate up to six photos on each receipt sheet (two columns by three rows).
  for(let p=0; p<receiptPages; p++){
    const batch = receipts.slice(p*receiptsPerPage, (p+1)*receiptsPerPage);
    const imgs = [];
    for(const receipt of batch) imgs.push(await doc.embedJpg(receipt.dataUrl));
    drawReceiptPage(doc, font, bold, imgs, p+1, receiptPages, p*receiptsPerPage, receipts.length, totalPages);
  }
  return await doc.save();
}

/* ============ RECEIPT SHEET (up to six photos per portrait page) ============ */
function drawReceiptPage(doc, font, bold, imgs, sheetNum, sheetCount, firstReceipt, receiptCount, totalPages){
  const {rgb} = PDFLib;
  const page = doc.addPage([612, 792]);
  page.drawRectangle({x:0, y:0, width:612, height:792, color:rgb(1,1,1)});
  const M = 34, ink = rgb(0.05,0.05,0.05), dim = rgb(0.3,0.3,0.3);
  let y = 742;
  page.drawText('EXPENSE RECEIPTS', {x:M, y, size:14, font:bold, color:ink});
  const label = `Page ${3+sheetNum} of ${totalPages}`;
  page.drawText(label, {x:612-M-bold.widthOfTextAtSize(label,9), y:y+3, size:9, font:bold, color:ink});
  y -= 16;
  page.drawText(`${state.name} \u00b7 ${periodRangeText()} \u00b7 Photos ${firstReceipt+1}-${firstReceipt+imgs.length} of ${receiptCount}`,
    {x:M, y, size:9, font, color:dim});

  const cols=2, rows=3, gap=10, top=708, bottom=sheetNum===sheetCount ? 62 : 30;
  const cellW=(612-2*M-gap)/cols, cellH=(top-bottom-(rows-1)*gap)/rows;
  imgs.forEach((img,i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=M+col*(cellW+gap), cellTop=top-row*(cellH+gap);
    const scale=Math.min((cellW-12)/img.width,(cellH-12)/img.height);
    const w=img.width*scale,h=img.height*scale;
    const ix=x+(cellW-w)/2, iy=cellTop-cellH+(cellH-h)/2;
    page.drawImage(img,{x:ix,y:iy,width:w,height:h});
    page.drawRectangle({x:ix,y:iy,width:w,height:h,borderColor:rgb(0.4,0.4,0.4),borderWidth:0.75});
    page.drawText(`Receipt ${firstReceipt+i+1}`,{x,y:cellTop-cellH+3,size:8,font,color:dim});
  });
  if(sheetNum===sheetCount){
    const text=`TOTAL EXPENSES FOR THIS PAY PERIOD: $${computeTotals().expenses.toFixed(2)}`;
    page.drawText(text,{x:M,y:32,size:11,font:bold,color:ink});
  }
}

function truncate(s, colWidth){
  const maxChars = Math.max(4, Math.floor(colWidth/4.6));
  s = String(s||'');
  if(s.length<=maxChars) return s;
  return s.slice(0,maxChars-1)+'…';
}

/* ============ WEEK PAGE (replica of the scanned daily-log template) ============ */
function drawWeekPage(doc, font, bold, weekNum, days, pageLabel){
  const {rgb} = PDFLib;
  const page = doc.addPage([612, 792]);
  page.drawRectangle({x:0, y:0, width:612, height:792, color:rgb(1,1,1)});
  const M = 40;
  const W = 532;
  const ink = rgb(0.05,0.05,0.05);
  const border = rgb(0.15,0.15,0.15);
  const faint = rgb(0.72,0.72,0.72);
  let y = 792 - 46;

  // column x-offsets
  const c0 = M;           // day label
  const c1 = M+50;        // job/address
  const c2 = M+50+150;    // time (left block)
  const cDivider = c2+50; // thick divider
  const c3 = cDivider+3;  // address/description
  const c4 = c3+147;      // time (right block)
  const c5 = c4+50;       // label col (Reg Hrs / OT Hrs / TOTAL)
  const c6 = c5+46;       // value col
  const end = M+W;

  const rowH = 14, notesH = 15, totalH = 14;

  // ---- identity row: white cells with black borders, bold labels (like the paper) ----
  const idH = 18;
  page.drawRectangle({x:M, y:y-idH, width:W, height:idH, borderColor:border, borderWidth:1});
  page.drawText('NAME:', {x:c0+3, y:y-idH+5.5, size:9, font:bold, color:ink});
  page.drawText(state.name||'', {x:c0+42, y:y-idH+5.5, size:9, font, color:ink});
  page.drawLine({start:{x:cDivider-25,y:y}, end:{x:cDivider-25,y:y-idH}, thickness:0.8, color:border});
  page.drawText('DATE:', {x:cDivider-20, y:y-idH+5.5, size:9, font:bold, color:ink});
  page.drawText(periodRangeText(), {x:cDivider+16, y:y-idH+5.5, size:9, font, color:ink});
  page.drawLine({start:{x:c5-10,y:y}, end:{x:c5-10,y:y-idH}, thickness:0.8, color:border});
  page.drawText(pageLabel, {x:c5-6, y:y-idH+5.5, size:8.5, font:bold, color:ink});
  y -= idH;

  // ---- grey column header row, centered small labels ----
  const hdrH = 12;
  page.drawRectangle({x:M, y:y-hdrH, width:W, height:hdrH, color:rgb(0.84,0.84,0.84), borderColor:border, borderWidth:0.8});
  const hdrY = y-hdrH+3.5;
  function centerHdr(txt, x1, x2){
    const w = font.widthOfTextAtSize(txt, 6);
    page.drawText(txt, {x:(x1+x2-w)/2, y:hdrY, size:6, font, color:ink});
  }
  centerHdr('Job # or Address', c1, c2);
  centerHdr('Time', c2, cDivider);
  centerHdr('Address/ Description', c3, c4);
  centerHdr('Time', c4, c5);
  y -= hdrH;

  function vLines(top, bottom){
    [c1,c2,c3,c4,c5,c6].forEach(x=>{
      page.drawLine({start:{x, y:top}, end:{x, y:bottom}, thickness:0.4, color:faint});
    });
    page.drawLine({start:{x:cDivider, y:top}, end:{x:cDivider, y:bottom}, thickness:2.2, color:rgb(0.05,0.05,0.05)});
    page.drawRectangle({x:M, y:bottom, width:W, height: top-bottom, borderColor:border, borderWidth:0.8});
  }

  // black bar with white TOTAL cell at the right, like the paper
  function totalBar(topY, val){
    const b = topY - totalH;
    page.drawRectangle({x:M, y:b, width:c5-M, height:totalH, color:rgb(0.05,0.05,0.05)});
    page.drawRectangle({x:c5, y:b, width:end-c5, height:totalH, borderColor:border, borderWidth:0.8});
    page.drawLine({start:{x:c6,y:topY-0}, end:{x:c6,y:b}, thickness:0.4, color:faint});
    page.drawText('TOTAL', {x:c5+3, y:b+4, size:7, font:bold, color:ink});
    if(val) page.drawText(val, {x:c6+4, y:b+4, size:7.5, font:bold, color:ink});
    return b;
  }

  function descLinesOf(s){ return String(s||'').split('\n').map(x=>x.trim()).filter(Boolean); }

  const byDow = {};
  days.forEach(dd=>byDow[dd.dayName]=dd);

  const DAY_LABEL = {Mon:'Mon', Tue:'Tues', Wed:'Weds', Thu:'Thurs', Fri:'Fri'};

  ['Mon','Tue','Wed','Thu','Fri'].forEach(dow=>{
    const dd = byDow[dow] || {jobAddress:'',desc:'',rt:'',ot:'',travel:'',mileage:'',expenses:''};
    const blockTop = y;
    for(let r=0;r<5;r++){
      const rowY = blockTop - (r+1)*rowH;
      page.drawLine({start:{x:M,y:rowY}, end:{x:M+W,y:rowY}, thickness:0.4, color:faint});
    }
    page.drawText(DAY_LABEL[dow], {x:c0+3, y:blockTop-10, size:7.5, font, color:ink});
    page.drawText(truncate(dd.jobAddress, 150), {x:c1+4, y:blockTop-10, size:8, font, color:ink});
    descLinesOf(dd.desc).slice(0,5).forEach((ln,r)=>{
      page.drawText(truncate(ln, 170), {x:c3+4, y:blockTop - r*rowH - 10, size:7.5, font, color:ink});
    });
    const regRowY = blockTop - 3*rowH;
    page.drawText('Reg Hrs', {x:c5+3, y:regRowY+4, size:7, font, color:rgb(0.25,0.25,0.25)});
    if(dd.rt) page.drawText(String(dd.rt), {x:c6+4, y:regRowY+4, size:7.5, font, color:ink});
    const otRowY = blockTop - 5*rowH;
    page.drawText('OT Hrs', {x:c5+3, y:otRowY+4, size:7, font, color:rgb(0.25,0.25,0.25)});
    if(dd.ot) page.drawText(String(dd.ot), {x:c6+4, y:otRowY+4, size:7.5, font, color:ink});

    let bottom = blockTop - 5*rowH;
    const notesY = bottom - notesH;
    page.drawLine({start:{x:M,y:notesY}, end:{x:M+W,y:notesY}, thickness:0.4, color:faint});
    page.drawText('NOTES', {x:c0+14, y:bottom-notesH+4.5, size:6.5, font, color:ink});
    const notesExtra = notesExtraFor(dd);
    if(notesExtra) page.drawText(truncate(notesExtra, 190), {x:c1+4, y:bottom-notesH+4.5, size:7, font, color:rgb(0.25,0.25,0.25)});
    page.drawText('OT Approval by:', {x:c3+4, y:bottom-notesH+4.5, size:7, font, color:ink});
    bottom = notesY;
    vLines(blockTop, bottom);
    const tot = (parseFloat(dd.rt)||0)+(parseFloat(dd.ot)||0);
    y = totalBar(bottom, tot? tot.toFixed(2) : '');
  });

  // ---- Sat/Sun block: 6 rows, SAT/SUN/OT Hrs on rows 1/3/5 (like the paper) ----
  {
    const sat = byDow['Sat'] || {jobAddress:'',desc:'',rt:'',ot:'',travel:'',mileage:'',expenses:''};
    const sun = byDow['Sun'] || {jobAddress:'',desc:'',rt:'',ot:'',travel:'',mileage:'',expenses:''};
    const blockTop = y;
    for(let r=0;r<6;r++){
      const rowY = blockTop - (r+1)*rowH;
      page.drawLine({start:{x:M,y:rowY}, end:{x:M+W,y:rowY}, thickness:0.4, color:faint});
    }
    page.drawText('Sat/Sun', {x:c0+3, y:blockTop-10, size:7.5, font, color:ink});
    page.drawText(truncate(sat.jobAddress||sun.jobAddress||'', 150), {x:c1+4, y:blockTop-10, size:8, font, color:ink});

    const wkndLines = []
      .concat(descLinesOf(sat.desc).map(s=>'Sat: '+s))
      .concat(descLinesOf(sun.desc).map(s=>'Sun: '+s))
      .slice(0,6);
    wkndLines.forEach((ln,r)=>{
      page.drawText(truncate(ln, 170), {x:c3+4, y:blockTop - r*rowH - 10, size:7.5, font, color:ink});
    });

    const satRowY = blockTop - 1*rowH;
    page.drawText('SAT', {x:c5+3, y:satRowY+4, size:7, font, color:rgb(0.25,0.25,0.25)});
    if(sat.rt) page.drawText(String(sat.rt), {x:c6+4, y:satRowY+4, size:7.5, font, color:ink});
    const sunRowY = blockTop - 3*rowH;
    page.drawText('SUN', {x:c5+3, y:sunRowY+4, size:7, font, color:rgb(0.25,0.25,0.25)});
    if(sun.rt) page.drawText(String(sun.rt), {x:c6+4, y:sunRowY+4, size:7.5, font, color:ink});
    const otRowY = blockTop - 5*rowH;
    page.drawText('OT Hrs', {x:c5+3, y:otRowY+4, size:7, font, color:rgb(0.25,0.25,0.25)});
    const weekendOT = (parseFloat(sat.ot)||0)+(parseFloat(sun.ot)||0);
    if(weekendOT) page.drawText(weekendOT.toFixed(2), {x:c6+4, y:otRowY+4, size:7.5, font, color:ink});

    let bottom = blockTop - 6*rowH;
    const notesY = bottom - notesH;
    page.drawLine({start:{x:M,y:notesY}, end:{x:M+W,y:notesY}, thickness:0.4, color:faint});
    page.drawText('NOTES', {x:c0+14, y:bottom-notesH+4.5, size:6.5, font, color:ink});
    const wkNotes = [sat.notes?('Sat: '+sat.notes):'', sun.notes?('Sun: '+sun.notes):''].filter(Boolean).join('   ');
    if(wkNotes) page.drawText(truncate(wkNotes, 190), {x:c1+4, y:bottom-notesH+4.5, size:7, font, color:rgb(0.25,0.25,0.25)});
    bottom = notesY;
    vLines(blockTop, bottom);

    const weekendTot = (parseFloat(sat.rt)||0)+(parseFloat(sun.rt)||0)+weekendOT;
    y = totalBar(bottom, weekendTot? weekendTot.toFixed(2) : '');
  }

  // ---- bottom rows + week summary lines + thick black strip (like the paper) ----
  const w1 = weekTotals(1), w2 = weekTotals(2);
  const nBottomRows = 4;
  const botTop = y;
  for(let r=0;r<nBottomRows;r++){
    const rowY = botTop - (r+1)*rowH;
    page.drawLine({start:{x:M,y:rowY}, end:{x:M+W,y:rowY}, thickness:0.4, color:faint});
  }
  function weekLine(rowIdx, label, t){
    const baseY = botTop - (rowIdx+1)*rowH + 4;
    page.drawText(label, {x:c3+4, y:baseY, size:8, font:bold, color:ink});
    page.drawText('Reg Hrs:', {x:c3+82, y:baseY, size:8, font:bold, color:ink});
    page.drawText(t.rt.toFixed(2), {x:c3+122, y:baseY, size:8, font, color:ink});
    page.drawText('OT:', {x:c5+3, y:baseY, size:8, font:bold, color:ink});
    page.drawText(t.ot.toFixed(2), {x:c6+4, y:baseY, size:8, font, color:ink});
  }
  if(weekNum===1){
    weekLine(2, 'WEEK ONE:', w1);
  } else {
    weekLine(0, 'WEEK ONE:', w1);
    weekLine(1, 'WEEK TWO:', w2);
    weekLine(3, 'TOTAL', {rt:w1.rt+w2.rt, ot:w1.ot+w2.ot});
  }
  const botBottom = botTop - nBottomRows*rowH;
  vLines(botTop, botBottom);
  y = botBottom;

  // final thick black strip across the bottom of the table
  page.drawRectangle({x:M, y:y-7, width:W, height:7, color:rgb(0.05,0.05,0.05)});
}
function weekTotals(week){
  const t = {rt:0, ot:0};
  effectiveDays().forEach(d=>{
    if(d.week===week){
      t.rt += parseFloat(d.rt)||0;
      t.ot += parseFloat(d.ot)||0;
    }
  });
  return t;
}
function notesExtraFor(dd){
  const parts = [];
  if(dd.notes) parts.push(dd.notes);
  if(dd.travel) parts.push(`Travel ${dd.travel}h`);
  if(dd.mileage) parts.push(`${dd.mileage} mi`);
  if(dd.expenses) parts.push(`$${dd.expenses} exp`);
  return parts.join('  ·  ');
}

/* ============ SUMMARY PAGE (replica of the Richmond Elevator landscape sheet) ============ */
function drawSummaryPage(doc, font, bold, pageLabel){
  const {rgb} = PDFLib;
  const page = doc.addPage([792, 612]);
  page.drawRectangle({x:0, y:0, width:792, height:612, color:rgb(1,1,1)});
  const M = 30;
  const ink = rgb(0.08,0.08,0.08);
  const grey = rgb(0.85,0.85,0.85);
  const lineC = rgb(0.35,0.35,0.35);

  // ---- titles ----
  let y = 612 - 36;
  page.drawText('RICHMOND ELEVATOR MAINTENANCE LTD.', {x:M, y, size:12.5, font:bold, color:ink});
  page.drawText('CONSTRUCTION / MODERNIZATION TIMESHEET', {x:430, y, size:11.5, font:bold, color:ink});
  y -= 15;
  const subT = 'All time must be recorded on this timesheet, no other timesheet will be accepted';
  const subW = bold.widthOfTextAtSize(subT, 8);
  page.drawText(subT, {x:(792-subW)/2 - 60, y, size:8, font:bold, color:ink});
  y -= 18;

  // ---- employee / pay period boxes ----
  const boxH = 20;
  page.drawRectangle({x:M, y:y-boxH, width:330, height:boxH, borderColor:lineC, borderWidth:0.9});
  page.drawText('Employee (1st and last name)', {x:M+4, y:y-boxH+6, size:7.5, font, color:ink});
  page.drawText(state.name||'', {x:M+140, y:y-boxH+6, size:9, font:bold, color:ink});
  page.drawRectangle({x:M+330, y:y-boxH, width:310, height:boxH, borderColor:lineC, borderWidth:0.9});
  page.drawText('Pay Period dates', {x:M+334, y:y-boxH+6, size:7.5, font, color:ink});
  page.drawText(periodRangeText(), {x:M+430, y:y-boxH+6, size:9, font:bold, color:ink});
  y -= boxH + 8;

  // ---- main table ----
  const cols = [
    {key:'day',  lines:['Week 1'],           w:66},
    {key:'job',  lines:['JOB #'],            w:52},
    {key:'wage', lines:['WAGE','LEVEL'],     w:46},
    {key:'rt',   lines:['REGULAR','TIME'],   w:54},
    {key:'ot',   lines:['OVERTIME','1.5'],   w:54},
    {key:'dt',   lines:['DOUBLE','TIME'],    w:50},
    {key:'travel',lines:['TRAVEL','TIME'],   w:50},
    {key:'mile', lines:['MILEAGE'],          w:50},
    {key:'loa',  lines:['LOA/','Per diem'],  w:52},
    {key:'exp',  lines:['EXPENSES'],         w:54},
  ];
  const tableX = M;
  const tableW = cols.reduce((a,c)=>a+c.w,0);
  const hdrH = 24, rowH = 25.5;
  const tableTop = y;

  function cellCenter(colIdx){
    let x = tableX; for(let i=0;i<colIdx;i++) x += cols[i].w;
    return {x, w: cols[colIdx].w};
  }
  function centerText(txt, colIdx, rowY, useFont, size){
    const {x,w} = cellCenter(colIdx);
    const tw = useFont.widthOfTextAtSize(txt, size);
    page.drawText(txt, {x: x + (w-tw)/2, y: rowY, size, font:useFont, color:ink});
  }

  // header row (white, bordered, bold centered — like the paper)
  let cx = tableX;
  cols.forEach((c,ci)=>{
    if(c.lines.length===2){
      centerText(c.lines[0], ci, tableTop-hdrH+13, bold, 7);
      centerText(c.lines[1], ci, tableTop-hdrH+4.5, bold, 7);
    } else {
      centerText(c.lines[0], ci, tableTop-hdrH+9, bold, 7.5);
    }
    cx += c.w;
  });

  // rows: Mon..Sun, "Week 2" divider, Mon..Sun, totals
  const DOWFULL = {Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};
  const DOWS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const byWeekDow = {};
  effectiveDays().forEach(dd=>{ byWeekDow[`${dd.week}-${dd.dayName}`] = dd; });
  const hasData = dd => dd && [dd.rt,dd.ot,dd.travel,dd.mileage,dd.expenses].some(v=>String(v||'').trim()!=='');

  let ry = tableTop - hdrH;   // top of first data row
  const rowsMeta = [];        // remember row boundaries for grid

  function dayRow(week, dow){
    const rowBottom = ry - rowH;
    const dd = byWeekDow[`${week}-${dow}`];
    page.drawText(DOWFULL[dow], {x:tableX+4, y:rowBottom+9, size:8, font, color:ink});
    if(hasData(dd)){
      centerText(truncate(dd.jobAddress, 50), 1, rowBottom+9, font, 7.5);
      centerText(String(dd.wage||state.wageLevel), 2, rowBottom+9, font, 7.5);
      if(dd.rt) centerText(String(dd.rt), 3, rowBottom+9, font, 7.5);
      if(dd.ot) centerText(String(dd.ot), 4, rowBottom+9, font, 7.5);
      if(dd.travel) centerText(String(dd.travel), 6, rowBottom+9, font, 7.5);
      if(dd.mileage) centerText(String(dd.mileage), 7, rowBottom+9, font, 7.5);
      if(dd.expenses) centerText('$'+dd.expenses, 9, rowBottom+9, font, 7.5);
    }
    rowsMeta.push(rowBottom);
    ry = rowBottom;
  }

  DOWS.forEach(dow=>dayRow(1,dow));

  // shaded "Week 2" divider row
  {
    const rowBottom = ry - rowH;
    page.drawRectangle({x:tableX, y:rowBottom, width:tableW, height:rowH, color:grey});
    page.drawText('Week 2', {x:tableX+4, y:rowBottom+9, size:8, font:bold, color:ink});
    rowsMeta.push(rowBottom);
    ry = rowBottom;
  }
  DOWS.forEach(dow=>dayRow(2,dow));

  // totals row
  const t = computeTotals();
  {
    const rowBottom = ry - rowH;
    // grey patch under JOB# + WAGE LEVEL cells, like the paper
    page.drawRectangle({x:tableX+cols[0].w, y:rowBottom, width:cols[1].w+cols[2].w, height:rowH, color:grey});
    page.drawText('Totals for Pay Period', {x:tableX+3, y:rowBottom+9, size:6.8, font:bold, color:ink});
    centerText(t.rt?t.rt.toFixed(2):'', 3, rowBottom+9, bold, 7.5);
    centerText(t.ot?t.ot.toFixed(2):'', 4, rowBottom+9, bold, 7.5);
    centerText(t.travel?t.travel.toFixed(2):'', 6, rowBottom+9, bold, 7.5);
    centerText(t.mileage?String(t.mileage):'', 7, rowBottom+9, bold, 7.5);
    centerText(t.expenses?('$'+t.expenses.toFixed(2)):'', 9, rowBottom+9, bold, 7.5);
    rowsMeta.push(rowBottom);
    ry = rowBottom;
  }

  // grid lines
  const tableBottom = ry;
  let vx = tableX;
  cols.forEach(c=>{ page.drawLine({start:{x:vx,y:tableTop},end:{x:vx,y:tableBottom}, thickness:0.5, color:lineC}); vx += c.w; });
  page.drawLine({start:{x:vx,y:tableTop},end:{x:vx,y:tableBottom}, thickness:0.5, color:lineC});
  page.drawLine({start:{x:tableX,y:tableTop},end:{x:tableX+tableW,y:tableTop}, thickness:0.9, color:lineC});
  page.drawLine({start:{x:tableX,y:tableTop-hdrH},end:{x:tableX+tableW,y:tableTop-hdrH}, thickness:0.7, color:lineC});
  rowsMeta.forEach(b=>page.drawLine({start:{x:tableX,y:b},end:{x:tableX+tableW,y:b}, thickness:0.4, color:lineC}));
  page.drawRectangle({x:tableX, y:tableBottom, width:tableW, height:tableTop-tableBottom, borderColor:ink, borderWidth:1});

  // ---- NOTES instruction panel (static text, exactly like the blank sheet) ----
  const nX = tableX + tableW + 14;
  const nW = 792 - M - nX;
  page.drawRectangle({x:nX, y:tableTop-hdrH, width:nW, height:hdrH, color:grey, borderColor:lineC, borderWidth:0.8});
  const ntw = bold.widthOfTextAtSize('NOTES', 8.5);
  page.drawText('NOTES', {x:nX+(nW-ntw)/2, y:tableTop-hdrH+8, size:8.5, font:bold, color:ink});

  const noteLines = [
    {b:'Job #:', r:' must be entered', u:true},
    null,
    {b:'Wage Level:', r:'', u:true},
    {b:'', r:'H- Helper'},
    {b:'', r:'M- Mechanic'},
    {b:'', r:'MIC- Mechanic in Charge'},
    {b:'', r:'ADJ- Adjuster'},
    {b:'', r:'TM- Temporary Mechanic'},
    {b:'', r:'TA- Temporary Adjuster'},
    null,
    {b:'Mileage:', r:'', u:true},
    {b:'', r:'to claim mileage a copy of'},
    {b:'', r:'your log sheet must be'},
    {b:'', r:'attached to your timesheet'},
    null,
    {b:'Travel Time:', r:' matches to Job #', u:true},
    null,
    {b:'Expenses:', r:'', u:true},
    {b:'', r:'All expenses must be'},
    {b:'', r:'approved by your supervisor'},
    {b:'', r:'prior to purchasing supplies'},
    null,
    {b:'Absentee:', r:'', u:true},
    {b:'', r:'Enter a "0" in regular time'},
    {b:'', r:'hours if you did not work on'},
    {b:'', r:'the day or Sick Pay if you'},
    {b:'', r:'want to use a sick day'},
    {b:'Sick Pay:', r:' 5 days per annum', u:true},
  ];
  let ny = tableTop - hdrH - 16;
  const nSize = 7.2, nLead = 10.6;
  noteLines.forEach(ln=>{
    if(ln){
      let tx = nX + 2;
      if(ln.b){
        page.drawText(ln.b, {x:tx, y:ny, size:nSize, font:bold, color:ink});
        const bw = bold.widthOfTextAtSize(ln.b, nSize);
        if(ln.u) page.drawLine({start:{x:tx,y:ny-1.5}, end:{x:tx+bw,y:ny-1.5}, thickness:0.5, color:ink});
        tx += bw;
      }
      if(ln.r) page.drawText(ln.r, {x:tx, y:ny, size:nSize, font, color:ink});
      ny -= nLead;
    } else {
      ny -= nLead*0.6;
    }
  });

  // ---- signature boxes ----
  const sigY = tableBottom - 30;
  page.drawRectangle({x:M, y:sigY-boxH, width:330, height:boxH, borderColor:lineC, borderWidth:0.9});
  page.drawText('Employee Signature', {x:M+4, y:sigY-boxH+6, size:8, font:bold, color:ink});
  page.drawRectangle({x:432, y:sigY-boxH, width:330, height:boxH, borderColor:lineC, borderWidth:0.9});
  page.drawText('Supervisor Signature', {x:436, y:sigY-boxH+6, size:8, font:bold, color:ink});
}

/* ---------------- init ---------------- */
addEventListener('message',e=>{const m=e.data;if(!m||m.rem!=='init')return;window.__tsId=m.id;
  if(m.load){const s=m.load.state;Object.assign(state,s,{days:s.days.map(d=>Object.assign({},d,{date:new Date(d.date)})),receipts:[]});rebuildSteps();stepIndex=steps.indexOf('summary');render();}
  else if(m.name&&!state.name){state.name=m.name;render();}});
render();
</script>
