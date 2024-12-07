import {defineNuxtConfig} from "nuxt/config";
export default defineNuxtConfig({
  nitro: {
    prerender: {
      routes: ['/search.index.json']
    }
  },
  compatibilityDate: '2024-12-07',
})