export function truncate(array) {
    const arr = [];
    for (let i = 0, len = array.length; i < len; i++) {
        let v = Math.round(array[i] * 100) / 100;
        if (v === -0) {
            v = 0;
        }
        arr[i] = v;
    }
    return arr;
}