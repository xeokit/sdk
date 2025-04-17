import http from 'http';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// HTML content to serve
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <style>
        body { font-family: sans-serif; text-align: center; margin-top: 100px; }
        h1 { color: #3498db; }
    </style>
</head>
<body>
    <h1>Hello from Node.js!</h1>
    <p>This page was generated and rendered dynamically.</p>
</body>
</html>
`;

import {Exporter} from "../../io";
import {EncodeParams} from "../../io";

const PORT = 3000;
const HOST = 'localhost';

/**
 *
 */
export class ScreenShotExporter extends Exporter {

    /**
     * Constructs a ScreenShotExporter.
     */
    constructor() {
        super({
            fileDataType: "json",
            encoders: {
                "1.0": encoder
            },
            defaultVersion: "1.0"
        });
    }
}

function encoder(params: EncodeParams, options?: any): Promise<any> {

    const {viewFit, eye} = options || {viewFit: true, eye: [1, 1, 1]};

    return new Promise<any>(function (resolve, reject) {
        const dataModelParams: any = params.dataModel ? params.dataModel.toParams() : {};
        dataModelParams.version = "1.0";
        doScreenShot().then((screenShotBuffer) => {
            return resolve(screenShotBuffer);
        })
    });
}

const doScreenShot = async () => {
    const server = await startHttpServer();

    try {
        const screenshotBuffer = await takeScreenshot(`http://${HOST}:${PORT}`);
        console.log(`📸 Screenshot captured in memory. Size: ${screenshotBuffer.length} bytes`);
        // // Optional: Base64 encode
        // const base64 = screenshotBuffer.toString('base64');
        // console.log(`Base64 (truncated): ${base64.substring(0, 100)}...`);
        return screenshotBuffer;
    } catch (err) {
        console.error(`Error capturing screenshot: ${err}`);
    } finally {
        server.close(() => {
            console.log(`🛑 Server closed`);
        });
    }
};


const startHttpServer = (): Promise<http.Server> => {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(htmlContent);
        });
        server.listen(PORT, HOST, () => {
            console.log(`Server running at http://${HOST}:${PORT}`);
            resolve(server);
        });
    });
};

const takeScreenshot = async (url: string) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const buffer = await page.screenshot({type: 'png'}); // buffer by default
    console.log(`📸 Screenshot captured`);
    await browser.close();
    return buffer;
};
