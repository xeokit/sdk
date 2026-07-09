import { readFile, readdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { parse } from 'node-html-parser';

const source = './packages';
const templateSource = './scripts/test-html-report/template.html';
const destination = './packages/website/test-report.html';
const destinationPath = resolve(destination);

const emptyCounts = () => ({
    suites: {total: 0, passed: 0, failed: 0, pending: 0},
    tests: {total: 0, passed: 0, failed: 0, pending: 0},
});

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const escapeAttr = (value) => escapeHtml(value).replaceAll("'", '&#39;');

const countFromText = (root, selector) => {
    const text = root.querySelector(selector)?.textContent || '';
    const match = text.match(/\((\d+)\)|^(\d+)/);
    return match ? Number(match[1] || match[2]) : 0;
};

const extractCounts = (jestContent) => ({
    suites: {
        total: countFromText(jestContent, '#suite-summary .summary-total'),
        passed: countFromText(jestContent, '#suite-summary .summary-passed'),
        failed: countFromText(jestContent, '#suite-summary .summary-failed'),
        pending: countFromText(jestContent, '#suite-summary .summary-pending'),
    },
    tests: {
        total: countFromText(jestContent, '#test-summary .summary-total'),
        passed: countFromText(jestContent, '#test-summary .summary-passed'),
        failed: countFromText(jestContent, '#test-summary .summary-failed'),
        pending: countFromText(jestContent, '#test-summary .summary-pending'),
    },
});

const addCounts = (target, sourceCounts) => {
    for (const group of ['suites', 'tests']) {
        for (const key of ['total', 'passed', 'failed', 'pending']) {
            target[group][key] += sourceCounts[group][key];
        }
    }
};

const statusForCounts = (counts) => {
    if (counts.tests.failed > 0 || counts.suites.failed > 0) {
        return 'failed';
    }
    if (counts.tests.pending > 0 || counts.suites.pending > 0) {
        return 'pending';
    }
    if (counts.tests.total === 0 && counts.suites.total === 0) {
        return 'empty';
    }
    return 'passed';
};

const parseSeconds = (value) => {
    const match = String(value || '').trim().match(/^([\d.]+)\s*(ms|s)?$/);
    if (!match) {
        return 0;
    }
    const amount = Number(match[1]);
    return match[2] === 'ms' ? amount / 1000 : amount;
};

const sourceAreaFromPath = (suitePath) => {
    const srcIndex = suitePath.indexOf('/src/');
    if (srcIndex === -1) {
        return 'other';
    }
    return suitePath.slice(srcIndex + 5).split('/')[0] || 'other';
};

const suiteStatus = (suite) => {
    if (suite.querySelector('.test-result.failed')) {
        return 'failed';
    }
    if (suite.querySelector('.test-result.pending')) {
        return 'skipped';
    }
    return 'passed';
};

const normalizeSearchText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const prepareSuites = (jestContent, folder) => {
    const suites = [];
    for (const suite of jestContent.querySelectorAll('.suite-container')) {
        const id = suite.getAttribute('id');
        const path = suite.querySelector('.suite-path')?.textContent?.trim() || id;
        const timeElement = suite.querySelector('.suite-time');
        const timeText = timeElement?.textContent?.trim() || '0s';
        const durationSeconds = parseSeconds(timeText);
        const status = suiteStatus(suite);
        const isSlow = timeElement?.classList.contains('warn') || durationSeconds >= 1;
        const area = sourceAreaFromPath(path);
        const title = path.split('/').pop() || path;
        const tests = suite.querySelectorAll('.test-result');
        const suiteHeaderSearch = normalizeSearchText([path, title, area].join(' '));
        const suiteFullSearch = normalizeSearchText([
            suiteHeaderSearch,
            ...suite.querySelectorAll('.test-suitename, .test-title').map((element) => element.textContent || ''),
        ].join(' '));

        suite.setAttribute('data-status', status);
        suite.setAttribute('data-slow', isSlow ? 'true' : 'false');
        suite.setAttribute('data-area', area);
        suite.setAttribute('data-search', suiteFullSearch);
        suite.setAttribute('data-suite-search', suiteHeaderSearch);
        suite.setAttribute('data-duration-seconds', String(durationSeconds));
        suite.classList.add(`suite-status-${status}`);
        if (isSlow) {
            suite.classList.add('suite-slow');
        }

        const toggle = suite.querySelector('input[type="checkbox"]');
        if (toggle) {
            if (status === 'failed' || status === 'skipped') {
                toggle.setAttribute('checked', 'checked');
            } else {
                toggle.removeAttribute('checked');
            }
        }

        for (const test of tests) {
            const testStatus = test.classList.contains('failed')
                ? 'failed'
                : test.classList.contains('pending')
                    ? 'skipped'
                    : 'passed';
            test.setAttribute('data-status', testStatus);
            test.setAttribute('data-search', normalizeSearchText(test.textContent));
        }

        suites.push({folder, id, path, title, timeText, durationSeconds, status, isSlow, area});
    }
    return suites;
};

const prefixDomIds = (root, prefix) => {
    for (const element of root.querySelectorAll('[id]')) {
        const id = element.getAttribute('id');
        element.setAttribute('id', `${prefix}-${id}`);
    }
    for (const element of root.querySelectorAll('[for]')) {
        const target = element.getAttribute('for');
        element.setAttribute('for', `${prefix}-${target}`);
    }
    for (const element of root.querySelectorAll('[href]')) {
        const href = element.getAttribute('href');
        if (href?.startsWith('#')) {
            element.setAttribute('href', `#${prefix}-${href.slice(1)}`);
        }
    }
};

const slowSuitesHtml = (slowSuites) => slowSuites.slice(0, 5).map((suite) => `
                    <a href="#${escapeAttr(suite.id)}">${escapeHtml(suite.title)} <span>${escapeHtml(suite.timeText)}</span></a>`).join('');

const packageSummaryHtml = (packages, totals, generatedAt, slowSuites) => {
    const rows = packages.map((pkg) => `
                <tr class="${pkg.status}">
                    <td><a href="#${escapeAttr(pkg.folder)}">${escapeHtml(pkg.folder)}</a></td>
                    <td>${escapeHtml(pkg.statusLabel)}</td>
                    <td>${pkg.counts.suites.total}</td>
                    <td>${pkg.counts.suites.failed}</td>
                    <td>${pkg.counts.tests.total}</td>
                    <td>${pkg.counts.tests.failed}</td>
                    <td>${pkg.counts.tests.pending}</td>
                </tr>`).join('');

    return `
        <section class="report-overview" aria-label="Aggregate test summary">
            <div class="top-summary-bar" aria-label="Sticky test summary">
                <div class="summary-chip passed"><strong>${totals.tests.passed}</strong><span>passed</span></div>
                <div class="summary-chip failed"><strong>${totals.tests.failed}</strong><span>failed</span></div>
                <div class="summary-chip skipped"><strong>${totals.tests.pending}</strong><span>skipped</span></div>
                <div class="slow-suite-links">
                    <strong>Slowest suites</strong>
                    ${slowSuitesHtml(slowSuites)}
                </div>
            </div>
            <p class="report-generated">Generated: ${escapeHtml(generatedAt)}</p>
            <div class="report-controls" aria-label="Report filters">
                <div class="filter-buttons">
                    <button type="button" class="filter-button active" data-filter="all">All</button>
                    <button type="button" class="filter-button" data-filter="failed">Failed</button>
                    <button type="button" class="filter-button" data-filter="skipped">Skipped</button>
                    <button type="button" class="filter-button" data-filter="slow">Slow</button>
                </div>
                <input id="report-search" type="search" placeholder="Search suites and tests" autocomplete="off">
            </div>
            <div id="summary">
                <div id="suite-summary">
                    <div class="summary-total">Suites (${totals.suites.total})</div>
                    <div class="summary-passed${totals.suites.passed ? '' : ' summary-empty'}">${totals.suites.passed} passed</div>
                    <div class="summary-failed${totals.suites.failed ? '' : ' summary-empty'}">${totals.suites.failed} failed</div>
                    <div class="summary-pending${totals.suites.pending ? '' : ' summary-empty'}">${totals.suites.pending} pending</div>
                </div>
                <div id="test-summary">
                    <div class="summary-total">Tests (${totals.tests.total})</div>
                    <div class="summary-passed${totals.tests.passed ? '' : ' summary-empty'}">${totals.tests.passed} passed</div>
                    <div class="summary-failed${totals.tests.failed ? '' : ' summary-empty'}">${totals.tests.failed} failed</div>
                    <div class="summary-pending${totals.tests.pending ? '' : ' summary-empty'}">${totals.tests.pending} pending</div>
                </div>
            </div>
            <table class="package-summary">
                <thead>
                    <tr>
                        <th>Package</th>
                        <th>Status</th>
                        <th>Suites</th>
                        <th>Suite Failures</th>
                        <th>Tests</th>
                        <th>Test Failures</th>
                        <th>Pending</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </section>`;
};

const tocHtml = (packages, suites) => {
    const suitesByPackage = new Map();
    for (const suite of suites) {
        const packageSuites = suitesByPackage.get(suite.folder) || [];
        packageSuites.push(suite);
        suitesByPackage.set(suite.folder, packageSuites);
    }

    return packages.map((pkg) => {
        const packageSuites = suitesByPackage.get(pkg.folder) || [];
        const suitesByArea = new Map();
        for (const suite of packageSuites) {
            const areaSuites = suitesByArea.get(suite.area) || [];
            areaSuites.push(suite);
            suitesByArea.set(suite.area, areaSuites);
        }
        const areaHtml = Array.from(suitesByArea.entries()).map(([area, areaSuites]) => `
                    <li class="toc-area">
                        <span>${escapeHtml(area)}</span>
                        <ul>
                            ${areaSuites.map((suite) => `<li><a class="${escapeAttr(suite.status)}${suite.isSlow ? ' slow' : ''}" href="#${escapeAttr(suite.id)}" title="${escapeAttr(suite.path)}">${escapeHtml(suite.title)} <span>${escapeHtml(suite.timeText)}</span></a></li>`).join('')}
                        </ul>
                    </li>`).join('');

        return `
            <li class="toc-package">
                <a class="${escapeAttr(pkg.status)}" href="#${escapeAttr(pkg.folder)}">${escapeHtml(pkg.folder)} <span>${escapeHtml(pkg.statusLabel)}</span></a>
                <ul>${areaHtml}</ul>
            </li>`;
    }).join('');
};

(async () => {
    console.log('\x1b[36m%s\x1b[0m', `\nGenerating summary!\n`);
    console.log('\x1b[36m%s\x1b[0m', `Source: ${source}`);
    console.log('\x1b[36m%s\x1b[0m', `Template: ${templateSource}`);
    console.log('\x1b[36m%s\x1b[0m', `Destination: ${destination}\n`);

    const templateHtmlFile = await readFile(templateSource, 'utf8').catch(() => null);

    if (!templateHtmlFile) {
        console.log('No template.html found');
        return;
    }

    const templateRoot = parse(templateHtmlFile);
    const folders = (await readdir(source, {withFileTypes: true}))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    const templateMenu = templateRoot.querySelector('nav ul');
    const reportHeader = templateRoot.querySelector('body .jesthtml-content');
    const totals = emptyCounts();
    const packageSummaries = [];
    const reportSections = [];
    const missingSections = [];
    const suiteSummaries = [];

    for (const folder of folders) {
        const reportPath = `${source}/${folder}/test-report.html`;
        const reportHtmlFile = resolve(reportPath) === destinationPath
            ? null
            : await readFile(reportPath, 'utf8').catch(() => null);

        if (!reportHtmlFile) {
            const counts = emptyCounts();
            packageSummaries.push({folder, counts, status: 'missing', statusLabel: 'missing report'});
            missingSections.push(`<div class="jesthtml-content missing-report"><header><h2 id="${escapeAttr(folder)}">No test-report.html found in <a href="${escapeAttr(source)}/${escapeAttr(folder)}/"><mark>@xeokit/${escapeHtml(folder)}</mark></a></h2></header></div>`);
            console.log('\x1b[33m%s\x1b[0m', '\u26a0  No test-report.html found in', `\x1b[35m${folder}`);
            continue;
        }

        const jestRoot = parse(reportHtmlFile);
        const jestContent = jestRoot.querySelector('.jesthtml-content');

        if (!jestContent) {
            const counts = emptyCounts();
            packageSummaries.push({folder, counts, status: 'missing', statusLabel: 'malformed report'});
            missingSections.push(`<div class="jesthtml-content missing-report"><header><h2 id="${escapeAttr(folder)}">Malformed test-report.html found in <a href="${escapeAttr(source)}/${escapeAttr(folder)}/"><mark>@xeokit/${escapeHtml(folder)}</mark></a></h2></header></div>`);
            console.log('\x1b[31m%s\x1b[0m', '\u2717  Malformed test-report.html in', `\x1b[35m${folder}`);
            continue;
        }

        const counts = extractCounts(jestContent);
        const status = statusForCounts(counts);
        addCounts(totals, counts);

        jestContent.querySelector('h1')?.remove();
        prefixDomIds(jestContent, folder);
        const suites = prepareSuites(jestContent, folder);
        suiteSummaries.push(...suites);
        packageSummaries.push({folder, counts, status, statusLabel: status, suites});
        jestContent.querySelector('header')?.insertAdjacentHTML('afterbegin', `<h2 id="${escapeAttr(folder)}"><mark><a href="${escapeAttr(source)}/${escapeAttr(folder)}/">@xeokit/${escapeHtml(folder)}</a></mark> Tests</h2>`);

        reportSections.push(jestContent.outerHTML);
        console.log('\x1b[32m%s\x1b[0m', `\u2713  Included test-report.html from`, `\x1b[35m${folder}`);
    }

    const slowSuites = suiteSummaries
        .slice()
        .sort((left, right) => right.durationSeconds - left.durationSeconds);

    templateMenu.insertAdjacentHTML('beforeend', tocHtml(packageSummaries, suiteSummaries));
    reportHeader.insertAdjacentHTML('beforeend', packageSummaryHtml(packageSummaries, totals, new Date().toISOString(), slowSuites));
    templateRoot.querySelector('main').insertAdjacentHTML('beforeend', reportSections.join(''));
    templateRoot.querySelector('main').insertAdjacentHTML('beforeend', missingSections.join(''));

    await writeFile(destination, templateRoot.outerHTML);

    console.log('\x1b[36m%s\x1b[0m', `\nGeneration complete!\n`);
})();
