import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

const KEYS = {
  token: 'et_session_token',
  pref: 'et_import_pref', // 'live' | 'fetch'
  lastChecked: 'et_last_checked_ms',
  pending: 'et_pending_queue',
  seen: 'et_seen_keys',
}

export async function getToken() {
  try {
    return (await SecureStore.getItemAsync(KEYS.token)) || null
  } catch {
    return null
  }
}

export async function setToken(token) {
  if (!token) {
    await SecureStore.deleteItemAsync(KEYS.token)
    return
  }
  await SecureStore.setItemAsync(KEYS.token, token)
}

export async function getImportPref() {
  return (await AsyncStorage.getItem(KEYS.pref)) || 'fetch'
}

export async function setImportPref(pref) {
  await AsyncStorage.setItem(KEYS.pref, pref === 'live' ? 'live' : 'fetch')
}

export async function getLastCheckedMs() {
  const v = await AsyncStorage.getItem(KEYS.lastChecked)
  return v ? Number(v) : 0
}

export async function setLastCheckedMs(ms) {
  await AsyncStorage.setItem(KEYS.lastChecked, String(ms))
}

export async function getPending() {
  const raw = await AsyncStorage.getItem(KEYS.pending)
  if (!raw) return []
  try {
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

export async function setPending(list) {
  await AsyncStorage.setItem(KEYS.pending, JSON.stringify(list || []))
}

export async function getSeenKeys() {
  const raw = await AsyncStorage.getItem(KEYS.seen)
  if (!raw) return []
  try {
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

export async function addSeenKeys(keys = []) {
  const cur = new Set(await getSeenKeys())
  keys.forEach((k) => cur.add(k))
  // keep last 500
  const arr = [...cur].slice(-500)
  await AsyncStorage.setItem(KEYS.seen, JSON.stringify(arr))
}
