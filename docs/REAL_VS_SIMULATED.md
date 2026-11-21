# Real vs simulated — honesty matrix

Every item below is labelled in the interface wherever a judge can encounter it. **No AI output is a final decision. No seeded number is a measured result.**

## Genuinely implemented (real code paths)

| Area | What actually runs | Where |
| --- | --- | --- |
| Hashing | Web Crypto SHA-256 of text, blobs, files, and data URLs; canonical FDR fingerprint | `src/lib/hash.js` |
| Hash chain | Block construction and full recomputation; detects broken links, edited payloads, off-chain fingerprint mismatch | `src/lib/ledger.js`, `shared/server.js` |
| Image cleanup | Canvas crop, deskew, brightness/contrast; original + cleaned data URLs | `src/lib/image.js` |
| Blur check | Laplacian variance computed from pixels | `src/lib/image.js` |
| ELA | JPEG re-encode error-level analysis with hotspot detection and heatmap | `src/lib/image.js` |
| Metadata | PNG/JPEG software-tag and tag inspection | `src/lib/image.js` |
| OCR | Tesseract.js loaded lazily from jsDelivr; runs on real uploads; engine status shown | `src/lib/ocr.js` |
| Signatures | ECDSA P-256 sign/verify with Web Crypto and sorted-key canonical JSON | `src/lib/proof.js`, `api/proof.js`, `public/bank_agent.py` |
| Scoring | Deterministic weighted expert engine, bands, sampling, weakest-expert caveats | `shared/forensic.js` |
| Policy | Double-lock rules engine with explicit reasons and revert messages | `src/lib/release.js`, `api/release.js` |
| Persistence | Zustand `persist` → localStorage; offline queue → IndexedDB; replay with idempotency | `src/store/useStore.js`, `src/lib/offline.js` |
| PWA | Manifest, installable icons, service worker offline shell; API traffic never cached | `public/`, `src/main.jsx` |
| Contract | Solidity 0.8.24 soulbound ledger, 8 passing Hardhat tests, Amoy deploy script | `contracts/` |
| APIs | Nine Vercel Node functions with validation, CORS, role checks, optional KV/Upstash/Neon | `api/`, `shared/server.js` |
| i18n / a11y | EN/HI strings, theme tokens, skip link, focus rings, aria-live toasts | `src/` |

`npm run dev` deliberately skips browser → `/api` calls so the console stays clean and the local-first demo is self-contained. Vercel builds call the handlers automatically; set `VITE_ENABLE_API=1` only when proxying the handlers locally.

## Simulated or labelled sandbox

| Area | Status | What a production system would need |
| --- | --- | --- |
| Login / roles | Mock email/password + one-click role switch | Real identity provider, MFA, RBAC with signed claims |
| 12 colleges, 8 banks, 40 FDRs, fraud ring, audit, events | Seeded illustrative fixture data | Authoritative registrar/core-banking feeds |
| Built-in `genuine / edited / blurry` sample OCR | Labelled fixture values; Tesseract still runs when available when a real file is uploaded | Certified OCR pipeline with human adjudication |
| AI “Eye / Reader / Memory” experts | Deterministic heuristics over extracted signals; **not a trained model** | Validated model with measured precision/recall and drift monitoring |
| Trust score, 98/60 bands, 10% sampling | Illustrative policy design targets | Calibrated thresholds from a labelled pilot |
| Anthropic vision note | Optional advisory only; disabled by default | Governance, red-teaming, audit trail, human override |
| Account Aggregator consent + fetch | Deterministic mock sandbox, scope/expiry checks are real | Setu/AA credentials, regulated consent artefacts |
| Bank locked-balance proof | Real signature; bank identity and “locked” assertion are demo-generated | Hardware-backed bank agent key, signed bank statement feed |
| WebAuthn | Native API used when available; labelled simulated fallback otherwise | Registered authenticators, attestation verification |
| Voice challenge | Browser speech or typed phrase; no biometric template stored | Liveness-checked voice biometrics with DPDP consent |
| Event stream / Kafka mesh | In-app array with broker-shaped API and visual mesh | Real broker (Kafka) with partitions and replay |
| Cross-bank consortium monitor | Illustrative aggregate chart | Regulatory data-sharing agreement and tenant isolation |
| Emergency pause | Client policy + contract two-officer flow, no real regulator integration | Multi-party governance and legal process |
| Blockchain anchoring | Local hash chain by default; on-chain path requires deployment | Deployed contract, notarisation and monitoring |
| Reminders | Real rule engine over seeded dates; no email/SMS sent | Consent-based notification service |
| PDF export / time machine | Client-side generation and simulated clock | Archival-grade document and time service |

## Data and privacy

- The public explorer exposes **only** fingerprints, status, token IDs, and block hashes.
- Ledger blocks never contain names, FDR numbers, amounts, document images, or contact details.
- AA sandbox fields are limited to FD summary attributes; no transaction history or personal identifiers.
- Bank proof payloads explicitly set `customerDataIncluded: false`.
- The prototype follows DPDP Act 2023 principles of purpose limitation and data minimisation. It is **not a legal compliance certification**.

## Wording used in the UI

- “Illustrative” — seeded or example data.
- “Simulated” — behaviour that mimics an integration.
- “Design targets, not measured results” — policy numbers such as ₹5 Cr and 98/60.
- “Probabilistic signal, not certainty” — all AI scores.

If a claim cannot be backed by code in this repository, it is not presented as real.
