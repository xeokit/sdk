// packages/website/scripts/create-example-snapshots.js

const fs = require("fs");
const path = require("path");
const httpServer = require("http-server");
const puppeteer = require("puppeteer");

const port = 3000;
const examplesDir = path.join(__dirname, "../examples");

async function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error(`Failed to read or parse JSON: ${filePath}`, e);
    return null;
  }
}

async function captureSnapshots() {

  const server = httpServer.createServer();
  server.listen(port, async () => {

    console.log(`Server running at http://localhost:${port}`);

    let browser;

    try {

      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1110, height: 600 });


      const examplesIndexPath = path.join(examplesDir, "index.json");
      const examplesIndex = await readJson(examplesIndexPath);

      if (!examplesIndex) {
        throw new Error("Could not read examples index.");
      }

      for (const exampleId of Object.keys(examplesIndex)) {

        const exampleIndexPath = path.join(examplesDir, exampleId, "index.json");
        const exampleIndex = await readJson(exampleIndexPath);

        if (!exampleIndex) {
          continue;
        }

        if (exampleIndex.isTutorial || exampleIndex.isVisualTest) {
          const exampleUrl = `http://localhost:${port}/examples/${exampleId}/index.html`;

          console.log(`Opening example: ${exampleUrl}`);

          try {
            await page.goto(exampleUrl, { waitUntil: "domcontentloaded" });
            await page.waitForFunction(
              () => !!document.querySelector("#ExampleLoaded"),
              { timeout: 10000 }
            );
            const visualTestJson = await getVisualTestJson(page);
            if (visualTestJson) {
              const jsonPath = path.join(examplesDir, exampleId, "index.visualtest.json");
              fs.writeFileSync(jsonPath, JSON.stringify(visualTestJson, null, 2), "utf8");
            }
            const screenshotPath = path.join(examplesDir, exampleId, "index.png");
            await page.screenshot({
              path: screenshotPath,
              fullPage: true
            });
            // Wait a bit between captures
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (e) {
            console.error(`Error capturing snapshot for ${exampleId}:`, e);
          }
        }
      }

      await browser.close();

      console.log("All snapshots captured successfully!");

      server.close();

    } catch (error) {
      if (browser) await browser.close();
      server.close();
      console.error("Error capturing snapshots:", error);
    }
  });
}

async function getVisualTestJson(page) {
   return await page.evaluate(() => {
    return new Promise(resolve => {
      function handler(event) {
        if (event.data && event.data.type === "xeokit.visualTestJson") {
          window.removeEventListener("message", handler);
          resolve(event.data.payload);
        }
      }
      window.addEventListener("message", handler);
    });
  });
}



captureSnapshots();
