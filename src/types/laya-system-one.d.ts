declare module 'laya-system-one' {
  export class Laya {
    static load(options?: any): Promise<any>;
    predict(state: any, questions?: any, requestedModel?: any, options?: any): Promise<any>;
  }
  export class LayaNative {
    predict(state: any, questions?: any, requestedModel?: any, options?: any): Promise<any>;
  }
}
