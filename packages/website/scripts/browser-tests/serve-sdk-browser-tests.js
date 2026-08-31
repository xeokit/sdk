#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const {execFileSync, spawn} = require("child_process");
const {URL} = require("url");

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const websiteRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.PORT || process.argv[2] || 8091);
const host = process.env.HOST || "127.0.0.1";
const contentTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".map", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".svg", "image/svg+xml; charset=utf-8"],
    [".wasm", "application/wasm"]
]);

let activeRun = null;

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

    if (requestUrl.pathname === "/__sdk_browser_tests/run") {
        runTests(req, res, requestUrl);
        return;
    }

    if (requestUrl.pathname === "/__sdk_browser_tests/stop") {
        stopTests(res);
        return;
    }

    if (requestUrl.pathname === "/__sdk_browser_tests/health") {
        sendJSON(res, 200, buildHealthPayload());
        return;
    }

    if (requestUrl.pathname === "/favicon.ico") {
        res.writeHead(204, {"cache-control": "no-store"});
        res.end();
        return;
    }

    serveStatic(requestUrl.pathname, res);
});

server.listen(port, host, () => {
    console.log(`SDK browser test page: http://${host}:${port}/examples/getting-started/browser-tests/page/`);
});

function runTests(req, res, requestUrl) {
    if (activeRun) {
        sendSSEHeaders(res);
        sendEvent(res, "errorMessage", {message: "A browser test run is already active."});
        res.end();
        return;
    }

    const testPathResult = parseTestPath(requestUrl.searchParams.get("testPath") || "");
    if (!testPathResult.ok) {
        sendSSEHeaders(res);
        sendEvent(res, "errorMessage", {message: testPathResult.error});
        res.end();
        return;
    }

    const outputFile = path.join("/tmp", `xeokit-sdk-browser-tests-${Date.now()}.json`);
    const args = [
        "--filter", "@xeokit/sdk",
        "exec", "jest",
        "--config", "jest.browser.config.js",
        "--runInBand",
        "--passWithNoTests",
        "--testTimeout=30000",
        "--json",
        "--outputFile", outputFile
    ];

    if (testPathResult.value) {
        args.push(testPathResult.value);
    }

    sendSSEHeaders(res);
    const command = `pnpm ${args.map(quoteArg).join(" ")}`;
    sendEvent(res, "status", {
        message: "Running SDK tests in the Electron browser environment.",
        command
    });

    const child = spawn("pnpm", args, {
        cwd: repoRoot,
        env: {
            ...process.env,
            CI: process.env.CI || "1"
        },
        detached: true,
        stdio: ["ignore", "pipe", "pipe"]
    });

    let closed = false;
    let heartbeat = null;
    const startedAt = Date.now();
    activeRun = {child, outputFile, startedAt};

    sendEvent(res, "status", {
        message: `Started process ${child.pid}. Waiting for Jest output.`,
        outputFile,
        elapsedMs: 0
    });

    heartbeat = setInterval(() => {
        const elapsedMs = Date.now() - startedAt;
        sendEvent(res, "status", {
            message: `Still running (${Math.round(elapsedMs / 1000)}s).`,
            outputFile,
            elapsedMs
        });
    }, 10000);

    child.stdout.on("data", (chunk) => {
        sendEvent(res, "log", {stream: "stdout", text: chunk.toString("utf8")});
    });

    child.stderr.on("data", (chunk) => {
        sendEvent(res, "log", {stream: "stderr", text: chunk.toString("utf8")});
    });

    child.on("error", (err) => {
        if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
        }
        sendEvent(res, "errorMessage", {message: err.message});
        activeRun = null;
    });

    child.on("close", (code, signal) => {
        if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
        }
        closed = true;
        const summary = readSummary(outputFile);
        sendEvent(res, "done", {
            ok: code === 0,
            code,
            signal,
            outputFile,
            completedAt: Date.now(),
            summary
        });
        res.end();
        activeRun = null;
    });

    req.on("close", () => {
        if (!closed && activeRun?.child === child) {
            stopChild(activeRun.child);
        }
    });
}

function buildHealthPayload() {
    return {
        ok: true,
        active: Boolean(activeRun),
        pid: activeRun?.child.pid || null,
        startedAt: activeRun?.startedAt || null,
        outputFile: activeRun?.outputFile || null,
        elapsedMs: activeRun ? Date.now() - activeRun.startedAt : null
    };
}

function stopTests(res) {
    if (!activeRun) {
        sendJSON(res, 200, {ok: true, stopped: false});
        return;
    }
    stopChild(activeRun.child);
    activeRun = null;
    sendJSON(res, 200, {ok: true, stopped: true});
}

function stopChild(child) {
    if (!child || !child.pid) {
        return;
    }
    for (const pgid of findDescendantProcessGroups(child.pid)) {
        killProcessGroup(pgid);
    }
    killProcessGroup(child.pid);
}

function killProcessGroup(pgid) {
    try {
        process.kill(-pgid, "SIGTERM");
    } catch (err) {
        // The process group may already be gone.
    }
}

function findDescendantProcessGroups(rootPid) {
    try {
        const output = execFileSync("ps", ["-eo", "pid=,ppid=,pgid="], {encoding: "utf8"});
        const childrenByParent = new Map();
        for (const line of output.trim().split(/\n+/)) {
            const [pidText, ppidText, pgidText] = line.trim().split(/\s+/);
            const pid = Number(pidText);
            const ppid = Number(ppidText);
            const pgid = Number(pgidText);
            if (!Number.isFinite(pid) || !Number.isFinite(ppid) || !Number.isFinite(pgid)) {
                continue;
            }
            const children = childrenByParent.get(ppid) || [];
            children.push({pid, pgid});
            childrenByParent.set(ppid, children);
        }

        const processGroups = new Set();
        const stack = [...(childrenByParent.get(rootPid) || [])];
        while (stack.length > 0) {
            const child = stack.pop();
            processGroups.add(child.pgid);
            stack.push(...(childrenByParent.get(child.pid) || []));
        }
        processGroups.delete(rootPid);
        return [...processGroups].sort((a, b) => b - a);
    } catch (err) {
        return [];
    }
}

function serveStatic(urlPath, res) {
    const pathname = decodeURIComponent(urlPath === "/" ? "/examples/getting-started/browser-tests/page/" : urlPath);
    const candidate = path.resolve(websiteRoot, `.${pathname}`);
    if (candidate !== websiteRoot && !candidate.startsWith(`${websiteRoot}${path.sep}`)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.stat(candidate, (statErr, stat) => {
        if (statErr) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }

        const filePath = stat.isDirectory() ? path.join(candidate, "index.html") : candidate;
        fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
                res.writeHead(404);
                res.end("Not found");
                return;
            }
            res.writeHead(200, {
                "content-type": contentTypes.get(path.extname(filePath)) || "application/octet-stream",
                "cache-control": "no-store"
            });
            res.end(data);
        });
    });
}

function parseTestPath(rawPath) {
    const trimmed = rawPath.trim();
    if (!trimmed) {
        return {ok: true, value: ""};
    }
    const normalized = trimmed.replace(/\\/g, "/").replace(/^packages\/sdk\//, "");
    if (!/^src\/.+\.test\.ts$/.test(normalized) || normalized.includes("..")) {
        return {
            ok: false,
            error: "Test path must be empty or a packages/sdk src/*.test.ts path."
        };
    }
    return {ok: true, value: normalized};
}

function readSummary(outputFile) {
    try {
        return JSON.parse(fs.readFileSync(outputFile, "utf8"));
    } catch (err) {
        return null;
    }
}

function sendSSEHeaders(res) {
    res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
        "x-accel-buffering": "no"
    });
}

function sendEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendJSON(res, status, data) {
    res.writeHead(status, {"content-type": "application/json; charset=utf-8"});
    res.end(JSON.stringify(data));
}

function quoteArg(arg) {
    return /^[A-Za-z0-9_./:=@-]+$/.test(arg) ? arg : JSON.stringify(arg);
}
