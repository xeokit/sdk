const fs = require('fs');
const path = require('path');
const hljs = require('highlight.js');
const markdownit = require('markdown-it');
const gulp = require('gulp');
const fileinclude = require('gulp-file-include');
const rename = require("gulp-rename");
const replace = require('gulp-replace-task');
const imageThumbnail = require('image-thumbnail');

//const base = "http://localhost:8080";
const base = "https://xeokit.github.io/sdk/";

const docsLinks = JSON.parse(fs.readFileSync("./data/docsLinks.json", "utf8"));
const docsLookup = JSON.parse(fs.readFileSync("./data/docsLookup.json", "utf8"));
const examplesIndex = JSON.parse(fs.readFileSync("./examples/index.json", "utf8"));
const DOCS_LOOKUP = {...docsLookup, ...docsLinks};

const markDownParser = markdownit({
    html: true,
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return (
                    '<pre class="code-section"><code class="hljs">' +
                    hljs.highlight(str, {language: lang, ignoreIllegals: true}).value +
                    "</code></pre>"
                );
            } catch (__) {
            }
        }
        return (
            '<code class="hljs">' +
            //    hljs.utils.escapeHtml(str) +
            "</code>"
        );
    }
});


/*----------------------------------------------------------------------------------------
 *
 *
 *---------------------------------------------------------------------------------------*/

function compileExamples() {
    console.log("Compiling examples");

    const baseDir = "./examples/";
    const index = {};

    try {

        const files = fs.readdirSync(baseDir);

        files.forEach(file => {

            const exampleDirPath = path.join(baseDir, file);
            const stats = fs.statSync(exampleDirPath);

            if (stats.isDirectory()) {

                const indexJSONPath = path.join(exampleDirPath, 'index.json');
                const indexJSPath = path.join(exampleDirPath, 'index.js');

                if (fs.existsSync(indexJSONPath)) {

                    console.log("Compiling example:" + exampleDirPath);

                    try {
                        const exampleInfo = JSON.parse(fs.readFileSync(indexJSONPath, 'utf8'));

                        exampleInfo.id = file;

                        if (exampleInfo.template) {

                            console.log("Compiling example template:" + exampleInfo.template);

                            gulp.src([`./templates/${exampleInfo.template}.html`])
                                .pipe(
                                    replace({
                                        patterns: [
                                            {
                                                match: 'base',
                                                replacement: base
                                            },
                                            {
                                                match: 'title',
                                                replacement: exampleInfo.title
                                            }
                                        ]
                                    })
                                )
                                .pipe(fileinclude({}))
                                .pipe(rename("index.html"))
                                .pipe(gulp.dest(`${exampleDirPath}/`))
                                .on('end', function () {
                                });

                            fs.cpSync(`./templates/${exampleInfo.template}.html`, `${exampleDirPath}/index.html`);
                        }

                        console.log("TEST EXISTS:" + indexJSPath);

                        if (fs.existsSync(indexJSPath)) {

                            console.log("TEST EXISTS: YES");

                            if (exampleInfo.isTutorial) {

                                console.log("Creating tutorial for example: " + file);

                                const articleDirPath = `./articles/example_${file}`;
                                const exampleDirPath = `./examples/${file}`;
                                fs.rmSync(articleDirPath, {recursive: true, force: true});
                                fs.mkdirSync(articleDirPath, {recursive: true});

                                const exampleJS = renderCodeSections(parseCodeSections(fs.readFileSync(indexJSPath, 'utf8'), null), true);

                                gulp.src([`./templates/web-example-tutorial.md`])
                                    .pipe(
                                        replace({
                                            patterns: [
                                                {
                                                    match: 'exampleId',
                                                    replacement: exampleInfo.id
                                                },
                                                {
                                                    match: 'title',
                                                    replacement: exampleInfo.title
                                                },
                                                {
                                                    match: 'description',
                                                    replacement: exampleInfo.description
                                                },
                                                {
                                                    match: 'exampleId',
                                                    replacement: file
                                                },
                                                {
                                                    match: 'base',
                                                    replacement: base
                                                },
                                                {
                                                    match: 'javascript',
                                                    replacement: exampleJS
                                                }
                                            ]
                                        })
                                    )
                                    .pipe(fileinclude({}))
                                    .pipe(rename("index.md"))
                                    .pipe(gulp.dest(articleDirPath))
                                    .on('end', function () {
                                    });

                                const articleInfo = {
                                    title: exampleInfo.title,
                                    description: exampleInfo.description || "",
                                    tags: [
                                        "Tutorial",
                                        "Example"
                                    ],
                                    topic: exampleInfo.topic || "general"
                                };
                                if (exampleInfo.tags) {
                                    articleInfo.tags = articleInfo.tags.concat(exampleInfo.tags);
                                }
                                fs.writeFileSync(path.join(articleDirPath, 'index.json'), JSON.stringify(articleInfo, null, 2));
                                fs.cpSync(path.join(exampleDirPath, 'index.png'), path.join(articleDirPath, 'index.png'));
                            }
                            const trimmedExampleInfo = {
                                id: exampleInfo.id,
                                title: exampleInfo.title,
                                description: exampleInfo.description || "",
                                isTutorial: !!exampleInfo.isTutorial,
                                isVisualTest: !!exampleInfo.isVisualTest,
                                tags: exampleInfo.tags || [],
                                categories: exampleInfo.categories || [],
                                topic: exampleInfo.topic || "general"
                            };
                            if (exampleInfo.template) {
                                trimmedExampleInfo.template = exampleInfo.template;
                            }
                            fs.writeFileSync(indexJSONPath, JSON.stringify(trimmedExampleInfo, null, 2));

                            index[exampleInfo.id] = trimmedExampleInfo;
                        }
                    } catch (err) {
                        console.error(`Error reading or parsing JSON in file: ${indexJSONPath}`, err);
                    }
                } else {
                    console.log(`index.json not found:  ${indexJSONPath}`);
                }
            }
        });
    } catch (err) {
        console.error(`Error reading directory: ${err}`);
    }
    fs.writeFileSync("./examples/index.json", JSON.stringify(index, null, 2), 'utf8');
}

let docLinkMade = {};

function parseCodeSections(code, token = "\\") {
    docLinkMade = {}
    const lines = code.split('\n')
    const sections = []
    let currentSection = {
        comments: [],
        code: []
    }
    for (let line of lines) {
        if (line.trim().startsWith(token)) {
            if (currentSection.code.length > 0) {
                sections.push({...currentSection})
                currentSection = {
                    comments: [],
                    code: []
                }
            }
            currentSection.comments.push(line.trim().substring(token.length).trim())
        } else if (line.length > 0) {
            if (currentSection.comments.length > 0 && currentSection.code.length === 0) {
                sections.push({...currentSection})
                currentSection = {
                    comments: [],
                    code: []
                }
            }
            currentSection.code.push(line)
        }
    }
    if (currentSection.comments.length > 0 || currentSection.code.length > 0) {
        sections.push(currentSection)
    }
    return sections
}

function renderCodeSections(sections, isJavaScript) {
    let lineCount = 1;
    return sections.map(section => {
        const html = []
        if (section.comments.length > 0) {
            html.push(`<p class="comment-block">
<span style="font-weight: bold">${lineCount++}.</span> ${parsedocsLookup(section.comments.join(' '))}</p>`)
        }
        if (section.code.length > 0) {
            if (isJavaScript) {
                html.push("\n\n````javascript\n" + section.code.join('\n') + "\n````\n")
            } else {
                html.push("\n\n````html\n\n" + section.code.join('\n') + "\n\n````\n")
            }
        }
        return html.join('');
    }).join('')
}

function parsedocsLookup(text) {
    Object.keys(docsLookup).forEach(function (key) {
        const expr = ` ${key}`;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            if (docLinkMade[key]) {
                return `&nbsp;<span class="doc-link">${key}</span>`
            }
            docLinkMade[key] = true;
            const entry = docsLookup[key];
            const path = entry.path || "";
            return `&nbsp;<a class="doc-link" data-template="${key}_template"  href="${base}${path}" target="_parent">${key}</a>
            <template class="doc-link-tooltip" id="${key}_template" style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol; font-size: 1rem; font-weight: 400; line-height: 1.5; color: #212529;">
                <p style="font-weight: lighter; color: grey;  font-size: 0.8rem; padding-top:0">@xeokit/sdk / ${entry.namespace} / ${key} /</p>
                <p style="font-weight: bold; font-size: 1.2rem; margin: 0; padding-top:0">${capitalizeFirstLetter(entry.kind)} ${key}</p>
                <p style="font-weight: normal; font-size: 1rem; margin-top: 5px; margin-bottom: 0; padding-top:0; padding-bottom: 0;">${entry.summary}</p>
            </template>`;
        });
    });
    return text;
}

function capitalizeFirstLetter(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}


/*----------------------------------------------------------------------------------------
 *
 *
 *---------------------------------------------------------------------------------------*/

function compileArticles() {

    console.log("Compiling articles");

    const baseDir = "./articles/";

    const index = {
        articles: {},
        tagsToArticlesMap: {}
    };
    try {

        const files = fs.readdirSync(baseDir);

        files.forEach(file => {

            const articleId = file;
            const subDirPath = path.join(baseDir, file);
            const stats = fs.statSync(subDirPath);

            if (stats.isDirectory()) {

                const indexPath = path.join(subDirPath, 'index.json');
                let articleJSON;

                if (fs.existsSync(indexPath)) {
                    try {
                        console.log("Compiling article: " + articleId);
                        const data = fs.readFileSync(indexPath, 'utf8');
                        articleJSON = JSON.parse(data);
                        index.articles[file] = articleJSON;

                        if (articleJSON.tags) {
                            const tagsToArticlesMap = index.tagsToArticlesMap;
                            for (let tag of articleJSON.tags) {
                                let tagArticles = tagsToArticlesMap[tag];
                                if (!tagArticles) {
                                    tagsToArticlesMap[tag] = [articleId];
                                } else {
                                    if (!tagsToArticlesMap[tag].includes(articleId)) {
                                        tagsToArticlesMap[tag].push(articleId)
                                    }
                                }
                            }
                        }
                        (async function () {
                            try {
                                let thumbnailPath = articleJSON.thumbnail;
                                if (!thumbnailPath) {
                                    const imageFiles = await listImageFiles(subDirPath);
                                    if (imageFiles.length > 0) {
                                        for (let filePath of imageFiles) {
                                            if (!filePath.includes("_thumbnail.jpg")) {
                                                thumbnailPath = filePath;
                                                break;
                                            }
                                        }
                                    }
                                    if (!thumbnailPath) {
                                        thumbnailPath = "./images/xktWithTextures.png";
                                    }
                                } else {
                                    thumbnailPath = path.join(subDirPath, thumbnailPath);
                                }
                                const outThumbPath = path.join(subDirPath, `_thumbnail.jpg`);
                                let thumbnail = await imageThumbnail(thumbnailPath, {
                                    width: 300,
                                    jpegOptions: {
                                        force: true,
                                        quality: 60
                                    }
                                });
                                fs.writeFileSync(outThumbPath, thumbnail);
                            } catch (err) {
                                console.error(err);
                            }
                        })();

                    } catch (err) {
                        console.error(`Error reading or parsing JSON in file: ${indexPath}`, err);
                    }
                } else {
                    console.log(`index.json not found: ${indexPath}`);
                }
                const mdIndexPath = path.join(subDirPath, 'index.md');
                const templateIndexPath = path.join(subDirPath, 'indexTemp.html');

                if (fs.existsSync(mdIndexPath)) {
                    console.log("Compiling article markdown: " + mdIndexPath);
                    try {
                        const md = fs.readFileSync(mdIndexPath, 'utf8');
                        const mdIndexPath2 = path.join(subDirPath, 'content.html');

                        if (articleJSON.bannerImage) {
                            fs.copyFileSync("./templates/article-with-banner.html", templateIndexPath);
                        } else {
                            fs.copyFileSync("./templates/article.html", templateIndexPath);
                        }

                        (async function convertMarkdownToHtml() {
                            const html =
                                await markDownParser.render(
                                    parseDocLinks(
                                        parseExampleTitle(
                                            parseExampleDescription(
                                                parseExampleRunLinks(
                                                    parseExampleHTMLLinks(
                                                        parseExampleJavaScriptLinks(
                                                            parseExampleSteps(md)
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                );
                            fs.writeFileSync(mdIndexPath2, html, 'utf8');

                            gulp.src([
                                templateIndexPath
                            ])
                                .pipe(fileinclude({
                                    filters: {
                                        //markdown: markdown.parse
                                    }
                                }))
                                .pipe(rename("index.html"))
                                .pipe(
                                    replace({
                                        patterns: [
                                            {
                                                match: 'bannerImage',
                                                replacement: articleJSON.bannerImage ? `${base}/articles/${articleId}/${articleJSON.bannerImage}` : ""
                                            },
                                            {
                                                match: 'base',
                                                replacement: base
                                            },
                                            {
                                                match: 'title',
                                                replacement: articleJSON.title
                                            },
                                            {
                                                match: 'subtitle',
                                                replacement: articleJSON.subtitle || ""
                                            },
                                            {
                                                match: 'articleId',
                                                replacement: articleId
                                            }
                                        ]
                                    })
                                )
                                .pipe(gulp.dest(`${subDirPath}/`))
                                .on('end', function () {
                                    fs.unlink(templateIndexPath, (err) => {
                                    });
                                    fs.unlink(mdIndexPath2, (err) => {
                                    });
                                });
                        })();

                    } catch (err) {
                        console.error(`Error reading or parsing file: ${indexPath}`, err);
                    }
                }
            }
        });

        gulp.src(["./templates/examples-index.html"])
            .pipe(
                replace({
                    patterns: [
                        {
                            match: 'base',
                            replacement: base
                        }
                    ]
                })
            )
            .pipe(fileinclude({}))
            .pipe(rename("index.html"))
            .pipe(gulp.dest(`./examples/`))
            .on('end', function () {
            });

        gulp.src(["./templates/articles-toc.html"])
            .pipe(
                replace({
                    patterns: [
                        {
                            match: 'base',
                            replacement: base
                        }
                    ]
                })
            )
            .pipe(fileinclude({}))
            .pipe(rename("index.html"))
            .pipe(gulp.dest(`./articles/`))
            .on('end', function () {
            });


        gulp.src(["./templates/models-index.html"])
            .pipe(
                replace({
                    patterns: [
                        {
                            match: 'base',
                            replacement: base
                        }
                    ]
                })
            )
            .pipe(fileinclude({}))
            .pipe(rename("index.html"))
            .pipe(gulp.dest(`./models/`))
            .on('end', function () {
            });

        console.log("Writing ./templates/article-index.html");

        // gulp.src(["./templates/article-index.html"])
        //     .pipe(
        //         replace({
        //             patterns: [
        //                 {
        //                     match: 'base',
        //                     replacement: base
        //                 }
        //             ]
        //         })
        //     )
        //     .pipe(fileinclude({}))
        //     .pipe(rename("index.html"))
        //     .pipe(gulp.dest(`./articles/`))
        //     .on('end', function () {
        //     });

        gulp.src(["./templates/index.html"])
            .pipe(
                replace({
                    patterns: [
                        {
                            match: 'base',
                            replacement: base
                        }
                    ]
                })
            )
            .pipe(fileinclude({}))
            .pipe(gulp.dest(`./`))
            .on('end', function () {
            });

        gulp.src(["./templates/api-docs.html"])
            .pipe(
                replace({
                    patterns: [
                        {
                            match: 'base',
                            replacement: base
                        }
                    ]
                })
            )
            .pipe(fileinclude({}))
            .pipe(gulp.dest(`./`))
            .on('end', function () {
            });

    } catch (err) {
        console.error(`Error reading directory: ${err}`);
    }

    console.log("Writing ./articles/index.json");

    fs.writeFileSync("./articles/index.json", JSON.stringify(index, null, 2), 'utf8');
}

async function listImageFiles(directory) {
    try {
        const files = await fs.readdirSync(directory);
        const imageFiles = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ext === '.jpg' || ext === '.jpeg' || ext === '.png';
            })
            .map(file => path.join(directory, file)); // Get full paths
        return imageFiles;
    } catch (err) {
        console.error(`Error reading directory: ${err.message}`);
        return [];
    }
}

function parseDocLinks(text, prefix = true) {
    Object.keys(DOCS_LOOKUP).forEach(function (key) {
        const expr = prefix ? `doc:${key}` : key;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            const entry = DOCS_LOOKUP[key];
            const path = entry.path || "";
            return `<a class="doc-link" data-template="${key}_template"  href="${base}${path}" target="_parent">${key}</a>
            <template class="doc-link-tooltip" id="${key}_template" style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol; font-size: 1rem; font-weight: 400; line-height: 1.5; color: #212529;">
                <p style="font-weight: lighter; color: grey;  font-size: 0.8rem; padding-top:0">@xeokit/sdk / ${entry.namespace} / ${key} /</p>
                <p style="font-weight: bold; font-size: 1.2rem; margin: 0; padding-top:0">${capitalizeFirstLetter(entry.kind)} ${key}</p>
                <p style="font-weight: normal; font-size: 1rem; margin-top: 5px; margin-bottom: 0; padding-top:0; padding-bottom: 0;">${entry.summary}</p>
            </template>`;
        });
    });
    return text;
}

function parseExampleTitle(text) {
    Object.keys(examplesIndex).forEach(function (key) {
        const expr = `example-title:${key}`;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            const entry = examplesIndex[key];
            if (!entry) {
                return "";
            }
            return `<span>${entry.title}</span>`;
        });
    });
    return text;
}

function parseExampleDescription(text) {
    Object.keys(examplesIndex).forEach(function (key) {
        const expr = `example-description:${key}`;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            const entry = examplesIndex[key];
            if (!entry) {
                return "";
            }
            return `<p>${entry.description}</p>`;
        });
    });
    return text;
}

function parseExampleRunLinks(text) {
    Object.keys(examplesIndex).forEach(function (key) {
        const expr = `example-run:${key}`;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            const entry = examplesIndex[key];
            if (!entry) {
                return "";
            }
            const exampleSrc = `../../examples/${key}/index.html`
            return `<div id="${key}-interactivePlaceholder" class="example-run-container">
                        <div id="${key}-overlay" class="overlay"><div id="${key}-text-overlay" class="text-overlay">Click to load</div></div>
                        <img id="${key}-img" src="../../examples/${key}/index.png"  alt="Placeholder image"/>
                        <iframe id="${key}-iframe"></iframe>
                        <p><i>${entry.title}</i></p>
                    </div>
                    <br>
                    <script>
                        const placeholder = document.getElementById("${key}-interactivePlaceholder");
                        placeholder.addEventListener('click', function() {
                            const overlay = document.getElementById("${key}-overlay");
                                  const textOverlay = document.getElementById("${key}-text-overlay");
                                  textOverlay.innerText = "Loading...";
                                  const img = document.getElementById("${key}-img");
     const imgStyles = window.getComputedStyle(img);
    const iframe = document.getElementById("${key}-iframe")
    iframe.src = "${exampleSrc}";
                            iframe.onload = () =>{
                                const checkElement = () => {
                                    try {
                                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                                        if (iframeDoc && iframeDoc.getElementById("ExampleLoaded")) {
                                            clearInterval(checkInterval);
                                            img.remove();
                                                        overlay.remove();
                                        }
                                    } catch (error) {
                                        console.warn("Unable to access iframe contents (possible cross-origin issue)");
                                    }
                                };
                                const checkInterval = setInterval(checkElement, 100);
                            };
                     });
             </script>`;
        });
    });
    return text;
}

function parseExampleSteps(text) {
    Object.keys(examplesIndex).forEach(function (key) {
        const expr = `example-steps:${key}`;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            const entry = examplesIndex[key];
            if (!entry) {
                return "";
            }
            const steps = entry.steps || [];
            const stepsHtml = ["<ol>"];
            for (let step of steps) {
                stepsHtml.push(`<li classname='status-message'>${parseDocLinks(step.trim(), false)}.</li>`);
            }
            stepsHtml.push("</ol>");
            return `${stepsHtml.join("\n")}<br>`;

        });
    });
    return text;
}

function createStepsHTML(entry) {
    const steps = entry.steps || [];
    const stepsHtml = ["<ol>"];
    for (let step of steps) {
        stepsHtml.push(`<li classname='status-message'>${parseDocLinks(step.trim(), false)}.</li>`);
    }
    stepsHtml.push("</ol>");
    return `${stepsHtml.join("\n")}<br>`;
}

function parseExampleHTMLLinks(text) {
    Object.keys(examplesIndex).forEach(function (key) {
        const expr = `example-html:${key}`;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            const entry = examplesIndex[key];
            if (!entry) {
                return "";
            }
            const html = fs.readFileSync(`./examples/${key}/index.html`, "utf8");
            return "\n````html\n" + html + "\n````\n<br>";
        });
    });
    return text;
}

function parseExampleJavaScriptLinks(text) {
    Object.keys(examplesIndex).forEach(function (key) {
        const expr = `example-javascript:${key}`;
        const regex = new RegExp(`\\b${expr}?\\b`, 'g');
        text = text.replace(regex, (match) => {
            const entry = examplesIndex[key];
            if (!entry) {
                return "";
            }
            const javascript = fs.readFileSync(`./examples/${key}/index.js`, "utf8");
            const sections = parseCodeSections(javascript, "//")
            return renderCodeSections(sections, true);
        });
    });
    return text;
}

function capitalizeFirstLetter(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}


compileExamples();

setTimeout(() => {
    compileArticles();
}, 5000)


