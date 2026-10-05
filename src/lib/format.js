export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Investments',
  'Wants',
  'Travel',
  'needs',
  'Rent & utils',
  'others',
]

export const CATEGORY_LABELS = {
  Food: 'Food',
  Groceries: 'Groceries',
  Investments: 'Investments',
  Wants: 'Wants',
  Travel: 'Travel',
  needs: 'Needs',
  'Rent & utils': 'Rent & utils',
  others: 'Others',
}

export function formatINR(n) {
  const num = Number(n) || 0
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num)
  } catch {
    return `₹${num}`
  }
}
