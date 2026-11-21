/**
 * Generates the three built-in FDR sample images.
 *
 * The images are fictional AICTE demo receipts, not real bank documents. The
 * edited sample carries a PNG `Software` text chunk and a high-ELA amount block
 * so the in-browser forensic pipeline can demonstrate a real failure path.
 *
 * Run with: npm run samples
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const OUT = path.resolve('public/samples')
const BRAND = path.resolve('public/brand')

const W = 1400
const H = 990

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function receiptSvg({ bank, bankShort, fdNumber, amount, issueDate, maturityDate, branch, ifsc, signatory, depositor, accent }) {
  const rows = [
    ['FDR / Deposit No.', fdNumber],
    ['Deposit amount', amount],
    ['Date of issue', issueDate],
    ['Date of maturity', maturityDate],
    ['Branch', branch],
    ['IFSC', ifsc],
    ['Depositor', depositor],
    ['Authorised signatory', signatory],
  ]

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fbf9f4"/>
        <stop offset="0.55" stop-color="#f7f3ea"/>
        <stop offset="1" stop-color="#f2ede2"/>
      </linearGradient>
      <pattern id="guilloche" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
        <path d="M0 13 Q6 4 13 13 T26 13" fill="none" stroke="${accent}" stroke-opacity="0.055" stroke-width="1"/>
        <path d="M0 20 Q6 11 13 20 T26 20" fill="none" stroke="${accent}" stroke-opacity="0.035" stroke-width="0.8"/>
      </pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#paper)"/>
    <rect width="${W}" height="${H}" fill="url(#guilloche)"/>
    <rect x="38" y="38" width="${W - 76}" height="${H - 76}" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="2"/>
    <rect x="48" y="48" width="${W - 96}" height="${H - 96}" fill="none" stroke="${accent}" stroke-opacity="0.22" stroke-width="1"/>
    <path d="M48 168 H${W - 48}" stroke="${accent}" stroke-opacity="0.28" stroke-width="1"/>

    <g font-family="Helvetica, Arial, sans-serif" fill="#1b1b19">
      <circle cx="112" cy="108" r="34" fill="${accent}"/>
      <text x="112" y="119" font-size="30" font-weight="700" text-anchor="middle" fill="#fbf9f4">${esc(bankShort.slice(0, 1))}</text>
      <text x="166" y="98" font-size="30" font-weight="700" letter-spacing="0.4">${esc(bank)}</text>
      <text x="166" y="128" font-size="14" letter-spacing="2.4" fill="#6c655c">FIXED DEPOSIT ADVICE · ILLUSTRATIVE SPECIMEN</text>
      <text x="${W - 72}" y="94" font-size="12" text-anchor="end" fill="#6c655c">FORM FDR-1</text>
      <text x="${W - 72}" y="116" font-size="12" text-anchor="end" fill="#6c655c">SERIAL ${esc(fdNumber.slice(-5))}</text>
      <text x="${W - 72}" y="138" font-size="12" text-anchor="end" fill="#6c655c">PAGE 1 OF 1</text>

      <text x="76" y="216" font-size="15" letter-spacing="2" fill="#6c655c">CERTIFICATE OF DEPOSIT</text>
      <text x="76" y="254" font-size="27" font-weight="700">Security deposit held in trust</text>
      <text x="76" y="283" font-size="14" fill="#6c655c">This advice confirms the receipt of the deposit described below.</text>

      <rect x="76" y="320" width="820" height="462" rx="6" fill="#fffdf8" stroke="#d8d0c2"/>
      ${rows
        .map(([label, value], index) => {
          const y = 368 + index * 51
          const amountRow = index === 1
          return `
            <text x="108" y="${y}" font-size="14" fill="#7b7369" letter-spacing="0.5">${esc(label)}</text>
            <text x="470" y="${y}" font-size="${amountRow ? 27 : 18}" font-weight="${amountRow ? 700 : 600}" fill="#1b1b19" font-family="${amountRow ? 'Courier New, monospace' : 'Helvetica, Arial, sans-serif'}">${esc(value)}</text>
            <path d="M108 ${y + 17} H864" stroke="#e2dbcf" stroke-width="1"/>
          `
        })
        .join('')}
    </g>

    <g font-family="Helvetica, Arial, sans-serif">
      <rect x="932" y="320" width="392" height="462" rx="6" fill="#fffdf8" stroke="#d8d0c2"/>
      <text x="962" y="358" font-size="12" font-weight="700" letter-spacing="1.8" fill="#7b7369">DEPOSIT SUMMARY</text>
      <text x="962" y="404" font-size="13" fill="#6c655c">Principal</text>
      <text x="1292" y="404" font-size="18" font-weight="700" text-anchor="end">${esc(amount)}</text>
      <text x="962" y="442" font-size="13" fill="#6c655c">Interest rate</text>
      <text x="1292" y="442" font-size="18" font-weight="700" text-anchor="end">7.20% p.a.</text>
      <text x="962" y="480" font-size="13" fill="#6c655c">Tenure</text>
      <text x="1292" y="480" font-size="18" font-weight="700" text-anchor="end">24 months</text>
      <path d="M962 502 H1292" stroke="#d8d0c2" stroke-dasharray="4 4"/>
      <text x="962" y="536" font-size="13" fill="#6c655c">Status</text>
      <text x="1292" y="536" font-size="16" font-weight="700" text-anchor="end" fill="#38573c">ACTIVE · LOCKED</text>
      <text x="962" y="580" font-size="11" fill="#7b7369">Amount locked with the issuing bank.</text>
      <text x="962" y="600" font-size="11" fill="#7b7369">Premature withdrawal subject to policy.</text>
      <g transform="translate(1108 690)">
        <circle r="52" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="2"/>
        <circle r="42" fill="none" stroke="${accent}" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="3 3"/>
        <text y="-8" font-size="10" text-anchor="middle" letter-spacing="1.4" fill="${accent}">VERIFIED</text>
        <text y="10" font-size="13" font-weight="700" text-anchor="middle" fill="${accent}">SPECIMEN</text>
        <text y="26" font-size="9" text-anchor="middle" fill="#7b7369">NOT A BANK DOCUMENT</text>
      </g>
      <path d="M1006 754 C1080 714, 1180 792, 1260 730" fill="none" stroke="#3b3a36" stroke-width="1.6" stroke-opacity="0.65"/>
      <text x="962" y="774" font-size="10" fill="#7b7369">Authorised signatory</text>
    </g>

    <g font-family="Helvetica, Arial, sans-serif" fill="#7b7369">
      <path d="M76 822 H1248" stroke="#d8d0c2"/>
      <text x="76" y="854" font-size="11">This is a fictional specimen created for the Samarth Ledger Smart India Hackathon prototype. It is not issued by any bank.</text>
      <text x="76" y="874" font-size="11">All names, numbers and amounts are illustrative. Do not use for any financial purpose.</text>
      <text x="76" y="910" font-size="10" letter-spacing="1.2">SAMARTH LEDGER · FDR EVIDENCE SPECIMEN · ${esc(fdNumber)}</text>
      <text x="${W - 76}" y="910" font-size="10" text-anchor="end" letter-spacing="1.2">DEMO · NOT VALID</text>
    </g>
  </svg>`
}

async function renderBase(config) {
  return sharp(Buffer.from(receiptSvg(config))).png().toBuffer()
}

function noisyPatch(width, height, amplitude = 34, alpha = 86) {
  const buffer = Buffer.alloc(width * height * 4)
  let seed = 9731
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  for (let i = 0; i < width * height; i += 1) {
    const jitter = (rand() - 0.5) * amplitude * 2
    const value = Math.max(0, Math.min(255, 244 + jitter))
    buffer[i * 4] = value
    buffer[i * 4 + 1] = value
    buffer[i * 4 + 2] = value
    buffer[i * 4 + 3] = alpha
  }
  return buffer
}

async function addEditCluster(base) {
  // A noisy, re-saved-looking block around the amount field. Visually it reads
  // as a scan artifact; in ELA it becomes a concentrated recompression cluster.
  const patch = noisyPatch(440, 96, 52, 128)
  return sharp(base)
    .composite([{ input: patch, raw: { width: 440, height: 96, channels: 4 }, left: 440, top: 348 }])
    .png()
    .toBuffer()
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]
    for (let j = 0; j < 8; j += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

/** Insert a PNG tEXt chunk immediately after IHDR. */
function injectPngText(png, key, value) {
  const signature = png.subarray(0, 8)
  const ihdrLength = png.readUInt32BE(8)
  const ihdrEnd = 8 + 4 + 4 + ihdrLength + 4
  const text = pngChunk('tEXt', Buffer.from(`${key}\0${value}`, 'latin1'))
  return Buffer.concat([signature, png.subarray(8, ihdrEnd), text, png.subarray(ihdrEnd)])
}

async function elaStats(png) {
  const { data: original, info } = await sharp(png)
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const jpeg = await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer()
  const { data: recompressed } = await sharp(jpeg)
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let total = 0
  let max = 0
  let hotspots = 0
  for (let i = 0; i < original.length; i += 3) {
    const diff = (Math.abs(original[i] - recompressed[i]) + Math.abs(original[i + 1] - recompressed[i + 1]) + Math.abs(original[i + 2] - recompressed[i + 2])) / 3
    total += diff
    if (diff > max) max = diff
    if (diff > 14) hotspots += 1
  }
  return { mean: total / (info.width * info.height), max, hotspots }
}

async function blurVariance(png) {
  const width = 800
  const height = Math.round((H / W) * width)
  const { data } = await sharp(png).resize(width, height, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true })
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i += 1) gray[i] = data[i]
  let mean = 0
  let variance = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width]
      mean += lap
      variance += lap * lap
      count += 1
    }
  }
  mean /= count
  variance = variance / count - mean * mean
  return Math.round(variance)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  await mkdir(BRAND, { recursive: true })

  const genuineBase = await renderBase({
    bank: 'HDFC Bank',
    bankShort: 'HDFC',
    fdNumber: 'HDFC123456789',
    amount: 'Rs. 25,00,000',
    issueDate: '12/02/2025',
    maturityDate: '11/02/2027',
    branch: 'Mumbai Fort',
    ifsc: 'HDFC0000123',
    signatory: 'V. Raghavan',
    depositor: 'RV College of Engineering',
    accent: '#1C4C8C',
  })
  const genuine = await sharp(genuineBase).png({ compressionLevel: 9 }).toBuffer()

  const editedBase = await renderBase({
    bank: 'HDFC Bank',
    bankShort: 'HDFC',
    fdNumber: 'HDFC987654321',
    amount: 'Rs. 35,00,000',
    issueDate: '03/04/2025',
    maturityDate: '02/04/2027',
    branch: 'Mumbai Fort',
    ifsc: 'HDFC0000123',
    signatory: 'P. Krishnan',
    depositor: 'RV College of Engineering',
    accent: '#1C4C8C',
  })
  const editedCluster = await addEditCluster(editedBase)
  const edited = injectPngText(
    await sharp(editedCluster).png({ compressionLevel: 9 }).toBuffer(),
    'Software',
    'Adobe Photoshop 25.0 (demo fixture)',
  )

  const blurryBase = await renderBase({
    bank: 'Saraswat Co-operative Bank',
    bankShort: 'SRCB',
    fdNumber: 'SRCB0442197',
    amount: 'Rs. 18,00,000',
    issueDate: '18/06/2024',
    maturityDate: '17/06/2028',
    branch: 'Andheri West',
    ifsc: 'SRCB0000042',
    signatory: 'S. Banerjee',
    depositor: 'Sardar Patel Institute of Technology',
    accent: '#3C6B4F',
  })
  const blurry = await sharp(blurryBase)
    .resize(980, Math.round((H / W) * 980))
    .blur(3.1)
    .resize(W, H)
    .jpeg({ quality: 58 })
    .toBuffer()
    .then((buffer) => sharp(buffer).png({ compressionLevel: 9 }).toBuffer())

  await writeFile(path.join(OUT, 'genuine.png'), genuine)
  await writeFile(path.join(OUT, 'edited.png'), edited)
  await writeFile(path.join(OUT, 'blurry.png'), blurry)

  const stats = {}
  for (const [name, buffer] of Object.entries({ genuine, edited, blurry })) {
    stats[name] = {
      bytes: buffer.length,
      blurVariance: await blurVariance(buffer),
      ela: await elaStats(buffer),
    }
  }

  await writeFile(
    path.join(OUT, 'samples.json'),
    `${JSON.stringify(
      {
        note: 'Fictional specimen images for the Samarth Ledger prototype. Generated by scripts/make-samples.mjs.',
        generatedAt: new Date().toISOString(),
        stats,
      },
      null,
      2,
    )}\n`,
  )

  // A small standalone brand mark for the public folder.
  await writeFile(
    path.join(BRAND, 'mark.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="18" fill="#141413"/>
  <path d="M18 18h22a6 6 0 0 1 6 6v22" stroke="#F6F3F1" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M46 46H24a6 6 0 0 1-6-6V18" stroke="#FF671B" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="5.5" fill="#F6F3F1"/>
  <circle cx="32" cy="32" r="2.2" fill="#141413"/>
</svg>
`,
  )

  console.log(JSON.stringify(stats, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
