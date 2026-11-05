import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = "http://localhost:4000";

// The browser talks to one origin in development and preview; Vite forwards
// API and media requests to the Express server.
const proxy = {
  "/api": { target: backend, changeOrigin: true },
  "/uploads": { target: backend, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
