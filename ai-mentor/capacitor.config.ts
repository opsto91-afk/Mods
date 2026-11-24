import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.opsto91.aimentor',
  appName: 'AI Mentor',
  webDir: 'dist',
  server: {
    // http scheme: localStorage persist + local AI (http://LAN:11434) pe mixed-content nahi
    androidScheme: 'http',
  },
};

export default config;
