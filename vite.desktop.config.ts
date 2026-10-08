import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";
const root = resolve("src/desktop");
export default defineConfig({
  root,
  envDir: false,
  plugins: [
    react(),
    tailwind(),
    {
      name: "desktop-no-server-modules",
      generateBundle() {
        for (const id of this.getModuleIds())
          if (id.includes("/src/") && /\.server\.[tj]s$/.test(id))
            throw new Error(`Desktop must not bundle server module: ${id}`);
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@/lib/demo-store", replacement: resolve(root, "store.tsx") },
      {
        find: "@/lib/workspace-state",
        replacement: resolve(root, "workspace.ts"),
      },
      {
        find: "@/lib/account-session",
        replacement: resolve(root, "account.ts"),
      },
      {
        find: "@/lib/agents/client",
        replacement: resolve(root, "features.ts"),
      },
      {
        find: "@/lib/document-preview-client",
        replacement: resolve(root, "preview.ts"),
      },
      { find: "@", replacement: resolve("src") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    fs: {
      allow: [resolve("src"), resolve("node_modules"), resolve("public")],
      deny: [
        ".env",
        ".env.*",
        "**/.tenderpro-local/**",
        "**/.codex/secrets/**",
      ],
    },
    watch: { ignored: ["**/src-tauri/**", "**/_temp/**"] },
  },
  publicDir: resolve("public"),
  build: {
    outDir: resolve("dist-desktop"),
    emptyOutDir: true,
    target: "chrome105",
  },
});
