const fs = require("fs");
const httpServer = require('http-server');
const puppeteer = require("puppeteer");

const port = 3000;
let server = httpServer.createServer();

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
        const examplesIndex = JSON.parse(fs.readFileSync("./examples/index.json", "utf8"));
        for (let exampleId in examplesIndex) {

            const exampleIndex = JSON.parse(fs.readFileSync(`./examples/${exampleId}/index.json`, "utf8"));

            if (exampleIndex.isTutorial || exampleIndex.isVisualTest) {

                const exampleUrl = `http://localhost:${port}/examples/${exampleId}/index.html`;

                console.log(`Opening example: ${exampleUrl}`);

                await page.goto(exampleUrl);

                try {
                    await page.waitForFunction(() => !!document.querySelector('#ExampleLoaded'));
                    await page.screenshot({
                        path: `./examples/${exampleId}/index.png`,
                        fullPage: true
                    });
                    console.log(`Captured snapshot: ./examples/${exampleId}/index.png`);
                    // Wait a bit between captures
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (e) {
                    console.error(`Error capturing snapshot for ${exampleId}:`, e);
                }
            }
        }
        await browser.close();
        console.log('All snapshots captured successfully!');
        server.close();
    } catch (error) {
        console.error('Error capturing snapshots:', error);
    }
});
