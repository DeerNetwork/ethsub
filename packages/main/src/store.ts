import fs from "fs";
import path from "path";
import { config } from "./utils";

export enum StoreKeys {
  ETH_BLOCKNUM = "ethBlockNum",
}

export class Store {
  private dataDir: string;
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }
  public async storeEthBlockNum(blockNum: number) {
    await this.writeKeyFile(StoreKeys.ETH_BLOCKNUM, blockNum.toString());
  }
  public async loadEthBlockNum(): Promise<number> {
    const buf = await this.readKeyFile(StoreKeys.ETH_BLOCKNUM);
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

function createStore(): Store {
  const { dataDir } = config;
  fs.mkdirSync(dataDir, { recursive: true });
  const store = new Store(dataDir);
  return store;
}

export default createStore();
