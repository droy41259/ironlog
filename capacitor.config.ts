import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ironlog.app",
  appName: "IronLog",
  // The statically-exported Next site produced by `npm run build:native`.
  webDir: "out",
  server: {
    // Android serves bundled content from https://localhost (default).
    // iOS can't use https for local content (reserved scheme) — it always uses
    // the capacitor:// scheme. The Firebase-Auth-under-capacitor:// issue is
    // handled in src/lib/firebase/client.ts instead.
    androidScheme: "https",
  },
};

export default config;
