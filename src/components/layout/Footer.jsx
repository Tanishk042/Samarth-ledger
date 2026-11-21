import { Link } from 'react-router-dom'
import { ArrowUpRight, Github, Lock, ShieldCheck } from 'lucide-react'
import Brand from './Brand'
import { PRIVACY_NOTE } from '../../lib/constants'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-ink text-paper">
      <div className="container-x py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Brand invert />
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-paper/60">
              A verifiable security-deposit ledger for AICTE. AI helps. Humans decide. Only fingerprints go on-chain.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper/60">
                <ShieldCheck size={11} /> DPDP-aware
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper/60">
                <Lock size={11} /> Soulbound FDR
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/40">Product</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-paper/70">
              <li><Link to="/#how" className="hover:text-paper">How it works</Link></li>
              <li><Link to="/#trust" className="hover:text-paper">Trust model</Link></li>
              <li><Link to="/explorer" className="hover:text-paper">Ledger explorer</Link></li>
              <li><Link to="/login" className="hover:text-paper">Demo login</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/40">Demo</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-paper/70">
              <li><Link to="/#samples" className="hover:text-paper">Sample FDRs</Link></li>
              <li><Link to="/explorer?tampered=1" className="hover:text-paper">Tamper demo</Link></li>
              <li><Link to="/login" className="hover:text-paper">Officer persona</Link></li>
              <li><Link to="/login" className="hover:text-paper">Bank agent persona</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/40">Project</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-paper/70">
              <li>Smart India Hackathon</li>
              <li>Problem statement · AICTE</li>
              <li className="flex items-center gap-1">
                Source &amp; contracts <Github size={12} />
              </li>
              <li>
                <a href="https://www.aicte-india.org" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-paper">
                  AICTE <ArrowUpRight size={12} />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-paper/10 pt-6 text-[11px] leading-relaxed text-paper/40 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl">{PRIVACY_NOTE}</p>
          <p className="shrink-0">© 2026 Samarth Ledger · prototype · illustrative demo data</p>
        </div>
      </div>
    </footer>
  )
}
