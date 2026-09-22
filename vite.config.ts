import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/icon-180.png"],
      manifest: {
        name: "Technical Analysis — strategy audit",
        short_name: "TA Audit",
        description:
          "Import your trade history and find out whether your edge is real or luck.",
        start_url: "/audit",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#0b0e14",
        theme_color: "#0b0e14",
        categories: ["finance", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The audit is pure client-side computation, so precaching the shell
        // makes the whole feature work with no connection at all — which is the
        // point of installing it rather than bookmarking it.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,htm}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Market data is never served stale from cache: a chart showing
            // yesterday's price with no indication it is old is worse than a
            // chart that fails to load.
            urlPattern: /^https:\/\/api\.(binance\.com|twelvedata\.com)\//,
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 8080, host: true },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
