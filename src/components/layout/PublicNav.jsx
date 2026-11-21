import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Globe, Menu, Moon, Sun, X } from 'lucide-react'
import Brand from './Brand'
import { useStore } from '../../store/useStore'
import { useT } from '../../lib/i18n'
import { cn } from '../../lib/utils'

export default function PublicNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const role = useStore((s) => s.role)
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [location.pathname])

  const links = [
    { href: '/#how', label: t('nav.how', 'How it works') },
    { href: '/#trust', label: t('nav.trust', 'Trust model') },
    { href: '/#samples', label: 'Test documents' },
    { href: '/explorer', label: t('nav.explorer', 'Ledger explorer') },
  ]

  const go = (href) => {
    setOpen(false)
    if (href.startsWith('/#')) {
      if (location.pathname === '/') {
        document.querySelector(href.slice(1))?.scrollIntoView({ behavior: 'smooth' })
      } else {
        navigate(href)
      }
    } else {
      navigate(href)
    }
  }

  const portal = role ? '/app' : '/login'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-line/80 bg-paper/85 backdrop-blur-xl' : 'bg-transparent',
      )}
    >
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Brand />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {links.map((link) =>
            link.href.startsWith('/#') ? (
              <button
                key={link.href}
                type="button"
                onClick={() => go(link.href)}
                className="link-underline text-[13px] font-semibold text-ink/80 hover:text-ink"
              >
                {link.label}
              </button>
            ) : (
              <Link key={link.href} to={link.href} className="link-underline text-[13px] font-semibold text-ink/80 hover:text-ink">
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="hidden items-center gap-1.5 rounded-full px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted transition hover:bg-ink/[0.05] hover:text-ink sm:flex"
            aria-label="Toggle language"
          >
            <Globe size={14} />
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2.5 text-muted transition hover:bg-ink/[0.05] hover:text-ink"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to={portal} className="btn-primary btn-sm ml-1 hidden sm:inline-flex">
            {role ? t('nav.portal', 'Open portal') : t('nav.login', 'Demo login')}
            <ArrowUpRight size={14} />
          </Link>
          <button
            type="button"
            className="rounded-full p-2.5 text-ink lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line bg-paper lg:hidden"
          >
            <div className="container-x flex flex-col gap-1 py-4">
              {links.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => go(link.href)}
                  className="rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-ink/[0.04]"
                >
                  {link.label}
                </button>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <Link to={portal} className="btn-primary flex-1" onClick={() => setOpen(false)}>
                  {role ? 'Open portal' : 'Demo login'}
                </Link>
                <button
                  type="button"
                  onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                  className="btn-outline btn-sm"
                  aria-label="Toggle language"
                >
                  <Globe size={14} />
                  {lang === 'en' ? 'हिंदी' : 'English'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
