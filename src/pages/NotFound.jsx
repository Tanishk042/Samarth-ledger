import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, Fingerprint, ShieldQuestion } from 'lucide-react'
import PublicNav from '../components/layout/PublicNav'
import Footer from '../components/layout/Footer'
import { Card, Eyebrow, SimBadge } from '../components/ui/primitives'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <PublicNav />
      <main id="main" className="container-x flex flex-1 items-center py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>404 · route not found</Eyebrow>
              <SimBadge>Demo prototype</SimBadge>
            </div>
            <h1 className="display mt-4 text-5xl leading-[0.98] sm:text-7xl">
              This ledger <em className="serif-accent">page</em> is not anchored.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
              The address may be mistyped, or the route may belong to a role you are not signed in as. Nothing was
              changed, and no demo data was lost.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link to="/" className="btn-primary">
                <ArrowLeft size={14} /> Back to overview
              </Link>
              <Link to="/explorer" className="btn-outline">
                <Fingerprint size={14} /> Public explorer
              </Link>
              <Link to="/login" className="btn-ghost">
                Demo login
              </Link>
            </div>
          </div>

          <Card className="relative overflow-hidden p-7">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent/[0.06]" aria-hidden />
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
              <ShieldQuestion size={23} />
            </span>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Useful anchors</p>
            <ul className="mt-3 space-y-2.5 text-[12px]">
              {[
                ['/', 'Product overview'],
                ['/login', 'Three-role demo login'],
                ['/explorer', 'Privacy-safe ledger explorer'],
                ['/app', 'Your role workspace'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link to={href} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper/50 px-3 py-2.5 font-semibold transition hover:border-accent/30 hover:text-accent">
                    <span>{label}</span>
                    <Compass size={13} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[10px] leading-relaxed text-muted">
              This is an illustrative Smart India Hackathon prototype. No real AICTE, bank or institution system is
              connected.
            </p>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
