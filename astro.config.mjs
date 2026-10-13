// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    site: 'https://license.phalcon.io',
    /*
     * The URLs of the site: `file` writes `404.html`, the page that Cloudflare
     * Pages serves for a path that does not exist, and `never` serves each page
     * with no trailing slash.
     */
    build: {
        format: 'file',
    },
    trailingSlash: 'never',
    /*
     * Astro 7 removes whitespace by JSX rules: the line break between a word
     * and the link on the next line goes, and the two words touch. The HTML
     * compression of Astro 5 keeps one space there.
     */
    compressHTML: true,
    server: {
        host: true,
        port: 4321,
    },
});
