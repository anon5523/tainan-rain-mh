// 南雨人孔調查表快找｜LINE 機器人（Netlify Function）
// 環境變數：LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、SITE_URL（例：https://tainan-rain-mh.netlify.app）
import crypto from 'node:crypto';
import DATA from './mh-data.mjs';

export const config = { path: '/api/line' };

const PDF = 'https://sewer.water.tainan.gov.tw/TNRS/Uploads/investigate/';
const CLS = { N: '正常人孔', C: '覆蓋人孔', V: '虛人孔' };
const CODES = DATA.codes;
const CODE_LIST = [...new Set(CODES.map(c => c.c))].sort((a, b) => b.length - a.length);
const env = k => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k] ?? '';

const get = id => {
  const r = DATA.mh[id];
  if (!r) return null;
  const [x, y, z, d, pdf, cl, rd, lat, lon] = r;
  const code = CODE_LIST.find(k => id.startsWith(k) && /^\d+$/.test(id.slice(k.length)));
  return { id, x, y, z, d, pdf: !!pdf, cl, rd, lat, lon, code, inv: z != null && d != null ? +(z - d).toFixed(2) : null };
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

function bubble(o, dist) {
  const rows = [
    ['頂高程', fmt(o.z)], ['深度', fmt(o.d)], ['底高程', fmt(o.inv)],
    ['TWD97 X', o.x == null ? '—' : o.x.toFixed(3)], ['TWD97 Y', o.y == null ? '—' : o.y.toFixed(3)],
  ];
  const buttons = [];
  if (o.pdf) buttons.push({ type: 'button', style: 'primary', height: 'sm', color: '#0b63ce', action: { type: 'uri', label: '開啟調查表', uri: PDF + o.id + '.pdf' } });
  if (o.lat != null) buttons.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'Google 地圖', uri: `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lon}` } });
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
      contents: rows.map(([k, v]) => ({ type: 'box', layout: 'horizontal', contents: [
        { type: 'text', text: k, size: 'sm', color: '#687386', flex: 4 },
        { type: 'text', text: v, size: 'sm', color: '#17202e', weight: 'bold', flex: 6, align: 'end' },
      ] })),
    },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons.length ? buttons : [{ type: 'text', text: '此人孔沒有調查表', size: 'xs', color: '#687386', align: 'center' }] },
  };
}

const quick = () => ({
  items: [
    { type: 'action', action: { type: 'location', label: '📍 找我附近的人孔' } },
    ...(site() ? [{ type: 'action', action: { type: 'uri', label: '🔍 開啟快找', uri: site() } }] : []),
  ],
});
const textMsg = text => ({ type: 'text', text, quickReply: quick() });
const flexMsg = (alt, contents) => ({ type: 'flex', altText: alt, contents, quickReply: quick() });

function nearest(lat, lon, k) {
  const r = Math.PI / 180, cos = Math.cos(lat * r), out = [];
  for (const [id, v] of Object.entries(DATA.mh)) {
    if (v[7] == null || v[5] === 'V') continue;
    const dx = (v[8] - lon) * r * cos * 6371000, dy = (v[7] - lat) * r * 6371000;
    out.push([id, Math.hypot(dx, dy)]);
  }
  return out.sort((a, b) => a[1] - b[1]).slice(0, k);
}

const HELP = '輸入人孔編號就能查詢，例如：\n・CWCR387\n・中西區 387\n・cwcr387\n\n輸入區名（例如「北區」）可看該區代碼。\n按下方「找我附近的人孔」傳送位置，會列出最近 5 個人孔。';

function answer(ev) {
  if (ev.type === 'follow') return [textMsg('歡迎使用南雨人孔調查表快找！\n\n' + HELP)];
  if (ev.type !== 'message') return null;
  const m = ev.message;
  if (m.type === 'location') {
    const list = nearest(m.latitude, m.longitude, 5).map(([id, d]) => bubble(get(id), d));
    if (!list.length) return [textMsg('附近找不到人孔。')];
    return [flexMsg('最近的 5 個人孔', { type: 'carousel', contents: list })];
  }
  if (m.type !== 'text') return [textMsg(HELP)];
  const t = m.text.trim();
  if (/^(help|說明|\?|？|使用說明|怎麼用)$/i.test(t)) return [textMsg(HELP)];
  const p = parse(t);
  if (!p) return [textMsg('看不懂這個編號 🤔\n\n' + HELP)];
  if (p.district) {
    return [textMsg(p.district.map(c => `${c.d}：${c.c}（${c.p.split('、')[0]}）`).join('\n') + '\n\n請輸入代碼＋編號，例如 ' + p.district[0].c + '001')];
  }
  if (p.multi) {
    const found = p.multi.map(c => lookup(c.c, p.num)).filter(Boolean);
    if (found.length) return [flexMsg(found.map(o => o.id).join('、'), found.length === 1 ? bubble(found[0]) : { type: 'carousel', contents: found.map(o => bubble(o)) })];
  }
  const o = lookup(p.code, p.num);
  if (o) return [flexMsg(`${o.id} 頂高程 ${fmt(o.z)} 深度 ${fmt(o.d)}`, bubble(o))];
  const n = +p.num;
  const near = Object.keys(DATA.mh).filter(id => id.startsWith(p.code) && /^\d+$/.test(id.slice(p.code.length)) && DATA.mh[id][4])
    .map(id => [id, Math.abs(+id.slice(p.code.length) - n)]).sort((a, b) => a[1] - b[1]).slice(0, 5).map(a => a[0]).sort();
  return [textMsg(`查無 ${p.code}${p.num}。` + (near.length ? `\n附近有調查表的編號：\n${near.join('、')}` : ''))];
}

async function reply(token, messages) {
  const r = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('LINE_CHANNEL_ACCESS_TOKEN')}` },
    body: JSON.stringify({ replyToken: token, messages }),
  });
  if (!r.ok) console.log('reply failed', r.status, await r.text());
}

export default async (req) => {
  if (req.method === 'GET') return new Response('南雨人孔 LINE 機器人運作中');
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
    try { const msgs = answer(ev); if (msgs) await reply(ev.replyToken, msgs); }
    catch (e) { console.log('error', e); }
  }));
  return new Response('ok');
};

export { answer, parse };
