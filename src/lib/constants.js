export const ROLES = {
  institution: {
    id: 'institution',
    label: 'Institution',
    labelHi: 'संस्थान',
    person: 'Dr. Meera Nair',
    email: 'registrar@rvce.edu.in',
    org: 'RV College of Engineering',
    orgId: 'COL-RVCE',
    blurb: 'Submit FDRs, track maturity, request releases.',
  },
  officer: {
    id: 'officer',
    label: 'AICTE Officer',
    labelHi: 'एआईसीटीई अधिकारी',
    person: 'A. K. Sharma',
    email: 'officer@aicte.gov.in',
    org: 'AICTE · Finance & Compliance',
    orgId: 'AICTE-FIN',
    blurb: 'Review risk, approve releases, hold the second key.',
  },
  bank: {
    id: 'bank',
    label: 'Bank Agent',
    labelHi: 'बैंक एजेंट',
    person: 'S. Iyer',
    email: 'agent@hdfcbank.example',
    org: 'HDFC Bank · FDR desk',
    orgId: 'BANK-HDFC',
    blurb: 'Publish signed proofs that deposits remain locked.',
  },
}

export const STATUS = {
  verified: { label: 'Verified', hi: 'सत्यापित', tone: 'olive' },
  renewal_due: { label: 'Renewal due', hi: 'नवीनीकरण देय', tone: 'amber' },
  under_review: { label: 'Under review', hi: 'समीक्षा में', tone: 'orange' },
  rejected: { label: 'Rejected', hi: 'अस्वीकृत', tone: 'red' },
  released: { label: 'Released', hi: 'जारी', tone: 'ink' },
  pending_sync: { label: 'Pending sync', hi: 'सिंक लंबित', tone: 'sand' },
}

export const TONE_CLASSES = {
  olive: 'border-olive/25 bg-olive/10 text-olive',
  amber: 'border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange: 'border-accent/25 bg-accent/10 text-accent',
  red: 'border-danger/25 bg-danger/10 text-danger',
  ink: 'border-ink/20 bg-ink/[0.06] text-ink',
  sand: 'border-sand bg-sand/30 text-muted',
  blue: 'border-sky-600/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
}

export const TOPICS = [
  'fdr.submitted',
  'fdr.verified',
  'fdr.rejected',
  'reminder.60d',
  'reminder.30d',
  'renewal.prepared',
  'release.requested',
  'release.ai_signed',
  'release.officer_signed',
  'release.completed',
  'proof.created',
  'proof.verified',
  'risk.flagged',
  'audit.exported',
  'sync.replayed',
]

export const DEFAULT_SETTINGS = {
  highThreshold: 98,
  mediumThreshold: 60,
  samplingRate: 10,
  preApprovalLimit: 50000000, // ₹5 crore illustrative policy limit
  highValueVoiceThreshold: 1000000, // ₹10 lakh
  autoPause: false,
  pauseReason: '',
  reminderLeadDays: [60, 30],
  escalationDays: 7,
}

export const HINDI = {
  'nav.institutions': 'संस्थानों के लिए',
  'nav.officers': 'अधिकारियों के लिए',
  'nav.explorer': 'लेजर एक्सप्लोरर',
  'nav.login': 'डेमो लॉगिन',
  'nav.portal': 'पोर्टल खोलें',
  'nav.how': 'यह कैसे काम करता है',
  'nav.trust': 'ट्रस्ट मॉडल',
  'common.search': 'खोजें',
  'common.filter': 'फ़िल्टर',
  'common.reset': 'रीसेट',
  'common.save': 'सहेजें',
  'common.cancel': 'रद्द करें',
  'common.next': 'आगे',
  'common.back': 'पीछे',
  'common.close': 'बंद करें',
  'common.verify': 'सत्यापित करें',
  'common.download': 'डाउनलोड',
  'common.view': 'देखें',
  'common.logout': 'लॉग आउट',
  'common.simulated': 'सिम्युलेटेड',
  'common.demo': 'डेमो',
  'home.eyebrow': 'एआईसीटीई · सुरक्षा जमा आधुनिकीकरण',
  'home.title': 'जमा जिसे आप साबित कर सकें। रिलीज़ जिस पर भरोसा कर सकें।',
  'home.sub': 'एक सत्यापन-योग्य एफडीआर लेजर जो दस्तावेज़ों की जाँच करता है, परिपक्वता याद दिलाता है, और धन जारी करने के लिए एआई और मानव दोनों हस्ताक्षर मांगता है।',
  'home.cta': 'इंटरैक्टिव डेमो खोलें',
  'home.cta2': 'लेजर देखें',
  'home.promise': 'एआई मदद करता है, मनुष्य निर्णय लेते हैं।',
  'home.problem': 'आज की मैन्युअल प्रक्रिया',
  'home.solution': 'समर्थ लेजर',
  'dash.title': 'मेरी जमा',
  'dash.new': 'नया एफडीआर जोड़ें',
  'dash.search': 'एफडीआर, बैंक या संख्या खोजें',
  'dash.all': 'सभी',
  'dash.active': 'सक्रिय',
  'dash.due': 'देय',
  'dash.review': 'समीक्षा में',
  'dash.released': 'जारी',
  'officer.title': 'अधिकारी डैशबोर्ड',
  'officer.reviews': 'समीक्षा कतार',
  'officer.releases': 'जारी स्वीकृतियाँ',
  'officer.audit': 'ऑडिट लॉग',
  'officer.settings': 'सेटिंग्स',
  'officer.risk': 'जोखिम संकेत',
  'officer.graph': 'धोखाधड़ी ग्राफ',
  'login.title': 'डेमो में प्रवेश करें',
  'login.sub': 'तीन भूमिकाएँ। एक क्लिक। कोई सेटअप नहीं।',
  'explorer.title': 'लेजर एक्सप्लोरर',
  'explorer.sub': 'किसी भी सार्वजनिक एफडीआर फिंगरप्रिंट को सत्यापित करें। कोई व्यक्तिगत डेटा नहीं।',
}

export const DECISION_BANDS = [
  { id: 'high', label: 'High confidence', range: '98–100', tone: 'olive' },
  { id: 'medium', label: 'Officer review', range: '60–97', tone: 'amber' },
  { id: 'low', label: 'Low confidence', range: '0–59', tone: 'red' },
]

export const PRIVACY_NOTE =
  'Only cryptographic fingerprints are written to the ledger. Personal and bank data stay off-chain in the application database, consistent with the DPDP Act, 2023 purpose-limitation and data-minimisation principles.'

export const HONESTY = {
  simulated: 'Simulated — demo behaviour, not a production integration.',
  targets: 'Design targets, not measured results.',
  ai: 'AI scores are probabilistic signals, not proof. A human decision is always available.',
}
