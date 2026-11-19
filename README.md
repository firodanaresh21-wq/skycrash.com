# SkyCrash — pura game + asli server (v2)

Ye wahi SkyCrash game hai jo aapne artifact me dekha (same screens, same wallet, countdown, requests, admin panel, Hindi/English).
Farak sirf ye hai ki ab **sab kuch server par chalta hai**, phone par nahi.
**Virtual coins only. Koi payment nahi.**

## Aapki 6 requirements
| # | Requirement | Kaise hota hai |
|---|---|---|
| 1 | 1,000 players ek saath | Ek Node process, WebSocket. Local test: 1,000 players, 0 error |
| 2 | Sabko same crash multiplier | Server crash point chunta hai aur sabko ek hi `crash` message bhejta hai |
| 3 | Sabka game ek hi time par start | Server round ka start time (`flyAt`) sabko bhejta hai, phone ka clock server se sync hota hai |
| 4 | Admin panel se sab players manage | Admin account se login karo, Profile me **Admin Panel** dikhega (pehle jaisa hi) |
| 5 | Balance server par save | SQLite file `data/skycrash.db`. Phone balance change nahi kar sakta |
| 6 | Server crash par data safe | SQLite WAL + `synchronous=FULL`. Beech round me crash ho to open bets refund ho jaati hain |

## Chalane ka tarika (apne computer par test)
Node.js **22.5 ya naya** chahiye (koi `npm install` nahi).

```
ADMIN_USER=boss ADMIN_PASS='koi-lamba-password' node --no-warnings server.js
```
Browser me `http://localhost:8080` kholo. Admin ke liye usi page par username `boss` aur apna password se login karo.
Admin account sirf is `ADMIN_USER`/`ADMIN_PASS` se banta hai. Password badalna ho to `ADMIN_PASS` badal ke server restart karo.

## Public karna (step by step)
1. **VPS lo** (Ubuntu 22.04/24.04, 1 GB RAM kaafi). Free hosting mat lo, kyunki database ko permanent disk chahiye.
2. **Node 22 install karo:**
   ```
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Is folder (`skycrash-server`) ko server par `/opt/skycrash` me copy karo (`scp` ya `rsync`).
4. **Service banao** — `/etc/systemd/system/skycrash.service`:
   ```
   [Unit]
   Description=SkyCrash
   After=network.target
   [Service]
   WorkingDirectory=/opt/skycrash
   ExecStart=/usr/bin/node --no-warnings server.js
   Environment=PORT=8080
   Environment=ADMIN_USER=boss
   Environment=ADMIN_PASS=koi-lamba-password
   Environment=TRUST_PROXY=1
   Environment=AUTH_RATE=300
   Restart=always
   RestartSec=2
   [Install]
   WantedBy=multi-user.target
   ```
   Phir: `sudo systemctl daemon-reload && sudo systemctl enable --now skycrash`
5. **Domain + HTTPS** (zaroori, warna phone par login/WebSocket theek nahi chalte). Domain ko VPS ke IP par point karo, phir Caddy lagao:
   ```
   sudo apt-get install -y caddy
   ```
   `/etc/caddy/Caddyfile`:
   ```
   aapka-domain.com {
     reverse_proxy localhost:8080
   }
   ```
   `sudo systemctl reload caddy` — HTTPS aur WebSocket apne aap chalenge.
6. **Backup:** server har 6 ghante me `data/backups/` me copy banata hai (aakhri 14 rakhta hai). Us folder ko kabhi-kabhi dusri jagah (apne computer) bhi copy kar lo.
7. `https://aapka-domain.com` sabko bhej do. Invite link (referral) bhi isi domain se banega.
8. **Pehle 20–50 doston ke saath test karo**, phir badhao.

## Settings (environment variables)
| Variable | Matlab | Default |
|---|---|---|
| `PORT` | HTTP + WebSocket port | 8080 |
| `DB_PATH` | SQLite file. **Persistent disk par rakho** | `./data/skycrash.db` |
| `ADMIN_USER`, `ADMIN_PASS` | Owner account | admin / (khali = admin band) |
| `TRUST_PROXY` | Caddy/nginx ke peeche ho to `1` (asli IP `X-Forwarded-For` se) | 0 |
| `AUTH_RATE` | Login/register/forgot tries per minute per IP | 60 |
| `GUEST_RATE` | Guest accounts per ghanta per IP | 60 |
| `REF_DAILY_MAX` | Ek player roz kitne invite bonus kama sakta hai | 200 |
| `MAX_CONN` | Max WebSocket connections | 5000 |
| `BACKUP_HOURS`, `BACKUP_KEEP` | Auto-backup gap / kitne rakhne | 6 / 14 |
| `SYNC` | `FULL` (sabse safe) ya `NORMAL` (thoda tez, power cut me aakhri kuch ms ka data ja sakta hai) | FULL |

**Dhyan:** college/hostel jaise jagah par bahut log ek hi IP se aate hain. `AUTH_RATE` aur `GUEST_RATE` badha do, nahi to unko "Too many attempts" milega.

## Testing
```
npm run loadtest   # 1,000 nakli players, 60 second (pehle server AUTH_RATE=100000 ke saath chalao)
npm run check      # har coin/₹ balance = ledger ka jod; koi bet atki nahi
```
Build machine par (sab ek hi computer par): 1,000 players, 0 error, sabko same round + same crash, ping p95 ~1 ms.
`kill -9` beech round me (100 open bets): restart ke baad 100 ki 100 refund, `check` pass.
**Ye local numbers hain.** Apne VPS par, bahar ke internet se, public karne se pehle dobara test karo.

## Kya badla (pehle artifact me vs ab)
- **Reset game data** (Settings): ab sirf history/stats saaf karta hai. Coins wapas 1000 nahi hote (warna free coins ka loophole banta).
- **Online players** abhi bhi admin ke "Online players shown" number jaisa dikhta hai (nakli). Us setting ko **0** kar do to asli online count dikhega.
- **Live Bets** list aur **Leaderboard** pehle jaise nakli/sample entries hain.
- **Guest** ab server par temporary account hai (24 ghante inactive rehne par session khatam).
- **Forgot password** username + email match se chalta hai (email bheji nahi jaati). Kamzor hai; sirf friends ke game ke liye theek.
- Redeem codes, ban list aur crash point (admin ke alawa) players ko bheje nahi jaate.

## Zaroori sachchai
- Ye **ek server process** hai. Ek VPS par 1,000 ke aas-paas theek hai; kai servers ya 10,000+ ke liye PostgreSQL + message bus chahiye.
- `node:sqlite` ko Node abhi "experimental" bolta hai.
- **"Withdraw", countdown aur "accepted" simulation hain.** Isse kisi ko asli paise bhejne ka jhansa mat do. Game ke labels ("Game simulation · Terms & conditions applied") hatao mat. Public game me asli paise ya paise jaisa inaam jodna India me bahut regulated hai.
