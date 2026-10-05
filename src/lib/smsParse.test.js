const test = require('node:test')
const assert = require('node:assert/strict')

// smsParse.js is ESM-style export — duplicate minimal checks via dynamic import in async test
test('parses PhonePe-style debit', async () => {
  const { parseDebitSms } = await import('./smsParse.js')
  const p = parseDebitSms({
    id: '1',
    address: 'AX-PHONEPE',
    body: 'Rs.250.00 debited from a/c XX1234 to SWIGGY on 05-10-26 UPI Ref 123456789012. Not you? Call 1800',
    date: Date.UTC(2026, 9, 5, 12, 0, 0),
  })
  assert.ok(p)
  assert.equal(p.amount, 250)
  assert.match(p.merchant.toLowerCase(), /swiggy/)
  assert.equal(p.date, '2026-10-05')
})

test('skips OTP', async () => {
  const { parseDebitSms } = await import('./smsParse.js')
  const p = parseDebitSms({
    id: '2',
    address: 'HDFCBK',
    body: 'Your OTP is 123456. Do not share with anyone.',
    date: Date.now(),
  })
  assert.equal(p, null)
})

test('dedupes by ref', async () => {
  const { filterAndParseMessages } = await import('./smsParse.js')
  const msgs = [
    {
      id: '1',
      address: 'HDFCBK',
      body: 'INR 100 debited UPI Ref ABCDEF123456 to MERCHANT',
      date: Date.now(),
    },
    {
      id: '2',
      address: 'HDFCBK',
      body: 'INR 100 debited UPI Ref ABCDEF123456 to MERCHANT',
      date: Date.now(),
    },
  ]
  const out = filterAndParseMessages(msgs)
  assert.equal(out.length, 1)
})
