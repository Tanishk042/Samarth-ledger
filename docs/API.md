# API reference

Base path: `/api` (same origin as the SPA). All bodies are JSON. Every response includes `httpStatus` and `storage` (`memory`, `vercel-kv`, `upstash`, `neon`). `OPTIONS` returns `204` with permissive CORS headers.

Role header: `X-Demo-Role: institution | officer | bank`. Read-only and sandbox endpoints allow a missing role so the static prototype works. Write endpoints enforce roles. This is **demo role gating, not production authentication**.

Error shape:

```json
{ "ok": false, "error": "Missing required field(s): fdNumber", "httpStatus": 422, "storage": "memory" }
```

---

## `POST /api/forensic`

Scores aggregate signals with the same deterministic engine used in the browser. Heavy image/OCR work stays client-side.

```json
{
  "signals": {
    "eye": { "blurVariance": 1712, "elaMean": 1.06, "softwareTag": false },
    "reader": { "exactMatch": true, "fieldsChecked": 6, "fieldsMatched": 6 },
    "memory": { "duplicates": 0, "recordsCompared": 40 }
  },
  "declared": { "fdNumber": "HDFC123456789" },
  "thresholds": { "highThreshold": 98, "mediumThreshold": 60 },
  "samplingRate": 10,
  "samplingRandom": 0.73
}
```

**200** → `score` (0–100), `experts[]`, `decision.band` (`high|medium|low`), `sampled`, `caveats[]`, `engine`, `vision` (`null` unless `ANTHROPIC_API_KEY` is set).
**400** missing signals · **422** inverted thresholds or invalid values · **405** wrong method.

The optional `imageBase64` field is only used for the Anthropic vision opinion and is never persisted.

---

## `/api/fdrs`

Demo FDR mirror. Browser `localStorage` remains authoritative; this is validation + optional durable mirroring.

| Method | Query/Body | Success | Notes |
| --- | --- | --- | --- |
| `GET` | `?q=&bankId=&collegeId=&status=` | 200 `{count, fdrs}` | No role required. |
| `POST` | `{fdr:{id,fdNumber,amount,bankId,collegeId,maturityDate,…}}` | 201 `{fdr}` | Institution/officer. 422 missing fields, 409 duplicate id. |
| `PUT` | `{id, ...patch}` or `{fdr:{id,…}}` | 200 `{fdr}` | Bank denied (403), unknown id 404. |
| `DELETE` | `?id=FDR-…` | 200 `{deleted,count}` | Officer only; others 403. |

---

## `POST /api/aa/consent`

Creates a purpose-limited **mock** Account Aggregator consent artefact. No real AA or bank is contacted.

```json
{ "institutionId": "COL-RVCE", "bankId": "hdfc", "purpose": "FDR verification…", "ttlHours": 24 }
```

**201** → `{consent:{id,provider,expiresAt,fields,simulated:true,…}}`. **422** missing/invalid fields · **405** wrong method.

## `POST /api/aa/fetch`

```json
{ "consentId": "CNS-…", "institutionId": "COL-RVCE", "bankId": "hdfc", "fdNumber": "HDFC123456789" }
```

**200** → `{simulated:true, record:{fdNumber,amount,issueDate,maturityDate,status,interestRate,consentId}}`. Deterministic values by bank prefix and seed. **404** unknown consent · **403** revoked/scope mismatch · **410** expired · **422** missing fields.

---

## `POST /api/proof`

Real ECDSA P-256 over sorted-key canonical JSON. No customer data in the payload. Private keys are never persisted or returned.

**Create** (role `bank` required):

```json
{ "action": "create", "bankId": "hdfc", "bankCode": "HDFC0000001", "proofDate": "2026-11-21", "fdrCount": 8 }
```

**201** → `proof` with `payload`, `signature`, `publicJwk` (EC P-256 `x`/`y`), `valid:true`, `simulated:true`.

**Verify** (no role required):

```json
{ "action": "verify", "payload": {}, "signature": "…", "publicJwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } }
```

**200** → `{valid:boolean, message}`. Any changed field fails closed. **422** invalid inputs · **403** wrong role for create.

A Python reference client is in `public/bank_agent.py`.

---

## `/api/ledger`

Append-only simulated SHA-256 hash chain. Blocks contain fingerprints, not financial/personal data.

- `GET` → `{count, head, blocks}`.
- `GET?action=verify` → recompute chain against mirrored FDRs.
- `POST {action:"verify", fdrs?}` → `{ok, result:{issues[], checkedBlocks, head}}`.
- `POST {action:"verify", fdr:{…}}` → verify one record against its `FDR_REGISTERED` block (404 if unanchored).
- `POST {action:"append", fdr:{…}, docHash?, timestamp?}` → **201** block with `prevHash`, `hash`, `simulated:true`. Role required. Rejected/unsynced FDRs are never anchored (422).

Issue kinds: `broken-link`, `block-hash`, `missing-record`, `fingerprint-mismatch`.

---

## `/api/events`

Mock broker-shaped topic feed.

- `GET?topic=fdr.submitted` → `{count, topics[], events[]}` (last 100).
- `POST {topic, payload, at?}` → **201** event with generated id and `simulated:true`.

Allowed topics: `fdr.submitted`, `fdr.verified`, `fdr.rejected`, `reminder.60d`, `reminder.30d`, `renewal.prepared`, `release.requested`, `release.ai_signed`, `release.officer_signed`, `release.completed`, `proof.created`, `proof.verified`, `risk.flagged`, `audit.exported`, `sync.replayed`. Unknown topics → 422.

---

## `POST /api/risk`

Deterministic rule-based signal over seeded indicators. **Not a trained model.**

```json
{
  "fdr": { "amount": 2500000, "maturityDate": "2027-01-10", "fraudRing": true },
  "college": { "compliance": 92, "lateRenewals": 4, "docErrors": 5 },
  "health": [{ "week": "W1", "health": 92 }, { "week": "W2", "health": 86 }]
}
```

**200** → `{score, band:"low|medium|high", label, reasons[], trend[], note, simulated:true}`. **422** if `fdr`, `college`, or `health[]` is missing.

---

## `POST /api/release`

Stateless mirror of the client double-lock rules. Role `officer` required.

```json
{
  "action": "evaluate | signKey1 | attempt",
  "fdr": { "id": "FDR-2026-0039", "amount": 46000000, "maturityDate": "2024-03-10" },
  "college": { "compliance": 91 },
  "settings": { "preApprovalLimit": 50000000, "highValueVoiceThreshold": 1000000 },
  "now": "2026-11-21T00:00:00.000Z",
  "paused": false,
  "key1": { "signature": "…" },
  "key2": { "signature": "…" },
  "voice": { "verified": true, "method": "typed" }
}
```

- `evaluate` → rules array, `allPass`, `voiceRequired`, `key1Allowed`.
- `signKey1` → **200** key1 signature, or **422** `FDRLedger: release rules not satisfied`.
- `attempt` → **200** simulated release record; **423** paused; **422** rules failed; **409** key 1 / key 2 / voice missing.

Every status code is paired with a specific revert-style message. No funds move.
