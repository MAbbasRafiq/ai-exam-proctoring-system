// =============================================================
// vite.config.js
// Vite build tool configuration.
// Loads the React plugin and Tailwind CSS plugin.
// =============================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),       // enables JSX transform and React fast refresh
    tailwindcss()  // enables Tailwind CSS utility classes
  ],
});
