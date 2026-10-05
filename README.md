# Expense Tracker Mobile (Android SMS)

Private internal APK that reads bank/UPI debit SMS, suggests a category, asks you to confirm, then writes into the same Google Sheet as [trackexpense.vercel.app](https://trackexpense.vercel.app).

**Repo:** https://github.com/kalashjain1010/expense-tracker-mobile

## What it does
- Import modes: **Fetch since last check** (default) or **Live while open** (polls ~25s)
- On-device regex parser for Indian debit SMS
- Category suggestion via backend (`rules` + optional free Gemini)
- Confirm modal → merges into same-day Spend row (appends note)

## What it does not do
- iOS / Play Store
- Read GPay/PhonePe in-app history (no public APIs)
- Background import when the app is force-stopped on aggressive OEMs

## Setup

### 1. Backend (expense-tracker API)
Deploy the web/API repo with mobile routes:
- `GET /auth/google/mobile`
- `GET /auth/google/mobile/callback`
- `POST /api/expense/import-suggest`
- `POST /api/expense/import`
- Bearer `Authorization` sessions

In Google Cloud OAuth **Web** client, add redirect:
```
https://trackexpense.vercel.app/auth/google/mobile/callback
```

Optional env on Vercel:
```
GOOGLE_MOBILE_REDIRECT_URI=https://trackexpense.vercel.app/auth/google/mobile/callback
MOBILE_APP_REDIRECT=expensetracker://auth/callback
GEMINI_API_KEY=...   # free tier; optional
```

### 2. App
```bash
cd expense-tracker-mobile
npm install
npx expo prebuild --platform android
npx expo run:android
```

Expo Go **cannot** read SMS — you need a **dev client / release APK**.

### 3. Release APK (sideload)
```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Install on phone: enable **Install unknown apps**, copy APK, open it.

Env for API host (optional):
```
EXPO_PUBLIC_API_BASE=https://trackexpense.vercel.app
```

## Permissions
- `READ_SMS` — inbox query for bank/UPI debits only (parsed on device; only confirmed rows go to your sheet)

## Privacy
SMS stay on-device in a pending queue until you Save/Skip. OTPs are filtered out by the parser.
