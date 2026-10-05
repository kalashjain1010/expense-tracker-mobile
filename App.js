import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { confirmImport, fetchMe, logout, mobileLoginUrl, suggestImport } from '../lib/api'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, formatINR } from '../lib/format'
import { ensureSmsPermission, isSmsSupported, listInboxSince } from '../lib/sms'
import { filterAndParseMessages } from '../lib/smsParse'
import {
  addSeenKeys,
  getImportPref,
  getLastCheckedMs,
  getPending,
  getSeenKeys,
  getToken,
  setImportPref,
  setLastCheckedMs,
  setPending,
  setToken,
} from '../lib/storage'

WebBrowser.maybeCompleteAuthSession()

export default function App() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState(null)
  const [pref, setPref] = useState('fetch')
  const [pending, setPendingState] = useState([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [review, setReview] = useState(null)
  const [liveTimer, setLiveTimer] = useState(null)

  const refreshUser = useCallback(async () => {
    const token = await getToken()
    if (!token) {
      setUser(null)
      return null
    }
    try {
      const data = await fetchMe()
      setUser(data?.user || null)
      if (!data?.user) await setToken(null)
      return data?.user || null
    } catch {
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        setPref(await getImportPref())
        setPendingState(await getPending())
        await refreshUser()
      } finally {
        setBooting(false)
      }
    })()
  }, [refreshUser])

  const enqueueParsed = useCallback(async (parsedList) => {
    if (!parsedList.length) return 0
    const seen = new Set(await getSeenKeys())
    const cur = await getPending()
    const curKeys = new Set(cur.map((p) => p.dedupeKey))
    const fresh = parsedList.filter((p) => !seen.has(p.dedupeKey) && !curKeys.has(p.dedupeKey))
    if (!fresh.length) return 0

    const enriched = []
    for (const p of fresh) {
      try {
        const s = await suggestImport({
          merchant: p.merchant,
          amount: p.amount,
          date: p.date,
          upiRef: p.upiRef,
        })
        enriched.push({
          ...p,
          category: s.category || 'others',
          noteDraft: s.noteDraft || '',
          confidence: s.confidence,
        })
      } catch {
        enriched.push({ ...p, category: 'others', noteDraft: `UPI ${p.merchant} ₹${p.amount}`, confidence: 0.3 })
      }
    }
    const next = [...enriched, ...cur]
    await setPending(next)
    setPendingState(next)
    return enriched.length
  }, [])

  const runFetch = useCallback(async () => {
    setBusy(true)
    setError('')
    setStatus('Reading SMS…')
    try {
      const ok = await ensureSmsPermission()
      if (!ok) throw new Error('SMS permission is required')
      const last = await getLastCheckedMs()
      // First run: look back 7 days
      const minDateMs = last > 0 ? last : Date.now() - 7 * 24 * 60 * 60 * 1000
      const messages = await listInboxSince(minDateMs, 300)
      const parsed = filterAndParseMessages(messages)
      const n = await enqueueParsed(parsed)
      await setLastCheckedMs(Date.now())
      setStatus(n ? `Found ${n} new debit(s)` : 'No new debit SMS')
    } catch (e) {
      setError(e.message || String(e))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [enqueueParsed])

  // Live mode: poll inbox every 25s while app is open
  useEffect(() => {
    if (!user || pref !== 'live') {
      if (liveTimer) clearInterval(liveTimer)
      setLiveTimer(null)
      return
    }
    runFetch()
    const id = setInterval(() => {
      runFetch()
    }, 25000)
    setLiveTimer(id)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pref])

  async function onLogin() {
    setError('')
    const result = await WebBrowser.openAuthSessionAsync(mobileLoginUrl(), 'expensetracker://auth/callback')
    if (result.type !== 'success' || !result.url) {
      setError('Sign-in cancelled')
      return
    }
    const url = new URL(result.url)
    const token = url.searchParams.get('token')
    const err = url.searchParams.get('error')
    if (err) {
      setError(err)
      return
    }
    if (!token) {
      setError('No session token returned')
      return
    }
    await setToken(token)
    await refreshUser()
  }

  async function onLogout() {
    await logout()
    setUser(null)
    setPendingState([])
  }

  async function onTogglePref(next) {
    await setImportPref(next)
    setPref(next)
  }

  async function openReview(item) {
    setReview({
      ...item,
      category: item.category || 'others',
      noteDraft: item.noteDraft || '',
    })
  }

  async function saveReview() {
    if (!review) return
    setBusy(true)
    setError('')
    try {
      await confirmImport({
        date: review.date,
        amount: Number(review.amount),
        category: review.category,
        merchant: review.merchant,
        upiRef: review.upiRef,
        noteAppend: review.noteDraft,
      })
      await addSeenKeys([review.dedupeKey])
      const next = (await getPending()).filter((p) => p.dedupeKey !== review.dedupeKey)
      await setPending(next)
      setPendingState(next)
      setReview(null)
      setStatus('Saved to your Google Sheet')
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function skipReview() {
    if (!review) return
    await addSeenKeys([review.dedupeKey])
    const next = (await getPending()).filter((p) => p.dedupeKey !== review.dedupeKey)
    await setPending(next)
    setPendingState(next)
    setReview(null)
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#1a5c45" />
      </SafeAreaView>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.brand}>Expense Tracker</Text>
          <Text style={styles.sub}>Android SMS import → your Google Sheet</Text>
          <Text style={styles.bullet}>• Reads bank / UPI debit SMS on this phone</Text>
          <Text style={styles.bullet}>• Suggests category (free AI + rules)</Text>
          <Text style={styles.bullet}>• You confirm before anything is saved</Text>
          {!isSmsSupported() ? (
            <Text style={styles.warn}>Build a custom Android APK (Expo Go cannot read SMS).</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryBtn} onPress={onLogin}>
            <Text style={styles.primaryBtnText}>Continue with Google</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi {user.name || user.email}</Text>
          <Text style={styles.muted}>Pending: {pending.length}</Text>
        </View>
        <Pressable onPress={onLogout}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Import mode</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, pref === 'fetch' && styles.chipOn]}
            onPress={() => onTogglePref('fetch')}
          >
            <Text style={[styles.chipText, pref === 'fetch' && styles.chipTextOn]}>Fetch button</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, pref === 'live' && styles.chipOn]}
            onPress={() => onTogglePref('live')}
          >
            <Text style={[styles.chipText, pref === 'live' && styles.chipTextOn]}>Live while open</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {pref === 'live'
            ? 'Polls SMS about every 25s while this screen is open.'
            : 'Tap the button to import SMS since last check (or last 7 days first time).'}
        </Text>
        <Pressable style={[styles.primaryBtn, busy && styles.disabled]} onPress={runFetch} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? 'Working…' : 'Import since last check'}</Text>
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.section}>To confirm</Text>
      <FlatList
        data={pending}
        keyExtractor={(item) => item.dedupeKey}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.muted}>No pending SMS imports</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => openReview(item)}>
            <Text style={styles.itemTitle}>
              {formatINR(item.amount)} · {CATEGORY_LABELS[item.category] || item.category}
            </Text>
            <Text style={styles.muted} numberOfLines={2}>
              {item.date} · {item.merchant || item.address}
            </Text>
          </Pressable>
        )}
      />

      {user.spreadsheetUrl ? (
        <Pressable style={styles.footerLink} onPress={() => Linking.openURL(user.spreadsheetUrl)}>
          <Text style={styles.link}>Open Google Sheet</Text>
        </Pressable>
      ) : null}

      <Modal visible={Boolean(review)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.h2}>Confirm expense</Text>
              {review ? (
                <>
                  <Text style={styles.label}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={review.date}
                    onChangeText={(t) => setReview({ ...review, date: t })}
                  />
                  <Text style={styles.label}>Amount</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={String(review.amount)}
                    onChangeText={(t) => setReview({ ...review, amount: t })}
                  />
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.wrap}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <Pressable
                        key={c}
                        style={[styles.chip, review.category === c && styles.chipOn]}
                        onPress={() => setReview({ ...review, category: c })}
                      >
                        <Text style={[styles.chipText, review.category === c && styles.chipTextOn]}>
                          {CATEGORY_LABELS[c] || c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.label}>Note</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 64 }]}
                    multiline
                    value={review.noteDraft}
                    onChangeText={(t) => setReview({ ...review, noteDraft: t })}
                  />
                  <Text style={styles.hint} numberOfLines={4}>
                    {review.rawPreview}
                  </Text>
                </>
              ) : null}
            </ScrollView>
            <View style={styles.row}>
              <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={skipReview}>
                <Text style={styles.secondaryBtnText}>Skip</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, busy && styles.disabled]}
                onPress={saveReview}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f5f2', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f5f2' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#121c17',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  brand: { fontSize: 28, fontWeight: '700', color: '#0f3d2e', marginBottom: 6 },
  sub: { color: '#6a7a71', marginBottom: 12 },
  bullet: { color: '#121c17', marginBottom: 4 },
  hello: { fontSize: 18, fontWeight: '700', color: '#0f3d2e' },
  muted: { color: '#6a7a71', fontSize: 13 },
  h2: { fontSize: 16, fontWeight: '700', color: '#0f3d2e', marginBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(18,28,23,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#1a5c45', borderColor: '#1a5c45' },
  chipText: { color: '#121c17', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#1a5c45',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(18,28,23,0.12)',
    backgroundColor: '#fff',
  },
  secondaryBtnText: { color: '#121c17', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  hint: { color: '#6a7a71', fontSize: 12, marginTop: 8, lineHeight: 17 },
  status: { color: '#1a5c45', marginTop: 10, fontWeight: '600' },
  error: { color: '#b33b2e', marginTop: 10 },
  warn: { color: '#7a5310', marginTop: 10 },
  link: { color: '#1a5c45', fontWeight: '700' },
  section: { fontWeight: '700', color: '#0f3d2e', marginBottom: 8 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(18,28,23,0.07)',
  },
  itemTitle: { fontWeight: '700', color: '#121c17', marginBottom: 2 },
  footerLink: { alignItems: 'center', paddingVertical: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18,28,23,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '88%',
  },
  label: { fontSize: 12, fontWeight: '700', color: '#6a7a71', marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(18,28,23,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#121c17',
  },
})
