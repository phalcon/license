/**
 * Checks the build of the license site. Run after `npm run build`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

import { missingTokens, resolveToken, usedTokens } from '../src/lib/design-checks.mjs';
import { cphalconStars, formatStars } from '../src/lib/stars.mjs';

/* The licenses of the page, in their order. */
const LICENSES = ['Phalcon License', 'PHP License', 'Zend License', 'Additional Licenses', 'Phalcon and PSR'];

const checks = [];

const count = (label, actual, expected) =>
    checks.push({ actual, expected, label, ok: actual === expected });

const present = (label, path) =>
    checks.push({ actual: existsSync(path), expected: true, label, ok: existsSync(path) });

/** Runs a measurement, turning a throw into a reported failure. */
const measure = (fn) => {
    try {
        return fn();
    } catch (error) {
        return `error: ${error.code ?? error.message}`;
    }
};

/** Lists files under `root`, skipping dist, node_modules and any dotfile directory. */
const listFiles = (root) => {
    const files = [];

    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name.startsWith('.')) {
            continue;
        }

        const path = `${root}/${entry.name}`;

        if (entry.isDirectory()) {
            files.push(...listFiles(path));
        } else if (entry.isFile()) {
            files.push(path);
        }
    }

    return files;
};

/** The file with the newest mtime among the given paths (files or directory trees). */
const newestOf = (paths) => {
    const files = paths.flatMap((path) => (statSync(path).isDirectory() ? listFiles(path) : path));

    let newest = { mtimeMs: -Infinity, path: 'none' };

    for (const file of files) {
        const mtimeMs = statSync(file).mtimeMs;

        if (mtimeMs > newest.mtimeMs) {
            newest = { mtimeMs, path: file };
        }
    }

    return newest;
};

/*
 * `dist/` carries no memory of the source it was built from, so a failed
 * rebuild that leaves an old `dist/` in place looks identical to a good one.
 * This must run before any check below.
 */
count(
    'dist is current',
    measure(() => {
        const source = newestOf(['src', 'public', 'astro.config.mjs', 'package.json', 'scripts']);
        const dist = newestOf(['dist']);

        return source.mtimeMs > dist.mtimeMs
            ? `${source.path} (${new Date(source.mtimeMs).toISOString()}) is newer than dist (${new Date(dist.mtimeMs).toISOString()})`
            : 'ok';
    }),
    'ok'
);

const pages = ['dist/index.html', 'dist/404.html'];
const html = (file) => readFileSync(file, 'utf8');

/* The licenses: one section for each, with its heading, in the order of the Jekyll page. */
count(
    'license headings',
    measure(() => [...html('dist/index.html').matchAll(/<section class="license">\s*<h2>([^<]*?)\s*(?:<span|<\/h2>)/g)].map((match) => match[1]).join(' | ')),
    LICENSES.join(' | ')
);
count(
    'license types of the main licenses',
    measure(() => [...html('dist/index.html').matchAll(/<h2>([^<]*?) <span class="license__type">([^<]*)<\/span><\/h2>/g)].map((match) => `${match[1]} ${match[2]}`).join(' | ')),
    'Phalcon License BSD-3-Clause | PHP License PHP-3.01 | Zend License Zend-2.0'
);

/*
 * The projects of src/licenses.json: one box for each, with its name and its
 * license type, in alphabetical order; the PSR projects come last. Each box
 * has the full license text.
 */
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const projects = measure(() => {
    const data = JSON.parse(readFileSync('src/licenses.json', 'utf8'));

    return [...[...data.projects].sort(byName), ...[...data.psr].sort(byName)];
});

count(
    'project boxes, in order, with their license types',
    measure(() => [...html('dist/index.html').matchAll(/<h3>([^<]*?) <span class="license__type">([^<]*)<\/span><\/h3>/g)].map((match) => `${match[1]} ${match[2]}`).join(' | ')),
    measure(() => projects.map((project) => `${project.name} ${project.license}`).join(' | '))
);
count(
    'project boxes with the full license text',
    measure(() => (html('dist/index.html').match(/<details>/g) ?? []).length),
    measure(() => projects.length)
);

/*
 * Design tokens. Every page loads tokens.css, common.css, sidebar.css and
 * then site.css, and no other stylesheet. The stylesheets use only tokens that
 * tokens.css defines, and the browser bar takes its color from the tokens.
 */
count(
    'pages that do not load exactly tokens.css, common.css, sidebar.css and then site.css',
    measure(() => pages.filter((file) => {
        const links = [...html(file).matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((match) => /href="([^"]*)"/.exec(match[0])?.[1]);

        return links.join(' ') !== '/css/tokens.css /css/common.css /css/sidebar.css /css/site.css';
    }).length),
    0
);
count(
    'tokens that site.css, common.css and sidebar.css use and tokens.css does not define',
    measure(() => missingTokens(html('dist/css/tokens.css'), [...usedTokens(html('dist/css/site.css')), ...usedTokens(html('dist/css/common.css')), ...usedTokens(html('dist/css/sidebar.css'))]).join(', ') || 'none'),
    'none'
);
count(
    'browser bar color',
    measure(() => /<meta name="theme-color" content="([^"]*)"/.exec(html('dist/index.html'))?.[1] ?? 'none'),
    resolveToken(readFileSync('public/css/tokens.css', 'utf8'), '--ph-dark-bg')
);

/*
 * The shared nav and footer (common.css, the classes of phalcon.io). Every
 * page has them, with the theme switcher and the mobile menu script, and
 * nothing of the Jekyll site: its stylesheet and scripts on assets.phalcon.io,
 * or a file from raw.githubusercontent.com. The nav shows the stars of
 * src/repositories.json, and the footer every link of src/footer.json.
 */
const without = (...parts) => pages.filter((file) => parts.some((part) => !part.test(html(file)))).length;

count('pages without the shared nav and footer', measure(() => without(/<nav class="ph-nav">/, /<footer class="ph-footer">/)), 0);
count('pages without the theme switcher', measure(() => without(/<div class="switcher">/)), 0);
count('pages without the mobile menu script', measure(() => without(/<script[^>]*src="\/js\/nav\.js"/)), 0);
count(
    'pages with a part of the Jekyll site',
    measure(() => pages.filter((file) => /assets\.phalcon\.io\/css\/style\.css|theme\.min\.js|main\.min\.js|raw\.githubusercontent\.com/.test(html(file))).length),
    0
);
count(
    'stars in the nav',
    measure(() => /class="ph-nav__stars">★ ([^<]*)</.exec(html('dist/index.html'))?.[1] ?? 'none'),
    measure(() => formatStars(cphalconStars(readFileSync('src/repositories.json', 'utf8'))))
);
count(
    'footer links',
    measure(() => (html('dist/index.html').match(/class="ph-footer__link"/g) ?? []).length),
    measure(() => JSON.parse(readFileSync('src/footer.json', 'utf8')).columns.flatMap((column) => column.links).length)
);
/*
 * The shared sidebar (sidebar.css): the box of the supporters and the box of
 * the projects text, with every link of the text of src/sidebar.json.
 */
count('sidebar boxes', measure(() => (html('dist/index.html').match(/<div class="ph-side__box">/g) ?? []).length), 2);
count(
    'links of the projects text',
    measure(() => (/<div class="ph-side__text">([\s\S]*?)<\/div>/.exec(html('dist/index.html'))?.[1].match(/<a /g) ?? []).length),
    measure(() => JSON.parse(readFileSync('src/sidebar.json', 'utf8')).projects.text.filter((part) => typeof part === 'object').length)
);
count(
    'canonical address of the home page',
    measure(() => /<link rel="canonical" href="([^"]*)"/.exec(html('dist/index.html'))?.[1] ?? 'none'),
    'https://license.phalcon.io/'
);
/* Each page has one h1: the name of the page for screen readers and search engines. */
count('pages without exactly one h1', measure(() => pages.filter((file) => (html(file).match(/<h1[\s>]/g) ?? []).length !== 1).length), 0);

/* The files that the Jekyll site served stay at their addresses. */
for (const path of [
    'dist/index.html',
    'dist/404.html',
    'dist/robots.txt',
    'dist/humans.txt',
    'dist/sitemap.xml',
    'dist/css/tokens.css',
    'dist/css/common.css',
    'dist/css/sidebar.css',
    'dist/css/site.css',
    'dist/js/nav.js',
]) {
    present(path.replace('dist/', ''), path);
}

for (const check of checks) {
    console.log(`${check.ok ? 'ok  ' : 'FAIL'}  ${check.label}: ${check.actual} (want ${check.expected})`);
}

const failed = checks.filter((check) => !check.ok).length;

console.log(`\n${checks.length - failed} of ${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
