import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: {
        name: "賃貸写真台帳メーカー",
        short_name: "写真台帳",
        description: "賃貸物件の状態を写真、間取り図、コメントで整理するアプリです。",
        theme_color: "#0f766e",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "/icons/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ]
});
