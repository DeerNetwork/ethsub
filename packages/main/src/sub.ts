export interface SubConfig {
  url: string;
}

export default class Sub {
  private config: SubConfig;
  public static async init(config: SubConfig): Promise<Sub> {
    const sub = new Sub();
    sub.config = config;
    return sub;
  }
}
