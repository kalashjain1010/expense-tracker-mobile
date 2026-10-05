import { PermissionsAndroid, Platform } from 'react-native'
import * as AndroidSms from 'android-sms'

export { isSmsSupported } from 'android-sms'

export async function ensureSmsPermission() {
  if (Platform.OS !== 'android') return false
  const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)
  if (has) return true
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'SMS access',
    message: 'Expense Tracker reads bank/UPI debit SMS to suggest expenses. Messages stay on your phone until you confirm.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  })
  return result === PermissionsAndroid.RESULTS.GRANTED
}

export async function listInboxSince(minDateMs, maxCount = 200) {
  const ok = await ensureSmsPermission()
  if (!ok) throw new Error('SMS permission denied')
  return AndroidSms.listInbox({ minDateMs, maxCount })
}
