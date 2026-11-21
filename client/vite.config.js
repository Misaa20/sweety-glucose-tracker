import { defineConfig } from "vite";
import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  // Read the API port without applying the server's NODE_ENV to Vite's build.
  const envPath = fileURLToPath(new URL("../.env", import.meta.url));
  const env = existsSync(envPath) ? parse(readFileSync(envPath)) : {};
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": `http://127.0.0.1:${process.env.PORT || env.PORT || 3001}`,
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
      css: false,
    },
  };
});
