import { readFile, readdir, writeFile } from 'fs/promises';
import { parse } from 'node-html-parser';

const source = './packages';
const templateSource = './scripts/test-html-report/template.html';
const destination = './test-report.html';

let html = '';
let htmlWithoutTests = '';

(async () => {
    console.log('\x1b[36m%s\x1b[0m', `\nGenerating summary!\n`);
    console.log('\x1b[36m%s\x1b[0m', `Source: ${source}`);
    console.log('\x1b[36m%s\x1b[0m', `Template: ${templateSource}`);
    console.log('\x1b[36m%s\x1b[0m', `Destination: ${destination}\n`);

    const folders = await readdir(source);

    for (const folder of folders) {
        const reportHtmlFile = await readFile(`${source}/${folder}/test-report.html`, 'utf8').catch(() => null);

        if (!reportHtmlFile) {
            htmlWithoutTests += `<div class="jesthtml-content"><header><h2>No test-report.html found in <mark>${folder}</mark></h2></header></div>`;
            console.log('\x1b[33m%s\x1b[0m', `No test-report.html found in ${folder}`);
            continue;
        }

        const jestRoot = parse(reportHtmlFile);
        const jestContent = jestRoot.querySelector('.jesthtml-content');

        jestContent.querySelector('h1').remove();
        jestContent.querySelector('header').insertAdjacentHTML('afterbegin', `<h2>Test Report for <mark>${folder}</mark></h2>`);

        html += jestContent.outerHTML;
        console.log('\x1b[32m%s\x1b[0m', `Included test-report.html from the ${folder}`);
    }

    const templateHtmlFile = await readFile(templateSource, 'utf8').catch(() => null);

    if (!templateHtmlFile) {
        console.log('No template.html found');
        return;
    }

    const templateRoot = parse(templateHtmlFile);
    templateRoot.querySelector('body').insertAdjacentHTML('afterbegin', html + htmlWithoutTests);

    await writeFile(destination, templateRoot.outerHTML);

    console.log('\x1b[36m%s\x1b[0m', `\nGeneration complete!\n`);
})();

