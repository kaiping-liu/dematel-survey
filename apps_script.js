/** Web App: text/plain JSON -> write to a sheet named by surveyId, and log to 'history' */
const SHARED_KEY = ''; // 可留空
const VERSION = 'v2025-08-13-5';
const HISTORY_SHEET_NAME = 'history';

function doPost(e) {
  try {
    if (!e || !e.postData) return txt('Bad Request');
    const ct = e.postData.type || '';
    if (!ct.startsWith('text/plain')) return txt('Unsupported Media Type');

    const raw = e.postData.contents || '';
    if (!raw) return txt('Empty body');

    let data;
    try { data = JSON.parse(raw); }
    catch (_) { return txt('Invalid JSON syntax'); }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return txt('Invalid JSON: must be an object');
    }

    if (SHARED_KEY && data.key !== SHARED_KEY) return txt('Unauthorized');

    const surveyId = String(data.surveyId ?? '').trim();
    if (!surveyId) return txt('Missing field: surveyId');

    const ss = SpreadsheetApp.getActive();

    // 1) 以 surveyId 命名分頁：清空或新建
    const safeName = sanitizeSheetName(surveyId);
    let sheet = ss.getSheetByName(safeName);
    if (sheet) sheet.clearContents();
    else sheet = ss.insertSheet(safeName);

    // 1-1) 基本資料（忽略 answers）：展平 key/value，並格式化時間
    const dataForKV = Object.assign({}, data);
    dataForKV.startTime = formatTimestamp(dataForKV.startTime);
    dataForKV.endTime = formatTimestamp(dataForKV.endTime);

    const kvPairs = flattenObj(dataForKV, '', ['answers']);
    const kvOutput = [['key', 'value']];
    kvPairs.forEach(([k, v]) => kvOutput.push([k, v]));
    sheet.getRange(1, 1, kvOutput.length, 2).setValues(kvOutput);

    // 基本資料後空一行
    let nextRow = kvOutput.length + 1;

    // 2) DEMATEL 矩陣（可能多組）
    const answers = (data.answers && typeof data.answers === 'object') ? data.answers : null;
    if (answers) {
      const matrices = buildDematelMatrices(answers); // [{labels, matrix}]
      for (let i = 0; i < matrices.length; i++) {
        const { labels, matrix } = matrices[i];

        // 2-1) 標題列：A=answers.matrix_X，B=Group: 起-迄
        nextRow += 1;
        sheet.getRange(nextRow, 1).setValue(`answers.matrix_${i + 1}`);
        sheet.getRange(nextRow, 2).setValue(`Group: ${groupLabel(labels)}`);

        // 2-2) 矩陣：從第2欄(B)開始；B列標籤，C..欄頭
        const out = [];
        out.push([''].concat(labels));         // B空白，C..為欄頭
        for (let r = 0; r < labels.length; r++) {
          out.push([labels[r]].concat(matrix[r])); // B為列名，C..為數值
        }
        sheet.getRange(nextRow + 1, 2, out.length, out[0].length).setValues(out);

        // 2-3) 矩陣之後留一行空白
        nextRow += out.length + 1;
      }
    }

    // 3) history：追加原始 JSON
    const historyHeaders = ['timestamp', 'surveyId', 'json'];
    const history = ensureSheetWithHeaders(ss, HISTORY_SHEET_NAME, historyHeaders);
    history.appendRow([new Date(), surveyId, JSON.stringify(data)]);

    return json({ ok: true, version: VERSION, sheet: safeName, history: HISTORY_SHEET_NAME });
  } catch (err) {
    return json({ ok: false, error: String(err), version: VERSION });
  }
}

/* ---- helpers ---- */
function txt(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function sanitizeSheetName(name) {
  let s = String(name);
  s = s.replace(/[:\\/?*\[\]]/g, '_').substring(0, 100);
  if (s.trim() === '') s = 'sheet_' + Date.now();
  return s;
}
function ensureSheetWithHeaders(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}
function flattenObj(obj, prefix = '', skipKeys = []) {
  const kv = [];
  for (const key in obj) {
    if (skipKeys.includes(key)) continue;
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) kv.push([newKey, '']);
    else if (Array.isArray(val)) kv.push([newKey, val.map(x => (x && typeof x === 'object') ? JSON.stringify(x) : String(x)).join(', ')]);
    else if (typeof val === 'object') kv.push(...flattenObj(val, newKey, []));
    else kv.push([newKey, val]);
  }
  return kv;
}

/** ===== DEMATEL ===== */
function buildDematelMatrices(answers) {
  const pairs = [];
  const neighbors = new Map();
  const labelsSet = new Set();

  for (const key in answers) {
    if (!key.includes('|')) continue;
    const [l0, r0] = key.split('|');
    const l = (l0 || '').trim(), r = (r0 || '').trim();
    if (!l || !r) continue;

    const [a0, b0] = String(answers[key] ?? '').trim().split('|');
    const a = toNum(a0), b = toNum(b0);
    pairs.push({ l, r, a, b });

    labelsSet.add(l); labelsSet.add(r);
    if (!neighbors.has(l)) neighbors.set(l, new Set());
    if (!neighbors.has(r)) neighbors.set(r, new Set());
    neighbors.get(l).add(r); neighbors.get(r).add(l);
  }

  // 連通群組
  const labels = Array.from(labelsSet);
  const visited = new Set();
  const components = [];
  for (const node of labels) {
    if (visited.has(node)) continue;
    const comp = [];
    const q = [node];
    visited.add(node);
    while (q.length) {
      const cur = q.shift();
      comp.push(cur);
      for (const nb of (neighbors.get(cur) || new Set())) {
        if (!visited.has(nb)) { visited.add(nb); q.push(nb); }
      }
    }
    comp.sort(naturalLabelCompare);
    components.push(comp);
  }

  // 生成矩陣
  const matrices = [];
  for (const comp of components) {
    const idx = new Map(); comp.forEach((lab,i)=>idx.set(lab,i));
    const n = comp.length;
    const M = Array.from({ length: n }, () => Array(n).fill(0));
    for (const { l, r, a, b } of pairs) {
      if (!idx.has(l) || !idx.has(r)) continue;
      const i = idx.get(l), j = idx.get(r);
      M[i][j] = a; M[j][i] = b;
    }
    matrices.push({ labels: comp, matrix: M });
  }
  matrices.sort((A,B)=>naturalLabelCompare(A.labels[0], B.labels[0]));
  return matrices;
}
function toNum(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function naturalLabelCompare(a, b) {
  const pa = parseLabel(a), pb = parseLabel(b);
  const ab = pa.prefix.localeCompare(pb.prefix, undefined, { sensitivity: 'accent' });
  if (ab !== 0) return ab;
  if (pa.num !== null && pb.num !== null) return pa.num - pb.num;
  if (pa.num !== null) return -1;
  if (pb.num !== null) return 1;
  return String(a).localeCompare(String(b));
}
function parseLabel(s) {
  const m = String(s).match(/^([A-Za-z]+)(\d+)?$/);
  if (!m) return { prefix: String(s).toLowerCase(), num: null };
  return { prefix: m[1].toLowerCase(), num: m[2] ? parseInt(m[2], 10) : null };
}
function groupLabel(labels) {
  if (!labels || labels.length === 0) return '';
  return `${labels[0]}-${labels[labels.length - 1]}`;
}

/** 時間格式化：'YYYY-MM-DD hh-mm-ss'；支援毫秒/秒/可解析字串 */
function formatTimestamp(v) {
  if (v === null || v === undefined || v === '') return '';
  let ms;
  if (typeof v === 'number' && isFinite(v)) {
    ms = (v > 1e12) ? v : (v > 1e9 ? v * 1000 : v);
  } else {
    const t = new Date(v);
    if (isNaN(t.getTime())) return String(v);
    ms = t.getTime();
  }
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
