# Samarth Ledger

**Autonomous Security Deposit & FDR Management Ledger** — a Smart India Hackathon prototype for AICTE.

> **AICTE deposit trust layer.** Deposits you can prove. Releases you can trust.

Samarth Ledger is a **local-first, zero-setup interactive prototype** that shows how fixed-deposit receipts (FDRs) submitted by institutions as security deposits could be verified, tracked, and released with an explainable AI signal plus a human-controlled double lock.

Everything ships as one repository: a React/Vite app, nine Vercel serverless functions, a Hardhat/Solidity contract, seeded demo data, real sample image specimens, and documentation. **No API key, database, wallet, or backend is required to run the demo.**

---

## ⚠️ Read this first: what is real and what is simulated

This is a **prototype**, not a production AICTE/bank system.

- ✅ **Real:** SHA-256 hashing, Web Crypto ECDSA P-256 signatures, canvas image cleanup, Laplacian blur variance, ELA heatmap, PNG metadata inspection, Tesseract OCR (lazy-loaded) on real uploads, hash-chain verification, rule evaluation, localStorage/IndexedDB persistence, service-worker offline shell, Solidity contract and its tests.
- 🧪 **Simulated / labelled in the UI:** mock login, seeded institutions/banks/FDRs, AA consent + fetch sandbox, WebAuthn fallback, voice challenge, Kafka-like event stream, cross-bank monitor, AI "experts" (deterministic heuristic, **not a trained model**), blockchain anchoring unless you deploy the contract, and all money movement.
- 📊 **Illustrative:** every name, amount, date, health score, and policy target (₹5 Cr pre-approval limit, ₹10 L voice threshold, 98/60 confidence bands, 10% sampling). These are **design targets, not measured results**.

See [`docs/REAL_VS_SIMULATED.md`](docs/REAL_VS_SIMULATED.md) for the full matrix. Privacy note: only fingerprints are written to the ledger; personal/bank data stays off-chain, following DPDP Act 2023 purpose-limitation and data-minimisation principles.

---

## Quick start (60 seconds)

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Click **Open interactive demo** → **Continue as Institution/AICTE Officer/Bank Agent** (one-click login; any 4+ character password also works).

No `.env` file is needed. The app seeds itself on first load. Use the **Demo controls** toolbar to move simulated time, toggle offline mode, or reset the dataset. Vite dev mode stays fully local (it skips `/api` calls); set `VITE_ENABLE_API=1` only if you are proxying the handlers locally. Vercel builds use the real APIs automatically.

### Production build

```bash
npm run build
npm run preview
```

### One-command verification

```bash
npm run lint          # UI/dead-code checks
npm run test:api      # 64 assertions across all nine API routes
npm run test:scoring  # reproducible high / low / medium sample bands
cd contracts && npm install && npm test   # 8 Solidity tests
```

---

## The 5-minute judge demo

See [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for the detailed scripted walkthrough. Short version:

1. **Landing** — tamper a sample FDR on the landing page, then restore it.
2. **Institution** → *Add FDR* → choose `genuine.png` → trust should land in the **high** band; choose `edited.png` → **low**; choose `blurry.png` → **medium** with a blur reason. The uploaded images are cleaned and hashed in the browser.
3. **Officer** → *Review queue* → open the fraud-ring cluster; inspect the explainable reasons and the rule-based risk signal.
4. **Officer** → *Releases* → `REL-0001` fails key 1 (rules); `REL-0004` fails the ₹5 Cr limit; `REL-0003` has a risk hold; `REL-0002` has key 1 signed and needs key 2 + the ₹10 L voice factor.
5. **Bank** → generate and verify an ECDSA locked-balance proof, rotate the demo key, then open the invalid Cosmos proof to see fail-closed verification.
6. **Public explorer** — recompute the whole hash chain, paste a fingerprint, and run the `?tampered=1` drill. No login, no personal data.
7. **Demo toolbar** — go offline, queue a submission, come back online, and watch the replay.

---

## Architecture

```
                     ┌──────────────────────────────────────────────┐
                     │                Browser (local-first)         │
                     │  React 18 · Vite · Router · Tailwind · Framer│
                     │  Zustand + persist (localStorage)            │
                     │  Offline queue (IndexedDB)                   │
                     │  Web Crypto: SHA-256, ECDSA P-256             │
                     │  Canvas cleanup · ELA · blur · EXIF · OCR     │
                     └───────────────┬──────────────────┬────────────┘
                                     │ fetch (optional) │
                     ┌───────────────▼──────────────────▼────────────┐
                     │        Vercel Node functions in /api          │
                     │  forensic · fdrs · aa/consent · aa/fetch      │
                     │  proof · ledger · events · risk · release     │
                     │  Shared deterministic scorer + policy         │
                     │  Optional KV / Upstash / Neon mirror           │
                     └───────────────┬───────────────────────────────┘
                                     │ optional
                     ┌───────────────▼───────────────────────────────┐
                     │  Polygon Amoy: FDRLedger.sol (soulbound)      │
                     │  register → agent key → officer key → release │
                     └───────────────────────────────────────────────┘
```

**Design principle:** the browser is authoritative for the demo. If `/api/*` returns an error, times out, or is missing (e.g. static hosting), every screen falls back to local logic. APIs mirror and validate; they never become a single point of failure.

### State and persistence

- `src/store/useStore.js` owns sessions, FDRs, reviews, releases, reminders, notifications, proofs, ledger blocks, audit/events, settings, offline queue, and the time machine.
- Zustand `persist` writes to `localStorage` under `samarth-ledger-v1`. The offline queue uses IndexedDB.
- `bootstrap()` seeds 40 FDRs across 12 colleges and 8 banks, generates bank keys + five days of proofs, anchors sample document hashes, and verifies the chain.
- **Reset demo data** in the toolbar restores the exact seeded scenario.

### Forensic pipeline

`src/lib/image.js` → `src/lib/ocr.js` → `src/lib/forensic.js` → `shared/forensic.js`.

1. **Cleanup (real):** crop, deskew, brighten/contrast on a canvas; produce an original and cleaned data URL plus SHA-256 of both.
2. **Eye (real signals):** Laplacian blur variance, error-level analysis hotspots, metadata/software tags.
3. **Reader (real on uploads):** Tesseract.js OCR, field extraction and cross-check against declared values. Built-in samples use **labelled fixture values** so the demo is deterministic offline; OCR still runs when available and its engine status is shown.
4. **Memory (real over seeded data):** duplicate fingerprint / FD-number / hash reuse and shared-signatory network checks.
5. **Score:** weighted experts (34/40/26) into Trust 0–100. Bands: high ≥ 98, medium 60–97, low < 60. A 10% deterministic sampling path is displayed when the high band is hit.
6. **Optional second opinion:** set `ANTHROPIC_API_KEY` to request a conservative vision note. It is advisory only and never overrides the deterministic score.

The UI always shows why a score moved, the weakest expert, and the caveat that this is **probabilistic decision support, not certainty**.

### Double-lock release

`src/lib/release.js` and `contracts/FDRLedger.sol` mirror the same policy:

| Gate | Rule |
| --- | --- |
| Maturity | Deposit has matured |
| Grievance | No open grievance |
| Compliance | Institution compliance ≥ 70 |
| Risk | No active risk hold |
| Limit | Amount ≤ ₹5 Cr (illustrative) |
| Pause | Multi-official pause is off |
| Key 1 | AI agent signature, only if all rules pass |
| Key 2 | Officer signature (WebAuthn when available; labelled fallback) |
| Voice | Required for ≥ ₹10 L (browser speech or typed phrase) |

Every failure reverts with a specific, human-readable message (e.g. `FDRLedger: dual signature required`). No funds move.

### Ledger

`src/lib/ledger.js` builds a Web Crypto SHA-256 hash chain. `FDR_REGISTERED` blocks anchor a canonical FDR fingerprint plus an optional document hash. Recomputing the chain detects broken links, edited block payloads, and off-chain amount tampering. The public explorer exposes only fingerprints, status, token IDs, and block hashes — no names, FDR numbers, amounts, documents, or contact details.

---

## API reference

All routes accept/return JSON, send `Access-Control-Allow-Origin: *`, include `httpStatus` and `storage` in responses, and degrade gracefully when optional storage is absent. Role is supplied via `X-Demo-Role: institution|officer|bank`. Read-only/sandbox routes allow a missing role so the static demo still works.

| Route | Methods | Purpose | Auth |
| --- | --- | --- | --- |
| `/api/forensic` | POST | Explainable scoring over aggregate signals; optional Anthropic vision note | optional |
| `/api/fdrs` | GET, POST, PUT, DELETE | Demo FDR mirror with filters and validation | write requires role |
| `/api/aa/consent` | POST | Purpose-limited mock AA consent artefact | optional |
| `/api/aa/fetch` | POST | Deterministic mock bank payload, scope-checked against consent | optional |
| `/api/proof` | POST | ECDSA P-256 proof create (bank) / verify (fail closed) | create bank; verify optional |
| `/api/ledger` | GET, POST | Append hash-chain blocks; verify chain or a single record | append requires role |
| `/api/events` | GET, POST | Mock event topics with validation and filtering | optional |
| `/api/risk` | POST | Rule-based early-warning score over seeded indicators | optional |
| `/api/release` | POST | Evaluate, sign key 1, or attempt a dual-signed release | officer |

See [`docs/API.md`](docs/API.md) for payloads, status codes, and examples. Run `npm run test:api` to exercise all of them locally with mock `req`/`res` objects.

---

## Smart contract

`contracts/src/FDRLedger.sol` (Solidity 0.8.24) implements:

- Soulbound token (transfers/approvals revert; ERC-165/ERC-721 interface flags).
- `registerFDR` with canonical fingerprint, amount, institution, bank, and dates.
- `approveByAgent` and `approveByOfficer` as independent keys.
- `release` enforcing rules, dual signature, and the high-value voice factor.
- `setRiskFlag`, `setGrievance`, and a two-officer emergency pause/resume.
- Role-based access control and on-chain policy setters.

```bash
cd contracts
npm install
npm test          # 8 Hardhat tests
npm run compile
# deploy to Polygon Amoy after copying .env.example → .env
npm run deploy:amoy
```

The contract stores **no personal data and no funds**. The web app does not require it; setting `VITE_CONTRACT_ADDRESS` enables the on-chain display path. Deployment steps are in [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Repository map

```
├── api/                     nine Vercel serverless functions
├── shared/                  deterministic scorer + server helpers
├── src/
│   ├── components/          UI primitives, layout, demo overlays, charts
│   ├── data/seed.js         12 colleges · 8 banks · 40 FDRs · audit/events
│   ├── lib/                 hash, ledger, release, proof, image, ocr, api, i18n
│   ├── pages/               landing, login, institution, officer, bank, public
│   └── store/useStore.js    single Zustand store + persistence
├── contracts/               FDRLedger.sol, Hardhat config, tests, deploy script
├── public/
│   ├── samples/             genuine / edited / blurry PNG specimens + stats
│   ├── brand/               original mark + PWA icons
│   ├── bank_agent.py        reference Python signing helper
│   ├── manifest.webmanifest
│   └── sw.js                offline shell (never caches API responses)
├── scripts/                 sample/icon generators + API harness
└── docs/                    demo script, API reference, real-vs-simulated matrix
```

---

## Accessibility, i18n, and privacy

- Keyboard skip link, focus-visible rings, labelled controls, `aria-live` toasts, reduced-motion friendly animations, semantic headings.
- English and Hindi UI strings for core navigation and dashboard labels.
- Light/dark themes using CSS custom properties.
- Public explorer deliberately omits personal/financial fields.
- No biometric template, document image, or personal identifier is written to the ledger. The AA flow is a labelled sandbox.

---

## Known limitations

1. AI experts are deterministic heuristics over seeded signals; no trained model or measured accuracy is claimed.
2. OCR fixtures for the three built-in samples are labelled; real uploads run real Tesseract OCR.
3. WebAuthn and voice are simulated fallbacks in browsers/devices without those APIs.
4. The event stream is an in-app array with a broker-shaped API, not a live Kafka cluster.
5. Bank proofs are signed with in-browser demo keys; a production agent needs a hardware-backed key store.
6. The hash chain is off-chain unless the contract is deployed and `VITE_CONTRACT_ADDRESS` is set.
7. Uploaded images are stored as data URLs in localStorage; keep uploads small in the demo.
8. Amounts use whole INR in the contract (no token decimals) because no funds are custodied.

---

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for Vercel import settings, environment variables, optional KV/Neon setup, contract deployment, and post-deploy checks.

---

## License / attribution

Prototype authored for Smart India Hackathon. Original branding, copy, and illustrations. Visual inspiration only from `https://kamdalej.sk/en` — no text, logos, or images were copied. Third-party runtime libraries are listed in `package.json`. All seeded organisations, people, and amounts are fictional and illustrative.
