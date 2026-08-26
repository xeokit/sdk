const path = require("path");
const gulp = require("gulp");
const fileinclude = require("gulp-file-include");
const rename = require("gulp-rename");
const replace = require("gulp-replace-task");
const commander = require("commander");

const program = new commander.Command();

program
  .description("Build website HTML pages from templates")
  .option("-l, --local", "build pages to test locally");

const argv = process.argv.filter((arg, index) => index < 2 || arg !== "--");
program.parse(argv);

const options = program.opts();
const websiteRoot = path.resolve(__dirname, "..", "..");
const siteBase = "https://xeokit.github.io/sdk/";

function outputBase(localBase) {
  return options.local ? localBase : siteBase;
}

async function main() {
  await buildTemplatePages();
}

async function buildTemplatePages() {
  const pageBuilds = [
    {template: "./templates/examples-index.html", dest: "./examples/", renameTo: "index.html", localBase: ".."},
    {template: "./templates/models-index.html", dest: "./models/", renameTo: "index.html", localBase: ".."},
    {template: "./templates/index.html", dest: "./", localBase: "."},
    {template: "./templates/api-docs.html", dest: "./", localBase: "."}
  ];

  for (const pageBuild of pageBuilds) {
    await renderTemplatePage(pageBuild);
  }
}

function renderTemplatePage(pageBuild) {
  return new Promise((resolve, reject) => {
    const pageBase = outputBase(pageBuild.localBase);
    let stream = gulp.src([pageBuild.template], {cwd: websiteRoot})
      .pipe(replace({
        patterns: [
          {
            match: "base",
            replacement: pageBase
          }
        ]
      }))
      .pipe(fileinclude({}));

    if (pageBuild.renameTo) {
      stream = stream.pipe(rename(pageBuild.renameTo));
    }

    stream
      .pipe(gulp.dest(pageBuild.dest, {cwd: websiteRoot}))
      .on("end", resolve)
      .on("error", reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
