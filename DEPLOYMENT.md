# Deployment guide

Samarth Ledger deploys to Vercel as a Vite SPA plus nine Node serverless functions. **The web app works without any environment variable or API configured** — those only add optional capabilities.

## 1. Deploy the web app (no configuration)

1. Push this folder to GitHub/GitLab/Bitbucket (or use `vercel` CLI from the project root).
2. In Vercel → **Add New… → Project**, import the repository.
3. Keep the detected framework **Vite**. `vercel.json` already sets:
   - build command `npm run build`
   - output directory `dist`
   - SPA fallback rewrites so deep links such as `/app/officer/releases` refresh correctly
   - CORS + `no-store` headers for `/api/*`
4. Click **Deploy**. No env vars are needed.
5. Open the deployment URL, click **Open interactive demo**, and sign in with one-click role buttons.

> If you deploy to a subpath instead of the domain root, update `base` in `vite.config.js` and the manifest `start_url`.

## 2. Optional environment variables

Add these in **Project → Settings → Environment Variables** and redeploy.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Server | Enables a conservative vision second opinion in `/api/forensic`. Advisory only. |
| `ANTHROPIC_MODEL` | Server | Model id; defaults to `claude-sonnet-4-20250514`. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Server | Vercel KV REST mirror for FDRs, proofs, ledger, events. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Server | Upstash REST mirror (used if KV is absent). |
| `DATABASE_URL` | Server | Neon Postgres mirror; creates a single `kv(key,value,updated_at)` table on first use. |
| `VITE_CONTRACT_ADDRESS` | Client | Deployed `FDRLedger` address for the on-chain display path. |
| `VITE_CHAIN_RPC` | Client | Polygon Amoy read RPC; defaults to `https://rpc-amoy.polygon.technology`. |
| `VITE_CHAIN_ID` | Client | Defaults to `80002`. |

Rules:

- Variables prefixed `VITE_` are embedded in the browser bundle — **never put a secret there**.
- If a configured store is unreachable, `/api` falls back to an in-process map and the browser keeps working. The `storage` field in every API response tells you which path was used (`memory`, `vercel-kv`, `upstash`, `neon`).
- Without `ANTHROPIC_API_KEY`, `/api/forensic` still returns the full deterministic score. `vision` is `null`. Never present the vision note as a final decision.

## 3. Deploy the smart contract (optional)

```bash
cd contracts
npm install
cp .env.example .env
# edit .env: PRIVATE_KEY=0x… (testnet wallet), RPC, optional PolygonScan key
npm test
npm run deploy:amoy
```

The deploy script writes `contracts/deployments/amoy.json` with address, tx hash, and block. Then set `VITE_CONTRACT_ADDRESS` in Vercel to that address and redeploy.

Transfer roles away from the deployer for a real deployment:

```bash
npx hardhat console --network amoy
# const c = await ethers.getContractAt('FDRLedger', '<address>')
# await c.grantRole(await c.OFFICER_ROLE(), '<officer wallet>')
# await c.grantRole(await c.AGENT_ROLE(), '<agent wallet>')
# await c.revokeRole(await c.OFFICER_ROLE(), '<deployer>')
```

Fund the deployer with test POL from a Polygon Amoy faucet. The contract custodies no funds; do not send real value.

## 4. Post-deploy verification checklist

- [ ] `/` loads with no console errors.
- [ ] Refresh `/app/officer/releases` and `/explorer` directly — no 404 (SPA rewrites work).
- [ ] One-click login for all three roles; logout returns to `/login`.
- [ ] `/api/forensic` POST with `{"signals":{}}` returns **400**, not a Vite index.html.
- [ ] `/api/ledger` GET returns JSON with `storage: "memory"` when no store is configured.
- [ ] Genuine / edited / blurry samples land in high / low / medium bands.
- [ ] Release rules, key 1, key 2, and voice challenge behave as in `docs/DEMO_SCRIPT.md`.
- [ ] Toggle offline, queue a submission, return online, confirm replay.
- [ ] Service worker registers in production; API responses are never served from cache.
- [ ] Public explorer shows no names, FDR numbers, amounts, or documents.

## 5. Local checks

```bash
npm install
npm run lint
npm run test:api
npm run test:scoring
npm run build
npm run preview
cd contracts && npm test
python3 public/bank_agent.py   # requires `pip install cryptography`
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Deep link 404s after refresh | Ensure `vercel.json` rewrites are present and framework is Vite. |
| API returns HTML | Confirm the rewrite `/api/(.*) → /api/$1` is above the SPA catch-all. |
| OCR never loads | The Tesseract bundle loads from jsDelivr on demand; offline use relies on labelled fixtures. |
| LocalStorage quota warning | Reset demo data from the toolbar; uploaded images are stored as data URLs. |
| Contract tests fail with HH1006 | Sources must stay in `contracts/src`, not the workspace root (node_modules is excluded). |
| Bank agent signature mismatch | Canonical JSON is sorted keys with no whitespace; use the helper in `public/bank_agent.py`. |
