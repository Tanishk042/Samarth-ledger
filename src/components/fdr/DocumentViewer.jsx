import { useState } from 'react'
import {
  AlertTriangle,
  FileImage,
  Fingerprint,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  ScanSearch,
  Sparkles,
} from 'lucide-react'
import { Button, InlineNote, Modal, SimBadge } from '../ui/primitives'
import { cn, shortHash } from '../../lib/utils'
import { toast } from '../../store/useToast'

const VIEWS = [
  { key: 'cleaned', label: 'Cleaned' },
  { key: 'original', label: 'Original' },
  { key: 'heatmap', label: 'ELA heat-map' },
  { key: 'overlay', label: 'Overlay' },
]

/**
 * Document evidence viewer. "Run forensic re-check" executes the real
 * crop → deskew → brighten → Laplacian → ELA pipeline in the browser on the
 * stored document, so seeded records can be inspected too.
 */
export default function DocumentViewer({ document: doc, fdr, className }) {
  const [analysis, setAnalysis] = useState(null)
  const [stage, setStage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [plainOpen, setPlainOpen] = useState(false)
  const [view, setView] = useState('cleaned')
  const [imgError, setImgError] = useState(false)

  if (!doc?.url) {
    return (
      <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper/40 px-5 py-12 text-center', className)}>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink/[0.05] text-muted">
          <FileImage size={20} />
        </span>
        <p className="mt-3 text-[12px] font-semibold">No document on this route</p>
        <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-muted">
          Account Aggregator submissions carry consented data fields only. There is no receipt image to forensically inspect.
        </p>
      </div>
    )
  }

  const runAnalysis = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(doc.url)
      if (!res.ok) throw new Error('Stored document could not be loaded.')
      const blob = await res.blob()
      const file = new File([blob], doc.name || 'document.png', { type: blob.type || 'image/png' })
      const { processDocument } = await import('../../lib/image')
      const result = await processDocument(file, { onStep: setStage })
      setAnalysis(result)
      setView('cleaned')
      setOpen(true)
      toast('Live analysis finished. The cleaned hash can differ from the anchored original — that is expected.', {
        tone: 'success',
      })
    } catch (err) {
      setError(err?.message || 'Analysis failed.')
      toast('Could not analyse the stored document.', { tone: 'danger' })
    } finally {
      setBusy(false)
      setStage(null)
    }
  }

  const source = analysis
    ? view === 'original'
      ? analysis.original
      : view === 'heatmap'
        ? analysis.ela?.heatmap
        : view === 'overlay'
          ? analysis.ela?.overlay
          : analysis.cleaned
    : doc.url

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-paper/30', className)}>
      <div className="relative group">
        {!imgError ? (
          <img
            src={doc.url}
            alt={doc.name || `Document for ${fdr?.id || 'deposit'}`}
            className="max-h-[360px] w-full cursor-zoom-in object-contain bg-[#e9e4df]"
            onError={() => setImgError(true)}
            onClick={() => setPlainOpen(true)}
          />
        ) : (
          <div className="grid h-52 place-items-center text-[11px] text-muted">Preview unavailable</div>
        )}
        <button
          type="button"
          onClick={() => setPlainOpen(true)}
          className="absolute right-2 top-2 rounded-full bg-ink/70 p-2 text-white backdrop-blur transition hover:bg-ink"
          aria-label="Open full document preview"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="space-y-3 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold">{doc.name || 'Document'}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
              <span>{doc.kind || 'upload'}</span>
              {doc.isSample && <SimBadge>Built-in sample</SimBadge>}
              {fdr?.source === 'aa' && <SimBadge>AA data only</SimBadge>}
            </p>
          </div>
          <Fingerprint size={15} className="shrink-0 text-muted" />
        </div>

        {doc.hash && (
          <div className="rounded-xl bg-paper/70 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Anchored SHA-256</p>
            <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-ink/80">{doc.hash}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setPlainOpen(true)}>
            <ImageIcon size={13} /> View
          </Button>
          <Button size="sm" variant="ghost" onClick={runAnalysis} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
            {busy ? 'Analysing…' : 'Run forensic re-check'}
          </Button>
        </div>

        {busy && (
          <div className="rounded-xl border border-line bg-surface px-2.5 py-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted">
              <span>{stage?.label || 'Starting pipeline…'}</span>
              <span className="font-mono">{stage?.pct ?? 0}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line/70">
              <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${stage?.pct ?? 0}%` }} />
            </div>
          </div>
        )}
        {error && <p className="text-[10px] font-semibold text-danger">{error}</p>}
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
          <Sparkles size={11} className="mt-0.5 shrink-0" />
          Re-check runs entirely in this browser: crop, deskew, levels, Laplacian focus, ELA and metadata.
        </p>
      </div>

      {/* Plain preview */}
      <Modal
        open={plainOpen}
        onClose={() => setPlainOpen(false)}
        title={doc.name || 'Document preview'}
        description={`${fdr?.id || 'Deposit'} · original file as stored for the demo`}
        size="xl"
      >
        {!imgError ? (
          <img src={doc.url} alt={doc.name} className="mx-auto max-h-[68vh] w-auto rounded-2xl border border-line" />
        ) : (
          <p className="py-10 text-center text-sm text-muted">Preview unavailable.</p>
        )}
        <InlineNote className="mt-4">
          Sample images are generated fixtures. Any other upload is the file you provided in this browser; nothing is sent to a server for
          this analysis.
        </InlineNote>
      </Modal>

      {/* Live analysis */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Live forensic re-check"
        description={`${doc.name || 'Document'} · cleaned hash ${shortHash(analysis?.hash || '', 12)}`}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!analysis) return
                const { downloadText } = await import('../../lib/utils')
                downloadText(
                  JSON.stringify(
                    {
                      fdrId: fdr?.id,
                      document: { name: doc.name, anchoredHash: doc.hash },
                      analysis: {
                        hash: analysis.hash,
                        width: analysis.width,
                        height: analysis.height,
                        quality: analysis.quality,
                        skew: analysis.skew,
                        metadata: analysis.metadata,
                        ela: {
                          mean: analysis.ela?.mean,
                          max: analysis.ela?.max,
                          hotspots: analysis.ela?.hotspots,
                        },
                      },
                      note: 'Live in-browser analysis. Not a certificate of authenticity.',
                    },
                    null,
                    2,
                  ),
                  `forensic-recheck-${fdr?.id || 'document'}.json`,
                  'application/json',
                )
                toast('Forensic re-check exported as JSON.', { tone: 'success' })
              }}
            >
              Export JSON
            </Button>
          </>
        }
      >
        {analysis && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex flex-wrap gap-1">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setView(v.key)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
                      view === v.key ? 'border-ink bg-ink text-paper' : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <img src={source} alt={`${view} view`} className="mt-2 max-h-[52vh] w-full rounded-2xl border border-line object-contain" />
              <p className="mt-2 text-[10px] text-muted">
                {view === 'heatmap'
                  ? 'Brighter regions re-compressed differently from their surroundings. Hotspots are a prompt for human inspection, not proof of editing.'
                  : view === 'overlay'
                    ? 'ELA differences overlaid on the cleaned scan.'
                    : view === 'original'
                      ? 'Decoded and resized original before clean-up.'
                      : 'After auto-crop, deskew and level stretching.'}
              </p>
            </div>
            <div className="space-y-2.5">
              <Metric label="Laplacian focus" value={analysis.quality?.blurScore} note={analysis.quality?.tooBlurry ? 'Below capture guide' : 'Above capture guide'} tone={analysis.quality?.tooBlurry ? 'danger' : 'olive'} />
              <Metric label="Brightness" value={analysis.quality?.brightness} note="0–255" />
              <Metric label="Detected skew" value={`${analysis.skew ?? 0}°`} note="Projection-profile estimate" />
              <Metric label="ELA mean" value={Number(analysis.ela?.mean || 0).toFixed(2)} note={`${analysis.ela?.hotspots ?? 0} hotspot pixels`} />
              <Metric label="Software tag" value={analysis.metadata?.software || 'None found'} note={analysis.metadata?.parser === 'none' ? 'No EXIF/PNG text' : `Parser: ${analysis.metadata?.parser}`} tone={analysis.metadata?.software ? 'danger' : 'olive'} />
              <div className="rounded-xl border border-line bg-paper/60 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Cleaned SHA-256</p>
                <p className="mt-1 break-all font-mono text-[9px] leading-relaxed">{analysis.hash}</p>
                {doc.hash && analysis.hash !== doc.hash && (
                  <p className="mt-2 text-[9px] leading-relaxed text-muted">
                    This differs from the anchored file hash because clean-up re-encodes the image. Both hashes are expected to be different.
                  </p>
                )}
              </div>
              <InlineNote tone="accent" icon={AlertTriangle}>
                This is a probabilistic inspection. It supports an officer decision but does not prove authenticity.
              </InlineNote>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Metric({ label, value, note, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className={cn('mt-0.5 text-[12px] font-semibold', tone === 'danger' ? 'text-danger' : tone === 'olive' ? 'text-olive' : '')}>
          {value ?? '—'}
        </p>
      </div>
      <p className="max-w-[130px] text-right text-[9px] leading-snug text-muted">{note}</p>
    </div>
  )
}
