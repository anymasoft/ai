// @ts-check
import {
  defineConfig,
  fontProviders,
} from "astro/config";


// https://astro.build/config
export default defineConfig({
  scopedStyleStrategy: 'where',
  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: "Roboto Slab",
        cssVariable: "--font-roboto-slab",
        weights: ["100 900"],
      },
      {
        provider: fontProviders.google(),
        name: "Inter",
        cssVariable: "--font-inter",
        weights: ["100 900"],
      },
    ],
  },
});
