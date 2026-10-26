# Production_Cutover.md — therapyjo.com on Vercel

The procedure for pointing `therapyjo.com` at this application, hosted on **Vercel**, with DNS
moved to **HostGator**, while the legacy clinical system keeps running at **`/clinic/`**.
Read it completely before acting on any part of it.

**Trigger:** the user says "post to production", or names a phase from this file.
**Owner:** the planner runs this. It is not a queued task and does not come off `tasks.md`.

**Planning pass:** second, 2026-08-23. Supersedes the host-agnostic first pass. What changed:

| Area | First pass | This pass |
|---|---|---|
| Host | "a hosting platform" | Vercel, with the routing expressed in `next.config.mjs` |
| DNS | Nameservers to a proxy provider | Nameservers to HostGator (user decision, 2026-08-23) |
| Legacy origin | "preserve the `Host` header" | **Impossible on Vercel** — rewrites send the destination's hostname. The origin must answer to its own name. See Hazard 1. |
| Mail | "check the mail records twice" | A specific, verified break: the SPF `a` mechanism under `DMARC p=reject`. See Hazard 2. |
| Prefix mechanics | "relative paths survive" | Verified true for the legacy login shell, plus the `trailingSlash` loop and the escape catalogue — the catalogue has since been **measured against the authenticated admin screen** and came back two escapes wide, both fixed (Hazard 5) |
| Env | 7 variables | 10 — `LEGACY_ORIGIN`, `SUPABASE_SERVICE_ROLE_KEY` and `TZ` were missing, and each breaks something |

### Where things stand — 2026-08-26

**Superseded — see *Where things stand — 2026-08-28. Phase 4 landed out of order* below.** The
table in this section describes a pre-flip state that no longer holds; read the 2026-08-28
section first.

**Read this first.** Nothing public has moved. `therapyjo.com` still resolves to the legacy host
and still serves the legacy application, exactly as it did before this work started.

| | State |
|---|---|
| Deployed | `master` = `origin/master`, **pushed 2026-08-24**. Vercel builds from GitHub — **`git push` is the deploy trigger** |
| What that push contained | **Ops tooling and documentation only** — the cert tripwire, the zone parity check, the fallback runbook, the Phase 4 gate, this file. No `src/`, no `next.config.mjs`, no `prisma/`, no env; `build`, `postinstall` and `start` untouched. The rebuild is functionally a no-op. The last change to the *running site* is still **`16d35dd`** |
| Live at | `therapyjo-proposal.vercel.app` |
| `/clinic/` proxy | **Working and verified in production**, including relative assets and the authenticated admin screen |
| `/clinic/` escapes | **Fixed and verified in production**, `16d35dd`. Two escapes found and patched; see Hazard 5. Before this, a successful login at `/clinic/` bounced staff into this app and 404'd — they could not reach the clinic system at all |
| Timezone | **Fixed and verified in production** — `Asia/Amman` |
| Custom domain on Vercel | **Apex attached 2026-08-26**, `therapyjo.com` only, Production, apex-to-`www` redirect deliberately **off**. Reads *Invalid Configuration* — correct, DNS has not moved. Apex still resolves `208.98.35.122`. `www` deliberately **not** added — it is still the proxy origin |
| **Vercel apex `A` value** | **`216.198.79.1`** — read off the domain panel 2026-08-26, not from memory. Not the legacy `76.76.21.21`. Corroborated: `X-Vercel-Acme-Ips` measured earlier in this file names `216.198.79.3`, the same `/24`. **Not yet sent to the vendor** — see *What must not happen yet* |
| DNS | Still at site4now.net, **untouched**. Whole zone re-measured 2026-08-24, authoritatively and over DoH: **identical** to the 2026-08-23 table, `SOA` serial `2025031307` both times — unedited since March 2025 |
| **HostGator zone** | **Built 2026-08-24; nine records, complete as of 2026-08-26.** Read back row by row out of the panel — see *The 2026-08-26 panel read-back*. `online` and `new` added, SPF confirmed already correct, the `MX` priority divergence found and corrected. **Nothing further is owed to this zone before delegation.** It was **empty** before it was built — registrar-level *Advanced DNS*, not cPanel, so there were no default records to displace |
| **HostGator TTLs** | **900s, not 300s.** The panel's TTL menu bottoms out at *15 Minutes*; there is no 300 option. See *The TTL floor* |
| **Phase 3 gate** | **Not passable, and now believed structurally so.** `zone:diff` reads `NOZONE` against every HostGator-side nameserver tried — **re-measured 2026-08-26, ~48h after the records were saved**, so the panel's own 24–48h window has elapsed with nothing published. Treat *"HostGator publishes only once the domain is delegated"* as fact rather than hypothesis. See *The publication problem* |
| HostGator nameservers | **Catch-all.** `ns1.hostgator.com` answers a parking address for any domain, including ones that do not exist — so an uncreated zone cannot announce itself as `NXDOMAIN`. See *Reading `npm run zone:diff`* |
| **HostGator's assigned NS** | **Unknown, and not readable from the panel.** Its *Nameservers* tab shows only the *current* delegation — `NS1`/`NS2`/`NS3.SITE4NOW.NET`, flagged *"not using default nameservers"* (read 2026-08-26). The only control that reveals the defaults is **REVERT TO DEFAULTS**, and clicking it **is** Phase 3 step 3. So the delegation target stays unknown until the moment it is committed. Ask support |
| SPF | **Live zone still `v=spf1 a mx …`** — unfixed, re-confirmed 2026-08-26. **The HostGator zone already carries the corrected `ip4:` form**, read back the same day: the 2026-08-24 build typed the Phase 1 record, not the legacy one. The two zones therefore *differ* on this record, so Phase 1 must land on the live zone before delegation or the delegation itself changes SPF. **No longer unfixable:** Phase 1 runs again through the vendor. Chain fully resolved 2026-08-26 — see *Who actually hosts the legacy system* |
| **`online.therapyjo.com`** | **Not live yet.** Re-probed 2026-08-26: `npm run cert:check -- --host online.therapyjo.com` returns `ERROR` / `ECONNRESET`. No IIS binding and no certificate — the vendor's work has not landed |
| **Legacy hosting panel** | **No direct login. Vendor reachable as of 2026-08-26** and acting on request. See *Vendor contact — 2026-08-26* |
| **Ability to edit DNS** | **Indirect** — through the vendor, as of 2026-08-26. Direct control still waits on Phase 3 |
| **Hazard 9** | **Reopened favourably 2026-08-26.** Option 4 landed as a move to `online.therapyjo.com`. Gated on one certificate question. See *Decision, 2026-08-26* |
| **Legacy certificate** | Serial `06575A81…`, expires **2026-10-22**, SAN still covers **both** names. Re-measured 2026-08-24 |
| **Cert tripwire** | `npm run cert:check` — **built (TJ-036), reads `OK` at 59 days on 2026-08-24. Not yet armed**: arming is `-- --update` plus a weekly cadence, the moment Phase 3 lands |
| **Zone parity check** | `npm run zone:diff` — **built and verified 2026-08-24.** Reads `MATCH` on the live site4now zone with `--legacy-spf`, `NOZONE` against HostGator. This is the Phase 3 step-2 gate |
| **Fallback runbook** | **Written**, see *Fallback runbook*. Not yet needed — nothing has moved |
| Vercel plan | **Hobby.** Pro declined — see *Declined, deliberately* |
| Supabase | Free / Nano, `aws-1-eu-west-1`. Vercel functions in `iad1` — mismatched, declined |

**The DNS row reframes everything.** The zone is hosted where nobody can reach it, so *no record
is editable at all* until the nameservers move to HostGator. Phase 3 is therefore not merely a
migration step — it is the step that **returns control of the domain to its owner**, and every
other DNS-dependent action sits downstream of it.

### Where things stand — 2026-08-28. Phase 4 landed out of order

The vendor edited the live site4now zone directly on 2026-08-27, flipping the apex to Vercel
before Phase 3 (the nameserver move to HostGator) ever happened. What follows is measured against
the live site, not against a plan.

| | State |
|---|---|
| DNS zone edit | Vendor edited the live site4now zone on 2026-08-27. SOA serial moved `2025031307` -> `2026082704` |
| Apex `A` | `216.198.79.1` (Vercel) |
| `www` `A` | `216.198.79.1` (Vercel) |
| Wildcard `*` `A` | `216.198.79.1` (Vercel) |
| `online` `A` | `208.98.35.122` |
| Nameservers | **UNCHANGED** — `ns1/2/3.site4now.net`. **Phase 3 has not happened** |
| `https://therapyjo.com` | Serves this app, `200`. Own certificate, SAN `DNS:therapyjo.com`, expires 2026-11-26. `http` -> `https` is `308`. HSTS `max-age=63072000` |
| `www.therapyjo.com` | Attached to the Vercel project on 2026-08-28, `308` redirect to the apex. Own certificate, SAN `DNS:www.therapyjo.com`, expires 2026-11-26. Before attachment it served the apex's certificate and every browser rejected it with a name mismatch |
| `online.therapyjo.com` | Serves the clinic login, `200`. IIS 10.0 / ASP.NET. Own certificate, SAN `DNS:online.therapyjo.com` only, expires 2026-11-26. **Hazard 9 is over** |
| Vercel env | `LEGACY_ORIGIN` = `https://online.therapyjo.com` and `AUTH_URL` = `https://therapyjo.com`, set and deployed 2026-08-28. Before `AUTH_URL` was fixed, protected routes on the apex bounced users to `https://therapyjo-proposal.vercel.app/login` |
| `/clinic/` | Returns `200`, serves the clinic login through the proxy. Timezone read `Asia/Amman` on the live apex |
| Legacy shared certificate | Serial `06575A81…`, apex + `www`, expires 2026-10-22. Will now fail renewal — neither name resolves to the legacy host any more. Nothing depends on it. **This is expected, not a fault** |

**Open at the time of writing that table — and what became of each the same day:**

- **SPF — broken, then resolved, the same day.** See immediately below.
- **The HostGator zone — corrected the same day.** See *The HostGator zone, corrected* below.
- The zone export is still owed. The vendor's 2026-08-28 panel screenshots are the closest thing
  to one so far; every record in them corroborates what was measured externally.

**SPF: broken, then fixed, 2026-08-28.** The vendor first **added** the corrected record instead
of **replacing** the old one, so the apex briefly published TWO `v=spf1` records:

- `v=spf1 a mx include:_spf.site4now.net -all`
- `v=spf1 ip4:208.98.35.122 mx include:_spf.site4now.net -all`

Both measured live over DoH, on Google and Cloudflare independently. Under RFC 7208 §4.5 more than
one SPF record is a `permerror`, so SPF could not pass for **any** sender — including the site4now
relays the `include:` used to authorise. Under `DMARC p=reject` that is a hard fail, and strictly
worse than the single wrong record it was meant to replace. The vendor deleted the legacy row on
request; re-measured afterwards on both resolvers as exactly one record, the corrected `ip4:` form.

**Phase 1 is therefore DONE** — the phase written off on 2026-08-23 as unrunnable, because no
reachable person could edit the zone.

### What else landed on 2026-08-28

**`www` was attached to the Vercel project**, as a `308` redirect to the apex, and issued its own
certificate (SAN `DNS:www.therapyjo.com`, expires 2026-11-26). Before that it resolved to Vercel
while belonging to no project, so it was served the **apex's** certificate and every browser
rejected it — `SEC_E_WRONG_PRINCIPAL`, a full-page security warning on the clinic's own domain.
The reason `www` had been deliberately left unattached died when the proxy origin moved to
`online`.

**Escape 3 of the catalogue, both halves.** Measured in production, not inferred:

| Path | Before | After |
|---|---|---|
| `/clinic/admin/` | `301` to `https://online.therapyjo.com/admin/` | `302` `Location: /Login.aspx` |
| `/clinic/admin` | `301` to `https://online.therapyjo.com/admin/` | `302` `Location: /Login.aspx` |

Cause: the rewrite used `:path*`, a path-to-regexp **repeated-segment** param that splits the
remainder on `/` and rejoins it, dropping a trailing empty segment. `/clinic/admin/` reached the
origin as `/admin`, and IIS answered with its directory-canonicalisation redirect — the one legacy
redirect emitted as an **absolute** URL. Every other legacy redirect is root-relative and is
already caught by escape 1. Fixed in two parts: `:path(.*)` to carry a trailing slash through
verbatim, then a second rule appending the slash on the way out for extensionless paths, so IIS
never has cause to canonicalise at all. That second rule rests on an assumption recorded in its
comment — Web Forms pages carry extensions, so extensionless means directory — which could not be
verified across the authenticated area without logging into the legacy application.

**`AUTH_URL` was still the preview address.** Protected routes on the apex were bouncing users to
`https://therapyjo-proposal.vercel.app/login`. Set to `https://therapyjo.com` and redeployed.
Note for any future env change: `next.config.mjs` is serialised to JSON at build time, so an env
var change does not reach a running deployment without a rebuild.

**Tooling brought back in line with reality:**

- `scripts/check-legacy-cert.mjs` retargeted from the dead shared apex+`www` certificate to
  `online.therapyjo.com`, and its `RESOLVED` verdict **deleted**. Left in place it would have been
  permanently true against the new host — the ladder checks it before expiry, so the script would
  have printed `RESOLVED` on every run and could never have reached `TRIPWIRE`. A tripwire that
  always reads green is worse than no tripwire. Re-baselined; reads `OK`, 89 days.
- `scripts/check-zone-parity.mjs` updated for the post-flip zone: the single `WEB_IP` constant
  split into `VERCEL_IP` and `LEGACY_IP`, and a check added for `online` — load-bearing now, and
  never checked before. Left unchecked, deliberately: `new`, which HostGator carries as a CNAME
  and the live zone resolves through the wildcard.
- `src/app/api/public/diagnostics/route.ts` deleted, Phase 4 having passed. Last reading before
  removal: `Asia/Amman`, `+0300`, on the live apex.
- `prisma/seed.ts` no longer invents credentials. `ADMIN_USERNAME` and `ADMIN_PASSWORD` are
  required, `admin123` is rejected by name, and validation runs before the connection pool is
  built so it fails instantly rather than after a timeout.

**The HostGator zone, corrected.** It still transcribed the pre-flip world. Three `A` records were
changed by hand — `@`, `www` and `*` from `208.98.35.122` to `216.198.79.1` — leaving `online` on
the legacy host. Read back row by row afterwards, and the `MX` preference re-checked in its Edit
dialog at `10`, since the list view hides it and that is exactly how a wrong value hid last time.
Nine records, one SPF row, no strays. `npm run zone:diff -- --ns ns1.site4now.net` reads **`MATCH`
on all 11 checks**, so the two zones are now faithful copies of each other.

**Why this mattered more than it looks:** before the correction, that zone would have rolled the
apex back to the legacy host on delegation. The updated checker would have reported `MISMATCH`
against a *correctly* updated zone, and the obvious way to make it pass would have been to restore
the legacy IP — undoing the entire cutover while appearing to follow the procedure.

**Test and QA data wiped.** See `Data_Reset.md`.

### Phase 3 — the reason for it has changed, and that is now the open question

Phase 3 was designed as the step that unblocked everything: DNS lived in a panel nobody could
reach, so no record was editable by anyone. **That premise died on 2026-08-26.** The vendor makes
zone edits on request, same day — three of them on 2026-08-27 and two more on 2026-08-28.

What it still buys is **autonomy** and **fewer hands on a live medical domain**. The 2026-08-28 SPF
incident is the evidence for the second: an ordinary add-instead-of-replace mistake put the domain
into `permerror` under `p=reject` for some hours.

**Two facts now govern the decision:**

1. **The gate as written cannot pass.** Phase 3 says delegate only once `zone:diff` prints `MATCH`
   against HostGator's nameservers. HostGator does not serve a zone until the domain is delegated
   to it — re-measured 48 hours after the zone was built, and again on 2026-08-28, still `NOZONE`.
   The panel read-back is the only available substitute, and it has now been done twice.
2. **HostGator's assigned nameservers are still unknown.** The panel shows only the current
   delegation. The one control that reveals the defaults is `REVERT TO DEFAULTS`, and clicking it
   **is** the delegation — it answers the question by committing the change. Ask support instead.

**The middle state is the worst one.** Two zones now exist and they currently match. Every future
DNS change must be applied to both or the copy drifts, and a drifted unpublished zone is not
neutral — on the morning of 2026-08-28 that copy still said the apex was `208.98.35.122`.

So the decision is **commit or abandon**, and it is deliberately left open here:

- **Commit** — ask support for the nameserver names, delegate on a day with an hour to watch it,
  run `zone:diff` against the real nameservers immediately after, and fix forward. Rollback is a
  TLD-TTL propagation measured in days, not the 15 minutes the records carry.
- **Abandon** — delete the HostGator records so nothing can ever be delegated to a stale copy, and
  accept vendor-mediated DNS as the permanent arrangement.

The argument for deciding sooner rather than later is that the zones are verified identical *now*,
which is the safest moment this will ever be, and that alignment decays on its own.
### Vendor contact — 2026-08-26. This changes the shape of the problem

**The vendor was reached and has agreed to move the legacy clinical system to
`online.therapyjo.com`.** User report, 2026-08-26. This is Hazard 9 Option 4 landing, in a
stronger form than the plan aimed at: rather than narrowing the shared certificate to `www` after
the apex has already moved, the legacy system moves to a hostname that never carried the apex at
all.

| | Before 2026-08-26 | After |
|---|---|---|
| Legacy hosting panel | No access, vendor unreachable | **Vendor reachable and cooperating.** Still no direct login — every panel action goes through them |
| Proxy origin | `www.therapyjo.com`, on the shared certificate | **`online.therapyjo.com`**, on its own certificate — *if* the question below answers yes |
| Hazard 9 | A permanent ~60-day fallback cycle | **Potentially eliminated** |
| Phase 1 (SPF) | Unrunnable, folded into Phase 3 | **Runnable again** — the vendor can edit the live zone |
| DNS editing | None until the nameservers move | Indirect, through the vendor |

**All of it rests on one unanswered question.** Ask it before anything moves:

> **Does `online.therapyjo.com` get its own certificate, separate from the one covering
> `therapyjo.com` and `www.therapyjo.com`?**

If it is added to the existing SAN list instead, **nothing is solved.** That certificate still
fails renewal the moment the apex leaves the legacy host, and it takes `online` down with it —
the same 502 through `/clinic/*`, reached by a different route. This is Phase 0 step 2b restated
as the gate it always was.

**Measured 2026-08-26, before any vendor action:**

| Probe | Result | Reading |
|---|---|---|
| `online.therapyjo.com` `A` | `208.98.35.122` | **The wildcard, not a record.** `zzz-nonexistent-check.therapyjo.com` answers identically |
| `https://online.therapyjo.com/` | No TLS response | No IIS binding and no certificate yet. Consistent with the unknown-SNI reset in the verified-state table |

The wildcard has a useful consequence: the vendor can complete HTTP-01 validation for
`online.therapyjo.com` **without any DNS change at all**, because the name already routes to their
server. An explicit `A` record is still worth adding — a wildcard is a safety net, not a
declaration — but its absence does not block them.

**What must not happen yet.** The vendor asked for "the A records for your project." That value is
**Vercel's**, and it is neither in this repo nor in the HostGator zone — the HostGator records are
a transcription of the *legacy* zone and point at `208.98.35.122`. Sending those would tell the
vendor to point the domain at his own server. **The value was obtained 2026-08-26 — `216.198.79.1`** —
by attaching the apex to the project (Settings to Domains) and reading it off that screen, which is
the only trustworthy source: Vercel has changed these values over time, and the figure most
documentation still carries, `76.76.21.21`, is not what the panel now returns.
**Do not send it until the certificate question is answered and SPF is fixed** — a cooperative
vendor may apply it the same day, and the apex moving ahead of the SPF correction bounces clinic
mail under `p=reject`.

### Next actions, in order

**Rewritten 2026-08-28.** The 2026-08-26 list below has been overtaken: items 1, 2, 3, 5, 6 and 8
are done, and 4, 7, 9, 10 and 11 survive. Phase 4 landed out of order when the vendor flipped the
apex on 2026-08-27, which collapsed most of that ordering.

**Done, 2026-08-26 to 2026-08-28** — kept here so the sequence is legible, not as work remaining:

| Was | Outcome |
|---|---|
| 1. Answer the certificate question | **Yes** — `online.therapyjo.com` holds its own certificate, SAN `DNS:online.therapyjo.com` only, expires 2026-11-26. Hazard 9 is over |
| 2. Get `online` live and verify from outside | Serves the clinic login, `200`, IIS 10.0 / ASP.NET, valid certificate that does not name the apex |
| 3. Phase 1 — fix SPF | Done via the vendor, after one broken intermediate state. One record, corrected `ip4:` form |
| 5. Switch the proxy origin | `LEGACY_ORIGIN` = `https://online.therapyjo.com`, deployed. `/clinic/` verified in production |
| 6. Rework the cert tripwire | Retargeted to `online`, `RESOLVED` verdict removed, re-baselined, reads `OK` |
| 8. Phase 4 — flip the front door | **Happened out of order**, by the vendor, on 2026-08-27 |

**Remaining:**

1. **Decide Phase 3: commit or abandon.** This is the open question, and it is a decision rather
   than a check — see *Phase 3 — the reason for it has changed*. The gate as written cannot pass,
   and the reason the phase existed no longer holds. Do not let it sit undecided: two zones that
   must be kept in step is a standing liability.
2. **If committing: ask HostGator support for the account's assigned nameservers.** Read-only, and
   the last unknown. Do **not** use `REVERT TO DEFAULTS` to find out — that control *is* the
   delegation. Expectation is `ns1`/`ns2.hostgator.com`, since the account carries the
   registration with no hosting plan, but expectation is not knowledge.
3. **Get the zone export.** Still owed (Phase 0 step 1). The vendor's 2026-08-28 panel screenshots
   are the closest thing so far and corroborate every externally measured record, but they are not
   an export and the top of the record list was cut off in them.
4. **Arm the cert tripwire on a schedule.** `npm run cert:check` is re-baselined and reads `OK`,
   but nothing runs it. A weekly cadence is what makes it a tripwire rather than a script. It now
   watches `online.therapyjo.com`, whose certificate expires 2026-11-26.
5. **Confirm the `AUTH_SECRET` rotation reached production.** It was rotated on Vercel on
   2026-08-28 after five test accounts were deleted; auth here is JWT with no session table, so
   until the rotation is *deployed* those accounts' tokens still verify. Vercel env changes need a
   rebuild.
6. **Run the two Phase 2c checks that need a login:** the 6 MB upload and a patient-document round
   trip. **Newly unblocked** — there is now a working admin account and an empty database to test
   against, which is the cleanest state these checks will ever run in.
7. **Ask the clinic two questions:** is any `therapyjo.com` email address actually used, and is
   anything automated pointing at the bare domain? Both matter more now that the apex has moved.
8. **Keep asking for the direct legacy panel login, or a named billing contact.** One cooperative
   vendor is not access, and every zone edit still routes through a person. Phase 0's ask survives.


### Owed cleanup

- `src/app/api/public/diagnostics/route.ts` — **deleted 2026-08-28**, after Phase 4 passed.
- `TJ-033` (4.5 MB upload limit), `TJ-034` (ambient timezone), `TJ-035` (SEO) are candidates
  named in this file and **not yet filed** in `tasks.md`.

So `/clinic/*` does not exist in production yet, and nothing public has moved. Phase 2 is now
*audit and retrofit* rather than *create and deploy*, and it no longer has to wait on Phase 1.

---

## The one thing that governs everything else

`therapyjo.com` currently serves a **separate legacy application** — ASP.NET Web Forms on
Windows/IIS, hosted elsewhere, with its own database. It runs every real patient, doctor and
scheduling operation in the clinic, and **it is not being replaced.** This application is the
public site plus a content admin. The two share no data and no server.

This cutover therefore **moves no data.** Nothing is exported, imported, copied, or deleted.
All that changes is which address routes to which system.

### Hard rules

1. **Never log into the legacy application.** No credentials for it are needed, wanted, or
   accepted. No step here reads from or writes to its database. Its *hosting control panel* is a
   different thing and is a legitimate `[USER]` destination; its *application* is not.
2. **Never run a destructive database command** against either database as part of this. No
   `prisma db push`, no `migrate reset`, no seed, against production. There is one shared
   Supabase Postgres and `db push` edits live clinic data.
3. **Steps are owned.** A `[USER]` step happens in a third-party web panel behind a login and
   **cannot be performed by any agent.** Do not attempt it, do not ask for the password, do not
   work around it. Present the step and wait.
4. **Stop gates are real.** Where this file says stop, stop and report.

---

## Verified state of the live domain

Measured 2026-08-23 from public DNS and unauthenticated HTTP. No credentials used. Re-measure
before acting — these are facts with a date on them, not constants.

| Fact | Value | Why it matters |
|---|---|---|
| Authoritative NS | `ns1/ns2/ns3.site4now.net` | **DNS is at the legacy Windows host, not HostGator.** HostGator is registrar only. |
| Apex `A` | `208.98.35.122` | The legacy IIS server |
| Apex `A` TTL | **300s** | Rollback propagates in five minutes |
| Wildcard | `*` → `208.98.35.122` | Every unlisted subdomain resolves to legacy. A wildcard, not dozens of records. |
| `www` `A` | `208.98.35.122` | Serves the legacy app, **HTTP 200, valid certificate** |
| `mail` | **`CNAME` → `mail5010.site4now.net`** (which resolves to `208.98.34.60`) | **Not an A record.** Transcribing it as `A → 208.98.34.60` works today and silently breaks whenever site4now renumbers its own mail host. |
| `MX` | `10 igw10.site4now.net` | Clinic mail |
| `TXT` SPF | `v=spf1 a mx include:_spf.site4now.net -all` | **The `a` mechanism is the trap.** See Hazard 2. |
| `TXT` `_dmarc` | `v=DMARC1;p=reject;pct=100;rua=mailto:postmaster@therapyjo.com` | **`p=reject`** — an SPF failure bounces mail, it does not junk it |
| TLS certificate | **One** Let's Encrypt certificate serves both names — identical serial `06575A81…`, SAN `therapyjo.com` + `www.therapyjo.com`, expires **2026-10-22** | `www` is already a certified, working legacy address — and the shared SAN is a timed trap. See Hazard 9. |
| `CAA` | **None**, on the apex or on `www` — verified twice over DoH | Nothing restricts which CA may issue, so Vercel's certificate request in Phase 4 cannot be blocked by one. Nothing to transcribe. **Do not add a CAA record during the cutover** — it can only turn a working issuance into a failed one. Worth considering afterwards. |
| DKIM | **None** under 16 probed selectors, with a validated absent-control | Nothing to transcribe. Confirm against the zone export, which is authoritative where probing is not. |
| `SRV`, `autodiscover` | **None.** `autodiscover` resolves only via the wildcard, to the *web* IP | No Outlook autoconfiguration exists today, so the cutover cannot regress it. |
| Server | `Microsoft-IIS/10.0`, `X-AspNet-Version: 4.0.30319` | |
| IIS binding | `Host: therapyjo.com` → 200; any other host → **403**; unknown SNI → **connection reset** | The origin must be a hostname IIS is bound to. See Hazard 1. |
| Login markup | `<form method="post" action="./">` with `__VIEWSTATE`; assets `assets/css/…`, `vendors/…`, `images/…` | **All relative.** The login shell survives a path prefix intact. |
| `Cache-Control` | `private` | Vercel's edge will not cache proxied clinical responses |

### How complete is this, without the zone export?

The zone export may not be obtainable — the user cannot log into the legacy hosting panel. So
the question is how much the table above can be trusted on its own. More than it first appears,
for a structural reason:

**The wildcard is a safety net.** `* → 208.98.35.122` is being transcribed, so any subdomain
missed that resolves there is still covered after the move. A missed record only bites if it is
**not an A record**, or is an A record pointing somewhere *other* than the web IP.

Non-A records are enumerable by name even behind a wildcard, because the wildcard synthesises
answers only for A queries — a TXT or CNAME query at a nonexistent name returns an honest NODATA.
That was exercised on 2026-08-23 with validated absent-controls:

| Probe | Coverage | Result |
|---|---|---|
| DKIM selectors | 37 names | All absent |
| `SRV` services | 9 standard services | All absent |
| `CNAME` / `TXT` / `MX` | 33 plausible subdomain names | All absent |
| `CAA` | apex and `www` | All absent |

**What remains genuinely unknowable by probing:** a record at a name nobody would guess, and an
A record pointing somewhere other than `208.98.35.122`. Certificate-transparency logs would
surface the names, and crt.sh returned `502` on every attempt that day — a service outage,
confirmed by a bare homepage fetch failing the same way. It stays open as Phase 0 step 7.

**Assessment:** proceeding on the probed table alone is a *low* risk for a zone this small and
this ordinary, and the residual risk is concentrated in mail records — which are exactly the ones
probed most systematically. It is not zero, and it is not the same as knowing. Get the export if
anyone can; do not treat its absence as a reason to stop.

---

### Who actually hosts the legacy system — measured 2026-08-26

This file asserted SmarterASP.NET from the start with no measurement behind it. Confirmed now,
because a vendor conversation depends on addressing the right company.

| Probe | Result | What it establishes |
|---|---|---|
| SPF of `smarterasp.net` itself | `v=spf1 a mx include:_spf.site4now.net -all` | **The clincher.** SmarterASP.NET's own domain publishes site4now's include — character-for-character the record `therapyjo.com` carries |
| `_netblocks.site4now.net` | contains `ip4:208.98.36.38` | That address **is** `mail.smarterasp.net`. SmarterASP's mail server is authorised inside site4now's SPF data |
| `PTR` of `208.98.34.60` | `Mail5010.site4now.net.` | site4now holds reverse DNS on the block |
| `ns2.site4now.net` | `208.98.36.41` | A site4now nameserver sits in the same `/19` as the clinic's server |
| RDAP of `208.98.35.122` | `SHARKTECH-LAS` / Sharktech, `208.98.32.0/19`, no sub-allocation | **The datacenter, not the host.** Sharktech leases SmarterASP the space. Do not contact them — a whois naming Sharktech is not evidence the account sits elsewhere |

**`site4now.net` is not a separate vendor and there is no separate account to obtain.** It is
SmarterASP.NET's infrastructure domain — their nameservers, their mail gateway, their SPF include,
their control-panel branding. One login covers everything this file asks for.

**Corollary for Hazard 2 — it upgrades that reasoning from inference to measurement.** The full
SPF chain resolves to:

```
_spf.site4now.net  → 70.39.75.128/26, 70.39.90.0/24, 70.39.73.0/25, 14.1.20.0/22
_netblocks…        → 208.98.36.38, 85.239.242.115, 209.145.50.244, 157.173.197.211,
                     208.98.34.9, 45.58.159.216, 204.188.228.46, 70.39.73.73
```

`208.98.35.122` appears nowhere in it. The clinic's own server is authorised to send mail **only**
by the `a` mechanism, exactly as Hazard 2 reasoned. The planned replacement — `ip4:208.98.35.122`
— is correct as written, and the record it replaces is SmarterASP.NET's **stock template**, not
anything the clinic chose.

---

## Who can do what

| Marker | Meaning | Examples |
|---|---|---|
| `[USER]` | A human, in a third-party control panel. An agent cannot do these. | DNS records, nameserver change, Vercel project and env vars, legacy hosting panel, secrets |
| `[EXECUTOR]` | Repo work on a branch, under the normal Planner/Executor Protocol | `next.config.mjs`, `src/middleware.ts`, `.env.example`, build verification |
| `[PLANNER]` | Verification from outside — reading public URLs, checking headers, resolving DNS | Post-change checks in every phase |

---

## Target addresses

| Address | Serves |
|---|---|
| `therapyjo.com` | This app — landing page (`src/app/page.tsx`) |
| `/blog`, `/blog/[slug]` | This app — public blog |
| `/login`, `/admin`, `/doctor`, `/secretary` | This app — dashboards and content admin. Already at these paths; no code change. |
| `/clinic/*` | **Legacy clinical system**, proxied by Vercel to its existing origin |
| `www.therapyjo.com` | **The legacy origin until 2026-08-26; being retired from that role.** Still `208.98.35.122`, still staff's direct fallback. Once `online` takes over, `www` is free to redirect to the apex like a normal site — which removes the wart noted below |
| `online.therapyjo.com` | **The legacy origin, from 2026-08-26.** Vendor-agreed. Its certificate never contains the apex, and that is what defuses Hazard 9 |
| `new.therapyjo.com` | Temporary — this app on Vercel during Phase 3, removed after Phase 5 |

`/admin` is unavailable as the legacy prefix — the legacy app already answers there.
`/login` is unavailable — this app owns it.

### Request flow after cutover

```
browser ──► therapyjo.com  (A → Vercel)
              │
              ├─ /, /blog, /login, /admin, …  ─► this app's functions ─► Supabase
              │
              └─ /clinic/*  ─► Vercel rewrite ─► https://www.therapyjo.com/*
                                                  (A → 208.98.35.122, IIS, own cert)
```

The legacy origin is reached **by name**, over TLS, at an address it already answers to. Nothing
in the legacy hosting panel has to change for this to work — which is the point of choosing
`www` over a fresh origin hostname.

**Cost of that choice:** visitors typing `www.therapyjo.com` land on the clinical login rather
than the marketing site. If that is unacceptable, the alternative is a dedicated origin hostname
— say `origin.therapyjo.com` — which requires the legacy host to bind it *and* issue a
certificate for it (Hazard 1), after which `www` can redirect to the apex normally. That is one
panel task and one extra DNS record. It is not a cutover prerequisite and can be done later
without touching anything else.

---

## Repo changes required

All `[EXECUTOR]`, on a branch, in Phase 2b. **None of this is in the deployment that is currently
live** — that build is `03920aa`, which has no `rewrites`, no `redirects` and no `/clinic`
exclusion. The site being "ready" is a statement about the marketing site and the admin; the
legacy proxy does not exist yet.

None of it is risky in isolation, and all of it must be verified locally with
`npm run build && npm start` plus `curl` before it is deployed, because Next's path matching is
where plans of this shape usually break.

### 1. `next.config.mjs` — the proxy

**Implemented and locally proven on branch `routing/clinic-legacy-proxy` (`313af8f`), 2026-08-23.
Not merged.** The design below is the corrected one — the first draft of this section contained a
bug, described immediately after it.

```js
// Absolute origin URL, e.g. "https://www.therapyjo.com". Unset on preview
// deployments, where /clinic must 404 rather than proxy.
const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN;

const nextConfig = {
  // The legacy app is served from /clinic/ and every asset and form action in
  // its markup is relative to that directory, so the trailing slash is
  // load-bearing. This disables Next's normalisation of it.
  skipTrailingSlashRedirect: true,

  // No redirects() entry. "/clinic" -> "/clinic/" lives in middleware. See below.

  async rewrites() {
    if (!LEGACY_ORIGIN) return [];
    return {
      beforeFiles: [
        { source: "/clinic/:path*", destination: `${LEGACY_ORIGIN}/:path*` },
        // UNDER EVALUATION — Hazard 9, Option 2. Lets the legacy host keep
        // renewing a certificate for a name that now resolves to Vercel.
        // Remove if it interferes with Vercel's own issuance.
        {
          source: "/.well-known/acme-challenge/:token*",
          destination: `${LEGACY_ORIGIN}/.well-known/acme-challenge/:token*`,
        },
      ],
    };
  },
};
```

`beforeFiles` is required — the rewrite must win over filesystem and dynamic routes.

#### Why the redirect is not in `redirects()`

**The obvious design is wrong and produces the exact loop it was meant to prevent.** Next compiles
every `redirects()` source with an optional trailing slash appended, unconditionally —
`next/dist/lib/redirect-status.js`, `modifyRouteRegex`, which does
`regex.replace(/\$$/, '(?:\\/)?$')` with no `strict` or `skipTrailingSlashRedirect` guard.

So `source: "/clinic"` compiles to a regex that **also matches `/clinic/`** — and sends it to
`/clinic/`. A self-redirect, forever. Verified in Next's source and observed live before the
cause was found.

The fix is an exact string comparison in middleware, which has no such leniency. This also means
bare `/clinic` must **not** be excluded from the middleware matcher, which is why the exclusion
below is `clinic/` with a required slash rather than `clinic(?:/|$)`.

#### Locally verified, all ten cases

Against a stand-in origin that echoes the path it received. Every case passed.

| # | Case | Result |
|---|---|---|
| 1 | `/clinic` → one 307 → `/clinic/`, no loop | PASS |
| 2 | `/clinic/` → origin receives `/` | PASS |
| 3 | `/clinic/Default.aspx?id=7` → query preserved | PASS |
| 4 | `/clinic/deep/nested/path` → prefix stripped | PASS |
| 5 | `/.well-known/acme-challenge/<token>` → reaches origin | PASS |
| 6 | Neither path redirects to `/login` | PASS |
| 7 | `/blog` still served by this app | PASS |
| 8 | `/admin` unauthenticated still → `/login` | PASS |
| 9 | `/clinicians` NOT proxied, NOT exempted | PASS |
| 10 | `LEGACY_ORIGIN` unset → `/clinic/` clean 404 | PASS |

Case 1 passing also settles a question this plan had been hedging: **middleware runs before
`beforeFiles` rewrites.** The rewrite's own compiled regex matches bare `/clinic` too, so if the
order were reversed, case 1 would have proxied instead of redirecting.

Cases 8 and 9 are the ones that matter for safety — they prove the matcher was not over-broadened
and that authentication still guards everything it did before.

### 2. `src/middleware.ts` — keep auth away from the prefix

Two exclusions, plus the `/clinic` redirect that could not live in `redirects()`:

```js
export default auth((req) => {
    if (req.nextUrl.pathname === "/clinic") {
        return NextResponse.redirect(new URL("/clinic/", req.nextUrl));
    }
});

// matcher:
"/((?!_next/static|_next/image|favicon\\.ico|clinic/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mp3|woff|woff2|ttf|eot|css|js)$).*)",
```

Three things about that matcher are deliberate:

- **`clinic/` carries a required trailing slash.** Bare `/clinic` must still reach middleware, or
  the redirect above never runs.
- **It is not `clinic`.** That would also exempt `/clinicians` and any future path starting with
  those letters. The slash anchors it to the segment. Case 9 in the table above tests exactly this.
- **`\.well-known/` is excluded too.** Without it, NextAuth intercepts ACME validation requests
  and redirects them to `/login`, and the certificate never issues.

Returning nothing from the wrapped function lets the request continue, with NextAuth's
`authorized` callback still enforcing everything it did before — proven by cases 8 and 9.

**One cosmetic side effect:** a bare `/clinic` request passes through the NextAuth wrapper and
picks up `authjs.csrf-token` and `authjs.callback-url` cookies. Harmless — `/clinic` is a public
route and no authentication is forced — but it means a staff member who never logs into this app
still receives two of its cookies. Not worth fixing during a cutover.

`src/lib/auth.config.ts` already lists `/clinic` in `publicRoutes` (TJ-017, landed). Keep it.
The two together are deliberate belt and braces: the matcher means middleware never runs for
`/clinic`, and `publicRoutes` means that if it somehow does, staff get an honest 404 instead of
being redirected into *this* app's login — which looks exactly like the clinical system has been
deleted.

### 3. `.env.example` — add the three missing variables

`LEGACY_ORIGIN`, `SUPABASE_SERVICE_ROLE_KEY` and `TZ` are each consumed or required in
production, and none of them is documented. See the table below.

### 4. Do **not** land in this window

`next build` emits a deprecation warning for the `middleware` file convention (Next 16 prefers
`proxy`). It is a warning, filed as **TJ-019**. Changing authentication plumbing in the same
window as a DNS migration means that when something breaks you cannot tell which change caused
it. The matcher edit above is a one-line exclusion, not a refactor; that is the whole allowance.

---

## Production environment variables

Set in the Vercel project, Production scope, never committed. `.gitignore` ignores `.env*`.

| Variable | Notes for production |
|---|---|
| `DATABASE_URL` | **Supabase's pooled (Supavisor transaction, port `6543`) string, not the direct one.** `src/lib/prisma.ts` opens a `pg.Pool` per instance; against the direct connection, instance count multiplies that until Postgres runs out of slots. Simplest way to be certain: overwrite it with the Transaction-pooler string from Supabase's *Connect* dialog rather than trying to audit what is there — the value is Sensitive and cannot be read back. **`pg.Pool`'s `max: 3` should stay at 3 — see Hazard 8, this reverses earlier advice in this file.** **Since 2026-10-26 (TJ-063a), either pooler port works:** `prisma.ts` moves `:5432` to `:6543` on the pooler host itself. |
| `AUTH_SECRET` | Generate a **new** value for production. Never reuse the development secret. |
| `AUTH_URL` | Must match the hostname actually being served. `https://new.therapyjo.com` in Phase 3, `https://therapyjo.com` in Phase 4. **A stale value here is the #1 cause of a login that loops forever.** |
| `LEGACY_ORIGIN` | **New.** `https://www.therapyjo.com`. Absent, `/clinic` 404s instead of proxying — correct preview-deployment behaviour. **This one is a BUILD-time variable, and that is a trap.** `rewrites()` runs during `next build` and its result is baked into `.next/routes-manifest.json` as a literal string — verified 2026-08-23, the manifest contains the origin URL spelled out. A deployment built without it has **no proxy at all**, and `/clinic` 404s with nothing in any log to explain why. Setting it and restarting is not enough; it must be present **when the build runs**, and changing it requires a genuine rebuild, not a cache-reusing redeploy. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Already set in the Vercel project** (user-confirmed 2026-08-23), and it is not optional there. Without it `supabaseAdmin` is `null`, so `POST /api/upload` returns **503** for the `patient-files` and `employee-files` folders and `GET /api/storage/clinical/*` returns **503** — patient and employee documents could be neither uploaded nor viewed. Being set is not the same as working: Phase 2c round-trips a real document to prove it. Note this is the same key **TJ-014d** is blocked on; that task is blocked on having it *locally*, and remains so. |
| `TZ` | **New.** `Asia/Amman`. See Hazard 4 — the `process.env.TZ` line in `next.config.mjs` does not reach Vercel's runtime. |
| `NEXT_PUBLIC_SUPABASE_URL` | Same project as development unless a separate production project is created. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | As above. Public by design. |
| `GOOGLE_PLACES_API_KEY` | Reviews section. Absent, reviews degrade and nothing crashes. |
| `GOOGLE_PLACES_PLACE_ID` | As above. |

### Vercel project settings

Audited 2026-08-23. Project `therapyjo-proposal`, currently at `therapyjo-proposal.vercel.app`.

| Setting | Current | Required | Why |
|---|---|---|---|
| Plan | **Hobby** | **Pro** | **Confirmed blocker.** Hobby is licensed for non-commercial use only, and a clinic's public site plus staff portal is commercial by any reading. This is a terms question, not a technical one — no error will ever tell you about it, and the remedy if Vercel notices first is suspension of the clinic's website. Settle it before the domain is pointed anywhere. |
| Function region | **`iad1`** (US East) | **`dub1`** (Dublin) | Supabase is in **`aws-1-eu-west-1`** — Ireland. Vercel's `dub1` *is* AWS eu-west-1, so this co-locates functions with the database. Changeable on Hobby (one region, but you pick which). See below. |
| Fluid Compute | **Enabled** | Keep | Good for this workload, and it changes the connection-pool advice — see Hazard 8. |
| Node version | — | Match local | |
| Deployment protection | — | On for Preview | Relevant to the service-role scope below. |

**On the region — resolved 2026-08-23, and it is the cheapest win in this file.** Supabase is in
`aws-1-eu-west-1` (Ireland). Vercel's functions are in `iad1` (Virginia). So today every single
database query crosses the Atlantic and comes back.

Vercel's `dub1` is AWS eu-west-1 — the same region as the database. Moving there collapses the
function↔database hop from a transatlantic round trip to a same-region one, and **that hop is paid
once per query**, so a page issuing four sequential queries saves four times over.

It improves the other hop too, which is the unusual part — this is not a trade:

| Hop | Today (`iad1`) | With `dub1` |
|---|---|---|
| Function → database | Virginia ↔ Ireland | Same region |
| Jordan user → function | Jordan ↔ Virginia | Jordan ↔ Ireland |

Both get shorter. `iad1` is simply the default nobody chose. Change it, redeploy — a new
deployment is required for the region to take effect — and do it **before** measuring anything in
Phase 3, or the latency numbers gathered there will describe a configuration you are about to
abandon.

**On pooler mode.** Local development uses the **session** pooler (same host, port `5432`).
Production should use the **transaction** pooler (`6543`), which multiplexes many client
connections onto few Postgres ones and is the right shape for serverless. That means production
will run a pooling mode local development has never exercised. If `prepared statement … already
exists` errors ever appear, that is the symptom and the cause is transaction mode — not a code
bug. Switching local to `6543` as well is the cheap way to find that out during development
rather than during a clinic's working day.

#### Declined, deliberately, 2026-08-23

Recorded so a later reader does not mistake these for oversights and "fix" them mid-cutover.

| Item | Decision | Consequence carried |
|---|---|---|
| `DATABASE_URL` port | **Not changed.** Account owner states it is already `6543` | **Measured false, 2026-10-26:** Supabase's pooler logs showed production on `mode: session`, i.e. port `5432`. The app now switches the port itself (TJ-063a), so the variable can stay as it is. The `prepared statement` worry does not apply: the app uses Prisma's `pg` driver adapter, which sends only unnamed statements. |
| Service-role key scope | **Stays on Preview** | Accepted. Reachable surface is nil today — every route using it is behind `await auth()` and previews cannot mint sessions. Becomes real only if a future handler touches `supabaseAdmin` before checking a session. |
| Function region | **Stays `iad1`** | Every database query crosses the Atlantic. Affects the app's own pages only — **not** `/clinic/*`, which is proxied at Vercel's edge and never enters a function. |
| Plan | **Stays Hobby** | Two distinct consequences, below. |

**The Hobby decision carries a technical risk, separate from the licensing one.** Hobby's usage
limits **pause the deployment** rather than billing for overage. After Phase 4, all clinical
traffic — every page, every asset, every postback of a ViewState-heavy Web Forms app for every
staff member, all day — flows through Vercel and counts toward that cap. Exceeding it does not
produce an invoice; it takes `/clinic/*` down, and with it the clinic's access to its own
scheduling and patient records.

This is a rough estimate, not a measurement: ten staff at a few hundred page loads a day, with
Web Forms pages in the hundreds of kilobytes, lands in the tens of gigabytes per month — the same
order of magnitude as the cap, not comfortably below it. **Worth measuring in Phase 3 rather than
assuming**, and it is the single strongest technical argument for Pro, independent of terms.

The licensing point stands as stated and will not be repeated: Hobby is non-commercial, and this
decision belongs to whoever owns the Vercel account. They should know the term exists, so that
staying on Hobby is a choice rather than an accident.

**Supabase is on the Free plan at Nano compute.** Two things follow that are outside this
cutover but should not go unrecorded: Free has **no automated backups**, and this database holds
patient records, SOAP notes and clinical documents. Free also caps file storage at 1 GB, which
scanned patient documents will reach. Neither blocks the cutover; both are worth a decision.

`src/generated/prisma/` is gitignored and regenerated by the `postinstall` script
(`prisma generate`). A clean Vercel build handles this with no intervention.

---

## Phase 0 — Inventory

**Nothing changes. The safety of every later phase rests on this being done thoroughly.**

1. `[USER]` **Export the complete DNS zone** from the site4now/MyASP control panel — every
   record, not only the web ones. The table above reconstructs most of it from public DNS, but
   it **cannot see `CAA` records, DKIM selectors, or any subdomain hidden behind the wildcard**.
   A screenshot is sufficient. This is not a credential.
2. `[USER]` Confirm from the panel that `www.therapyjo.com` is bound to the legacy site and will
   stay bound. It is the proxy origin; if the host would ever drop that binding, use a dedicated
   origin hostname instead — see Target addresses.
2b. `[USER]` In the same panel, establish **whether a certificate can be issued for
   `www.therapyjo.com` alone**, without `therapyjo.com` on it. Some panels only offer "domain and
   www" as one unit. The answer decides whether Hazard 9 is fixed by a reissue in Phase 4 or by
   moving to a dedicated origin hostname — and the second of those is much easier to arrange now
   than in the hour after a cutover.
3. ~~`[USER]` Obtain `SUPABASE_SERVICE_ROLE_KEY`.~~ **Done** — it is already set in the Vercel
   project. Phase 2c still has to prove it works.
4. `[USER]` Confirm no staff member relies on a bookmark to the bare domain — that address is
   being taken over. `www.therapyjo.com` becomes their address.
5. `[USER]` Determine **whether the legacy application sends email**.
   **Answered 2026-08-23, user report:** patients receive no appointment emails, and the legacy
   site has no "forgot password" function anywhere. Qualified with "to my knowledge" and not
   corroborated by DMARC data, so treated as *probable, not established*. See Hazard 2 for what
   this does and does not change.
5b. `[USER]` **New, and now the more important question: is `therapyjo.com` email used by anyone
   at all?** Ask the clinic what address staff actually send work email from. This matters twice
   over:
   - The postmaster mailbox could not be logged into, so the DMARC reports that would have
     settled step 5 are unreadable — and may not be being delivered anywhere at all.
   - **Phases 1, 3 and 4 each require sending and receiving a test email.** Those gates are
     unperformable if nobody holds a working mailbox on the domain. Establish who does, or
     accept that the mail-safety checks in this plan cannot be run and say so explicitly rather
     than skipping them quietly.
6. `[PLANNER]` Re-measure everything in the verified-state table and diff it against this file.
   **Done 2026-08-23**, over DoH: CAA, DKIM, SRV and autodiscover all confirmed absent, `mail`
   corrected to a `CNAME`, TTLs confirmed at 300.
7. `[PLANNER]` **Outstanding:** retry the certificate-transparency query
   (`https://crt.sh/?q=%25.therapyjo.com&output=json`), which returned `502` on every attempt
   during the 2026-08-23 pass — a crt.sh outage, confirmed by a bare homepage fetch failing the
   same way, and again at session close. **Three attempts, three `502`s — still outstanding.**
   CT logs are the only way to see hostnames the wildcard hides: a subdomain that once
   held a certificate but is no longer a distinct DNS record will not show up in any lookup, and
   would be dropped in the Phase 3 transcription without anyone noticing. Retry before Phase 3;
   if crt.sh is still down, use another CT search. Low probability of finding anything, and the
   cost of the miss is a silently dead hostname.

**Stop gate.** Do not begin **Phase 3** until the zone export exists and has been read. Phases 1
and 2 need nothing from it and can proceed.

---

## Phase 1 — Fix SPF, before anything moves

> **Revived 2026-08-26. This phase runs again, close to as first written.** The 2026-08-23
> correction below folded it into Phase 3 because no record in the site4now zone could be edited
> by anyone reachable. The vendor is now reachable and will make zone edits on request, so the SPF
> fix happens in the live zone, days ahead of the apex move, exactly as this phase first
> specified. The 24-hour soak is worth keeping this time — the apex move is no longer bundled into
> the same change window.
>
> Steps 1 and 2 are `[USER]`-via-vendor rather than `[USER]`-in-panel. Step 4 still needs a working
> mailbox on the domain, which is Phase 0 step 5b and still unanswered — if nobody holds one, say
> so explicitly rather than skipping the check quietly.

> **Sequencing correction, 2026-08-23. This phase cannot run where it is written.** It was
> specified as "done in the current DNS panel, days ahead of the nameserver move" — but the
> current DNS panel is the legacy host's, and there is no access to it. No record in the
> site4now zone can be edited at all.
>
> **Fold it into Phase 3 instead.** The zone is being recreated from scratch at HostGator, so the
> corrected SPF record simply gets typed in there rather than transcribed as-is. That removes a
> phase rather than delaying one, and the 24-hour soak it prescribed is unnecessary: TTLs on
> these records are 300 seconds, and Phase 4 — the apex move, which is what SPF is protecting
> against — comes later anyway.
>
> The reasoning below stays; only the *where* and *when* change.

**Not silently destroying clinic email. Nothing to do with Vercel.**

The current record is `v=spf1 a mx include:_spf.site4now.net -all`. The `a` mechanism means
*"whatever the apex A record points at is allowed to send mail as this domain."* Today that is
the legacy server. The moment the apex points at Vercel, the legacy server stops being
authorised — and `_dmarc` says `p=reject`, so its mail is **bounced, not junked**.

1. `[USER]` Replace the SPF record with the same policy stated by address instead of by
   reference:

   `v=spf1 ip4:208.98.35.122 mx include:_spf.site4now.net -all`

   Confirm `208.98.35.122` against the zone export first. If the panel shows a different
   outbound IP for mail, use that — and keep `ip4:` entries for both if in any doubt.
2. `[USER]` Lower the TTL on the apex `A`, `www` `A`, `MX` and both `TXT` records to **300s** if
   the panel allows it. The apex is already 300; the others are not necessarily.
3. `[PLANNER]` Confirm the new SPF resolves and still ends in `-all`.
4. `[USER]` **Send and receive a test email** on the current setup. This establishes the
   baseline — if mail is already broken you need to know now, and not attribute it to the
   cutover later.

**Wait at least 24 hours** after the SPF change before Phase 3, so any receiver-side cache of the
old record has expired. Phase 2 does not touch DNS and should run during that soak, not after it.

---

## Phase 2 — Audit and retrofit the existing deployment

**The app is already live on Vercel at its `*.vercel.app` address, and no custom domain is
attached. `therapyjo.com` is untouched throughout. Zero public risk.**

Independent of Phase 1 — run it during the SPF soak. The work here is closing the gap between
what is deployed and what the cutover needs, which is three environment variables and three
repo changes.

### 2a — Audit what is already there

1. `[USER]` Report which variables from the table above are present in the Vercel project.
   **Names and presence only — do not paste values.** Two matter more than the rest:
   - `DATABASE_URL` — is it the **pooled** string (Supavisor, port `6543`) or the direct one
     (port `5432`)? The direct string behaves perfectly for one tester and fails under a clinic,
     so this cannot be settled by "it works".
   - `AUTH_URL` — whatever it is now, it changes twice more, in 2b and Phase 4.
2. `[USER]` Confirm the plan is **Pro**, and report the function region so it can be checked
   against the Supabase project's region.
3. `[USER]` Confirm no custom domain is attached to the project yet. (Public DNS says none is,
   as of 2026-08-23.)

#### Audit result, 2026-08-23

| Variable | Scope | Assessment |
|---|---|---|
| `DATABASE_URL` | **Production only** | Present. **Settled 2026-10-26:** it is the **session** pooler, measured from Supabase's pooler logs rather than read from Vercel. The app moves it to the transaction pooler in code (TJ-063a). |
| `AUTH_SECRET` | Production + Preview | Present |
| `AUTH_URL` | **Production only** | Present. Changes twice more — 2b and Phase 4. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + **Preview** | Present. See the note below — Preview scope is a real exposure. |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Production + Preview | Present |
| `GOOGLE_PLACES_API_KEY` / `_PLACE_ID` | Production + Preview | Present |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production + Preview | **Referenced nowhere in `src/`.** Dead configuration — probably a half-finished move to Supabase's newer key scheme. Harmless; worth deleting so the next reader does not assume it does something. |
| `LEGACY_ORIGIN` | — | **Missing.** Required, and **build-time**. |
| `TZ` | — | **Missing.** Required. |

**`SUPABASE_SERVICE_ROLE_KEY` is scoped to Preview, and it should not be** — as hardening, not
because anything is currently exploitable. Stating the severity accurately matters more than
stating it dramatically:

- The key bypasses Row Level Security completely, so code holding it can reach every patient
  document and clinical row through the Supabase API.
- **But every route that uses it today is behind `await auth()`**, and previews have no
  `DATABASE_URL`, so the Prisma-backed credential check cannot succeed and no preview session can
  be minted. The reachable surface today is therefore effectively nil.
- What it costs is margin. The key material sits in a weaker environment for no benefit, and the
  protection is one future commit away from lapsing — a debug route, a health check, any handler
  that touches `supabaseAdmin` before checking a session.

Restrict it to **Production**. Nothing in the app needs it on previews, it costs one dropdown,
and it is much easier to do now than to argue for after an incident.

### 2b — Land the missing pieces and redeploy

4. `[EXECUTOR]` Land the three repo changes above on a branch, verified locally against the four
   `curl` checks, and merge. `npm run build` passes on `master`.
5. `[USER]` Add `LEGACY_ORIGIN=https://www.therapyjo.com`. Set `AUTH_URL=https://new.therapyjo.com`.
   **`TZ` cannot be added** — Vercel rejects it as a reserved name; the timezone is pinned in
   `src/instrumentation.ts` instead. See Hazard 4.
5b. `[USER or PLANNER]` **`git push`. This is the deploy trigger, and forgetting it is invisible.**
   The Vercel project builds from GitHub, so a merge that exists only locally does not exist to
   Vercel. Observed 2026-08-23: a redeploy after a local-only merge rebuilt the **previous
   commit** with the new environment variable attached — which looks like a successful deploy in
   every dashboard, and produces an application missing the entire change. Confirm with
   `git log origin/master..master` returning nothing before treating a deploy as done.
6. `[USER]` **Redeploy — and force a fresh build.** An environment variable saved in the dashboard
   does not reach the running deployment until a new build; this is the most common way a correct
   variable appears to have no effect. For `LEGACY_ORIGIN` it is worse than a delay: the value is
   compiled into the route manifest, so a redeploy that reuses the build cache can produce a
   deployment with **no `/clinic` proxy at all**, failing silently. If Vercel offers "use existing
   build cache", decline it.
7. `[PLANNER]` Confirm the proxy actually exists in the deployment before trusting it: request
   `/clinic` on the `*.vercel.app` address and expect a **307 to `/clinic/`**. A 404 there means
   the build did not see `LEGACY_ORIGIN`, whatever the dashboard shows.

### 2c — Verify, on the `*.vercel.app` address

7. `[PLANNER]` Work the list and stop at the first failure:
   - Landing page renders with **real** content — doctors and blog posts load, not empty
     sections. An empty section here usually means `DATABASE_URL` is wrong, not that the page is
     broken.
   - `/blog` lists posts; an article opens.
   - `/login` accepts a real login and lands on the correct dashboard for the role.
   - Publishing a post in the admin makes it appear on the public blog **without a redeploy**.
   - An image upload succeeds — **and, separately, a 6 MB PDF upload.** See Hazard 3; this is
     the check that catches the Vercel-only body-size limit, and it is the one most likely to
     fail, because it cannot fail locally.
   - A patient document uploads **and opens again.** `SUPABASE_SERVICE_ROLE_KEY` is set, so this
     should pass — but set and working are different claims, and a wrong key degrades to the
     same 503 as a missing one.
   - **Timezone, measured not assumed:** `GET /api/public/diagnostics` (route removed 2026-08-28;
     its last reading before removal was `Asia/Amman`, `+0300`, taken on the live apex) reports
     `timeZone: "Asia/Amman"` and `offsetMinutes: -180`, and its `sample` field — the instant
     `2026-08-23T23:30:00Z` — renders as **Aug 24**, not Aug 23. Request it twice and confirm
     `now` changes, proving it is served dynamically rather than prerendered at build time. A
     prerendered response would report the *build machine's* timezone and look like a pass while
     proving nothing. **This endpoint is temporary and must be deleted once Phase 2c passes.**
   - `/clinic` and `/clinic/` return a clean **404**. Correct at this stage, not a failure: the
     `vercel.app` hostname is not what the legacy origin expects, so the rewrite has nothing to
     prove until Phase 3 puts a real hostname in front of it.

#### Results, 2026-08-23, against `therapyjo-proposal.vercel.app` at commit `33a5d51`

| Check | Result |
|---|---|
| `/clinic` → 307 → `/clinic/` | PASS |
| `/clinic/` serves the legacy app | PASS — 200 with `X-Aspnet-Version: 4.0.30319` passed through from IIS |
| Legacy markup intact under the prefix | PASS — `action="./"`, `href="assets/css/app.css"`, `__VIEWSTATE` all present |
| **Relative assets resolve under the prefix** | **PASS — `/clinic/assets/css/app.css` returns 200, `text/css`, 286 KB** |
| Timezone | PASS — `Asia/Amman`, `-180`, and the boundary instant renders as **Aug 24** |
| `/`, `/blog`, `/login` | PASS — 200 |
| `/admin` unauthenticated | PASS — 302 to `/login?callbackUrl=%2Fadmin` |

**The fourth row is the one that mattered most.** Hazard 5 — whether a Web Forms app survives
being served from a subdirectory — was the largest unquantified risk in this plan, and its login
screen now renders through the proxy with its full stylesheet. That is not the whole answer: the
inner screens are behind a login and only a human can exercise them (Phase 4 step 5). But the
mechanism works, and it was proven **without any DNS change**, because the origin sees
`Host: www.therapyjo.com` regardless of which hostname the browser used.

That last fact is worth generalising: **most of this plan is testable before anything
irreversible happens.** Earlier revisions assumed otherwise.

**Not yet run:** the 6 MB upload (Hazard 3) and the patient-document round trip, both of which
need an authenticated session.

**Stop gate — user sign-off.** The visual sign-off is already given; what has to hold here is
this list. An unresolved item on it is a reason not to start Phase 3.

---

## Phase 3 — Move DNS to HostGator, as a no-op

**The riskiest phase, and the technique is to make it change nothing.** Every record is recreated
exactly as it is today. No record points anywhere new. The only observable difference is which
nameservers answer.

1. `[USER]` In HostGator, create the zone for `therapyjo.com` and **transcribe every record from
   the Phase 0 export**, unchanged:
   | Name | Type | Value | TTL |
   |---|---|---|---|
   | `@` | `A` | `208.98.35.122` | 300 |
   | `*` | `A` | `208.98.35.122` | 300 |
   | `www` | `A` | `208.98.35.122` | 300 |
   | `online` | `A` | `208.98.35.122` | 300 |
   | `mail` | **`CNAME`** | `mail5010.site4now.net.` | 300 |
   | `@` | `MX` | `10 igw10.site4now.net.` | 300 |
   | `@` | `TXT` | the **Phase 1** SPF record | 300 |
   | `_dmarc` | `TXT` | `v=DMARC1;p=reject;pct=100;rua=mailto:postmaster@therapyjo.com` | 300 |
   | `new` | `CNAME` | `31e97fa68447aa19.vercel-dns-017.com` — read off Vercel 2026-08-26 | 300 |

   That table is the **entire** confirmed zone as of 2026-08-23 — verified over DoH, with no
   CAA, no DKIM selector and no SRV record anywhere in it. It is short enough to get right.
   Still diff it against the Phase 0 export before trusting it: probing proves a name answers,
   only the export proves what the zone contains.

   Four traps in that table:
   - **`mail` is a `CNAME`, not an `A`.** Copying the resolved IP instead works today and breaks
     the day site4now renumbers its mail host.
   - **The wildcard `*`.** Omit it and every subdomain dies at once.
   - **`www` must keep pointing at `208.98.35.122`** — it is the proxy origin, not a spare.
   - **The `MX` priority must be `10`, and the panel hides it.** HostGator's list view shows the
     exchange but not the preference number, which defaults to `0` on entry. It was `0` here until
     2026-08-26 and nothing on screen said so. See *The `MX` priority divergence*.
   - **The zone must end up containing these nine records and nothing else.** cPanel zones
     usually ship with their own apex `A` and often a self-pointing `MX`. Left alongside the
     transcribed rows, a leftover default `MX` quietly takes delivery of clinic mail. Transcribing
     is *replacing* the defaults, not adding to them.

   **Check the mail records twice.** A missed `MX`, SPF or DKIM record is the one failure mode
   that produces no error anywhere and is discovered days later.
2. `[PLANNER]` Before the nameserver change, diff HostGator's zone against the table above by
   querying HostGator's nameservers **directly**:

   ```
   npm run zone:diff -- --ns <the nameserver HostGator assigned this account>
   ```

   **It must print `MATCH`.** Anything else is a stop. Read the assigned nameservers out of the
   HostGator panel rather than assuming `ns1/ns2.hostgator.com` — the pair is per-account.
   The corresponding reading of the *old* zone, for comparison, is
   `npm run zone:diff -- --ns ns1.site4now.net --legacy-spf`, which should also print `MATCH`.
3. `[USER]` Change the nameservers at the registrar. One screen. **Only after step 2 prints
   `MATCH`.** Delegating to an unpopulated zone parks the domain and drops all mail — see
   *Reading `npm run zone:diff`*.
4. `[PLANNER]` After propagation, re-run the same check against the delegated nameservers and
   confirm it still prints `MATCH`, then confirm by hand that the legacy site still loads at both
   `therapyjo.com` and `www.therapyjo.com`.
5. `[USER]` **Send and receive a test email again.** Do not skip this.
6. `[USER]` Add `new.therapyjo.com` to the Vercel project and wait for its certificate.
   **Attached 2026-08-26**, Production, no redirect; it reads *Invalid Configuration*, which is
   correct while DNS has not moved. The certificate cannot issue until the delegation lands, so
   only the waiting half of this step remains.
7. `[PLANNER]` Re-run the whole **Phase 2c** checklist against `https://new.therapyjo.com` — a real
   hostname, a real certificate, real cookies. This is the dry run a temporary host URL cannot
   give you. **`/clinic/` should now work**, because `LEGACY_ORIGIN` is reachable. Run the escape
   hunt (Hazard 5) and the latency measurement (Hazard 7) here.

### The TTL floor — 900s, not 300s

**Measured 2026-08-24 while building the zone.** HostGator's Advanced DNS TTL menu offers
1 Week / 1 Day / 12 Hours / 4 Hours / 2 Hours / 1 Hour / 1/2 Hour / **15 Minutes**, and nothing
shorter. Every record in the new zone is therefore **900s**, where the site4now zone runs 300s.

Two consequences, neither fatal:

- **Phase 4's rollback is fifteen minutes, not five.** The apex `A` move is still reversible by
  editing one record; it just takes three times as long to propagate. Plan the flip window
  accordingly, and stop describing the rollback as five minutes.
- **The fallback runbook's precondition "the apex `A` TTL is still 300s" is now false** and should
  read 900s. Nothing else in that runbook depends on the figure.

`zone:diff` reports a TTL that isn't 300 as a `WARN`, giving `MATCH-WARN` rather than `MATCH` — so
expect that verdict, and treat it as the pass. If a shorter TTL is ever wanted, *Premium DNS* is
offered in the panel as a paid add-on and was **not** purchased; whether it lifts the floor is
unverified.

Two more panel specifics worth knowing before editing that zone again:

- **No trailing dots.** `mail5010.site4now.net.` was rejected with *"Invalid DNS Configuration:
  One or more DNS records contain incorrect formatting."* The bare name saved fine. Same for the
  `MX` target.
- **TTL resets to 4 Hours** on every newly added row, and again whenever a row's *Refers to* is
  changed. Set it last, and re-check it after any other edit to that row.

### The 2026-08-26 panel read-back

Every row was read out of the HostGator panel on 2026-08-26 — twice, character for character, with
each record's *Edit* dialog opened to see the fields the list view hides. This is what the zone
**actually contains**, as distinct from what it was intended to contain:

| Type | Refers to | Value | TTL |
|---|---|---|---|
| `A` | `*` | `208.98.35.122` | 15 minutes |
| `A` | `@` | `208.98.35.122` | 15 minutes |
| `A` | `www` | `208.98.35.122` | 15 minutes |
| `A` | **`online`** | `208.98.35.122` | 15 minutes |
| `CNAME` | **`new`** | `31e97fa68447aa19.vercel-dns-017.com` — **no trailing dot** | 15 minutes |
| `CNAME` | `mail` | `mail5010.site4now.net` — **no trailing dot** | 15 minutes |
| `MX` | `@` | `igw10.site4now.net`, priority **`0`** | 15 minutes |
| `TXT` | `@` | `v=spf1 ip4:208.98.35.122 mx include:_spf.site4now.net -all` | 15 minutes |
| `TXT` | `_dmarc` | `v=DMARC1;p=reject;pct=100;rua=mailto:postmaster@therapyjo.com` | 15 minutes |

Four things this settled:

- **The SPF row was already the corrected form.** The 2026-08-24 build entered the Phase 1 record,
  not the legacy one. Which of the two had been typed was an open question until this read — the
  build commit never recorded it. The consequence runs the other way now: the *live* zone is the
  one carrying the legacy `a` mechanism, so Phase 1 through the vendor is what closes the gap.
- **The four TTLs `zone:diff` cannot verify** — `MX`, both `TXT`, and the `mail` `CNAME` — are all
  900s. That closes the "check those four in the panel by eye" caveat under *Reading `npm run
  zone:diff`*.
- **No stray rows.** Eight records at the time of the read-back, nine once `new` was added later
  the same day — no duplicates, confirmed across repeated reads that rendered the list in
  different orders.
- **`online` was added** on 2026-08-26. The wildcard already covered the name; an explicit record
  means the clinic's new origin does not depend on a wildcard surviving future edits to this zone.

`new` followed on 2026-08-26, once `new.therapyjo.com` had been attached to the Vercel project and
its target read off that panel. **The target is per-project — `31e97fa68447aa19.vercel-dns-017.com`,
not the generic `cname.vercel-dns.com`** — which is the same lesson the apex `A` taught: read it off
the panel, never from documentation. Vercel's own notice on that screen says the legacy
`cname.vercel-dns.com` and `76.76.21.21` do still work, so the earlier warning here is about which
value is *recommended*, not about the old ones having been switched off. Vercel displays the target
with a trailing dot; HostGator rejects that form, so it is entered bare.

Two panel behaviours worth adding to the two already recorded under *The TTL floor*:

- **`Refers to` is a dropdown** offering `@`, `www`, and **Other Host**. The last reveals a
  free-text field with `.therapyjo.com` shown greyed beside it — enter the **label only**.
  `online.therapyjo.com` typed there saves as `online.therapyjo.com.therapyjo.com`.
- **A TTL set inside the *Add* dialog is honoured.** The 4-Hours reset applies to *edits* of
  existing rows, not to newly added ones where the TTL was chosen before saving.

### The `MX` priority divergence — found 2026-08-26

The HostGator `MX` record carries priority **`0`**. The live zone answers **`10`** — measured
authoritatively the same day against `ns1.site4now.net` and `ns2.site4now.net`, both returning
`10 igw10.site4now.net`. The panel does not show the preference number in its list view, so this
was invisible until the record's *Edit* dialog was opened.

With a single `MX` host it changes nothing about delivery: one exchanger receives everything
regardless of its preference. It matters for two other reasons.

- **`scripts/check-zone-parity.mjs:36` hardcodes `MX_PREF = 10`** and compares the whole
  `"<priority> <host>"` string, so a published zone would read **`MISMATCH`, exit 1** — a hard
  stop. It would fire inside the watched delegation window, the one place the restructured gate
  says fix forward and never roll back, and at a glance it is indistinguishable from a genuine
  mail failure.
- **It breaks the property the whole phase rests on** — that both zones answer identically, which
  is what makes a split resolver population harmless during the two-day delegation TTL.

**Status: corrected 2026-08-26.** Read back from the record's *Edit* dialog afterwards: priority
`10`, exchange `igw10.site4now.net`, TTL `15 Minutes` — the TTL did **not** reset on the edit,
despite that being the case where this panel is known to reset it. Both zones now agree on this
record.

### The publication problem — why the gate has not passed

**Open as of 2026-08-24.** The seven records are saved and correct in the panel, but no nameserver
reachable from outside serves them:

| Nameserver family | `zone:diff` | How it declines |
|---|---|---|
| `ns1`–`ns3.hostgator.com` | `NOZONE` | Catch-all → `162.214.129.144`, a parking host |
| `dns1`–`dns5.name-services.com` | `NOZONE` | eNom/Newfold. `EREFUSED` — refuses the domain outright |
| **`ns1`–`ns4.launchpad.com`** | `NOZONE` | **HostGator's documented registrar defaults.** Catch-all → **`127.0.0.1`** |

`launchpad.com` is the important row: HostGator's own documentation names those four as the
default nameservers for domains registered with them, so they are almost certainly what
*Revert to Defaults* would set. They answer, and they do not have this zone.

Note what their catch-all returns — **`127.0.0.1`**. A domain delegated to `launchpad` before its
zone exists does not land on a parking page; it resolves to **localhost**, which is a total
blackhole for web *and* mail. That is a worse failure than the HostGator parking address, and it
raises the cost of delegating early rather than lowering it.

Three independent nameserver families, none serving the zone, minutes-to-hours after the records
were saved. The likely explanation is that **HostGator does not publish the zone until the domain
is actually delegated to them** — the registrar stores the records, and the zone goes live only
once the delegation points at it. If that is right, Phase 3's gate is circular as written: the
parity check cannot pass *before* the nameserver change, because there is nothing to check.

**What the gate was actually protecting, and what still covers it.** Its job was to catch a
transcription error before a slow-to-reverse delegation. Part of that is now covered by a
different route: the seven records were read back out of the panel and compared character for
character against this file's table, and they match. What that read-back *cannot* tell you is how
HostGator's DNS will **render** them — and one specific rendering question is the whole ballgame:

> `mail5010.site4now.net` and `igw10.site4now.net` had to be entered **without** trailing dots,
> because the panel rejects the FQDN form. If HostGator treats a dotless value as relative and
> appends the zone, the published records become `mail5010.site4now.net.therapyjo.com` and
> `igw10.site4now.net.therapyjo.com` — and clinic mail stops, under `p=reject`, with no error in
> the panel.

The rejection of the trailing-dot form is weak evidence that it treats these as absolute, but it
is not proof, and `zone:diff` answers it in one second once the zone is reachable. **That single
question is what the gate is now for.**

**The restructured gate.** If publication really is delegation-gated, the check moves after the
flip rather than being abandoned:

1. Delegate during clinic-closed hours (Asia/Amman), with someone watching.
2. Run `npm run zone:diff -- --ns ns1.launchpad.com` **immediately**, then every minute.
3. On anything other than `MATCH`/`MATCH-WARN`, **fix forward in the HostGator panel** — do not
   roll the delegation back. Records are editable and TTLs are 900s, so a bad record is corrected
   in about fifteen minutes; a nameserver rollback takes up to two days.

That bounds the exposure at roughly *time-to-notice + 15 minutes*, which is minutes if it is
watched and hours if it is not. It is still materially riskier than verifying first, and it should
be a deliberate decision rather than a default — but it is a bounded, recoverable risk, not a
blind one.

Before accepting it, **re-run the check** — the panel warns changes can take 24–48 hours, and
these records were minutes old when first measured. If they publish on their own, the original
gate works as written and none of the above is needed.

### Reading `npm run zone:diff`

`npm run zone:diff` (`scripts/check-zone-parity.mjs`) makes ten assertions about a zone — apex,
wildcard and `www` `A`; `mail` `CNAME`; `MX`; SPF; DMARC; and the *absence* of `CAA` on both names
and `AAAA` on the apex — and prints a verdict word on its own first line with a matching exit
code, in the same shape as `cert:check`.

It queries **the nameserver you name, directly**. That is the whole point: until the delegation
changes, public recursive DNS still answers from site4now, so an ordinary lookup would test the
old zone, pass, and tell you nothing about whether HostGator's zone is even populated. `--ns` is
mandatory for that reason — the script refuses to fall back to the system resolver.

| Verdict | Exit | What it means | What to do |
|---|---|---|---|
| `MATCH` | 0 | All ten assertions hold | **The gate is open.** Proceed to the nameserver change |
| `MATCH-WARN` | 0 | Values all correct, some TTL is not 300 | Safe to delegate, but fix the TTL — a long one slows Phase 4's five-minute rollback |
| `SPF-LEGACY` | 2 | The zone carries `v=spf1 a mx …` where the corrected form was expected | Replace `a` with `ip4:208.98.35.122`. Expected against site4now; a **stop** against HostGator |
| `MISMATCH` | 1 | One or more records differ | **Do not change the nameservers.** Fix the record and re-run |
| `NOZONE` | 3 | The nameserver serves nothing of yours for this zone | The zone is not created there yet. **Not a transcription error** — do not go looking for a typo |
| `ERROR` | 4 | No `--ns`, or the nameserver's own address would not resolve | Nothing was measured. Never read it as `MATCH` |

**`NOZONE` is the one to understand, because HostGator's nameservers cannot say "no."** Measured
2026-08-24: `ns1.hostgator.com` answers `162.214.129.144` — a parking host that `301`s to
`wildcard.hostgator.com` — for `therapyjo.com`, for `google.com`, and for a domain that does not
exist. Its `SOA` for all three is a generic catch-all (`root.gator.hostgator.com`, serial
`1378556401`), not a per-domain zone. So an uncreated zone never surfaces as `NXDOMAIN`; it
surfaces as every `A` record being "wrong" in the same way. The script probes a control domain the
server cannot host on every run, which is what lets it tell those two states apart and report
`NOZONE` with the parking address named.

**That measurement is also the reason step 3 is gated on step 2.** Delegating before the zone is
populated does not produce an empty zone — it parks the domain. The apex, `www` and every
subdomain resolve to HostGator's parking page while `MX`, SPF and DMARC disappear outright: the
legacy clinical system unreachable and clinic mail dead, in one move, with a two-day delegation
TTL behind it.

One limit worth knowing: Node's resolver exposes a TTL only for `A`/`AAAA` answers, so the `MX`,
`TXT` and `CNAME` TTLs are **not** verified. The script says so in its own output. Check those
four in the panel by eye.

**Schedule the nameserver change in clinic-closed hours (Asia/Amman, UTC+3).**

**Rollback — and it is the slow one.** Change the nameservers back at the registrar. The
site4now zone stays intact and authoritative throughout; nothing there is deleted.

But do not plan around this being quick. The zone's own `NS` TTL is 3600, and that figure is
misleading: resolvers cache the **`.com` delegation**, not the in-zone `NS` record, and the
delegation TTL for `.com` is conventionally **172800 (two days)**. So a nameserver rollback can
take up to two days to reach every resolver, during which some see HostGator and some see
site4now.

That is exactly why Phase 3 changes no record values. Both zones answer identically, so a split
resolver population is harmless — which is what makes an otherwise slow, hard-to-reverse step
safe to take. It also means **Phase 3 is the one phase you cannot hurry**, and any problem
discovered in it is better fixed forward, by correcting the record in HostGator, than by
rolling the delegation back.

(The `.com` delegation TTL above is the standard value, not one measured here — Windows'
resolver tools would not return the referral. Confirm it at the registrar if the rollback
window matters to the scheduling decision.)

---

## Phase 4 — Flip the front door

**The migration actually happens here. One record, reversible in five minutes.**

> **Entry gate, added 2026-08-24. Do not start this phase until the legacy certificate has
> renewed at least once from behind Phase 3.**
>
> The certificate measured on 2026-08-24 — serial `06575A81…`, `notBefore` 2026-07-24,
> `notAfter` 2026-10-22 — is due to renew around **2026-09-22**. Where Phase 4 sits relative to
> that date is worth about two months of runway:
>
> | | Phase 4 before ~2026-09-22 | **Phase 4 after the renewal is observed** |
> |---|---|---|
> | The ~2026-09-22 renewal | Fails, silently | **Succeeds** — new certificate to ~2026-12-21 |
> | First failed renewal | ~2026-09-22 | ~2026-11-21 |
> | Tripwire fires | ~2026-10-08 | ~2026-12-07 |
> | Hard deadline | 2026-10-22 | **2026-12-21** |
>
> Two things are bought by waiting, and the second matters more than the first:
>
> 1. **A fresh certificate**, doubling the time available to pursue Hazard 9 Option 4.
> 2. **Test B is finally answered.** Nobody has confirmed the legacy host's renewal survives the
>    *nameserver move* at all. If that host validates over DNS-01, Phase 3 alone kills renewal
>    and no fallback runbook helps — the answer is Option 5, and that is worth discovering
>    while the apex is still on the legacy host rather than after it has moved.
>
> **The gate:** run `npm run cert:check` weekly after Phase 3. When it reports the serial has
> changed, Test B has passed — record the new baseline and proceed. If the serial has not changed
> by 2026-10-08, Test B has **failed**: do not run Phase 4, and go to Option 5.

1. `[USER]` Add `therapyjo.com` to the Vercel project. Vercel will show the required `A` value —
   **copy it from the dashboard, not from this file.**
2. `[USER]` Change `AUTH_URL` to `https://therapyjo.com` and redeploy.
3. `[USER]` Change the apex `A` record in HostGator from `208.98.35.122` to Vercel's value.
   **Leave `www` pointing at `208.98.35.122`** — it is the proxy origin. Changing it would break
   `/clinic/` and the staff fallback in the same stroke.
4. `[PLANNER]` Verify in this order, and stop at the first failure:
   - `therapyjo.com` serves the landing page over HTTPS with a valid certificate, doctors and
     blog content populated.
   - `/blog` and an article load.
   - `/login` serves **this** app's login, and a real login succeeds.
   - `/clinic` redirects to `/clinic/`, once, not in a loop.
   - `/clinic/` reaches the legacy login screen **with its stylesheet applied** — an unstyled
     page means the assets escaped the prefix.
5. `[USER]` **Log into the legacy system at `/clinic/` and work it properly.** Open scheduling,
   open a patient record, perform a save, upload a file, run a report. Compare each screen
   against the same screen at `https://www.therapyjo.com`. This is the check that matters most,
   and only a human with legitimate access can perform it. Any difference between the two is an
   escape (Hazard 5), and none of it is a data risk.
   *The login itself and the admin index were audited on 2026-08-23 and their escapes fixed, so
   both should now work end to end. The inner screens were not reachable for that audit. To check
   one without a hosting panel, use the technique in Hazard 5: log in, then `fetch()` the screen's
   URL under `/clinic/` from the page's own JS context and enumerate its `href`/`src`/`action`
   attributes — anything starting `/` that is not `.aspx` or `.axd` is a new escape.*
6. `[PLANNER]` Publish a test post in the new admin and confirm it appears on the public blog.
7. `[USER]` Send and receive a test email a third time. This is the first moment the apex `A`
   has actually changed, which is what Hazard 2 is about.
8. `[USER]` **Same day, not later, *if the panel can be reached*:** in the legacy hosting panel,
   reissue that host's certificate for **`www.therapyjo.com` only**, dropping `therapyjo.com`
   from it. Skipping this does not break anything today — it breaks `/clinic/*` for every staff
   member about a month from now, with no warning in between. Hazard 9 explains why.

   *As of 2026-08-24 this step is **not performable** — no panel login, vendor unreachable. It
   stays written as the permanent fix, and it is what Option 4's outreach is trying to unlock.
   Until it lands, the fallback runbook substitutes for it on a ~60-day cycle. Do not read this
   step as done, and do not read it as optional; read it as owed.*
9. `[PLANNER]` **Arm the tripwire.** Record the current baseline with
   `npm run cert:check -- --update`, then run it weekly. This is Option 3, and it is the only
   thing standing between a silent renewal failure and a clinical outage.

**Rollback:** set the apex `A` back to `208.98.35.122`. Five minutes at a 300s TTL, and the
legacy site is back at the front door. `AUTH_URL` goes back with it. This is the same first move
as the fallback runbook, for a different reason — here it aborts a bad cutover, there it rescues
a renewal.

---

## Phase 5 — Hand over

1. `[USER]` Tell staff their address is now `therapyjo.com/clinic/`, and that
   `www.therapyjo.com` reaches the same system directly if anything looks wrong. Have them
   re-bookmark.
2. `[USER]` **Keep `new.therapyjo.com`.** *Corrected 2026-08-24 — this step previously said to
   remove it after a week of quiet. That is a month before the first renewal window, and it is
   the address the fallback runbook parks this app on. Removing it turns a routine fallback into
   an outage with nowhere to land.* Retire it only once the legacy certificate has been reissued
   for `www` alone (Hazard 9, Option 4) and the runbook is permanently retired with it.
3. `[PLANNER]` For several days, treat any report of a broken screen inside the legacy system as
   Hazard 5 until proven otherwise.
4. `[PLANNER]` Watch Vercel's logs for 404s on root paths that look like legacy assets. Each one
   is an escape that nobody reported.

---

## Fallback runbook — restoring legacy certificate renewal

**Standing procedure, not a phase.** Once Phase 4 has moved the apex, this is the only thing that
keeps the legacy certificate alive, and it will be needed **every ~60 days** until someone gains
authority over the legacy hosting account (Hazard 9, Option 4) or the apex retreats to a
subdomain (Option 5). Written out so it can be executed at 11pm by whoever is available, not
reconstructed from Hazard 9 under pressure.

### What it does, and why it is not instant

Reverting the apex `A` does **not** renew anything by itself. It re-opens the door: with
`therapyjo.com` resolving to `208.98.35.122` again, the legacy host's ACME client can complete
HTTP-01 validation for *both* names on its certificate the next time it runs. **That client's
schedule is unknown and cannot be triggered from outside** — no panel access. The DNS flip takes
five minutes; the wait for the client to run is what sets the length of the window.

### Trigger — fire on the tripwire, not on the outage

| Entry condition | Clinic during the wait | Public site during the wait |
|---|---|---|
| **Tripwire** — serial unchanged with ≤14 days to `notAfter` | **Unaffected.** Old certificate still valid, `/clinic/` still proxies | Off the apex, 1–7 days |
| Outage — certificate already expired | **TLS interstitial at `www`, 502 through `/clinic/`, for the whole wait** | Off the apex, 1–7 days |

Both cost the public site the same. Only one costs the clinic anything. **The outage row is the
backstop for a missed tripwire, never the plan.**

Fire the tripwire when `npm run cert:check` reports `TRIPWIRE`.

### Reading `npm run cert:check`

`npm run cert:check` (`scripts/check-legacy-cert.mjs`, TJ-036) prints a verdict word on its own
first line and exits with a matching code, so it is greppable from a scheduler. Run it **weekly**
from Phase 3 onwards, and **daily** while a fallback is in progress.

| Verdict | Exit | What it means | What to do |
|---|---|---|---|
| `OK` | 0 | Serial matches the baseline, more than 14 days left | Nothing |
| `RENEWED` | 0 | Serial changed on the tracked certificate | **Good news.** Before Phase 4 this is Test B passing; during a fallback it is the signal to flip back. Re-run with `--update` to accept the new baseline |
| `TRIPWIRE` | 1 | Serial unchanged, ≤14 days to `notAfter` | **Run this runbook now** |
| `EXPIRED` | 2 | The tracked certificate has lapsed | Missed tripwire — the clinic is already degraded. Run the runbook and expect the outage row above |
| `FOREIGN` | 3 | The host is not serving the tracked certificate at all | **Check DNS before trusting anything else.** Most likely `www` was repointed by a hand-edit — it must stay at `208.98.35.122` |
| `RESOLVED` | 0 | SAN names `www.therapyjo.com` and no longer names the apex | **Hazard 9 is over.** Someone reissued for `www` alone. Retire this runbook and `new.therapyjo.com` |
| `ERROR` | 3 | Could not measure — timeout, DNS failure, no certificate | **Not a signal. Retry before reacting.** A transient network failure produces this, and it was observed once during TJ-036's own verification. Two consecutive `ERROR`s a few minutes apart is worth investigating; one is not |

**`ERROR` and `FOREIGN` never mean "fine."** They mean the check could not tell you anything about
the certificate, which is the one thing a tripwire must never quietly imply.


### Preconditions — verify these hold *before* they are needed

- `new.therapyjo.com` still resolves and still serves this app. Phase 5 no longer removes it.
- Whoever holds the HostGator DNS login is reachable out of hours, and knows this file exists.
- The apex `A` TTL is still 300s.

### Procedure

| # | Step | Owner | Elapsed |
|---|---|---|---|
| 1 | In HostGator, set the apex `A` from Vercel's value back to `208.98.35.122`. **Do not touch `www`, `*`, `MX` or either `TXT`.** | `[USER]` | ~5 min to propagate |
| 2 | On Vercel, set `AUTH_URL` to `https://new.therapyjo.com` and redeploy | `[USER]` | ~3 min |
| 3 | Tell staff: `therapyjo.com/clinic/` is unavailable, use **`www.therapyjo.com`** directly | `[USER]` | — |
| 4 | **Wait.** Run `npm run cert:check` daily until the serial changes | `[PLANNER]` | **24h–7 days** |
| 5 | Serial changed — record the new one as the baseline (`npm run cert:check -- --update`) | `[PLANNER]` | minutes |
| 6 | Set the apex `A` back to Vercel's value; set `AUTH_URL` to `https://therapyjo.com`; redeploy | `[USER]` | ~8 min |
| 7 | Re-run the Phase 4 step 4 verification list, and tell staff `/clinic/` is back | `[PLANNER]` / `[USER]` | ~15 min |

**Step 1 is the whole mechanism. Steps 2 and 3 are the ones that get forgotten** — skipping 2
breaks login on the new site wherever it is living, and skipping 3 produces a flood of "the
system is down" reports about a system that is up.

### What is actually down

| | During the window |
|---|---|
| Legacy clinical system at `www.therapyjo.com` | **Up throughout.** It never depends on the apex |
| Legacy clinical system at `therapyjo.com` (root) | Up — that is the fallback state |
| **`therapyjo.com/clinic/`** | **404 from IIS.** The prefix exists only on Vercel |
| This app at `therapyjo.com` | Gone. The apex serves the legacy login page to the public |
| This app at `new.therapyjo.com` | Up, provided the precondition above held |
| Email | **Unaffected** — SPF pins `ip4:208.98.35.122` and never dereferences the apex |

### If the serial does not change

- **After 72 hours:** the client is probably not on a daily schedule. Keep waiting; do not flip back.
- **After 7 days, with the certificate still unexpired:** the renewal is not merely blocked by
  DNS. The likeliest explanations are DNS-01 validation (Test B was never answered, or was
  answered wrong) or an ACME client that has stopped running at all. Neither is fixable from
  here. **Go to Option 5** — leave the apex on the legacy host and move this app permanently to
  `new.therapyjo.com`.
- **If the certificate expires while waiting:** nothing new breaks that this runbook can fix. The
  apex is already back on legacy, so `www` continues to serve — with an expired certificate and a
  browser interstitial — until the client renews.

### Recurrence, stated plainly

A Let's Encrypt certificate lasts 90 days and renews at ~30 days remaining, so this window opens
roughly **every 60 days, indefinitely**. Six times a year, someone must notice a silent signal,
flip DNS, wait an unpredictable number of days, and flip back. That is the running cost of
keeping the apex on Vercel without access to the legacy host, and it is the argument for
Option 4 — this runbook is a bridge to that, not a destination.

### What the origin change does to the tripwire — 2026-08-26

`scripts/check-legacy-cert.mjs` was written against a fixed pair of names: `LEGACY_WWW_HOST`
(`www.therapyjo.com`) and `LEGACY_APEX_HOST` (`therapyjo.com`), lines 30-31. Its verdicts are built
on them — `FOREIGN` fires when the observed SAN does not name `www`, and `RESOLVED` fires when the
SAN names `www` without the apex.

Once `LEGACY_ORIGIN` points at `online.therapyjo.com`, both constants are wrong:

| Run | Verdict | Why it is wrong |
|---|---|---|
| Default (`www`) | Whatever `www` happens to serve | `www` is no longer the origin. The certificate it serves stops mattering to `/clinic/*` |
| `-- --host online.therapyjo.com` | **`FOREIGN`** | The SAN will name `online`, not `www`, so the `FOREIGN` gate trips on the *correct* certificate |

`--host` already exists (line 53), so the measurement target is parameterised; the **SAN constants
are not**. The rework is to make the expected name and the forbidden name configurable alongside
the host, so the script can watch `online.therapyjo.com` and assert the apex is absent from *its*
SAN.

**Do not repoint the host and mentally excuse the `FOREIGN`.** This file's own rule stands:
`FOREIGN` and `ERROR` never mean "fine." A tripwire that has to be explained away is not a
tripwire. Until the rework lands the fallback runbook has no automated trigger — a second reason
not to retire the runbook early.

---
## Known hazards

### 1. Vercel rewrites do not preserve the `Host` header

Measured: the legacy IIS returns **403** for any Host it is not bound to, and **resets the
connection** on an unknown SNI name. A Next.js rewrite to an external URL sends the
**destination's** hostname, and no setting changes this. So the origin must be a name IIS
already answers to, with a certificate covering it.

`www.therapyjo.com` satisfies both today, verified. That is the entire reason this plan uses it.
If you move to a dedicated origin hostname later, the legacy host must **bind it and issue a
certificate for it** first, and the DNS record must resolve before a certificate can be issued
over HTTP-01 — the order matters.

Do not work around this by proxying to the IP with a forged Host header and certificate
verification disabled. That puts patient data on an unverified TLS connection.

### 2. SPF, the `a` mechanism, and `DMARC p=reject`

The most dangerous thing in this cutover, and it has nothing to do with the website. `v=spf1 a …`
authorises whatever the apex `A` points at. Point the apex at Vercel and the legacy mail sender
is silently de-authorised, under a DMARC policy of `reject`.

Symptom: appointment reminders and password resets stop arriving, with no error visible anywhere
in either system, discovered days later by a patient who missed an appointment.

Fixed in Phase 1, ahead of time, by pinning the IP instead of dereferencing the `A` record.
Tested in Phases 1, 3 and 4, because each of those phases moves a different piece.

**Re-rated 2026-08-23 — still do it, for a different reason.** The user reports no appointment
emails and no password-reset function in the legacy app, which makes it *probable* that nothing
sends mail from `208.98.35.122` and that de-authorising it breaks nothing. That downgrades this
from a launch blocker to a one-record precaution. Three things keep it on the list anyway:

1. **The evidence is a recollection, not a measurement.** The DMARC reports that would settle it
   are in a mailbox nobody can open. "To my knowledge, nothing sends mail" is exactly the belief
   a silent mail failure hides behind.
2. **The flip does not just remove an authorisation, it adds one.** After Phase 4, `a`
   dereferences to *Vercel's* address — so the SPF record would begin asserting that a shared
   edge IP belonging to a hosting company is a legitimate sender for a medical clinic's domain.
   That is not a breakage, it is sloppiness with the clinic's name on it, and the same one-record
   edit removes it.
3. **It costs one TXT record and 24 hours of waiting**, against a failure mode that is invisible
   for days. That trade does not need a strong prior to be worth taking.

What it stops being is a *reason to delay*. If Phase 1 is inconvenient to schedule, the cutover
can proceed without it — provided this decision is made deliberately rather than by forgetting.

### 3. Vercel caps request bodies at 4.5 MB

`src/app/api/upload/route.ts` rejects files over **10 MB**. Vercel's function request-body limit
is **4.5 MB**. Every upload between those two figures fails in production with a platform 413
that the app's own error handling never sees — and it works perfectly in development, which is
what makes it expensive to diagnose. Scanned patient documents land in that range routinely.

The fix is to upload directly from the browser to Supabase Storage with a signed upload URL, so
the bytes never traverse a Vercel function. Not a cutover prerequisite, provided the 6 MB test
in Phase 2 is honestly assessed and the app's own limit is lowered to match reality in the
meantime — shipping a 10 MB promise the platform breaks at 4.5 MB is worse than shipping a 4 MB
limit. **Candidate TJ-033.**

### 4. The timezone pin does not reach Vercel

`next.config.mjs` sets `process.env.TZ = "Asia/Amman"`, and **no source file references that
timezone** — the whole scheme rests on that one line. `next.config.mjs` is a build-time and
`next start` concern; Vercel's serverless runtime does not evaluate it per invocation. There are
89 raw `new Date(…)` / `toISOString()` call sites in `src/`.

Amman is UTC+3 year-round. Under UTC, everything between 00:00 and 03:00 Amman time is filed to
the previous day. The clinic is closed then, which narrows the blast radius to date-only
boundaries computed near midnight rather than to appointments themselves — but it is wrong, and
it is wrong silently.

**`TZ` cannot be set on Vercel.** Established 2026-08-23: Vercel rejects it as a reserved name —
it is one of the AWS Lambda runtime-reserved variables. The environment-variable fix this file
previously prescribed does not exist.

**What works instead.** Node applies `process.env.TZ` assignments at runtime, verified on Node 22:

```
process.env.TZ='UTC';        new Date('2026-08-23T23:30:00Z')  ->  Sun Aug 23 2026 23:30 GMT+0000
process.env.TZ='Asia/Amman'; new Date('2026-08-23T23:30:00Z')  ->  Mon Aug 24 2026 02:30 GMT+0300
```

That is Hazard 4 in two lines — the same instant is the 23rd in UTC and the 24th in Amman. So the
fix is `instrumentation.ts` with a `register()` that sets `process.env.TZ`, which Next runs once
per server instance at bootstrap, before any request is handled.

**Verify it empirically — do not assume the instrumentation ran.** Whether `register()` executes
before route handlers in Vercel's serverless runtime is a reasonable inference, not a measured
fact. Confirm it in Phase 2c against the real deployment.

None of this is the *real* fix. The real fix is that date-only boundaries should be computed with
an explicit `timeZone`, not inherited from an ambient process setting that three separate layers
have now failed to carry. **Candidate TJ-034**, and it stays open after the cutover.

### 5. The legacy app under a subpath — the escape catalogue

**Status: audited and fixed, 2026-08-23.** This section was speculative in the second planning
pass. It has now been run for real, against the authenticated legacy admin screen, and the
speculation can be replaced with measurements.

**How the audit was done** — worth repeating for any future legacy screen. Log in at `/clinic/`,
then from that page's own JS context `fetch('/clinic/Admin/Index.aspx')`. The legacy session
cookie is scoped to the Vercel host, so the request carries it *through the proxy* and returns the
real authenticated markup (744 KB, HTTP 200). Then enumerate every `href`/`src`/`action` in it.
No hosting-panel access is needed, which matters because there isn't any.

**What the audit found.** The prefix hypothesis holds far better than feared. Of 67 internal
references on the admin index, **65 are relative** (`Index.aspx`, `ViewPatient.aspx`,
`../assets/css/app.css`). There are **no `~/` paths and no directory-style links**. Only two
escapes are reachable through normal use, and both are now fixed. A third is real but no legacy
link can reach it, so it is documented rather than patched:

| # | Escape | Measured | Lands on | Fix |
|---|---|---|---|---|
| 1 | Post-login redirect | `302 Location: /Admin/Index.aspx` | This app → `/login` → 404 — **staff could not log in at all** | `redirects()` in `next.config.mjs` |
| 2 | Resource handlers | `/WebResource.axd`, `/ScriptResource.axd`, **21 refs** on one page | This app → `302 /login` → dead JS, broken postbacks | `beforeFiles` rewrite + middleware matcher |
| 3 | Trailing-slash directories | `/clinic/Admin/` → rewrite drops the slash → IIS `301` to **absolute** `https://www.therapyjo.com/Admin/` | Raw legacy domain, outside the proxy | **Not fixed — unreachable.** No legacy link is directory-style; only hand-typed URLs hit it |

Escape 1 was the live bug: the legacy app replies root-relative, the browser resolves it against
the Vercel host rather than IIS, and the staff member is bounced into *this* app's login. The
`Location` is capital-`A` `/Admin/…`, while the role gate in `auth.config.ts` tests lowercase
`/admin`, so the landing is a **404, not the `/unauthorized` 403** — worth knowing when reading
bug reports about this.

Symptom: a staff screen fails to load, is unstyled, or a click lands on the marketing site.
**Not a data risk** — nothing is lost or corrupted.

The rules now in the tree, both verified present in `.next/routes-manifest.json` after a build:

```js
// redirects() — page navigations, bounced back under the prefix so the address
// bar stays honest. Emits 307: preserves method and body, so postbacks survive.
{ source: "/:file((?!clinic/).*\\.aspx)", destination: "/clinic/:file", permanent: false },

// rewrites().beforeFiles — resource handlers, rewritten so there is no extra round trip
{ source: "/:file((?!clinic/).*\\.axd)", destination: `${LEGACY_ORIGIN}/:file` },
```

Two constraints that are not obvious and cost real debugging time:

**The `(?!clinic/)` lookahead is not optional.** Without it the `.aspx` rule matches its own
destination, and every legacy page enters an infinite redirect.

**The `.axd` rewrite is dead code without a matching middleware exclusion.** Next's routing order
is `headers → redirects → MIDDLEWARE → beforeFiles rewrites → filesystem`. A `beforeFiles`
rewrite therefore runs *after* middleware, so NextAuth answers `/WebResource.axd` with a redirect
to `/login` before the rewrite is ever consulted. `src/middleware.ts` must exclude `axd` from its
matcher — which is the same reason the `/clinic/` rewrite works at all. **The rewrite and the
matcher exclusion are a pair; removing either silently disables the other.** The `.aspx` rule
needs no such pairing because `redirects()` runs *ahead* of middleware.

Note that Next compiles these sources case-insensitively (`/^…/i`), so capital-`A` `/Admin/…`
is caught and `/CLINIC/…` is correctly excluded from the loop guard.

**Verified in production**, `16d35dd`, 2026-08-23:

| Check | Before | After |
|---|---|---|
| `/Admin/Index.aspx` | `302 → /login?callbackUrl=…` | `307 → /clinic/Admin/Index.aspx` |
| `/WebResource.axd` | `302 → /login` | `404` with `X-Powered-By: ASP.NET` — reaches IIS |
| Unauthenticated chain from `/Admin/Index.aspx` | dumped into this app | 3 hops, ends `200` at `/clinic/Login.aspx`, **never leaves the proxy** |
| `/clinic/Login.aspx`, `/clinic/Admin/Index.aspx` | — | `0` redirects — loop guard holds |
| Legacy admin screen in-browser | — | renders; **22 `.axd` resources load with real bytes**; `WebForm_DoPostBackWithOptions`, `WebForm_PostBackOptions` and `Sys` all defined, so postbacks work |
| `/`, `/login`, `/blog`, `/admin`, `/clinic`, `/clinic/` | — | unchanged |

That third row is the one worth remembering: the `.aspx` rule catches the legacy app's *own*
internal auth bounce, not just the post-login redirect. An unauthenticated staff member now walks
`/Admin/Index.aspx → /clinic/Admin/Index.aspx → (IIS 302 /Login.aspx) → /clinic/Login.aspx` and
stays inside the proxy the whole way.

If further escapes turn out to be numerous or structural, the answer is not more rules — it is
`clinic.therapyjo.com` as a subdomain, which sidesteps the entire class of problem for the cost
of one DNS record and one binding. **On the evidence above that is not needed**: the surface was
two rules wide, not structural. Keep it in your pocket anyway — and note it is unavailable until
the nameservers move, since it needs a DNS record nobody can currently create.

### 6. Session cookies cross between the two systems

A consequence of same-origin subpath hosting, worth stating once. Because both systems answer on
`therapyjo.com` at path `/`, every `/clinic/*` request carries **this app's `authjs.session-token`
to the legacy IIS server**, and every request to the marketing site carries the legacy
`ASP.NET_SessionId` to Vercel. Neither system reads the other's cookie, but each one's session
token is transmitted to, and potentially logged by, the other's infrastructure.

There is no fix within a subpath design — the auth cookie must be scoped to `/`. A subdomain
gives the two systems separate cookie jars and removes it entirely. Recorded here as an accepted
consequence of the chosen shape, not as an argument to change it.

Related, and worth an explicit check in Phase 3: confirm the legacy `Set-Cookie` after login
carries **no explicit `Domain=www.therapyjo.com`**. If it does, the browser will reject it under
`therapyjo.com`, and login through `/clinic/` will fail while working perfectly at `www`.

### 7. Latency and cost of proxying a daily-use application

Every clinical request now takes an extra hop: staff browser → nearest Vercel PoP → the legacy
origin, instead of going straight there. Measure it in Phase 3 against the direct
`www.therapyjo.com` address before staff meet it, and again from inside the clinic. A plan that
is technically correct and 400 ms slower on every screen will be judged a failure.

All that traffic is also billed as Vercel data transfer, and there is no caching relief: IIS
sends `Cache-Control: private`.

### 8. Database connections

Use the **pooled** connection string. Repeated because it bites after launch rather than during
it.

**Correction, 2026-08-23 — do not drop `pg.Pool`'s `max` to 1.** An earlier revision of this file
said to, on the reasoning that a serverless instance serves one request at a time. **That
reasoning does not hold here: the project has Fluid Compute enabled.** Fluid instances serve many
concurrent requests, so a pool of 1 would serialise every database call behind a single
connection and turn the pool into the bottleneck. `max: 3` stays.

~~The ceiling is not tight.~~ **Wrong, measured 2026-10-26 (TJ-063).** Production was on the
**session** pooler, where every open client holds one of the **15** pool slots, busy or idle. The
**200** limit applies only in transaction mode. A busy afternoon on 25 Oct hit it 71 times
(`EMAXCONNSESSION … pool_size: 15`), and staff were signed out and could not sign back in.
**Fixed in code, TJ-063a, deployed 2026-10-26 as `f3bf68d`:** `src/lib/prisma.ts` moves the app's
runtime pool from `:5432` to `:6543` on the pooler host, and new connections now log
`mode: transaction`. `max: 3` stays.

The measurements that matter after launch are Supavisor's client-connection count and, if it
appears, `remaining connection slots` in the Postgres logs.

### 9. The shared certificate breaks the proxy about 30 days after cutover

**Severity is on a par with Hazard 2, and the mechanism is the same: a delayed, silent failure
caused by moving the apex.**

> **Status, 2026-08-26 — provisionally solved, pending one answer.** The vendor has agreed to move
> the legacy system to `online.therapyjo.com`. A certificate covering only that name cannot be
> broken by the apex moving, so the mechanism described below stops applying to `/clinic/*`
> altogether. Everything here is kept in full because the solution is *provisional*: it holds if
> and only if `online` gets its **own** certificate. Folded into the existing SAN list, every word
> below still applies unchanged. See *Vendor contact — 2026-08-26* and *Decision, 2026-08-26*.

Measured 2026-08-23: `therapyjo.com` and `www.therapyjo.com` are served by **one certificate**,
not two — identical serial `06575A8139BB2762A52C9A079CFB28F80EE8`, SAN covering both names,
Let's Encrypt, expiring **2026-10-22**.

Let's Encrypt renewal validates **every** name on the certificate, and an ACME order is
all-or-nothing across its identifiers. After Phase 4, HTTP-01 validation for `therapyjo.com`
resolves to Vercel, which knows nothing about the legacy host's challenge token and returns 404.
That one failure fails the whole order — so **`www.therapyjo.com` does not get renewed either.**

Chain of consequences, none of which announces itself:

1. Renewal is attempted, typically ~30 days before expiry — around **2026-09-22**.
2. It fails silently. The existing certificate is still valid, so nothing looks wrong.
3. On **2026-10-22** the certificate expires.
4. Vercel validates TLS when it proxies, so the `/clinic/:path*` rewrite starts returning **502**.
5. Every staff member loses the clinical system at once, roughly a month after a cutover that
   appeared to have gone perfectly.

**The fix, and its timing is the tricky part.** The certificate cannot be narrowed to `www`
*before* Phase 4, because until the apex moves, `https://therapyjo.com` is still served by the
legacy host and needs that name on its certificate. So:

- `[USER]` **Immediately after Phase 4**, in the legacy hosting panel, reissue the certificate
  for **`www.therapyjo.com` only**, dropping `therapyjo.com` from it. The apex no longer needs a
  certificate there.
- **Deadline: before the next renewal attempt** — call it 2026-09-22, and treat a cutover that
  lands near that date as needing this done the same day.
- If the panel will not issue for `www` alone — some issue "domain and www" as an inseparable
  unit — use a dedicated origin hostname instead (`origin.therapyjo.com`), whose certificate
  never contains the apex and is therefore immune. See Target addresses.

**If nobody can instruct the legacy host, this becomes the blocker for the whole cutover.**
Established 2026-08-23: the user cannot log into the SmarterASP.NET control panel. Every fix
above requires *someone* with authority over that hosting account — which is a relationship, not
a password, and may sit with the clinic or with the legacy vendor.

Note carefully what this is **not**. It is not a consequence of serving the legacy app under
`/clinic/`. Abandoning the subpath entirely does not help, because the certificate covering
`www` fails renewal the moment the *apex* stops resolving to the legacy host — regardless of
whether Vercel proxies anything. **Any plan that points `therapyjo.com` at Vercel inherits
this.**

It is also not a cliff. The consequence is a **fuse, roughly 60 days long**:

| Date | Event |
|---|---|
| ~2026-09-22 | First renewal attempt after the flip fails, silently |
| 2026-10-22 | Certificate expires; `/clinic/*` starts returning 502 |
| Any time before then | Reverting the apex `A` to `208.98.35.122` restores renewal |

So the cutover *can* proceed without legacy-host access, provided that is a **decision** rather
than an oversight: either someone gains authority over that account before the renewal window,
or the cutover is rolled back before the certificate expires. Do not start Phase 4 without
naming, in writing, who will do which.

### Options when the legacy host cannot be reached at all

Established 2026-08-23: no control-panel login, and the vendor is unreachable. What remains under
the clinic's control is the **domain registration** and the **Vercel project** — nothing on the
legacy host. These are the options that fit inside that, ordered by how much they actually solve.

| # | Option | Solves it? | Cost |
|---|---|---|---|
| 1 | **Time the cutover just after a successful renewal** | No — extends the fuse from ~30 to ~90 days | Waiting until late September |
| 2 | ~~Proxy the ACME challenge path through Vercel~~ | **RULED OUT 2026-08-23** — measured, not predicted | — |
| 3 | **Cut over and monitor the certificate**, reverting if renewal fails | No — but converts a silent failure into a caught one | Someone must actually watch it |
| 4 | **Reach the host without the vendor** — the account is billed to someone | Yes | Depends on a relationship that may not exist |
| 5 | **Do not move the apex.** New site lives permanently at a new subdomain | Yes, trivially | The new site never gets the real domain |

Options 1, 3 and 4 combine. The sane default is **1 + 3 + 2-if-it-tests-clean**, with 4 running
in the background and 5 as the honest fallback if none of it lands.

**Option 1 — timing.** The certificate was issued 2026-07-24 and expires 2026-10-22, so renewal
is likely around **2026-09-22**. If the apex is still on the legacy host at that moment, renewal
succeeds and the new certificate runs to roughly **2026-12-21**. Cutting over immediately after
that turns a one-month fuse into a three-month one, for free. The renewal is observable from
outside: watch the certificate's **serial number** on `www.therapyjo.com` and note when it
changes.

**Option 2 — ruled out by measurement, 2026-08-23.** The idea was a `beforeFiles` rewrite sending
`/.well-known/acme-challenge/:path*` to the legacy origin, so the legacy host could keep
validating `therapyjo.com` after that name resolves to Vercel.

It was deployed and probed. The response did not come from the legacy origin and did not come
from the application:

```
HTTP/1.1 404 Not Found
X-Vercel-Acme-Ips: 216.198.79.3,64.29.17.3,…
Content-Type: application/json
{"error":{"message":"Token not found","code":"not_found","statusCode":404,"meta":{}}}
```

**Vercel serves `/.well-known/acme-challenge/*` itself, at the platform layer, ahead of
application routing.** An app-level rewrite of that path is unreachable code.

Two conclusions, and they point opposite ways:

- **The rewrite is harmless.** The worry that it might break Vercel's own certificate issuance is
  answered: Vercel owns the path regardless of what the application declares. Test C in the
  ladder below is therefore closed, without needing a nameserver move.
- **The rewrite is also useless.** It can never reach the legacy host, so the legacy host can
  never validate `therapyjo.com` by HTTP-01 once the apex points at Vercel. **The root-cause fix
  for Hazard 9 does not exist on Vercel.**

The rewrite should be deleted rather than left in place looking load-bearing. Batch that with
removing the temporary diagnostic route after Phase 2c.

**What this costs:** the plan of record was "test Option 2, hold Option 5 as the fallback."
Option 2 has now failed its test. The live choices are Option 1 + Option 3 together — cut over
right after a successful renewal and monitor the certificate — or Option 4, or Option 5.

**Option 3 — tripwire.** After Phase 4, check `www.therapyjo.com`'s certificate weekly. If the
**serial has not changed** by two weeks before `notAfter`, renewal has failed: revert the apex
`A` to `208.98.35.122`, let the renewal succeed, and reconsider. This is what makes the fuse
survivable — the failure is silent by nature, so the monitoring is not optional decoration.

**Option 5 — don't move the apex.** Worth stating plainly rather than treating as defeat: leave
both `therapyjo.com` and `www.therapyjo.com` on the legacy host, where the certificate renews
forever, and give the new site a permanent home at a new subdomain. Zero risk, no fuse, no
monitoring — at the price of the new site never occupying the real domain. If the options above
are exhausted, this is better than a cutover with an unmanaged expiry date on it.

### Decision, 2026-08-23

**Test Option 2. Hold Option 5 as the fallback.** Options 1 and 3 come along for free and should
be applied regardless.

**First, a piece of evidence that makes Option 2 plausible rather than a guess.** Option 2 only
works if the legacy host validates over **HTTP-01**; if it uses **DNS-01** it writes challenge
records into the zone, and the nameserver move alone would break renewal — no proxying could
help. Measured 2026-08-23: there are no `_acme-challenge` TXT records, and more tellingly the
**SOA serial is `2025031307`** — frozen since March 2025, while the current certificate was
issued in **July 2026**. A host writing DNS-01 challenge records into this zone would have bumped
that serial. Nothing has written to this zone in over a year.

Evidence, not proof — some ACME integrations edit a zone without touching the visible serial. But
it points firmly at HTTP-01, and it means the Phase 3 nameserver move is very unlikely to break
renewal on its own.

### Decision, 2026-08-24 — supersedes the above

**Proceed with the cutover. Gate Phase 4 on the September renewal. Run Option 4 in parallel, and
keep the fallback runbook armed as the standing safety net.** User decision, 2026-08-24.

The 2026-08-23 decision above — "test Option 2, hold Option 5" — was overtaken the same day by
Option 2's measured failure. This replaces it.

| Element | Choice |
|---|---|
| Option 1 — timing | **Taken.** Phase 4 waits for the ~2026-09-22 renewal. See the Phase 4 entry gate |
| Option 2 — ACME proxy | Dead. Vercel owns `/.well-known/acme-challenge/*` |
| Option 3 — tripwire | **Taken, automated.** `npm run cert:check`, weekly |
| Option 4 — reach the host | **Taken, and it is the actual fix.** Outreach starts now, with ~4 months of runway |
| Option 5 — never move the apex | Held as the fallback, with two named triggers: Test B fails, or the runbook fails to renew after 7 days |

**Certificate re-measured 2026-08-24**, unchanged from the previous day and now the tripwire's
baseline: serial `06575A8139BB2762A52C9A079CFB28F80EE8`, `notBefore` 2026-07-24,
`notAfter` 2026-10-22, SAN `therapyjo.com` + `www.therapyjo.com`, issuer Let's Encrypt.

**What was corrected in the user's plan as originally stated.** The plan was "run the fallback if
the outage happens." Reverting the apex does not renew anything by itself — it re-opens HTTP-01
validation and then waits on an ACME client whose schedule nobody can see. Entering that wait
*after* expiry means the clinic spends the whole of it behind a TLS interstitial and a 502ing
proxy; entering it on the tripwire, ~14 days early, costs the clinic nothing and the public site
the same 1–7 days either way. **The runbook therefore fires on the tripwire; the outage is only
the backstop for a tripwire that was missed.**

**What is being accepted, in writing, per the instruction at the end of Hazard 9.** Until Option 4
lands, the apex stays on Vercel and the legacy certificate is kept alive by a manual ~60-day
cycle: notice, flip, wait, flip back. `[USER]` owns the DNS flips and the staff notice;
`[PLANNER]` owns the weekly check and the call to fire. If Option 4 has not landed by the second
fallback cycle, that is the signal to reconsider Option 5 rather than continue indefinitely.

### Decision, 2026-08-26 — supersedes the above

**Take Option 4 in its stronger form: move the legacy system off the shared certificate entirely,
onto `online.therapyjo.com`.** Vendor agreement obtained 2026-08-26.

The 2026-08-24 decision accepted a permanent ~60-day fallback cycle as the price of not reaching
the host, and ran Option 4 as background work with ~4 months of runway. Option 4 landed in two
days, and what it bought is better than the reissue this file was aiming at. A reissue narrows the
shared certificate to `www` *after* the apex has already moved, which leaves a window in between;
moving the origin to a fresh hostname means the apex never has to appear on the legacy certificate
at any point.

| Element | Status after 2026-08-26 |
|---|---|
| Option 1 — timing | **No longer load-bearing**, if the certificate question answers yes. Phase 4 stops depending on the ~2026-09-22 renewal |
| Option 2 — ACME proxy | Dead, unchanged. Vercel owns `/.well-known/acme-challenge/*` |
| Option 3 — tripwire | **Kept, but repointed.** It stops watching a shared certificate and starts watching the new origin's. Needs the rework named in the next-actions list before it means anything |
| Option 4 — reach the host | **Landed, in a stronger form than specified.** Not a reissue — a move |
| Option 5 — never move the apex | **Released** as the standing fallback, conditional on the certificate answer. If `online` shares the SAN list, Option 5 comes straight back |
| Fallback runbook | **Not retired yet.** It retires when `online` is verified on its own certificate *and* `LEGACY_ORIGIN` points at it. Until both hold, it is still the safety net |

**What is being accepted, in writing.** The clinic now depends on a vendor *relationship* for panel
actions rather than on a login. That is better than unreachable and worse than control. A direct
login, or a named billing contact, is still worth obtaining — Phase 0's ask does not lapse because
one request was granted.

**What has not changed.** Phase 3 still happens. Moving the nameservers to HostGator was never
about Hazard 9; it is about the zone being hosted where the clinic cannot reach it. A cooperative
vendor is not the same thing as control, and this decision does not weaken that step — it only
takes the deadline off it.

**What would reverse this.** Either answer to the certificate question coming back wrong, or
`online.therapyjo.com` failing the outside verification in next-action 2. In either case the
2026-08-24 decision resumes unchanged and Phase 4 goes back behind the renewal gate.

### The test ladder

Three separate questions, each answered before the next step depends on it. **No step is taken
until the one before it has passed.**

| | Question | How it is answered | If it fails |
|---|---|---|---|
| **A** | Does the routing work at all — including the acme-challenge rewrite — without breaking auth or the app? | **PASSED 2026-08-23.** Ten cases against a stand-in origin, branch `routing/clinic-legacy-proxy` (`313af8f`), unmerged. See *Repo changes required*. | — |
| **B** | Does the legacy host's renewal survive the **nameserver move**? | Phase 3, then watch `www`'s certificate **serial** through the ~2026-09-22 renewal window. A changed serial means validation still works. | The host uses DNS-01. Revert the nameservers and go to Option 5. |
| **C** | Does the acme-challenge rewrite break **Vercel's own** certificate issuance? | **ANSWERED 2026-08-23 — no, and it does not work either.** Vercel serves that path itself, ahead of the app. Answered on the `vercel.app` host, with no nameserver move needed. | — |

Only if **A**, **B** and **C** all pass does Phase 4 proceed with the rewrite in place — and even
then, Option 3's tripwire stays on, because C proves the rewrite does not break Vercel, not that
it definitely keeps the legacy renewal alive. That last fact is only ever confirmed by watching
the first renewal after the apex moves.

**Order matters and is not negotiable:** A is free and comes first. B and C both require Phase 3,
because until the nameservers move there is no DNS anyone can edit. B is the one with a calendar
attached — it can only be observed during a renewal window, so reaching Phase 3 before late
September is what keeps the cheap version of this plan available.

**Related, and now closed:** a `CAA` record restricts which certificate authorities may issue for
a zone, and one that did not authorise Vercel's CA would have stalled Phase 4 at the last step
with the apex already moved. **Verified 2026-08-23: no `CAA` record exists**, on the apex or on
`www`. Vercel's issuance cannot be blocked this way.

The corollary is an instruction, not just a fact: **do not add a `CAA` record as part of this
cutover.** It cannot improve the outcome and can only convert a working certificate issuance
into a failed one at the worst possible moment. If the clinic wants CAA — and it is a reasonable
thing to want — add it weeks afterwards, authorising both Let's Encrypt and whichever CA Vercel
turns out to have used.

---

## Out of scope

- **Any migration of legacy data into this application.** A separate project, not started, and
  the only thing that would ever justify legacy credentials.
- **Search-engine visibility.** The landing page renders its content in the browser, so crawlers
  see an empty shell on first look. Real, worth fixing for a marketing site, and unrelated to
  this cutover. `skipTrailingSlashRedirect` adds a second, smaller duplicate-content wart to the
  same future task. **Candidate TJ-035.**
- **Moving this app's admin to `/frontend`.** Deferred by decision — it would mean restructuring
  routing and every internal link for a cosmetic address.
- **Consolidating the legacy hosting itself.** DNS moves to HostGator here; the legacy
  application stays exactly where it is.
