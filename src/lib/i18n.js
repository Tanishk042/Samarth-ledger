import { useStore } from '../store/useStore'
import { HINDI } from './constants'

const EN = {
  'nav.institutions': 'For institutions',
  'nav.officers': 'For officers',
  'nav.explorer': 'Ledger explorer',
  'nav.login': 'Demo login',
  'nav.portal': 'Open portal',
  'nav.how': 'How it works',
  'nav.trust': 'Trust model',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.reset': 'Reset',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.verify': 'Verify',
  'common.download': 'Download',
  'common.view': 'View',
  'common.logout': 'Log out',
  'common.simulated': 'Simulated',
  'common.demo': 'Demo',
  'home.eyebrow': 'AICTE · Security deposit modernisation',
  'home.title': 'Deposits you can prove. Releases you can trust.',
  'home.sub': 'A verifiable FDR ledger that checks documents, remembers maturity dates, and requires both an AI and a human signature before money moves.',
  'home.cta': 'Open the interactive demo',
  'home.cta2': 'Verify a deposit',
  'home.promise': 'AI helps, humans decide.',
  'home.problem': 'Manual process today',
  'home.solution': 'Samarth ledger',
  'dash.title': 'My deposits',
  'dash.new': 'Add new FDR',
  'dash.search': 'Search FDR, bank or number',
  'dash.all': 'All',
  'dash.active': 'Active',
  'dash.due': 'Due',
  'dash.review': 'Under review',
  'dash.released': 'Released',
  'officer.title': 'Officer dashboard',
  'officer.reviews': 'Review queue',
  'officer.releases': 'Release approvals',
  'officer.audit': 'Audit log',
  'officer.settings': 'Settings',
  'officer.risk': 'Risk flags',
  'officer.graph': 'Fraud graph',
  'login.title': 'Step into the demo',
  'login.sub': 'Three roles. One click. Nothing to install.',
  'explorer.title': 'Ledger explorer',
  'explorer.sub': 'Verify any public FDR fingerprint. No personal data is stored on-chain.',
}

export function useT() {
  const lang = useStore((s) => s.lang)
  return (key, fallback) => {
    if (lang === 'hi') return HINDI[key] || fallback || EN[key] || key
    return EN[key] || fallback || key
  }
}
