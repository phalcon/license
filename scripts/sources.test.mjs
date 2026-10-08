import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { footerProblems, missingTokens, sidebarProblems } from '../src/lib/design-checks.mjs';
import { sourceFiles, usedBySite } from './token-sources.mjs';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

test('the source scan covers the stylesheets, components, layout and pages, not tests or the tokens file', () => {
    // A token that only a component uses must count as used.
    const files = sourceFiles();

    for (const file of ['public/css/site.css', 'public/css/common.css', 'public/css/sidebar.css', 'src/components/Header.astro', 'src/components/Meta.astro', 'src/layouts/Base.astro', 'src/pages/index.astro']) {
        assert.ok(files.includes(file), file);
    }

    assert.ok(!files.includes('public/css/tokens.css'));
    assert.ok(!files.some((file) => file.endsWith('.test.mjs')));
});

test('no source types a color', () => {
    // Colors come from public/css/tokens.css (phalcon/assets), so a palette change is made once. The copy of
    // common.css and of sidebar.css are not this site's source: phalcon/assets checks their colors, and their comments
    // can name colors. A data URI hides a hex color as %23…, and an SVG paint attribute can type one (fill="white").
    const color = /#[0-9a-fA-F]{3,8}\b|rgba?\(|%23[0-9a-fA-F]{3,8}\b|\b(?:fill|stroke|stop-color|flood-color|lighting-color)=["'](?!currentColor|none|var\(|url\(|inherit|transparent)[^"']+["']/g;
    const typed = sourceFiles().filter((file) => !['public/css/common.css', 'public/css/sidebar.css'].includes(file)).flatMap((file) =>
        read(file)
            .split('\n')
            .flatMap((line, index) => [...line.matchAll(color)].map((match) => `${file}:${index + 1} ${match[0]}`))
    );

    assert.deepEqual(typed, []);
});

test('the tokens file defines every token that the site uses', () => {
    assert.deepEqual(missingTokens(read('public/css/tokens.css'), usedBySite()), []);
});

test('the source scan counts a token that a component reads by name', () => {
    // Meta.astro gives --ph-brand-400 and --ph-dark-bg to resolveToken(), for the browser colors. No stylesheet uses
    // --ph-brand-400, so it shows that the scan counts a name in quotes.
    const used = usedBySite();

    assert.ok(used.has('--ph-brand-400'), '--ph-brand-400');
    assert.ok(used.has('--ph-dark-bg'), '--ph-dark-bg');
});

test('the CI workflow gets the design files before the tests', () => {
    // The tests and the build must see the files that the deploy publishes.
    const workflow = read('.github/workflows/main.yml');
    const step = workflow.indexOf('run: node scripts/update-tokens.mjs');

    assert.ok(step > 0, 'the step is missing');
    assert.ok(step < workflow.indexOf('run: npm test'), 'the step must come before the tests');
});

test('the CI workflow and the refresh script read phalcon/assets from assets.phalcon.io', () => {
    // assets.phalcon.io is the CDN of the Phalcon sites.
    const workflow = read('.github/workflows/main.yml');
    const script = read('scripts/update-tokens.mjs');

    assert.doesNotMatch(workflow, /raw\.githubusercontent\.com/, 'main.yml');
    assert.doesNotMatch(script, /raw\.githubusercontent\.com/, 'update-tokens.mjs');
    assert.match(script, /const SOURCE = 'https:\/\/assets\.phalcon\.io\/phalcon';/);
    assert.match(workflow, /curl -fsSL -o src\/fanart\.html \\\n\s+https:\/\/assets\.phalcon\.io\/phalcon\/fanart-fragment\.html/);
    assert.match(workflow, /curl -fsSL -o src\/sponsors\.json \\\n\s+https:\/\/assets\.phalcon\.io\/phalcon\/sponsors\.json/);
});

test('the CI workflow gets the design tools first, and keeps the committed copy when a file is not valid', () => {
    // The tools come from assets.phalcon.io. The design files and the tests must use the tools that the build uses.
    const workflow = read('.github/workflows/main.yml');
    const step = workflow.indexOf('https://assets.phalcon.io/phalcon/tools/$file');

    assert.ok(step > 0, 'the step is missing');
    assert.ok(step < workflow.indexOf('run: node scripts/update-tokens.mjs'), 'the step must come before the design files');
    assert.match(workflow, /for file in design-checks\.mjs design-refresh\.mjs; do/);
    assert.match(workflow, /new="src\/lib\/\$\{file%\.mjs\}\.new\.mjs"/);
    assert.match(workflow, /curl -fsSL --max-time 30 -o "\$new" "https:\/\/assets\.phalcon\.io\/phalcon\/tools\/\$file" && node --check "\$new"; then/);
});

test('the CI workflow publishes the build to the production branch, which Cloudflare Pages serves', () => {
    const workflow = read('.github/workflows/main.yml');

    assert.match(workflow, /DEPLOY_BRANCH: production/);
    assert.match(workflow, /if: github\.ref == 'refs\/heads\/master' && github\.event_name != 'pull_request'/);
    assert.match(workflow, /branches-ignore:\n\s+- production/);
});

test('the refresh script copies the shared files and checks each one', () => {
    const script = read('scripts/update-tokens.mjs');
    const entries = [
        ['public/css/tokens.css', 'css/tokens.css'],
        ['public/css/common.css', 'css/common.css'],
        ['public/css/sidebar.css', 'css/sidebar.css'],
        ['src/sidebar.json', 'sidebar.json'],
        ['src/footer.json', 'footer.json'],
        ['src/repositories.json', 'repositories.json'],
    ];

    for (const [copy, name] of entries) {
        assert.ok(script.includes(`copy: '${copy}',\n            name: '${name}',`), copy);
    }

    assert.ok(script.includes("problems: (text) => commonCssProblems(text, readFileSync('public/css/tokens.css', 'utf8')),"));
    assert.ok(script.includes('problems: footerProblems,'));
    assert.ok(script.includes("problems: (text) => sidebarCssProblems(text, readFileSync('public/css/tokens.css', 'utf8')),"));
    assert.ok(script.includes('problems: sidebarProblems,'));
    // The tokens come first: the checks of common.css and sidebar.css must read the new tokens copy.
    assert.ok(
        script.indexOf("copy: 'public/css/tokens.css'") < Math.min(script.indexOf("copy: 'public/css/common.css'"), script.indexOf("copy: 'public/css/sidebar.css'")),
        'the tokens must come before common.css and sidebar.css',
    );
});

test('the committed footer.json has no problems', () => {
    // Footer.astro reads this copy at build time.
    assert.deepEqual(footerProblems(read('src/footer.json')), []);
});

test('the committed sidebar.json has no problems', () => {
    // Sidebar.astro reads this copy at build time.
    assert.deepEqual(sidebarProblems(read('src/sidebar.json')), []);
});

test('sidebar.css has a rule for every ph-side class that the sidebar uses', () => {
    // A class that phalcon/assets renames would leave the sidebar with no style. The tests run after the refresh.
    const css = read('public/css/sidebar.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const used = ['src/components/Sidebar.astro', 'src/components/Sponsors.astro']
        .flatMap((file) => [...read(file).matchAll(/class="([^"]*)"/g)])
        .flatMap((match) => match[1].split(/\s+/))
        .filter((name) => name.startsWith('ph-side'));
    const missing = [...new Set(used)].filter((name) => !new RegExp(`\\.${name}(?![\\w-])`).test(css));

    assert.ok(used.length >= 8, 'the sidebar uses the shared classes');
    assert.deepEqual(missing, []);
});

test('common.css has a rule for every ph- class that the nav and the footer use', () => {
    // A class that phalcon/assets renames would leave an element with no style. The tests run after the refresh,
    // so the deploy stops before it publishes.
    const css = read('public/css/common.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const used = ['src/components/Header.astro', 'src/components/Footer.astro']
        .flatMap((file) => [...read(file).matchAll(/class="([^"]*)"/g)])
        .flatMap((match) => match[1].split(/\s+/))
        .filter((name) => name.startsWith('ph-'));
    const missing = [...new Set(used)].filter((name) => !new RegExp(`\\.${name}(?![\\w-])`).test(css));

    assert.ok(used.length > 30, 'the nav and the footer use the shared classes');
    assert.deepEqual(missing, []);
});

test('the nav has the links of phalcon.io, with absolute addresses', () => {
    // The site is not on phalcon.io: a relative link of phalcon.io (/download) would point into this site. The
    // scripts come after the markup.
    const header = read('src/components/Header.astro').split('<script')[0];
    const links = [...header.matchAll(/href: '([^']*)'|href="([^"]*)"/g)].map((match) => match[1] ?? match[2]);

    assert.ok(links.length >= 15, `${links.length} links`);
    assert.deepEqual(links.filter((href) => !href.startsWith('https://') && href !== '/'), []);
});

test('the page uses the class names of this site, not the ones of the old blog layout', () => {
    // The old shared sheet named the page after the blog (phalcon-blog, phalcon-blog__main, …). The small sites
    // that copy this one (Phase 7 and 8) must not carry that name.
    assert.match(read('src/layouts/Base.astro'), /<div class="page">/);
    assert.deepEqual(sourceFiles().filter((file) => file !== 'public/css/common.css' && read(file).includes('phalcon-blog')), []);
});

test('no file of the Jekyll site is left', () => {
    // The site is built by Astro and published by .github/workflows/main.yml.
    const jekyll = [
        '.github/workflows/jekyll.yml', '.ruby-version', 'Gemfile', '_config.yml', '_includes', '_layouts', 'build.sh',
        'humans.txt', 'index.html', 'robots.txt', 'serve', 'updateData.php',
    ];

    assert.deepEqual(jekyll.filter((file) => existsSync(new URL(file, root))), []);
});

/** The projects of src/licenses.json: the additional licenses, then the PSR ones. */
const licenseEntries = () => {
    const data = JSON.parse(read('src/licenses.json'));

    return [...data.projects, ...data.psr];
};

test('licenses.json has each project once, with its links, its Phalcon parts and its license text', () => {
    const entries = licenseEntries();
    const names = entries.map((entry) => entry.name);

    assert.ok(entries.length >= 19, `${entries.length} projects`);
    assert.deepEqual([...new Set(names)], names, 'each project once');

    for (const entry of entries) {
        assert.match(entry.name, /^[\w.-]+\/[\w.-]+$/, entry.name);
        assert.equal(entry.url, `https://github.com/${entry.name}`, entry.name);
        assert.match(entry.licenseUrl, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/blob\/[\w.-]+\/LICENSE(?:\.md|\.txt)?$/, entry.name);
        assert.ok(entry.licenseUrl.startsWith(`${entry.url}/blob/`), entry.name);
        assert.ok(entry.parts.length > 0 && entry.parts.every((part) => /^Phalcon(?:\\[A-Z]\w*)+$/.test(part)), entry.name);
        assert.match(entry.text, /^Copyright \(c\) .+$/m, entry.name);
    }
});

test('the license type of each project agrees with its text', () => {
    // MIT has the permission notice. A BSD license has a list of two or three conditions.
    for (const entry of licenseEntries()) {
        const conditions = (entry.text.match(/^\s*[-*] /gm) ?? []).length;
        const type = entry.text.includes('Permission is hereby granted, free of charge') ? 'MIT' : `BSD-${conditions}-Clause`;

        assert.equal(entry.license, type, entry.name);
    }
});
