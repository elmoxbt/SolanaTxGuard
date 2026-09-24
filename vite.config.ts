import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// SolanaTxGuard demo app — Vite + React + TS
//
// @solana/web3.js (and our own instruction decoders) use Node's Buffer
// under the hood. Vite doesn't polyfill Node core modules by default, so
// nodePolyfills() shims `Buffer`/`global` for the browser bundle.
export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ["buffer"] })],
  server: {
    port: 5173
  }
});
