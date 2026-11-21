import { defineConfig, mergeConfig } from "vite";
import originalConfig from "./vite.config.mjs";

export default defineConfig(mergeConfig(originalConfig, {
  plugins: [{
    name: "orbit-swap-guide",
    transformIndexHtml: {
      order: "pre",
      handler() {
        return [{
          tag: "script",
          attrs: { type: "module", src: "/guide/guide.mjs" },
          injectTo: "body",
        }];
      },
    },
  }],
}));
