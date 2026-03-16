// ── Clock ──────────────────────────────────────────────────────
function updateClock() {
  const t = new Date().toTimeString().slice(0, 8);
  document.getElementById('clock').textContent = t;
  document.getElementById('clockUser').textContent = t;
}
setInterval(updateClock, 1000);
updateClock();

// ── Pages ──────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function goAdmin() {
  showPage('page-password');
  document.getElementById('pwInput').value = '';
  clearPwError();
  setTimeout(() => document.getElementById('pwInput').focus(), 300);
}

function goUser() {
  showPage('page-user');
  document.getElementById('searchQuery').value = '';
  document.getElementById('searchResult').style.display = 'none';
  document.getElementById('notFound').style.display = 'none';
}

// ── Password ───────────────────────────────────────────────────
function checkPassword() {
  if (document.getElementById('pwInput').value === '1717') {
    document.getElementById('pwInput').value = '';
    clearPwError();
    showPage('page-admin');
  } else {
    const i = document.getElementById('pwInput');
    i.classList.add('error');
    document.getElementById('pwError').textContent = 'Incorrect password.';
    setTimeout(() => i.classList.remove('error'), 500);
  }
}

function clearPwError() {
  document.getElementById('pwError').textContent = '';
}

// ── State ──────────────────────────────────────────────────────
let currentPatient = null, currentID = null, currentAge = null, currentGender = null;
let patients = [];
let bleCharacteristic = null, bleConnected = false;
let vitals = { hr: null, temp: null, spo2: null };
let prevVitals = { hr: null, temp: null, spo2: null };
let liveHR = [], liveSpo2 = [], liveTemp = [];
const MAX_LIVE = 40;
let alarmEnabled = true, alarmTriggered = false;

// ── Charts ─────────────────────────────────────────────────────
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },
  plugins: { legend: { display: false } },
  scales: {
    x: { display: false },
    y: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#5a7a9a', font: { size: 10 } }
    }
  }
};

const hrChart = new Chart(document.getElementById('hrChart'), {
  type: 'line',
  data: {
    labels: Array(MAX_LIVE).fill(''),
    datasets: [{
      data: Array(MAX_LIVE).fill(null),
      borderColor: '#ff3860', borderWidth: 2,
      pointRadius: 0, tension: 0.3,
      fill: true, backgroundColor: 'rgba(255,56,96,0.08)'
    }]
  },
  options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 40, max: 160 } } }
});

const spo2Chart = new Chart(document.getElementById('spo2Chart'), {
  type: 'line',
  data: {
    labels: Array(MAX_LIVE).fill(''),
    datasets: [{
      data: Array(MAX_LIVE).fill(null),
      borderColor: '#00c8ff', borderWidth: 2,
      pointRadius: 0, tension: 0.3,
      fill: true, backgroundColor: 'rgba(0,200,255,0.08)'
    }]
  },
  options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 85, max: 100 } } }
});

const tempChart = new Chart(document.getElementById('tempChart'), {
  type: 'line',
  data: {
    labels: Array(MAX_LIVE).fill(''),
    datasets: [{
      data: Array(MAX_LIVE).fill(null),
      borderColor: '#ffb300', borderWidth: 2,
      pointRadius: 0, tension: 0.3,
      fill: true, backgroundColor: 'rgba(255,179,0,0.08)'
    }]
  },
  options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 34, max: 42 } } }
});

function pushChart(chart, val) {
  if (val == null) return;
  chart.data.datasets[0].data.push(val);
  chart.data.datasets[0].data.shift();
  chart.update('none');
}

// ── Admin ──────────────────────────────────────────────────────
function loadPatient() {
  const name   = document.getElementById('patientName').value.trim();
  const id     = document.getElementById('patientID').value.trim();
  const age    = document.getElementById('patientAge').value.trim();
  const gender = document.getElementById('patientGender').value;
  if (!name) { alert('Enter patient name.'); return; }
  if (!id)   { alert('Enter patient ID.');   return; }

  currentPatient = name; currentID = id;
  currentAge = age || null; currentGender = gender || null;
  prevVitals = { hr: null, temp: null, spo2: null };
  vitals     = { hr: null, temp: null, spo2: null };

  liveHR = Array(MAX_LIVE).fill(null);
  liveSpo2 = Array(MAX_LIVE).fill(null);
  liveTemp = Array(MAX_LIVE).fill(null);
  hrChart.data.datasets[0].data   = [...liveHR];
  spo2Chart.data.datasets[0].data = [...liveSpo2];
  tempChart.data.datasets[0].data = [...liveTemp];
  hrChart.update('none'); spo2Chart.update('none'); tempChart.update('none');

  document.getElementById('summaryName').textContent = name;
  const meta = [];
  if (age) meta.push('Age: ' + age);
  if (gender) meta.push(gender);
  meta.push('ID: ' + id);
  document.getElementById('summaryMeta').textContent = meta.join(' · ');
  updateSummary(); updateSections(); updateCondition();
}

function savePatient() {
  if (!currentPatient) { alert('Load a patient first.'); return; }
  if (!vitals.hr && !vitals.temp && !vitals.spo2) { alert('No vital data to save yet.'); return; }

  let p = patients.find(x => x.id === currentID);
  if (!p) {
    p = { id: currentID, name: currentPatient, age: currentAge, gender: currentGender, history: [] };
    patients.unshift(p);
  }
  p.name = currentPatient; p.age = currentAge; p.gender = currentGender;

  if (p.history.length > 0) {
    prevVitals = { hr: p.history[0].hr, temp: p.history[0].temp, spo2: p.history[0].spo2 };
  }
  p.history.unshift({ time: new Date().toLocaleString(), hr: vitals.hr, temp: vitals.temp, spo2: vitals.spo2 });
  renderAdminSaved();
  updateArrows();
}

function deletePatient(id) {
  const p = patients.find(x => x.id === id);
  if (!confirm('Delete all records for ' + p.name + '?')) return;
  patients = patients.filter(x => x.id !== id);
  renderAdminSaved();
}

function renderAdminSaved() {
  const list = document.getElementById('adminSavedList');
  if (!patients.length) { list.innerHTML = '<div class="empty-state">No patients saved yet.</div>'; return; }
  list.innerHTML = patients.map(p => {
    const latest = p.history[0] || {};
    const meta = [];
    if (p.age)    meta.push(p.age + 'y');
    if (p.gender) meta.push(p.gender);
    return `<div class="saved-item">
      <div class="saved-item-left">
        <div class="saved-item-name">${p.name}</div>
        <div class="saved-item-meta">ID: ${p.id}${meta.length ? ' · ' + meta.join(', ') : ''}</div>
        <div class="saved-item-time">${p.history.length} reading${p.history.length !== 1 ? 's' : ''} · Last: ${latest.time || '—'}</div>
      </div>
      <div class="saved-item-vitals">
        <span>❤️ <b>${latest.hr ?? '--'}</b></span>
        <span>🌡️ <b>${latest.temp != null ? latest.temp.toFixed(1) : '--'}</b></span>
        <span>🫁 <b>${latest.spo2 ?? '--'}</b></span>
      </div>
      <div class="saved-item-actions">
        <button class="btn-sm btn-sm-del" onclick="deletePatient('${p.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ── BLE ────────────────────────────────────────────────────────
async function toggleBLE() {
  if (bleConnected) { disconnectBLE(); return; }
  if (!navigator.bluetooth) {
    alert('Web Bluetooth not supported.\nUse Chrome on desktop or Android.');
    return;
  }
  try {
    setBLEStatus('connecting');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'VitalPatch_Pro' }],
      optionalServices: ['12345678-1234-1234-1234-123456789abc']
    });
    device.addEventListener('gattserverdisconnected', onBLEDisconnect);
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService('12345678-1234-1234-1234-123456789abc');
    bleCharacteristic = await service.getCharacteristic('abcd1234-1234-1234-1234-123456789abc');
    await bleCharacteristic.startNotifications();
    bleCharacteristic.addEventListener('characteristicvaluechanged', onBLEData);
    bleConnected = true;
    setBLEStatus('connected');
  } catch (err) {
    setBLEStatus('disconnected');
    if (!err.message.includes('cancelled')) alert('Could not connect: ' + err.message);
  }
}

function disconnectBLE() {
  try { bleCharacteristic.service.device.gatt.disconnect(); } catch (e) {}
  bleConnected = false; bleCharacteristic = null;
  setBLEStatus('disconnected');
}

function onBLEDisconnect() {
  bleConnected = false; bleCharacteristic = null;
  setBLEStatus('disconnected');
}

function onBLEData(event) {
  const raw = new TextDecoder().decode(event.target.value);
  const map = {};
  raw.split(',').forEach(p => {
    const [k, v] = p.split(':');
    if (k && v !== undefined) map[k.trim()] = v.trim();
  });
  const hr     = parseInt(map['H']);
  const temp   = parseFloat(map['T']);
  const spo2   = parseInt(map['O']);
  const finger = map['F'] === '1';
  const weak   = map['W'] === '1';

  document.getElementById('fingerAlert').style.display = (!finger || weak) ? 'flex' : 'none';

  if (finger && !weak) {
    if (!isNaN(hr)   && hr   > 0) { vitals.hr   = hr;   pushChart(hrChart, hr); }
    if (!isNaN(temp) && temp > 0) { vitals.temp = temp;  pushChart(tempChart, temp); }
    if (!isNaN(spo2) && spo2 > 0) { vitals.spo2 = spo2;  pushChart(spo2Chart, spo2); }

    ['hrValue', 'tempValue', 'spo2Value'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.remove('live-pulse');
      void el.offsetWidth;
      el.classList.add('live-pulse');
    });
    updateSummary(); updateSections(); updateCondition(); checkAlarm();
  }
}

function setBLEStatus(s) {
  const btn    = document.getElementById('bleBtn');
  const dot    = document.getElementById('bleDot');
  const txt    = document.getElementById('bleBtnText');
  const banner = document.getElementById('bleBanner');
  const bTxt   = document.getElementById('bleBannerText');

  if (s === 'connected') {
    btn.className = 'btn-ble connected'; dot.className = 'ble-dot on';
    txt.textContent = 'DISCONNECT';
    banner.className = 'ble-banner connected';
    bTxt.textContent = '✅ VitalPatch ESP32 connected — streaming live vitals';
  } else if (s === 'connecting') {
    btn.className = 'btn-ble'; dot.className = 'ble-dot';
    txt.textContent = 'CONNECTING...';
    banner.className = 'ble-banner';
    bTxt.textContent = '🔄 Connecting to VitalPatch_Pro...';
  } else {
    btn.className = 'btn-ble'; dot.className = 'ble-dot';
    txt.textContent = 'CONNECT';
    banner.className = 'ble-banner';
    bTxt.textContent = '📡 Connect your VitalPatch ESP32 to stream live vitals.';
    document.getElementById('fingerAlert').style.display = 'none';
  }
}

// ── Status helpers ─────────────────────────────────────────────
function hrStatus(v) {
  if (!v) return { cls: 'normal', txt: 'Awaiting data' };
  if (v > 100) return { cls: 'high', txt: 'Tachycardia' };
  if (v < 60)  return { cls: 'low',  txt: 'Bradycardia' };
  return { cls: 'normal', txt: 'Normal sinus rhythm' };
}

function tempStatus(v) {
  if (!v) return { cls: 'normal', txt: 'Awaiting data' };
  if (v > 37.5) return { cls: 'high', txt: 'Fever detected' };
  if (v < 36.0) return { cls: 'low',  txt: 'Hypothermia risk' };
  return { cls: 'normal', txt: 'Normothermia' };
}

function spo2Status(v) {
  if (!v) return { cls: 'normal', txt: 'Awaiting data' };
  if (v < 90) return { cls: 'high', txt: 'Severe hypoxia' };
  if (v < 95) return { cls: 'low',  txt: 'Mild hypoxia' };
  return { cls: 'normal', txt: 'Normal saturation' };
}

function statusColor(cls) {
  return cls === 'normal' ? 'var(--good)' : cls === 'high' ? 'var(--danger)' : 'var(--warn)';
}

// ── Condition ──────────────────────────────────────────────────
function classifyCondition(hr, temp, spo2) {
  const issues = [];
  if (spo2 != null && spo2 < 90)   issues.push({ level: 'critical', msg: 'Severe hypoxia (SpO₂ ' + spo2 + '%)' });
  if (hr   != null && hr   > 120)  issues.push({ level: 'critical', msg: 'Severe tachycardia (' + hr + ' BPM)' });
  if (hr   != null && hr   < 45)   issues.push({ level: 'critical', msg: 'Severe bradycardia (' + hr + ' BPM)' });
  if (temp != null && temp > 39)   issues.push({ level: 'critical', msg: 'High fever (' + temp.toFixed(1) + '°C)' });

  if (issues.some(i => i.level === 'critical'))
    return { level: 'critical', icon: '🚨', label: 'CRITICAL', reason: issues.map(i => i.msg).join(' · ') };

  const warns = [];
  if (spo2 != null && spo2 < 95)    warns.push('Low SpO₂ (' + spo2 + '%)');
  if (hr   != null && hr   > 100)   warns.push('Tachycardia (' + hr + ' BPM)');
  if (hr   != null && hr   < 60)    warns.push('Bradycardia (' + hr + ' BPM)');
  if (temp != null && temp > 37.5)  warns.push('Fever (' + temp.toFixed(1) + '°C)');
  if (temp != null && temp < 36.0)  warns.push('Low temp (' + temp.toFixed(1) + '°C)');

  if (warns.length)
    return { level: 'monitor', icon: '⚠️', label: 'MONITOR', reason: warns.join(' · ') };
  if (!hr && !temp && !spo2)
    return { level: 'stable', icon: '⏳', label: 'AWAITING', reason: 'No vitals received yet' };

  return { level: 'stable', icon: '✅', label: 'STABLE', reason: 'All vitals within normal range' };
}

function updateCondition() {
  const c = classifyCondition(vitals.hr, vitals.temp, vitals.spo2);
  setConditionBanner('conditionBanner', 'conditionIcon', 'conditionVal', 'conditionReason', c);
  document.getElementById('conditionTime').textContent = new Date().toTimeString().slice(0, 8);
}

function setConditionBanner(bannerId, iconId, valId, reasonId, c) {
  const b = document.getElementById(bannerId);
  b.className = 'condition-banner ' + c.level;
  document.getElementById(iconId).textContent   = c.icon;
  document.getElementById(valId).textContent    = c.label;
  document.getElementById(reasonId).textContent = c.reason;
}

// ── Alarm ──────────────────────────────────────────────────────
function toggleAlarm() {
  alarmEnabled = !alarmEnabled;
  const btn = document.getElementById('alarmBtn');
  btn.className   = 'alarm-btn ' + (alarmEnabled ? 'alarm-off' : 'alarm-on');
  btn.textContent = alarmEnabled ? '🔔 ALARM ON' : '🔕 ALARM OFF';
  if (!alarmEnabled) alarmTriggered = false;
}

function checkAlarm() {
  if (!alarmEnabled) return;
  const c = classifyCondition(vitals.hr, vitals.temp, vitals.spo2);
  if (c.level === 'critical' && !alarmTriggered) {
    alarmTriggered = true;
    playAlarm();
  }
  if (c.level !== 'critical') alarmTriggered = false;
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (freq, start, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = 'sine';
      g.gain.setValueAtTime(0.4, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur + 0.05);
    };
    beep(880, 0, 0.15); beep(880, 0.2, 0.15); beep(880, 0.4, 0.15);
    beep(1100, 0.7, 0.3); beep(1100, 1.1, 0.3);
  } catch (e) {}
}

// ── Arrows ─────────────────────────────────────────────────────
function arrowChar(curr, prev, higher_is_worse) {
  if (curr == null || prev == null) return { char: '', cls: 'arrow-same' };
  if (curr > prev) return { char: '↑', cls: higher_is_worse ? 'arrow-up' : 'arrow-up' };
  if (curr < prev) return { char: '↓', cls: 'arrow-down' };
  return { char: '→', cls: 'arrow-same' };
}

function updateArrows() {
  const setArrow = (id, curr, prev) => {
    const a  = arrowChar(curr, prev, true);
    const el = document.getElementById(id);
    el.textContent = a.char; el.className = 'vital-arrow ' + a.cls;
  };
  setArrow('arrowHR',   vitals.hr,   prevVitals.hr);
  setArrow('arrowTemp', vitals.temp, prevVitals.temp);

  const sp   = arrowChar(vitals.spo2, prevVitals.spo2, false);
  const spEl = document.getElementById('arrowSpo2');
  spEl.textContent = sp.char;
  spEl.className   = 'vital-arrow ' + (
    vitals.spo2 != null && prevVitals.spo2 != null && vitals.spo2 < prevVitals.spo2
      ? 'arrow-up' : 'arrow-down'
  );
}

// ── Min / Max ──────────────────────────────────────────────────
function calcMinMax(history, key) {
  const vals = history.map(r => r[key]).filter(v => v != null);
  if (!vals.length) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

function renderMinMax(elId, mm, unit, decimals = 0) {
  const el = document.getElementById(elId);
  if (!mm) { el.innerHTML = ''; return; }
  el.innerHTML = `<span>Min <b>${mm.min.toFixed(decimals)}</b>${unit}</span><span>Max <b>${mm.max.toFixed(decimals)}</b>${unit}</span>`;
}

// ── Summary & sections ─────────────────────────────────────────
function updateSummary() {
  document.getElementById('summaryHR').textContent   = vitals.hr ?? '--';
  document.getElementById('summaryTemp').textContent = vitals.temp != null ? vitals.temp.toFixed(1) : '--';
  document.getElementById('summarySpo2').textContent = vitals.spo2 ?? '--';
}

function updateSections() {
  const hr = vitals.hr;
  document.getElementById('hrValue').textContent = hr ?? '--';
  setStatus('hrStatus', 'hrStatusText', hrStatus(hr));
  document.getElementById('hrGauge').style.width = hr
    ? Math.min(100, Math.max(0, ((hr - 20) / 230) * 100)) + '%' : '0%';

  const temp = vitals.temp;
  document.getElementById('tempValue').textContent = temp != null ? temp.toFixed(1) : '--';
  setStatus('tempStatus', 'tempStatusText', tempStatus(temp));
  document.getElementById('tempGauge').style.width = temp
    ? Math.min(100, Math.max(0, ((temp - 30) / 12) * 100)) + '%' : '0%';

  const spo2 = vitals.spo2;
  document.getElementById('spo2Value').textContent = spo2 ?? '--';
  setStatus('spo2Status', 'spo2StatusText', spo2Status(spo2));
  document.getElementById('spo2Gauge').style.width = spo2
    ? Math.min(100, spo2) + '%' : '0%';

  const p = currentID ? patients.find(x => x.id === currentID) : null;
  if (p) {
    renderMinMax('hrMinMax',   calcMinMax(p.history, 'hr'),   ' BPM');
    renderMinMax('tempMinMax', calcMinMax(p.history, 'temp'), '°C', 1);
    renderMinMax('spo2MinMax', calcMinMax(p.history, 'spo2'), '%');
  }
}

function setStatus(badgeId, textId, s) {
  const badge = document.getElementById(badgeId);
  badge.className   = 'status-badge status-' + s.cls;
  badge.textContent = s.cls === 'normal' ? 'NORMAL' : s.cls === 'high' ? 'HIGH' : 'LOW';
  const el = document.getElementById(textId);
  el.textContent = s.txt;
  el.style.color = statusColor(s.cls);
}

// ── User search ────────────────────────────────────────────────
function searchPatient() {
  const q = document.getElementById('searchQuery').value.trim().toLowerCase();
  if (!q) return;

  document.getElementById('searchResult').style.display = 'none';
  document.getElementById('notFound').style.display = 'none';

  const p = patients.find(x =>
    x.id.toLowerCase() === q || x.name.toLowerCase().includes(q)
  );
  if (!p) { document.getElementById('notFound').style.display = 'block'; return; }

  const latest = p.history[0] || {};
  document.getElementById('resultName').textContent = p.name;
  document.getElementById('resultIDLabel').textContent  = 'ID: ' + p.id;
  document.getElementById('resultAgeSex').textContent   = [p.age ? 'Age: ' + p.age : '', p.gender].filter(Boolean).join(' · ') || '';
  document.getElementById('resultReadings').textContent = p.history.length + ' reading' + (p.history.length !== 1 ? 's' : '');

  // Condition
  const c = classifyCondition(latest.hr, latest.temp, latest.spo2);
  setConditionBanner('userConditionBanner', 'userConditionIcon', 'userConditionVal', 'userConditionReason', c);

  // HR
  const hrEl = document.getElementById('resultHR');
  hrEl.textContent = latest.hr ?? '--';
  const hrS = hrStatus(latest.hr);
  hrEl.style.color = statusColor(hrS.cls);
  document.getElementById('resultHRStatus').textContent = hrS.txt;
  document.getElementById('resultHRStatus').style.color = statusColor(hrS.cls);
  const hrMM = calcMinMax(p.history, 'hr');
  document.getElementById('resultHRMinMax').textContent = hrMM ? 'Min: ' + hrMM.min + ' · Max: ' + hrMM.max + ' BPM' : '';

  // Temp
  const tEl = document.getElementById('resultTemp');
  tEl.textContent = latest.temp != null ? latest.temp.toFixed(1) : '--';
  const tS = tempStatus(latest.temp);
  tEl.style.color = statusColor(tS.cls);
  document.getElementById('resultTempStatus').textContent = tS.txt;
  document.getElementById('resultTempStatus').style.color = statusColor(tS.cls);
  const tMM = calcMinMax(p.history, 'temp');
  document.getElementById('resultTempMinMax').textContent = tMM ? 'Min: ' + tMM.min.toFixed(1) + ' · Max: ' + tMM.max.toFixed(1) + ' °C' : '';

  // SpO2
  const sEl = document.getElementById('resultSpo2');
  sEl.textContent = latest.spo2 ?? '--';
  const sS = spo2Status(latest.spo2);
  sEl.style.color = statusColor(sS.cls);
  document.getElementById('resultSpo2Status').textContent = sS.txt;
  document.getElementById('resultSpo2Status').style.color = statusColor(sS.cls);
  const sMM = calcMinMax(p.history, 'spo2');
  document.getElementById('resultSpo2MinMax').textContent = sMM ? 'Min: ' + sMM.min + ' · Max: ' + sMM.max + ' %' : '';

  // History table
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = p.history.map((r, i) => {
    const hs = hrStatus(r.hr), ts = tempStatus(r.temp), ss = spo2Status(r.spo2);
    return `<tr>
      <td style="color:var(--muted)">${p.history.length - i}</td>
      <td style="color:var(--muted)">${r.time}</td>
      <td class="ht-${hs.cls}">${r.hr ?? '--'}</td>
      <td class="ht-${ts.cls}">${r.temp != null ? r.temp.toFixed(1) : '--'}</td>
      <td class="ht-${ss.cls}">${r.spo2 ?? '--'}</td>
      <td class="ht-${hs.cls}">${hs.txt}</td>
      <td class="ht-${ts.cls}">${ts.txt}</td>
      <td class="ht-${ss.cls}">${ss.txt}</td>
    </tr>`;
  }).join('');

  document.getElementById('searchResult').style.display = 'block';
}

// ── Print Report ───────────────────────────────────────────────
function printReport() {
  const idText = document.getElementById('resultIDLabel').textContent.replace('ID: ', '');
  const p = patients.find(x => x.id === idText);
  if (!p) return;

  const latest = p.history[0] || {};
  const hrS  = hrStatus(latest.hr);
  const tS   = tempStatus(latest.temp);
  const sS   = spo2Status(latest.spo2);
  const cond = classifyCondition(latest.hr, latest.temp, latest.spo2);
  const hrMM = calcMinMax(p.history, 'hr');
  const tMM  = calcMinMax(p.history, 'temp');
  const sMM  = calcMinMax(p.history, 'spo2');
  const condColor = cond.level === 'stable' ? '#1a7a40' : cond.level === 'monitor' ? '#b35c00' : '#cc0022';

  const histRows = p.history.map((r, i) => {
    const hs = hrStatus(r.hr), ts = tempStatus(r.temp), ss = spo2Status(r.spo2);
    const c = (s) => s.cls === 'normal' ? '#1a7a40' : s.cls === 'high' ? '#cc0022' : '#b35c00';
    return `<tr style="border-bottom:1px solid #e8eef4">
      <td style="padding:7px 10px;color:#999;font-size:12px">${p.history.length - i}</td>
      <td style="padding:7px 10px;color:#666;font-size:12px">${r.time}</td>
      <td style="padding:7px 10px;font-weight:600;color:${c(hs)}">${r.hr ?? '--'}</td>
      <td style="padding:7px 10px;font-weight:600;color:${c(ts)}">${r.temp != null ? r.temp.toFixed(1) : '--'}</td>
      <td style="padding:7px 10px;font-weight:600;color:${c(ss)}">${r.spo2 ?? '--'}</td>
      <td style="padding:7px 10px;color:${c(hs)};font-size:12px">${hs.txt}</td>
      <td style="padding:7px 10px;color:${c(ts)};font-size:12px">${ts.txt}</td>
      <td style="padding:7px 10px;color:${c(ss)};font-size:12px">${ss.txt}</td>
    </tr>`;
  }).join('');

  const vc = (s) => s.cls === 'normal' ? '#1a7a40' : s.cls === 'high' ? '#cc0022' : '#b35c00';

  const html = `<!DOCTYPE html><html><head><title>VitalPatch Report — ${p.name}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;background:#fff}@media print{button{display:none!important}}</style>
  </head><body><div style="max-width:820px;margin:0 auto;padding:40px 32px">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #e02040;padding-bottom:20px;margin-bottom:28px">
      <div><div style="font-size:30px;font-weight:800;letter-spacing:2px">VITAL<span style="color:#0077cc">PATCH</span></div><div style="font-size:11px;letter-spacing:3px;color:#888;margin-top:4px">PATIENT CLINICAL REPORT</div></div>
      <div style="text-align:right;font-size:12px;color:#666"><div>Printed: ${new Date().toLocaleString()}</div><div style="margin-top:4px">VitalPatch Monitor v21</div></div>
    </div>
    <div style="background:#f7f9fc;border:1px solid #e0e8f0;border-radius:12px;padding:20px 24px;margin-bottom:20px;display:flex;gap:32px;flex-wrap:wrap">
      <div><div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase">Patient Name</div><div style="font-size:22px;font-weight:700;margin-top:4px">${p.name}</div></div>
      <div><div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase">Patient ID</div><div style="font-size:22px;font-weight:700;margin-top:4px;color:#0077cc">${p.id}</div></div>
      ${p.age    ? `<div><div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase">Age</div><div style="font-size:22px;font-weight:700;margin-top:4px">${p.age}</div></div>` : ''}
      ${p.gender ? `<div><div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase">Gender</div><div style="font-size:22px;font-weight:700;margin-top:4px">${p.gender}</div></div>` : ''}
      <div><div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase">Total Readings</div><div style="font-size:22px;font-weight:700;margin-top:4px">${p.history.length}</div></div>
    </div>
    <div style="background:${cond.level === 'stable' ? '#f0fdf4' : cond.level === 'monitor' ? '#fffbeb' : '#fff5f5'};border:2px solid ${condColor};border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
      <div style="font-size:28px">${cond.icon}</div>
      <div><div style="font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase">Patient Condition</div><div style="font-size:22px;font-weight:700;color:${condColor}">${cond.label}</div><div style="font-size:13px;color:#666;margin-top:2px">${cond.reason}</div></div>
    </div>
    <div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:12px">Latest Vitals</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">
      <div style="border:2px solid ${vc(hrS)};border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:6px">❤️</div>
        <div style="font-size:30px;font-weight:700;color:${vc(hrS)}">${latest.hr ?? '--'}</div>
        <div style="font-size:10px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Heart Rate BPM</div>
        <div style="font-size:12px;font-weight:600;margin-top:5px;color:${vc(hrS)}">${hrS.txt}</div>
        ${hrMM ? `<div style="font-size:11px;color:#999;margin-top:4px">Min ${hrMM.min} · Max ${hrMM.max}</div>` : ''}
      </div>
      <div style="border:2px solid ${vc(tS)};border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:6px">🌡️</div>
        <div style="font-size:30px;font-weight:700;color:${vc(tS)}">${latest.temp != null ? latest.temp.toFixed(1) : '--'}</div>
        <div style="font-size:10px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Temperature °C</div>
        <div style="font-size:12px;font-weight:600;margin-top:5px;color:${vc(tS)}">${tS.txt}</div>
        ${tMM ? `<div style="font-size:11px;color:#999;margin-top:4px">Min ${tMM.min.toFixed(1)} · Max ${tMM.max.toFixed(1)}</div>` : ''}
      </div>
      <div style="border:2px solid ${vc(sS)};border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:6px">🫁</div>
        <div style="font-size:30px;font-weight:700;color:${vc(sS)}">${latest.spo2 ?? '--'}</div>
        <div style="font-size:10px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:1px">SpO₂ %</div>
        <div style="font-size:12px;font-weight:600;margin-top:5px;color:${vc(sS)}">${sS.txt}</div>
        ${sMM ? `<div style="font-size:11px;color:#999;margin-top:4px">Min ${sMM.min} · Max ${sMM.max}</div>` : ''}
      </div>
    </div>
    <div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:12px">Full Reading History</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f0f4f8">
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">#</th>
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">Time</th>
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">HR</th>
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">Temp</th>
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">SpO₂</th>
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">HR Status</th>
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">Temp Status</th>
        <th style="padding:9px 10px;text-align:left;font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase">SpO₂ Status</th>
      </tr></thead>
      <tbody>${histRows}</tbody>
    </table>
    <div style="margin-top:40px;padding-top:14px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:11px;color:#aaa">
      <span>VitalPatch Patient Monitor — Auto-generated Clinical Report</span><span>Page 1 of 1</span>
    </div>
  </div><script>window.onload=()=>window.print()<\/script></body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html);
  w.document.close();
}
