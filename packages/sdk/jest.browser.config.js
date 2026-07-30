const base = require("./jest.config");

module.exports = {
    ...base,
    displayName: "@xeokit/scene Browser Tests",
    runner: "@kayahr/jest-electron-runner",
    testEnvironment: "@kayahr/jest-electron-runner/environment",
    testEnvironmentOptions: {
        electron: {
            options: [
                "no-sandbox",
                "ignore-certificate-errors",
                "force-device-scale-factor=1",
                "enable-webgl",
                "ignore-gpu-blocklist",
                "enable-unsafe-swiftshader"
            ],
            disableHardwareAcceleration: false
        }
    }
};
