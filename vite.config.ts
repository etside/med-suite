import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 8081,
      overlay: false,
    },
    proxy: {
      "/api": { target: "http://127.0.0.1:8090", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:8090", changeOrigin: true },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.svg", "logo.svg"],
      manifest: false,
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/\.netlify\/functions\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/|\/\.netlify\/functions\/api/,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 750,
    // Keep heavy chart code out of the initial preload set: home never
    // renders charts, the Dashboard/Reports chunks fetch it on demand.
    modulePreload: {
      resolveDependencies: (filename, deps) =>
        deps.filter((d) => !d.includes("charts-")),
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          radix: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
          ],
          charts: ["recharts"],
          utils: ["date-fns", "zod", "react-hook-form"],
        },
      },
    },
  },
}));
