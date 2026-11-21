import { defineConfig, mergeConfig } from "vite";
import originalConfig from "./vite.config.mjs";

// GitHub Pages lacks configurable response headers; meta CSP cannot enforce frame-ancestors.
const productionCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://api.devnet.solana.com wss://api.devnet.solana.com",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-src 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
].join("; ");

export default defineConfig(mergeConfig(originalConfig, {
  plugins: [{
    name: "orbit-swap-guide",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        return {
          html: html
            .replace('<html lang="ko">', '<html lang="ko" data-orbit-theme="green">')
            .replace('name="theme-color" content="#0c1733"', 'name="theme-color" content="#e2eee4"'),
          tags: [
            ...(!context.server ? [{
              tag: "meta",
              attrs: { "http-equiv": "Content-Security-Policy", content: productionCsp },
              injectTo: "head-prepend",
            }] : []),
            {
              tag: "script",
              attrs: { type: "module", src: "/guide/guide.mjs" },
              injectTo: "body",
            },
          ],
        };
      },
    },
  }],
}));
