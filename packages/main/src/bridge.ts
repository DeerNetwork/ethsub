import Eth from "./eth";
import Sub from "./sub";
import { config } from "./utils";

let ctx: Ctx;

export interface Ctx {
  eth: Eth;
  sub: Sub;
}

export enum BridgeMsgType {
  FungibleTransfer = "FungibleTransfer",
  GenericTransfer = "GenericTransfer",
}

export interface BridgeMsg {
  source: number;
  destination: number;
  type: BridgeMsgType;
  depositNonce: number;
  payload: any;
}

export function getCtx() {
  if (!ctx) throw new Error("Ctx have not been initialized");
  return ctx;
}

export default class Bridge {
  public static async init() {
    const eth = await Eth.init(config.eth);
    const sub = await Sub.init(config.sub);
    ctx = { eth, sub };
    await eth.pullBlocks();
  }
}
