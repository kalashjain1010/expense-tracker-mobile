/**
 * Parse Indian bank / UPI debit SMS into structured fields.
 * Credits, OTPs, and unknown templates return null.
 */

const SENDER_HINT =
  /(?:HDFC|SBI|ICICI|AXIS|KOTAK|YESB|IDFC|PNB|BOB|UNION|INDUS|FEDERAL|CANARA|PHONEPE|GPAY|GOOGLEPAY|PAYTM|BHIM|AIRTEL|JIO|AMEX|SCB|HSBC|CITI|RBL|AU BANK|SLICE|CRED)/i

const OTP_HINT = /\b(?:otp|one[\s-]?time|verification code|do not share)\b/i

export function looksLikeBankOrUpiSender(address = '') {
  return SENDER_HINT.test(String(address))
}

export function parseDebitSms({ id, address, body, date }) {
  const text = String(body || '')
  if (!text.trim()) return null
  if (OTP_HINT.test(text)) return null

  const lower = text.toLowerCase()
  const isCredit = /\b(?:credited|received|cr\.|deposit)\b/i.test(text) && !/\bdebited\b/i.test(text)
  if (isCredit) return null

  const isDebit =
    /\b(?:debited|spent|paid|purchase|withdrawn|dr\.)\b/i.test(text) ||
    /\b(?:upi|imps|neft|rtgs)\b/i.test(text) ||
    looksLikeBankOrUpiSender(address)
  if (!isDebit) return null

  const amountMatch =
    text.match(/(?:INR|Rs\.?|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i) ||
    text.match(/\b([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?)\b/)
  if (!amountMatch) return null
  const amount = Number(String(amountMatch[1]).replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null

  const upiRefMatch =
    text.match(/\b(?:UPI[\s\-:]*)?(?:Ref|RRN|Txn(?:\s*ID)?|UTR)[:\s#]*([A-Za-z0-9]{6,})/i) ||
    text.match(/\b([0-9]{12,})\b/)
  const upiRef = upiRefMatch?.[1] || ''

  let merchant = ''
  const toMatch =
    text.match(/\b(?:to|at|towards|paid to)\s+([A-Za-z0-9@._\-]{2,40})/i) ||
    text.match(/\bat\s+([A-Za-z0-9@._\-]{2,40})/i)
  if (toMatch) {
    merchant = toMatch[1].replace(/\s+(on|upi|ref|rrn|txn)\b.*/i, '').trim()
  }
  if (!merchant) {
    const vpa = text.match(/\b([a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,})\b/)
    if (vpa) merchant = vpa[1]
  }
  merchant = merchant.slice(0, 48)

  const ts = Number(date) || Date.now()
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')

  const dedupeKey = upiRef
    ? `ref:${upiRef}`
    : `h:${address}|${yyyy}-${mm}-${dd}|${amount}|${text.slice(0, 40)}`

  return {
    smsId: String(id || ''),
    address: String(address || ''),
    body: text,
    amount,
    merchant,
    upiRef,
    date: `${yyyy}-${mm}-${dd}`,
    dateMs: ts,
    dedupeKey,
    rawPreview: text.slice(0, 160),
  }
}

export function filterAndParseMessages(messages = []) {
  const out = []
  const seen = new Set()
  for (const msg of messages) {
    if (!looksLikeBankOrUpiSender(msg.address) && !/\bupi\b/i.test(msg.body || '')) {
      // still try parse — some banks use short codes without brand in address
    }
    const parsed = parseDebitSms(msg)
    if (!parsed) continue
    if (seen.has(parsed.dedupeKey)) continue
    seen.add(parsed.dedupeKey)
    out.push(parsed)
  }
  return out
}
