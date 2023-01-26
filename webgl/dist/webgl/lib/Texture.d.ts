export type Texture = {
    bind(unit: number): boolean;
    unbind(unit: number): void;
};
