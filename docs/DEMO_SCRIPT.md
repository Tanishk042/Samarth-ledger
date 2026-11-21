# Guided demo script (5 minutes)

Use this script during a judging walkthrough. Every number and organisation is **illustrative demo data**. Every simulated surface is labelled in the UI.

## 0. Setup

Open the deployed URL (or `http://localhost:5173` after `npm run dev`). No login is needed for the landing page and public explorer.

## 1. Landing — the problem and the tamper drill (45 s)

1. Scroll to **“A ledger you can prove a deposit against.”**
2. Click **Tamper illustrative record**. The landing chain verification switches to a mismatch for `FDR-2026-0039`.
3. Click **Restore**. The chain verifies again.
4. Point out the **design targets, not measured results** label under the metric cards.

## 2. Institution — real image checks + explainable AI (90 s)

1. Click **Open interactive demo** → **Continue as Institution**.
2. Dashboard shows 40 seeded deposits across 12 colleges with maturity reminders.
3. Click **Add FDR** → choose **Sample: genuine** → **Run document check**.
   - Cleanup preview, SHA-256, blur variance, ELA heatmap, and metadata tags are computed in the browser.
   - Trust lands in the **high** band (≥ 98). Sampling flag may appear — explain it is a 10% second-look policy, not randomness in the outcome.
4. Reload the wizard with `?sample=edited` (or choose **Sample: edited**) → **low** band. Show the reasons: software tag, OCR/declared amount mismatch, noisy amount region.
5. Choose **Sample: blurry** → **medium** band with blur as the weakest expert.
6. Click **Request AA fetch** to see purpose-limited mock consent and a deterministic sandbox payload. Say explicitly: *no real bank data was accessed.*
7. Submit the genuine FDR. It is anchored into the local hash chain and mirrored to `/api/fdrs` when available.

## 3. Officer — review queue, risk, fraud graph (60 s)

1. Switch role via **Demo controls → Sign out**, then sign in as **AICTE Officer**.
2. Open the **Review queue**. Show the seeded `under_review` FDRs and the explainable expert reasons.
3. Open the **fraud graph**. The ring built from shared signatory/branch patterns is a visualisation over seeded data, not an accusation.
4. Open **Risk flags**. Show the rule-based trend, reasons, and the *not a trained model* note.
5. Open **Settings** and change `reminderLeadDays` / `escalationDays`; run reminders from the toolbar to see recomputed notifications.

## 4. Releases — the double lock (90 s)

1. Go to **Releases**.
   - `REL-0001` (`FDR-2026-0037`, ~₹3.2 Cr): key 1 refused because rules fail (grievance / compliance / maturity).
   - `REL-0004` (`FDR-2026-0038`): key 1 refused by the illustrative ₹5 Cr pre-approval limit.
   - `REL-0003` (`FDR-2026-0035`): active risk hold.
   - `REL-0002` (`FDR-2026-0039`, ₹4.6 Cr): key 1 already signed → **key 2 required**.
2. Attempt key 2 without the voice factor — the release is blocked with `FDRLedger: high-value voice challenge incomplete`.
3. Complete the typed voice phrase (or browser speech where available), then sign key 2. WebAuthn appears when the browser supports it; otherwise the fallback is labelled **simulated**.
4. Show the audit entry and the `RELEASED` ledger block with both signers.

## 5. Bank — signed locked-balance proofs (60 s)

1. Sign out, sign in as **Bank Agent**.
2. Select HDFC Bank. The P-256 public JWK is shown; the private key never leaves the demo store.
3. Click **Generate daily proof**. ECDSA signature is real. Inspect the payload: no institution names, FDR numbers, amounts, or people.
4. Click **Verify** — pass. Then mutate a field in the payload inspector and verify again — fail closed.
5. Click **Rotate key**; old proofs remain verifiable against their own public JWK.
6. Open the seeded **invalid Cosmos proof** and the missed-proof alert to show the exception path.

## 6. Public explorer — zero-login verification (45 s)

1. Open `/explorer` in a new tab (no sign-in).
2. Recompute the hash chain: chain valid, head hash shown.
3. Search by fingerprint. Only fingerprints, status, token IDs, and block hashes are visible.
4. Open `/explorer?tampered=1` to run the tamper drill; restore from the explorer.
5. Export privacy-safe JSON and show that it contains no personal or financial fields.

## 7. Offline + time machine (30 s)

1. In **Demo controls**, toggle **Offline**. Submit an FDR → it enters the IndexedDB queue.
2. Toggle back **Online** → the queue replays with idempotency checks and an audit/event entry.
3. Move simulated time +60 days → 60-day reminders appear. +30 more → 30-day reminders and escalation notes.

## Closing line

> “The cryptography, hashing, signatures, image checks, OCR, persistence, and contract tests are real. The institutions, amounts, bank integrations, AA sandbox, voice/WebAuthn fallbacks, and AI experts are clearly labelled simulations. The system never claims certainty and always leaves the final decision with a human.”
