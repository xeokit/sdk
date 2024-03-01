module.exports = {
    ...require('@xeokit/config/jest.config.base'),
    displayName: '@xeokit/bcf Tests',
    resolver: undefined,
    silent: false,

    "runner": "@kayahr/jest-electron-runner",
    "testEnvironment": "@kayahr/jest-electron-runner/environment",
    "testEnvironmentOptions": {
        "electron": {
            "options": [
                "no-sandbox",
                "ignore-certificate-errors",
                "force-device-scale-factor=1"
            ],
            "disableHardwareAcceleration": false
        }
    },
    "reporters": [
        "default",
        ["./../../node_modules/jest-html-reporter", {
            "pageTitle": "@xeokit/viewer Test Report"
        }]
    ]
};
