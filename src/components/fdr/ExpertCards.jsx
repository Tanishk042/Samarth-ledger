import { Eye, History, ScanText, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

const META = {
  eye: { name: 'Eye', role: 'Document & image forensics', icon: Eye, tone: 'text-accent bg-accent/10' },
  reader: { name: 'Reader', role: 'OCR & field consistency', icon: ScanText, tone: 'text-olive bg-olive/10' },
  memory: { name: 'Memory', role: 'History & network patterns', icon: History, tone: 'text-ink bg-ink/[0.07]' },
}

const ORDER = ['eye', 'reader', 'memory']

/**
 * Normalises both the seeded reason shape ({eye:{score,reasons}}) and the live
 * API shape ({experts:[{key,score,reasons}]}) into one renderable list.
 */
export function normaliseExperts(source) {
  if (!source) return []
  if (Array.isArray(source)) {
    return source.map((item) => ({
      key: item.key || item.name?.toLowerCase(),
      score: item.score,
      reasons: item.reasons || [],
      name: item.name,
      role: item.role,
    }))
  }
  return Object.entries(source).map(([key, value]) => ({
    key,
    score: value?.score,
    reasons: value?.reasons || [],
    name: value?.name,
    role: value?.role,
  }))
}

export default function ExpertCards({ experts, className, compact = false }) {
  const list = normaliseExperts(experts)
  if (!list.length) {
    return (
      <p className={cn('rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[11px] text-muted', className)}>
        No expert breakdown is attached to this record.
      </p>
    )
  }
  const ordered = [...list].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
  return (
    <div className={cn('grid gap-3', compact ? 'sm:grid-cols-3' : 'md:grid-cols-3', className)}>
      {ordered.map((expert) => {
        const meta = META[expert.key] || META.memory
        const Icon = meta.icon
        const score = Number(expert.score) || 0
        const weak = score < 60
        return (
          <div key={expert.key} className="rounded-2xl border border-line bg-paper/35 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className={cn('grid h-8 w-8 place-items-center rounded-xl', meta.tone)}>
                <Icon size={15} />
              </span>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold leading-none">{score}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">/ 100</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] font-semibold">{expert.name || meta.name}</p>
            <p className="text-[10px] text-muted">{expert.role || meta.role}</p>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-line/70">
              <span
                className={cn('block h-full rounded-full', weak ? 'bg-danger' : score < 90 ? 'bg-amber-500' : 'bg-olive')}
                style={{ width: `${Math.max(4, score)}%` }}
              />
            </div>
            {!compact && (
              <ul className="mt-3 space-y-1.5">
                {expert.reasons?.slice(0, 4).map((reason, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
                    {weak ? (
                      <TriangleAlert size={10} className="mt-0.5 shrink-0 text-danger" />
                    ) : (
                      <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-muted/60" />
                    )}
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
