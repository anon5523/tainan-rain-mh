// 南雨人孔調查表快找｜LINE 機器人（Netlify Function）
// 環境變數：LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、SITE_URL（例：https://tainan-rain-mh.netlify.app）
import crypto from 'node:crypto';
import DATA from './mh-data.mjs';
import MENU_IMG from './richmenu-img.mjs';

export const config = { path: '/api/line' };

const PDF = 'https://sewer.water.tainan.gov.tw/TNRS/Uploads/investigate/';
const CLS = { N: '正常人孔', C: '覆蓋人孔', V: '虛人孔' };
const CODES = DATA.codes;
const CODE_LIST = [...new Set(CODES.map(c => c.c))].sort((a, b) => b.length - a.length);
const BYC = {};
for (const [id, v] of Object.entries(DATA.mh)) {
  if (!v[4]) continue;
  const c = CODE_LIST.find(k => id.startsWith(k) && /^\d+$/.test(id.slice(k.length)));
  if (c) (BYC[c] = BYC[c] || []).push(id);
}
for (const c in BYC) BYC[c].sort((a, b) => +a.slice(c.length) - +b.slice(c.length));
const AA = DATA.aa || {};
const env = k => String((globalThis.Netlify?.env?.get?.(k)) ?? process.env[k] ?? '').trim();

const get = id => {
  const r = DATA.mh[id];
  if (!r) return null;
  const [x, y, z, d, pdf, cl, rd, lat, lon] = r;
  const code = CODE_LIST.find(k => id.startsWith(k) && /^\d+$/.test(id.slice(k.length)));
  const a = AA[id];
  return { id, x, y, z, d, pdf: !!pdf, cl, rd, lat, lon, code, inv: z != null && d != null ? +(z - d).toFixed(2) : null,
    aa: a ? { e1: a[0], e2: a[1], e3: a[2], tw: a[3], bw: a[4], bh: a[5], nk: a[6], fl: a[7] || '' } : null };
};
const dname = c => (CODES.find(x => x.c === c) || {}).d || '';

function lookup(c, n) {
  for (const k of [n, n.padStart(3, '0'), n.padStart(4, '0'), String(+n).padStart(3, '0')]) {
    if (DATA.mh[c + k]) return get(c + k);
  }
  return null;
}

// 解析使用者輸入：CWCR387、cwcr 387、中西區387、中西 387、北區 12
function parse(text) {
  const t = text.trim().toUpperCase().replace(/[－—–]/g, '-');
  let m = t.match(/^([A-Z]{2,4})\s*-?\s*(\d{1,4})$/);
  if (m) return { code: m[1], num: m[2] };
  m = t.match(/^([一-鿿]{1,3}?)區?\s*(\d{1,4})$/);
  if (m) {
    const hits = CODES.filter(c => c.d.replace(/區$/, '') === m[1] || c.d === m[1]);
    if (hits.length) return { code: hits[0].c, num: m[2], multi: hits.length > 1 ? hits : null };
  }
  m = t.match(/^([一-鿿]{1,3}?)區?$/);
  if (m) {
    const hits = CODES.filter(c => c.d.replace(/區$/, '') === m[1]);
    if (hits.length) return { district: hits };
  }
  return null;
}

const fmt = v => (v == null ? '—' : v.toFixed(2) + ' m');
const site = () => env('SITE_URL').replace(/\/$/, '');
const nearUri = () => (env('LIFF_ID') ? `https://liff.line.me/${env('LIFF_ID')}` : 'https://line.me/R/nv/location/');

function aaFlex(a) {
  const f = v => (v == null ? '—' : v.toFixed(2));
  const bwT = a.bw ? a.bw.reduce((p, q) => p + q, 0) : null;
  const r = a.tw && bwT ? Math.min(0.6, Math.max(0.22, a.tw / bwT)) : 0.35;
  const share = a.nk && a.bh ? Math.min(0.6, Math.max(0.25, a.nk / (a.nk + a.bh))) : 0.4;
  const BW = 110, HT = 96, x0 = 34, y0 = 14, sw = Math.round(BW * r), nkp = Math.round(HT * share), bhp = HT - nkp;
  const abs = (x, y, w, h, extra) => ({ type: 'box', layout: 'vertical', position: 'absolute', offsetStart: `${x}px`, offsetTop: `${y}px`, width: `${w}px`, height: `${h}px`, contents: [], ...extra });
  const txt = (x, y, t, color, size, w, align) => ({ type: 'box', layout: 'vertical', position: 'absolute', offsetStart: `${x}px`, offsetTop: `${y}px`, width: `${w || 90}px`, contents: [{ type: 'text', text: t, size: size || 'xxs', color: color || '#17202e', align: align || 'start', weight: 'bold' }] });
  const P = '#d63384';
  const yBox = y0 + nkp, yBot = yBox + bhp, xr = x0 + BW;
  return { type: 'box', layout: 'vertical', height: `${yBot + 26}px`, margin: 'md', backgroundColor: '#f2f4f7', cornerRadius: '8px', contents: [
    abs(x0, yBox, BW, bhp, { borderWidth: '2px', borderColor: '#17202e', backgroundColor: '#dbe7fb' }),
    abs(xr - sw, y0, sw, nkp + 2, { borderWidth: '2px', borderColor: '#17202e', backgroundColor: '#eef3fc' }),
    txt(xr + 6, y0 - 6, `EL ${f(a.e1)}`), txt(xr + 6, yBox - 6, `EL ${f(a.e2)}`), txt(xr + 6, yBot - 8, `EL ${f(a.e3)}`),
    txt(xr - sw - 40, y0 - 13, `${a.tw ?? '—'}cm`, P, 'xxs', sw + 80, 'center'),
    txt(x0 - 30, yBot + 4, `${bwT ?? '—'}cm`, P, 'xxs', BW + 60, 'center'),
    txt(0, yBox + bhp / 2 - 7, `${a.bh ?? '—'}`, P, 'xxs', x0 - 2, 'end'),
    txt(0, y0 + nkp / 2 - 7, `${a.nk ?? '—'}`, P, 'xxs', xr - sw - 3, 'end'),
  ] };
}

let NO_DRAW = false;
function bubble(o, dist) {
  const rows = [
    ['人孔頂高程', fmt(o.z)], ['人孔深度', fmt(o.d)], ['底高程', fmt(o.inv)],
    ['TWD97 X', o.x == null ? '—' : o.x.toFixed(3)], ['TWD97 Y', o.y == null ? '—' : o.y.toFixed(3)],
  ];
  const ll = o.lat != null ? `${o.lat.toFixed(6)}, ${o.lon.toFixed(6)}` : null;
  const buttons = [];
  if (o.pdf) buttons.push({ type: 'button', style: 'primary', height: 'sm', color: '#0b63ce', action: { type: 'uri', label: '開啟調查表', uri: PDF + o.id + '.pdf' } });
  if (o.pdf && o.aa) buttons.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: '看斷面原圖（第3頁）', uri: PDF + o.id + '.pdf#page=3' } });
  if (o.lat != null) {
    buttons.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'Google 地圖', uri: `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lon}` } });
    buttons.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'clipboard', label: '複製經緯度', clipboardText: ll } });
  }
  if (site()) buttons.push({ type: 'button', style: 'link', height: 'sm', action: { type: 'uri', label: '在快找開啟', uri: `${site()}/#${o.id}` } });
  return {
    type: 'bubble', size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: '#0b63ce', paddingAll: '14px', contents: [
        { type: 'text', text: o.id, color: '#ffffff', weight: 'bold', size: 'xl' },
        { type: 'text', text: [dname(o.code), o.rd, CLS[o.cl]].filter(Boolean).join('・') || ' ', color: '#ffffffcc', size: 'xs', wrap: true },
        ...(dist != null ? [{ type: 'text', text: `距離 ${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(2) + ' km'}`, color: '#ffffff', size: 'sm', weight: 'bold', margin: 'sm' }] : []),
      ],
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
      contents: [
        ...rows.map(([k, v]) => ({ type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: k, size: 'sm', color: '#687386', flex: 4 },
          { type: 'text', text: v, size: 'sm', color: '#17202e', weight: 'bold', flex: 6, align: 'end' },
        ] })),
        ...(o.aa ? [
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'A-A 斷面（調查表第 3 頁）', size: 'sm', color: '#0b63ce', weight: 'bold', margin: 'md' },
          ...(o.aa.fl ? [{ type: 'text', text: o.aa.fl === 'A' ? '＊斷面圖無法辨識，以屬性表推算' : '＊部分數值以管線／人孔屬性表補足', size: 'xxs', color: '#b54708', wrap: true }] : []),
          ...[['箱涵頂高程', fmt(o.aa.e2)], ['渠底高程', fmt(o.aa.e3)], ['人孔直徑', o.aa.tw != null ? o.aa.tw + ' cm' : '—'],
            ['箱涵寬度', o.aa.bw ? o.aa.bw.reduce((p, q) => p + q, 0) + ' cm' : '—'], ['箱涵淨高', o.aa.bh != null ? o.aa.bh + ' cm' : '—']]
            .map(([k, v]) => ({ type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: k, size: 'sm', color: '#687386', flex: 4 },
              { type: 'text', text: v, size: 'sm', color: '#17202e', weight: 'bold', flex: 6, align: 'end' } ] })),
          ...(NO_DRAW ? [] : [aaFlex(o.aa)]),
        ] : []),
        ...(ll ? [
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '經緯度（WGS84）', size: 'sm', color: '#687386', margin: 'md' },
          { type: 'text', text: ll, size: 'md', color: '#17202e', weight: 'bold', wrap: true },
        ] : []),
      ],
    },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons.length ? buttons : [{ type: 'text', text: '此人孔沒有調查表', size: 'xs', color: '#687386', align: 'center' }] },
  };
}

const quick = () => ({
  items: [
    { type: 'action', action: { type: 'uri', label: '📍 附近人孔', uri: nearUri() } },
    { type: 'action', action: { type: 'location', label: '🗺️ 地圖搜尋' } },
    { type: 'action', action: { type: 'postback', label: '🗂️ 選行政區', data: 'act=dist', displayText: '選行政區' } },
    ...(site() ? [{ type: 'action', action: { type: 'uri', label: '🔍 開啟快找', uri: site() } }] : []),
  ],
});
const textMsg = text => ({ type: 'text', text, quickReply: quick() });
const flexMsg = (alt, contents) => ({ type: 'flex', altText: alt, contents, quickReply: quick() });

// ---------- 點選介面 ----------
const cell = (title, sub, data, display, color) => ({
  type: 'box', layout: 'vertical', flex: 1, backgroundColor: color || '#e8f0fc', cornerRadius: '8px', paddingAll: '8px', justifyContent: 'center',
  action: { type: 'postback', label: String(title).slice(0, 20), data, displayText: display },
  contents: [
    { type: 'text', text: String(title), size: 'sm', weight: 'bold', color: '#0b63ce', align: 'center', wrap: true },
    ...(sub ? [{ type: 'text', text: String(sub), size: 'xxs', color: '#687386', align: 'center', wrap: true }] : []),
  ],
});
const filler = () => ({ type: 'box', layout: 'vertical', flex: 1, contents: [] });
function grid(cells, per) {
  const rows = [];
  for (let i = 0; i < cells.length; i += per) {
    const r = cells.slice(i, i + per);
    while (r.length < per) r.push(filler());
    rows.push({ type: 'box', layout: 'horizontal', spacing: 'sm', contents: r });
  }
  return rows;
}
const panel = (title, sub, rows, size) => ({
  type: 'bubble', size: size || 'mega',
  header: { type: 'box', layout: 'vertical', backgroundColor: '#0b63ce', paddingAll: '12px', contents: [
    { type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'md', wrap: true },
    ...(sub ? [{ type: 'text', text: sub, color: '#ffffffcc', size: 'xxs', wrap: true }] : []),
  ] },
  body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '10px', contents: rows },
});

function districtPicker() {
  const cells = CODES.filter(c => BYC[c.c]).map(c => cell(c.d, `${c.c}・${BYC[c.c].length}`, `act=d&c=${c.c}`, `${c.d}（${c.c}）`));
  return flexMsg('選擇行政區', panel('選擇行政區', '由南往北排列・數字為調查表份數', grid(cells, 3)));
}
function idPanels(c, ids, title) {
  const bubbles = [];
  for (let i = 0; i < ids.length && bubbles.length < 12; i += 25) {
    const part = ids.slice(i, i + 25);
    const cells = part.map(id => cell(id.slice(c.length), '', `act=id&id=${id}`, id, '#ffffff'));
    bubbles.push(panel(title, `${part[0]} ～ ${part[part.length - 1]}`, grid(cells, 5), 'kilo'));
  }
  return flexMsg(title, bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles });
}
function rangePicker(c) {
  const ids = BYC[c] || [];
  const name = `${dname(c)}（${c}）`;
  if (!ids.length) return textMsg(`${name}沒有調查表。`);
  if (ids.length <= 25) return idPanels(c, ids, `${name} 選擇人孔`);
  const groups = {};
  for (const id of ids) { const h = Math.floor(+id.slice(c.length) / 100); (groups[h] = groups[h] || []).push(id); }
  const cells = Object.keys(groups).map(Number).sort((a, b) => a - b).map(h => {
    const g = groups[h], a = g[0].slice(c.length), b = g[g.length - 1].slice(c.length);
    return cell(`${a}–${b}`, `${g.length} 份`, `act=r&c=${c}&h=${h}`, `${c} ${a}–${b}`);
  });
  return flexMsg(`${name} 選擇編號範圍`, panel(`${name}`, `共 ${ids.length} 份調查表・先選編號範圍`, grid(cells, 3)));
}
function hundredPanel(c, h) {
  const ids = (BYC[c] || []).filter(id => Math.floor(+id.slice(c.length) / 100) === h);
  return ids.length ? idPanels(c, ids, `${dname(c)}（${c}）選擇人孔`) : textMsg('這個範圍沒有調查表。');
}

// 模糊搜尋：只打數字（1、01、001、0001）→ 列出各區同編號的人孔
const DORD = {};
CODES.forEach((c, k) => { if (!(c.c in DORD)) DORD[c.c] = k; });
function numberPicker(num) {
  const n = String(+num);
  const ex = [], pre = [];
  for (const c of Object.keys(BYC)) for (const id of BYC[c]) {
    const k = String(+id.slice(c.length));
    if (k === n) ex.push([c, id]); else if (k.startsWith(n)) pre.push([c, id]);
  }
  ex.sort((a, b) => DORD[a[0]] - DORD[b[0]]);
  if (ex.length === 1) { const o = get(ex[0][1]); return flexMsg(`${o.id} 頂高程 ${fmt(o.z)} 深度 ${fmt(o.d)}`, bubble(o)); }
  const list = ex.length ? ex : pre.sort((a, b) => +a[1].slice(a[0].length) - +b[1].slice(b[0].length) || DORD[a[0]] - DORD[b[0]]).slice(0, 60);
  if (!list.length) return textMsg(`找不到編號 ${num} 的人孔。`);
  const cells = list.slice(0, 60).map(([c, id]) => cell(id, dname(c), `act=id&id=${id}`, id, '#ffffff'));
  const bubbles = [];
  for (let i = 0; i < cells.length; i += 24) bubbles.push(panel(ex.length ? `編號 ${n} 的人孔` : `編號 ${n} 開頭的人孔`, `${list.length} 筆${list.length > 60 ? '（顯示前 60 筆）' : ''}・由南往北排列`, grid(cells.slice(i, i + 24), 3)));
  return flexMsg(`編號 ${n} 的人孔`, bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles });
}

function nearPicker(lat, lon) {
  const list = nearest(lat, lon, 12);
  if (!list.length) return textMsg('附近找不到人孔。');
  const fd = d => (d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km');
  const rows = list.map(([id, d]) => {
    const o = get(id);
    return { type: 'box', layout: 'horizontal', spacing: 'md', paddingAll: '10px', backgroundColor: '#f2f4f7', cornerRadius: '8px',
      action: { type: 'postback', label: id, data: `act=id&id=${id}`, displayText: id },
      contents: [
        { type: 'text', text: id, weight: 'bold', color: '#0b63ce', size: 'sm', flex: 4 },
        { type: 'text', text: o.rd || dname(o.code) || ' ', size: 'xs', color: '#687386', flex: 6, wrap: false },
        { type: 'text', text: fd(d), size: 'sm', weight: 'bold', color: '#17202e', flex: 3, align: 'end' },
      ] };
  });
  return flexMsg(`附近的人孔：${list.slice(0, 3).map(x => x[0]).join('、')}…`, {
    type: 'bubble', size: 'mega',
    header: { type: 'box', layout: 'vertical', backgroundColor: '#0b63ce', paddingAll: '12px', contents: [
      { type: 'text', text: '📍 附近的人孔', color: '#ffffff', weight: 'bold', size: 'md' },
      { type: 'text', text: '由近到遠・點一下看資料', color: '#ffffffcc', size: 'xxs' } ] },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '10px', contents: rows },
  });
}

function nearest(lat, lon, k) {
  const r = Math.PI / 180, cos = Math.cos(lat * r), out = [];
  for (const [id, v] of Object.entries(DATA.mh)) {
    if (v[7] == null || v[5] === 'V') continue;
    const dx = (v[8] - lon) * r * cos * 6371000, dy = (v[7] - lat) * r * 6371000;
    out.push([id, Math.hypot(dx, dy)]);
  }
  return out.sort((a, b) => a[1] - b[1]).slice(0, k);
}

const HELP = '輸入人孔編號就能查詢，例如：\n・CWCR387\n・中西區 387\n・cwcr387\n・只打數字（1、001、0001）會列出各區同編號的人孔\n\n也可以用下方選單：\n・📍 附近人孔：自動定位，列出最近的人孔\n・🗺️ 地圖搜尋：在地圖上點選位置，回傳最近 5 個\n・🗂️ 選行政區：依區、編號範圍點選\n・輸入區名（例如「北區」）直接選編號';

function answer(ev) {
  const inGroup = ev.source && ev.source.type !== 'user';
  if (ev.type === 'follow') return [textMsg('歡迎使用南雨人孔調查表快找！\n\n' + HELP)];
  if (ev.type === 'join') return [textMsg('大家好，我是南雨人孔快找 👋\n\n在群組裡直接打人孔編號（例如 CWCR387、中西區 387）我就會回覆。\n要選行政區或查區名，請 @我：\n・@南雨人孔快找 北區\n・只 @我 → 跳出行政區選單\n\n其他聊天內容我不會打擾。傳送位置資訊時，我會回覆附近的人孔。\n\n也可以點下方按鈕操作。')];
  if (ev.type === 'postback') {
    const q = new URLSearchParams(ev.postback.data);
    const act = q.get('act');
    if (act === 'dist') return [districtPicker()];
    if (act === 'd') return [rangePicker(q.get('c'))];
    if (act === 'r') return [hundredPanel(q.get('c'), +q.get('h'))];
    if (act === 'id') { const o = get(q.get('id')); return o ? [flexMsg(`${o.id} 頂高程 ${fmt(o.z)} 深度 ${fmt(o.d)} ${o.lat != null ? o.lat.toFixed(6) + ',' + o.lon.toFixed(6) : ''}`, bubble(o))] : [textMsg('查無此人孔。')]; }
    return null;
  }
  if (ev.type !== 'message') return null;
  const m = ev.message;
  if (m.type === 'location') return [nearPicker(m.latitude, m.longitude)];
  if (m.type !== 'text') return inGroup ? null : [textMsg(HELP)];
  let t = m.text;
  if (inGroup) {
    // 群組裡：只有 @ 本帳號才回應
    const ms = (m.mention && m.mention.mentionees) || [];
    if (!ms.some(x => x.isSelf)) {
      // 沒有 @：只在「整則訊息就是一個存在的人孔編號」時回應
      const q = parse(t);
      const o = q && q.code && q.num && !q.district ? lookup(q.code, q.num) : null;
      return o ? [flexMsg(`${o.id} 頂高程 ${fmt(o.z)} 深度 ${fmt(o.d)} ${o.lat != null ? o.lat.toFixed(6) + ',' + o.lon.toFixed(6) : ''}`, bubble(o))] : null;
    }
    for (const x of [...ms].sort((a, b) => b.index - a.index)) t = t.slice(0, x.index) + ' ' + t.slice(x.index + x.length);
    t = t.trim();
    if (!t) return [districtPicker()];
  }
  t = t.trim();
  if (/^(help|說明|\?|？|使用說明|怎麼用)$/i.test(t)) return [textMsg(HELP)];
  if (/^(選區|選行政區|行政區|選單|menu|開始)$/i.test(t)) return [districtPicker()];
  if (/^\d{1,4}$/.test(t)) return [numberPicker(t)];
  const p = parse(t);
  if (!p) return [textMsg('看不懂這個編號 🤔\n\n' + HELP)];
  if (p.district) return p.district.slice(0, 2).map(c => rangePicker(c.c));
  if (p.multi) {
    const found = p.multi.map(c => lookup(c.c, p.num)).filter(Boolean);
    if (found.length) return [flexMsg(found.map(o => o.id).join('、'), found.length === 1 ? bubble(found[0]) : { type: 'carousel', contents: found.map(o => bubble(o)) })];
  }
  const o = lookup(p.code, p.num);
  if (o) return [flexMsg(`${o.id} 頂高程 ${fmt(o.z)} 深度 ${fmt(o.d)} ${o.lat != null ? o.lat.toFixed(6) + ',' + o.lon.toFixed(6) : ''}`, bubble(o))];
  const pref = (BYC[p.code] || []).filter(id => String(+id.slice(p.code.length)).startsWith(String(+p.num)));
  if (pref.length) return [idPanels(p.code, pref.slice(0, 50), `${p.code}${p.num}… 的人孔`)];
  const n = +p.num;
  const near = Object.keys(DATA.mh).filter(id => id.startsWith(p.code) && /^\d+$/.test(id.slice(p.code.length)) && DATA.mh[id][4])
    .map(id => [id, Math.abs(+id.slice(p.code.length) - n)]).sort((a, b) => a[1] - b[1]).slice(0, 5).map(a => a[0]).sort();
  return [textMsg(`查無 ${p.code}${p.num}。` + (near.length ? `\n附近有調查表的編號：\n${near.join('、')}` : ''))];
}

async function api(path, opt = {}, host = 'api.line.me') {
  const r = await fetch(`https://${host}/v2/bot/${path}`, { ...opt, headers: { Authorization: `Bearer ${env('LINE_CHANNEL_ACCESS_TOKEN')}`, ...(opt.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status} ${t}`);
  return t ? JSON.parse(t) : {};
}
async function setupMenu() {
  const old = await api('richmenu/list');
  for (const m of old.richmenus || []) await api(`richmenu/${m.richMenuId}`, { method: 'DELETE' });
  const S = site();
  const areas = [
    { bounds: { x: 0, y: 0, width: 625, height: 843 }, action: { type: 'uri', label: '附近人孔', uri: nearUri() } },
    { bounds: { x: 625, y: 0, width: 625, height: 843 }, action: { type: 'uri', label: '地圖搜尋', uri: 'https://line.me/R/nv/location/' } },
    { bounds: { x: 1250, y: 0, width: 625, height: 843 }, action: { type: 'postback', label: '選行政區', data: 'act=dist', displayText: '選行政區' } },
    { bounds: { x: 1875, y: 0, width: 625, height: 843 }, action: S ? { type: 'uri', label: '開啟快找', uri: S } : { type: 'message', label: '說明', text: '說明' } },
  ];
  const { richMenuId } = await api('richmenu', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ size: { width: 2500, height: 843 }, selected: true, name: '南雨人孔快找', chatBarText: '人孔快找選單', areas }) });
  await api(`richmenu/${richMenuId}/content`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.from(MENU_IMG, 'base64') }, 'api-data.line.me');
  await api(`user/all/richmenu/${richMenuId}`, { method: 'POST' });
  return richMenuId;
}

async function reply(token, messages) {
  const send = msgs => fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('LINE_CHANNEL_ACCESS_TOKEN')}` },
    body: JSON.stringify({ replyToken: token, messages: msgs }),
  });
  const r = await send(messages);
  if (r.ok) return true;
  const t = await r.text();
  console.log('reply failed', r.status, t);
  return { status: r.status, text: t };
}

export default async (req) => {
  if (req.method === 'GET' && new URL(req.url).searchParams.get('setup') === 'menu') {
    try { await setupMenu(); return new Response('✅ 圖文選單已建立！重新打開 LINE 聊天室就會看到下方的選單。', { headers: { 'content-type': 'text/plain; charset=utf-8' } }); }
    catch (e) { return new Response('❌ 建立失敗：' + e.message, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }); }
  }
  if (req.method === 'GET' && new URL(req.url).searchParams.get('cfg') !== null) {
    return new Response(JSON.stringify({ liffId: env('LIFF_ID') }), { headers: { 'content-type': 'application/json' } });
  }
  const tq = req.method === 'GET' && new URL(req.url).searchParams.get('test');
  if (tq) {
    NO_DRAW = false;
    const msgs = answer({ type: 'message', source: { type: 'user' }, message: { type: 'text', text: tq } });
    const r = await fetch('https://api.line.me/v2/bot/message/validate/reply', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('LINE_CHANNEL_ACCESS_TOKEN')}` }, body: JSON.stringify({ messages: msgs }) });
    return new Response(`${tq}：${r.ok ? '✅ 訊息格式正確' : '❌ ' + r.status + ' ' + (await r.text())}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (req.method === 'GET') {
    const sec = env('LINE_CHANNEL_SECRET'), tok = env('LINE_CHANNEL_ACCESS_TOKEN');
    const chk = [
      `LINE_CHANNEL_SECRET：${!sec ? '❌ 沒有讀到' : sec.length === 32 ? '✅ 已設定（32 字元）' : `⚠️ 長度 ${sec.length}，正確應為 32 字元，可能貼錯`}`,
      `LINE_CHANNEL_ACCESS_TOKEN：${!tok ? '❌ 沒有讀到' : tok.length > 100 ? '✅ 已設定' : `⚠️ 長度 ${tok.length}，太短，可能貼錯`}`,
      `SITE_URL：${env('SITE_URL') || '（未設定）'}`,
    ];
    return new Response('南雨人孔 LINE 機器人運作中\n\n' + chk.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const body = await req.text();
  const secret = env('LINE_CHANNEL_SECRET');
  const sig = req.headers.get('x-line-signature') || '';
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64');
  if (!secret || sig.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac))) {
    return new Response('bad signature', { status: 401 });
  }
  const { events = [] } = JSON.parse(body || '{}');
  await Promise.all(events.map(async ev => {
    if (!ev.replyToken) return;
    try {
      NO_DRAW = false;
      const msgs = answer(ev);
      if (!msgs) return;
      const ok = await reply(ev.replyToken, msgs);
      if (ok !== true && ok.status === 400) { NO_DRAW = true; await reply(ev.replyToken, answer(ev)); }
    }
    catch (e) { console.log('error', e); }
  }));
  return new Response('ok');
};

export { answer, parse };
