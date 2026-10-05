# Install (friends)

1. Get `app-release.apk` from the builder.
2. On Android: **Settings → Security → Install unknown apps** → allow your Files/Chrome app.
3. Open the APK → Install.
4. Open **Expense Tracker SMS** → **Continue with Google** → allow Sheets/Drive.
5. Allow **SMS** when asked.
6. Tap **Import since last check** (or enable **Live while open**).
7. Confirm each suggested expense → it appears in your Google Sheet.

If Android asks to access other apps during Google login, **Block** is fine.

## Build APK yourself
```bash
git clone https://github.com/kalashjain1010/expense-tracker-mobile.git
cd expense-tracker-mobile
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```
APK path: `android/app/build/outputs/apk/release/app-release.apk`
