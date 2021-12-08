import fs from "fs";
import path from "path";
import level from "level";
import type {LevelUp} from "levelup";
import {ServiceOption, InitOption, INIT_KEY, createInitFn} from "use-services";
import {BridgeMsg, BridgeMsgStatus} from "./types";
import {srvs} from "./services";

export type Option<S extends Service> = ServiceOption<Args, S>;

export interface Args {
  dataDir: string;
}

const ETH_BN_KEY = "bn:eth";
const SUB_BN_KEY = "bn:sub";

export class Service {
  private args: Args;
  private db: LevelUp;

  public constructor(option: InitOption<Args, Service>) {
    this.args = option.args;
  }

  public async [INIT_KEY]() {
    await fs.promises.mkdir(this.args.dataDir, {recursive: true});
    this.db = level(path.resolve(this.args.dataDir, "db"), {
      valueEncoding: "json",
    });
  }

  public async storeEthBlockNum(blockNum: number) {
    await this.db.put(ETH_BN_KEY, blockNum);
  }

  public async loadEthBlockNum(): Promise<number> {
    const value = await this.safeGet(ETH_BN_KEY);
    return value || 0;
  }

  public async storeSubBlockNum(blockNum: number) {
    await this.db.put(SUB_BN_KEY, blockNum);
  }

  public async loadSubBlockNum(): Promise<number> {
    const value = await this.safeGet(SUB_BN_KEY);
    return value || 0;
  }

  public async storeMsg(msg: BridgeMsg) {
    const key = this.stringifyMsgKey(msg);
    await this.db
      .batch()
      .put(key, {
        payload: msg.payload,
        name: msg.resource.name,
      })
      .put(`${key}:${BridgeMsgStatus.Pending}`, Date.now())
      .write();
  }

  public async loadMsg(key: string): Promise<BridgeMsg> {
    const value = await this.safeGet(key);
    if (!value) return;
    const {source, destination, nonce} = this.parseMsgKey(key);
    const {name, payload} = value;
    const resource = srvs.settings.resources.find((v) => v.name === name);
    return {
      source,
      destination,
      nonce,
      resource,
      type: resource.type,
      payload,
    };
  }

  public async storeMsgStatus(msg: BridgeMsg, status: BridgeMsgStatus) {
    const key = this.stringifyMsgKey(msg);
    const batch = this.db.batch();
    for (const statusValue in BridgeMsgStatus) {
      if (/^\d+$/.test(statusValue)) {
        if (statusValue === status.toString()) {
          batch.put(`${key}:${statusValue}`, Date.now());
        } else {
          batch.del(`${key}:${statusValue}`);
        }
      }
    }
    await batch.write();
  }

  public async loadMsgStatus(msg: BridgeMsg): Promise<BridgeMsgStatus> {
    const key = this.stringifyMsgKey(msg);
    const keys = [];
    for (const statusValue in BridgeMsgStatus) {
      if (/^\d+$/.test(statusValue)) {
        keys.push(`${key}:${statusValue}`);
      }
    }
    const values: number[] = await (this.db as any).getMany(keys);
    for (let i = 0; i < values.length; i++) {
      return i as any as BridgeMsgStatus;
    }
    return BridgeMsgStatus.Pending;
  }

  public async nextMsg(
    source: number,
    destination: number
  ): Promise<BridgeMsg> {
    const re = new RegExp(
      `^msg:${source}:${destination}:\\d+:${BridgeMsgStatus.Pending}$`
    );
    const key = await this.firstKey((key) => re.test(key));
    if (!key) return;
    const {nonce} = this.parseMsgKey(key);
    return this.loadMsg(this.stringifyMsgKey({source, destination, nonce}));
  }

  private async safeGet<T = any>(key: string): Promise<T> {
    try {
      const value = await this.db.get(key);
      return value;
    } catch {
      return null;
    }
  }
  private async firstKey(pred = (_: string) => true) {
    for await (const [key] of this.db.iterator({values: false}) as any) {
      if (pred(key)) return key;
    }
  }

  private parseMsgKey(key: string) {
    const [source, destination, nonce, status] = key
      .slice(4)
      .split(":")
      .map((v) => parseInt(v));
    return {source, destination, nonce, status};
  }

  private stringifyMsgKey(msg: KeyableBridgeMsg, status?: BridgeMsgStatus) {
    let key = `msg:${msg.source}:${msg.destination}:${msg.nonce}`;
    if (typeof status !== "undefined") {
      key += ":" + status;
    }
    return key;
  }
}

export const init = createInitFn(Service);

interface KeyableBridgeMsg {
  source: number;
  destination: number;
  nonce: number;
}
