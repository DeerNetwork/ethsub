import { ApiPromise, WsProvider } from "@polkadot/api";
import { BlockHash } from "@polkadot/types/interfaces";
import { Keyring } from "@polkadot/keyring";
import { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { logger, sleep } from "./utils";
import store from "./store";
import { BridgeMsg, ResourceIdConfig } from "./bridge";

export interface SubConfig {
  chainId: number;
  url: string;
  secret: string;
  startBlock: number;
  resourceIds: ResourceIdConfig[];
}

export default class Sub {
  private api: ApiPromise;
  private config: SubConfig;
  private currentBlock: number;
  private wallet: KeyringPair;
  public static async init(config: SubConfig): Promise<Sub> {
    const sub = new Sub();
    sub.config = config;
    sub.api = new ApiPromise({
      provider: new WsProvider(config.url),
    });
    await sub.api.isReady;
    sub.wallet = await createWallet(config.secret);
    sub.currentBlock = Math.max(
      config.startBlock,
      await store.loadSubBlockNum()
    );
    return sub;
  }

  public async pullBlocks() {
    while (true) {
      const finalizedHash = await this.api.rpc.chain.getFinalizedHead();
      const header = await this.api.rpc.chain.getHeader(finalizedHash);
      const latestBlock = header.number.toNumber();
      if (latestBlock <= this.currentBlock) {
        await sleep(2000);
        continue;
      }
      await this.parseBlock();
      await store.storeSubBlockNum(this.currentBlock);
    }
  }
  private async parseBlock() {
    const blockNum = this.currentBlock;
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNum);
    logger.debug(`Parse sub block ${blockNum}`);
    const events = await this.api.query.system.events.at(blockHash);
    for (const evt of events) {
      const { event } = evt;
      if (event.section === "bridge") {
        if (event.method === "FungibleTransfer") {
          const resourceId = event.data[2].toString();
          const resourceIdData = this.config.resourceIds.find(
            (v) => v.value === resourceId
          );
          if (!resourceIdData) continue;
          const destination = parseInt(event.data[0].toString());
          const depositNonce = parseInt(event.data[1].toString());
          const amount = event.data[3].toString();
          const recipent = event.data[4].toString();
          const msg: BridgeMsg = {
            source: this.config.chainId,
            destination,
            depositNonce,
            type: resourceIdData.type,
            resourceId,
            resourceName: resourceIdData.name,
            payload: { amount, recipent },
          };
          console.log(msg);
        }
      }
    }
    this.currentBlock += 1;
  }
}

async function createWallet(privateKey: string) {
  await cryptoWaitReady();
  const keyring = new Keyring();
  return keyring.addFromUri(privateKey);
}
