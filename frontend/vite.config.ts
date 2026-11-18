import { defineConfig } from "vite";

// Single ES module with a fixed name: the integration serves it as a static
// file and appends ?v=<version> as the cache buster. Lit is bundled in.
export default defineConfig({
  build: {
    outDir: "../custom_components/blaupause/frontend",
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    target: "es2022",
    lib: {
      entry: "src/blaupause-panel.ts",
      formats: ["es"],
      fileName: () => "blaupause-panel.js",
    },
  },
});
