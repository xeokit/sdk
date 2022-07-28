const Cache = {

    enabled: false,
    files: {},

    add: function (key: string | number, file: any) {
        if (this.enabled === false) {
            return;
        }
        this.files[key] = file;
    },

    get: function (key: string | number) {
        if (this.enabled === false) {
            return;
        }
        return this.files[key];
    },

    remove: function (key: string | number) {
        delete this.files[key];
    },

    clear: function () {
        this.files = {};
    }
};

export {Cache};
