const endpointBase = "/__getting-started/browser-tests/page";

const els = {
    run: document.getElementById("run"),
    stop: document.getElementById("stop"),
    clear: document.getElementById("clear"),
    testPath: document.getElementById("testPath"),
    state: document.getElementById("state"),
    suites: document.getElementById("suites"),
    tests: document.getElementById("tests"),
    passed: document.getElementById("passed"),
    failed: document.getElementById("failed"),
    time: document.getElementById("time"),
    json: document.getElementById("json"),
    log: document.getElementById("log"),
    failures: document.getElementById("failures")
};

let source = null;
let startedAt = 0;

els.run.addEventListener("click", runTests);
els.stop.addEventListener("click", stopTests);
els.clear.addEventListener("click", clearOutput);
els.testPath.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !els.run.disabled) {
        runTests();
    }
});

checkServer().then((available) => {
    if (available && new URLSearchParams(location.search).get("auto") === "1") {
        runTests();
    }
});

async function runTests() {
    closeSource();
    clearOutput();
    startedAt = performance.now();
    setRunning(true);
    setState("Running", "running");
    appendLog("Starting browser test run...\n");

    const testPath = els.testPath.value.trim();
    const query = testPath ? `?testPath=${encodeURIComponent(testPath)}` : "";
    source = new EventSource(`${endpointBase}/run${query}`);

    source.addEventListener("status", (event) => {
        const data = parseEvent(event);
        if (data.command) {
            appendLog(`$ ${data.command}\n`);
        }
        if (data.message) {
            appendLog(`${data.message}\n`);
        }
    });

    source.addEventListener("log", (event) => {
        const data = parseEvent(event);
        appendLog(data.text || "");
    });

    source.addEventListener("errorMessage", (event) => {
        const data = parseEvent(event);
        appendLog(`${data.message || "Error"}\n`);
        setState("Failed", "fail");
        setRunning(false);
        closeSource();
    });

    source.addEventListener("done", (event) => {
        const data = parseEvent(event);
        renderDone(data);
        setRunning(false);
        closeSource();
    });

    source.onerror = () => {
        appendLog("\nLost connection to the browser test server.\n");
        setState("Failed", "fail");
        setRunning(false);
        closeSource();
    };
}

async function stopTests() {
    els.stop.disabled = true;
    try {
        await fetch(`${endpointBase}/stop`, {method: "POST"});
        appendLog("\nStopping active test run...\n");
    } catch (err) {
        appendLog(`\nStop failed: ${err.message}\n`);
    }
}

function renderDone(data) {
    const summary = data.summary || {};
    const runtimeMs = summary.startTime && data.completedAt
        ? data.completedAt - summary.startTime
        : performance.now() - startedAt;

    els.suites.textContent = formatPair(summary.numPassedTestSuites, summary.numTotalTestSuites);
    els.tests.textContent = formatPair(summary.numPassedTests, summary.numTotalTests);
    els.passed.textContent = String(summary.numPassedTests ?? "-");
    els.failed.textContent = String(summary.numFailedTests ?? "-");
    els.time.textContent = `${(runtimeMs / 1000).toFixed(1)}s`;
    els.json.textContent = data.outputFile || "-";

    const failedSuites = (summary.testResults || []).filter((result) => result.status === "failed");
    if (failedSuites.length === 0) {
        els.failures.className = data.ok ? "ok" : "muted";
        els.failures.textContent = data.ok ? "No failures." : "No structured failure output.";
    } else {
        els.failures.className = "fail";
        els.failures.textContent = failedSuites.map(formatFailedSuite).join("\n\n");
    }

    setState(data.ok ? "Passed" : "Failed", data.ok ? "pass" : "fail");
    appendLog(`\nExited with code ${data.code}${data.signal ? `, signal ${data.signal}` : ""}.\n`);
}

function formatFailedSuite(result) {
    const assertions = (result.assertionResults || [])
        .filter((assertion) => assertion.status === "failed")
        .map((assertion) => {
            const message = (assertion.failureMessages || []).join("\n").trim();
            return `  - ${assertion.fullName || assertion.title}\n${indent(message || "No failure message.", "    ")}`;
        })
        .join("\n");
    return `${result.name || "Unknown suite"}\n${assertions || "  No failed assertions listed."}`;
}

function formatPair(passed, total) {
    if (passed === undefined || total === undefined) {
        return "-";
    }
    return `${passed}/${total}`;
}

function indent(text, prefix) {
    return text.split(/\r?\n/).map((line) => `${prefix}${line}`).join("\n");
}

function clearOutput() {
    els.suites.textContent = "-";
    els.tests.textContent = "-";
    els.passed.textContent = "-";
    els.failed.textContent = "-";
    els.time.textContent = "-";
    els.json.textContent = "-";
    els.log.textContent = "";
    els.failures.className = "muted";
    els.failures.textContent = "No failures.";
    setState("Idle", "");
}

function appendLog(text) {
    els.log.textContent += text;
    els.log.scrollTop = els.log.scrollHeight;
}

function setRunning(running) {
    els.run.disabled = running;
    els.stop.disabled = !running;
    els.testPath.disabled = running;
}

function setState(text, className) {
    els.state.textContent = text;
    els.state.className = className || "";
}

function closeSource() {
    if (source) {
        source.close();
        source = null;
    }
}

function parseEvent(event) {
    try {
        return JSON.parse(event.data || "{}");
    } catch (err) {
        return {message: event.data || err.message};
    }
}

async function checkServer() {
    try {
        const response = await fetch(`${endpointBase}/health`, {cache: "no-store"});
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        appendLog(data.active ? "Ready. A test run is already active.\n" : "Ready.\n");
        return true;
    } catch (err) {
        appendLog("Browser test server is not available.\nRun `pnpm sdk-test:browser:page`, then open this page from the printed URL.\n");
        els.run.disabled = true;
        setState("Offline", "fail");
        return false;
    }
}
