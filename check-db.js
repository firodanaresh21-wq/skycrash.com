'use strict';
// Usage: node check-db.js [path-to-db]
// Verifies: every coin balance and rupee wallet equals the sum of its ledger, no bet stuck open.
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[2] || require('path').join(__dirname, 'data', 'skycrash.db'), { readOnly: true });
const bad = db.prepare(`SELECT u.id,u.name,u.balance,u.rs,
  COALESCE((SELECT SUM(delta) FROM ledger WHERE user_id=u.id AND acct='coin'),0) coin_sum,
  COALESCE((SELECT SUM(delta) FROM ledger WHERE user_id=u.id AND acct='rs'),0) rs_sum FROM users u
  WHERE u.balance!=coin_sum OR u.rs!=rs_sum`).all();
const open = db.prepare("SELECT COUNT(*) n FROM bets WHERE status='open'").get().n;
const c = db.prepare("SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM bets) bets,(SELECT COUNT(*) FROM rounds) rounds,(SELECT COUNT(*) FROM bets WHERE status='void') voided").get();
console.log(JSON.stringify({ ...c, balanceMismatches: bad.length, openBets: open }));
if (bad.length) console.log(JSON.stringify(bad.slice(0, 5)));
process.exit(bad.length || open ? 1 : 0);
