# IronLog — Mobile (Android & iOS)

The mobile apps wrap the existing Next.js web app with [Capacitor](https://capacitorjs.com).
There is **one codebase**: the web UI is statically exported and bundled inside a
native shell for each platform.

## How it works

- `npm run build:native` exports the app to static files in `out/` (Next.js
  `output: "export"`, gated by `BUILD_TARGET=native` so the normal web build is
  untouched). `scripts/build-native.mjs` temporarily moves `src/app/api` aside
  during the export because static sites can't host the dynamic API routes.
- `npx cap sync` copies `out/` into `android/` and `ios/` and updates native deps.
- Auth (email/password) and all Firestore data go **directly** from the device to
  Firebase — no app server needed. Everything works without our backend.
- **The AI Coach is the only exception.** It calls `/api/gemini`, a proxy that
  holds the secret `GEMINI_API_KEY` and so cannot ship inside the app. The native
  build points at a **hosted** copy of that route via `NEXT_PUBLIC_API_BASE_URL`
  (see below). Until that's set, every feature works except the AI Coach.

## One-time setup

**Android**
- Install [Android Studio](https://developer.android.com/studio) (bundles the
  Android SDK) and a JDK 21 (Android Studio ships one).

**iOS** (macOS only)
- Install **Xcode** from the App Store, then run
  `xcode-select --install` and open Xcode once to accept the license.
  (Capacitor 8 uses Swift Package Manager, so CocoaPods is *not* required.)

## Point the AI Coach at your hosted proxy

The web app is already a normal Next.js server app — deploy it anywhere that runs
Next (Vercel, Firebase App Hosting, Cloud Run…). Then, before building the apps,
set the origin in `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-deployed-ironlog.example.com
```

Also add that origin to `ALLOWED_ORIGINS` on the server so the proxy accepts
requests from the app.

## Build & run

```bash
# Android — opens the project in Android Studio; press Run to deploy to a
# device/emulator.
npm run cap:android

# iOS — opens the project in Xcode; pick a simulator/device and press Run.
npm run cap:ios
```

Both scripts run `build:native` + `cap sync` first. After any change to the web
code, re-run `npm run cap:sync` (or the platform script) to push the new bundle
into the native projects.

## App identity & assets

- App name **IronLog**, bundle id **com.ironlog.app** (change in
  `capacitor.config.ts` + the native projects if needed).
- Icons/splash are generated from `assets/` by `@capacitor/assets`. To regenerate
  after changing the art: `node scripts/gen-assets.mjs && npx @capacitor/assets generate`.

## Known follow-ups

- **Safe areas:** if the bottom nav or status bar needs to draw under the
  notch/home indicator, set `viewport-fit=cover` and add
  `env(safe-area-inset-*)` padding. Left off by default so content stays in the
  safe area without device testing.
- **Push notifications / haptics / native status bar:** add the relevant
  `@capacitor/*` plugins when wanted.
- **Store release:** signing keys + store listings are needed for Play Store /
  App Store distribution (not required for local device installs).
