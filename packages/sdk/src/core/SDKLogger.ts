
export class SDKLogger {

    private logging: boolean;

    constructor(logging: boolean) {
        this.logging = logging;
    }

   public logError(a: any) {
        if (this.logging) {
            console.error(a.error);
        }
        return a;
   }
}

const logger = new SDKLogger(true);

export {logger};