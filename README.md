<p align="center"><a href="https://docs.phalcon.io" target="_blank">
    <img src="https://assets.phalcon.io/phalcon/images/svg/phalcon-logo-transparent-black.svg" height="100" alt="Phalcon"/>
</a></p>

## Phalcon License

The content of <a href="https://license.phalcon.io/">license.phalcon.io</a>: the licenses that govern the Phalcon Framework.

The site is built with [Astro](https://astro.build). The CI workflow (`.github/workflows/main.yml`) tests and builds it, and publishes the build to the `production` branch, which Cloudflare Pages serves.

#### Local use

The tools run in Docker:

- Install: `docker run --rm -v "$PWD:/app" -w /app node:22-alpine npm ci`
- Tests: `docker run --rm -v "$PWD:/app" -w /app node:22-alpine npm test`
- Build and checks: `docker run --rm -v "$PWD:/app" -w /app node:22-alpine sh -c 'npm run build && npm run verify'`
- Preview: `docker run --rm -p 4321:4321 -v "$PWD:/app" -w /app node:22-alpine npx astro preview --host 0.0.0.0`

#### Colors, fonts, the nav and the footer

The colors and the fonts come from `phalcon/css/tokens.css` in [phalcon/assets](https://github.com/phalcon/assets): the design tokens that every Phalcon site uses. From there also come the shared nav and footer (`phalcon/css/common.css`), the footer links (`phalcon/footer.json`), the shared sidebar (`phalcon/css/sidebar.css`, with its titles and text in `phalcon/sidebar.json`) and the GitHub stars of the nav (`phalcon/repositories.json`). `public/css/tokens.css`, `public/css/common.css`, `public/css/sidebar.css`, `src/sidebar.json`, `src/footer.json` and `src/repositories.json` are copies. Every CI run downloads the files again before the tests and the build. When a download fails, or when a file is not correct, the run keeps that committed copy and shows a warning.

- To change a color, change `tokens.css` in phalcon/assets. The site gets it on its next CI run.
- To get the new files now: `docker run --rm -v "$PWD:/app" -w /app node:22-alpine node scripts/update-tokens.mjs`. To read them from a local phalcon/assets: `--from ../assets/public/phalcon` (mount the folder).
- The checks and the refresh are the shared design tools of phalcon/assets: `src/lib/design-checks.mjs`, `src/lib/design-refresh.mjs` and `src/lib/stars.mjs` (the star count of the nav) are copies of `phalcon/tools/` there, and every CI run gets them again first. Change them in phalcon/assets, not here.
- `public/css/site.css` has the rules of this site. `public/css/common.css` (the shared nav and footer) and `public/css/sidebar.css` (the shared sidebar) are copies: do not change them. Use a color through the tokens: `var(--nd-…)` or `var(--ph-…)`. `npm test` fails on a typed color in `public/css/` (not in the copies of `common.css` and `sidebar.css`) and `src/`.
- The nav (`src/components/Header.astro`) and the footer (`src/components/Footer.astro`) are the ones of phalcon.io, with the classes of `common.css`. `public/js/nav.js` is a copy of the mobile menu script of phalcon.io.

## Sponsors

Become a sponsor and get your logo on our README on Github with a link to your site. [[Become a sponsor](https://opencollective.com/phalcon#sponsor)]

<a href="https://opencollective.com/phalcon/#contributors">
<img src="https://opencollective.com/phalcon/tiers/sponsors.svg?avatarHeight=48&width=800">
</a>

## Backers

Support us with a monthly donation and help us continue our activities. [[Become a backer](https://opencollective.com/phalcon#backer)]

<a href="https://opencollective.com/phalcon/#contributors">
<img src="https://opencollective.com/phalcon/tiers/backers.svg?avatarHeight=48&width=800&height=200">
</a>
