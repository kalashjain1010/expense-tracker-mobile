const { requireNativeModule, Platform } = require('expo-modules-core')

let AndroidSms = null
if (Platform.OS === 'android') {
  try {
    AndroidSms = requireNativeModule('AndroidSms')
  } catch {
    AndroidSms = null
  }
}

export async function hasSmsPermission() {
  if (!AndroidSms) return false
  return AndroidSms.hasPermission()
}

export async function requestSmsPermission() {
  if (!AndroidSms) return false
  return AndroidSms.requestPermission()
}

/**
 * @param {{ minDateMs?: number, maxCount?: number }} opts
 * @returns {Promise<Array<{ id: string, address: string, body: string, date: number }>>}
 */
export async function listInbox(opts = {}) {
  if (!AndroidSms) return []
  const minDateMs = Number(opts.minDateMs) || 0
  const maxCount = Math.min(Number(opts.maxCount) || 200, 500)
  return AndroidSms.listInbox(minDateMs, maxCount)
}

export function isSmsSupported() {
  return Platform.OS === 'android' && AndroidSms != null
}
