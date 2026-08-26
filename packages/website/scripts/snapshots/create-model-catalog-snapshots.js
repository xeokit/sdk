const fs = require("fs");
const path = require("path");
const httpServer = require('http-server');
const puppeteer = require("puppeteer");

const websiteRoot = path.resolve(__dirname, "..", "..");
const port = 3000;
let server = httpServer.createServer({root: websiteRoot});

server.listen(3000, async () => {
  console.log(`Server running at http://localhost:${port}`);
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      //        headless:false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1110, height: 600});

    const modelsIndex = JSON.parse(fs.readFileSync(path.join(websiteRoot, "models", "index.json"), "utf8"));
    const models = modelsIndex.models;

    for (let i = 0, len = models.length; i < len; i++) {

      const model = models [i];
      const modelId = model.id;
      const modelPipelines = model.pipelines || [];

      for (let j = 0, lenj = modelPipelines.length; j < lenj; j++) {

        const pipelineId = modelPipelines [j];
        const viewModelURL = `http://localhost:${port}/models/viewModel.html?modelId=${modelId}&pipelineId=${pipelineId}`;

        console.log(`Opening model: ${viewModelURL}`);

        await page.goto(viewModelURL);

        try {
          const snapShotPath = path.join(websiteRoot, "models", modelId, pipelineId, "index.png");

          await page.waitForFunction(() => !!document.querySelector('#ExampleLoaded'), {timeout: 60000});


          await Promise.race([page.screenshot({
            path: snapShotPath,
            fullPage: true,
            timeout: 60000
          }), new Promise((resolve, reject) => setTimeout(reject, 60000))]);

          console.log(`Captured snapshot: ${snapShotPath}`);

          // Wait a bit between captures
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (e) {
          console.error(`Error capturing snapshot for model '${modelId}' pipeline '${pipelineId}':`, e);
        }
      }
    }
    await browser.close();
    console.log('All snapshots captured successfully!');
  } catch (error) {
    console.error('Error capturing snapshots:', error);
  }
});
