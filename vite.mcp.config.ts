import { defineConfig } from "vite";
import path from "path";

/**
 * Builds the MCP server as a single Node bundle.
 *
 * Vite rather than plain tsc so the `@/` path alias resolves the same way it
 * does for the web app — the MCP server shares the parsers and the statistics
 * engine with the browser, and neither copy should drift from the other.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    ssr: "src/mcp/server.ts",
    outDir: "dist-mcp",
    target: "node20",
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: "server.js", format: "es" },
    },
  },
});
