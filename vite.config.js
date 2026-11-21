import { defineConfig, mergeConfig } from "vite";
import originalConfig from "./vite.config.mjs";

export default defineConfig(mergeConfig(originalConfig, {
  plugins: [{
    name: "orbit-swap-guide",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return {
          html: html
            .replace('<html lang="ko">', '<html lang="ko" data-orbit-theme="green">')
            .replace('name="theme-color" content="#0c1733"', 'name="theme-color" content="#102d23"'),
          tags: [{
            tag: "script",
            attrs: { type: "module", src: "/guide/guide.mjs" },
            injectTo: "body",
          }],
        };
      },
    },
  }],
}));
