'use strict';
// Usage: node loadtest.js [players=1000] [seconds=60] [url=http://localhost:8080]
// Opens N websocket players, each bets every round, and checks that everyone saw the same rounds and crash points.
// Start the server with a big AUTH_RATE (for example AUTH_RATE=100000) because all bots share one IP.
const N = +process.argv[2] || 1000, SECS = +process.argv[3] || 60, BASE = process.argv[4] || 'http://localhost:8080';
const WS = BASE.replace(/^http/, 'ws');
const pr = process.env.LT_PREFIX || 'lt' + Date.now().toString(36);
const stats = { connected: 0, authed: 0, errors: 0, betsSent: 0, betErrors: 0, wins: 0, losses: 0, msgs: 0, closed: 0 };
const crashes = new Map(), starts = new Map(), pings = [], betLat = [];
async function post(path, body) { const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
async function player(i) {
  const name = pr + '_' + i;
  let d = await post('/api/register', { name, email: name + '@t.io', pass: 'secret1' });
  if (d.error) d = await post('/api/login', { name, pass: 'secret1' });
  if (!d.token) { stats.errors++; return; }
  const ws = new WebSocket(WS); let rid = 0; const sent = {};
  const call = o => { o.rid = ++rid; sent[o.rid] = Date.now(); ws.send(JSON.stringify(o)); };
  ws.onopen = () => { stats.connected++; ws.send(JSON.stringify({ t: 'auth', token: d.token })); };
  ws.onclose = () => { stats.closed++; };
  ws.onerror = () => { stats.errors++; };
  ws.onmessage = e => {
    stats.msgs++; const m = JSON.parse(e.data);
    if (m.t === 'welcome') stats.authed++;
    else if (m.t === 'round') { (starts.get(m.id) || starts.set(m.id, new Set()).get(m.id)).add(m.flyAt);
      setTimeout(() => { if (ws.readyState === 1) { stats.betsSent++; call({ t: 'bet', amount: 10, auto: i % 3 === 0 ? 1.5 : i % 3 === 1 ? 2 : 0 }); } }, Math.random() * 2500); }
    else if (m.t === 'fly' && i % 3 === 2) setTimeout(() => { if (ws.readyState === 1) call({ t: 'cash' }); }, 300 + Math.random() * 2500);
    else if (m.t === 'crash') (crashes.get(m.id) || crashes.set(m.id, new Set()).get(m.id)).add(m.cp);
    else if (m.t === 'cashed') stats.wins++;
    else if (m.t === 'lost') stats.losses++;
    else if (m.t === 'r') { if (sent[m.rid]) { betLat.push(Date.now() - sent[m.rid]); delete sent[m.rid]; } if (m.err && /Betting|already/.test(m.err)) stats.betErrors++; }
    else if (m.t === 'pong') pings.push(Date.now() - m.c);
  };
  if (i % 10 === 0) setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', c: Date.now() })); }, 2000);
}
(async () => {
  const t0 = Date.now();
  const batch = 50; for (let i = 0; i < N; i += batch) { await Promise.all(Array.from({ length: Math.min(batch, N - i) }, (_, k) => player(i + k))); }
  console.log('setup done in', ((Date.now() - t0) / 1000).toFixed(1), 's  connected', stats.connected, 'authed', stats.authed);
  await new Promise(r => setTimeout(r, SECS * 1000));
  const h = await (await fetch(BASE + '/api/health')).json();
  const done = [...crashes.entries()];
  const split = done.filter(([, s]) => s.size > 1).length, startSplit = [...starts.values()].filter(s => s.size > 1).length;
  const pc = a => a.length ? { p50: a.sort((x, y) => x - y)[a.length >> 1], p95: a[Math.floor(a.length * .95)], max: a[a.length - 1] } : null;
  console.log(JSON.stringify({ players: N, seconds: SECS, ...stats, serverOnline: h.online, roundsSeen: done.length, roundsWithDifferentCrash: split, roundsWithDifferentStart: startSplit, pingMs: pc(pings), requestReplyMs: pc(betLat) }, null, 1));
  process.exit(split || startSplit || stats.errors ? 1 : 0);
})();
