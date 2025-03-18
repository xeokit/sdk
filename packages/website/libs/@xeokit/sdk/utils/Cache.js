const files = {};
let enabled = false;
const Cache = {
    enabled: false,
    files: {},
    add: function (key, file) {
        if (!enabled) {
            return;
        }
        files[key] = file;
    },
    get: function (key) {
        if (!enabled) {
            return;
        }
        return files[key];
    },
    remove: function (key) {
        delete files[key];
    },
    clear: function () {
        this.files = {};
    }
};
export { Cache };
//# sourceMappingURL=Cache.js.map