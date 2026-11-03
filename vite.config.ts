// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { offline } from "./scripts/offline-plugin.mjs";

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta de hospedagem estática (ex.: GitHub Pages).
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 5000 },
  plugins: [offline()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
