declare const Cache: {
    enabled: boolean;
    files: {};
    add: (key: string | number, file: any) => void;
    get: (key: string | number) => any;
    remove: (key: string | number) => void;
    clear: () => void;
};
export { Cache };
