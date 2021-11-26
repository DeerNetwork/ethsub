import fs from "fs";
import path from "path";
import { ServiceOption, InitOption, INIT_KEY } from "use-services";

export type Option<S extends Service> = ServiceOption<Args, S>;

export interface Args {
  baseDir: string;
}

export async function init<S extends Service>(
  option: InitOption<Args, S>
): Promise<S> {
  const srv = new (option.ctor || Service)(option);
  await srv[INIT_KEY]();
  return srv as S;
}

export enum StoreKeys {
  ETH_BLOCKNUM = "ethBlockNum",
  SUB_BLOCKNUM = "subBlockNum",
}

export class Service {
  private dataDir: string;
  public constructor(option: InitOption<Args, Service>) {
    this.dataDir = option.args.baseDir;
  }
  public async [INIT_KEY]() {
    await fs.promises.mkdir(this.dataDir, { recursive: true });
  }
  public async storeEthBlockNum(blockNum: number) {
    await this.writeKeyFile(StoreKeys.ETH_BLOCKNUM, blockNum.toString());
  }
  public async loadEthBlockNum(): Promise<number> {
    const buf = await this.readKeyFile(StoreKeys.ETH_BLOCKNUM);
    if (!buf) return 0;
    return parseInt(buf.toString("utf8")) || 0;
  }
  public async storeSubBlockNum(blockNum: number) {
    await this.writeKeyFile(StoreKeys.SUB_BLOCKNUM, blockNum.toString());
  }
  public async loadSubBlockNum(): Promise<number> {
    const buf = await this.readKeyFile(StoreKeys.SUB_BLOCKNUM);
    if (!buf) return 0;
    return parseInt(buf.toString("utf8")) || 0;
  }
  private async readKeyFile(key: StoreKeys): Promise<Buffer> {
    const keyFile = this.getKeyFile(key);
    try {
      return await fs.promises.readFile(keyFile);
    } catch {
      return null;
    }
  }
  private async writeKeyFile(key: StoreKeys, data: string | Buffer) {
    const keyFile = this.getKeyFile(key);
    await fs.promises.writeFile(keyFile, data);
  }
  private getKeyFile(key: StoreKeys) {
    return path.resolve(this.dataDir, key);
  }
}
