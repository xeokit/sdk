const files: any = {};
let enabled = false;

const Cache = {

    enabled: false,
    files: {},

    add: function (key: string | number, file: any) {
        if (!enabled) {
            return;
        }
        files[key] = file;
    },

    get: function (key: string | number) {
        if (!enabled) {
            return;
        }
        return files[key];
    },

    remove: function (key: string | number) {
        delete files[key];
    },

    clear: function () {
        this.files = {};
    }
};

export {Cache};
