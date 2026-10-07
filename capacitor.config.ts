import type { CapacitorConfig } from '@capacitor/cli';

// Medsuite-eT — PWA wrapped as a native Android app (Capacitor).
// The built web app (dist/) is bundled inside the APK, so the UI works
// offline; data syncs with the VPS API when a connection is available.
// Until https://med-suite.shop is live the API base is the VPS IP over
// plain HTTP (cleartext flag is set on the Android manifest by CI).
const config: CapacitorConfig = {
  appId: 'com.medsuite.pharmacy',
  appName: 'Medsuite-eT',
  webDir: 'dist',
  backgroundColor: '#0f766e',
};

export default config;
