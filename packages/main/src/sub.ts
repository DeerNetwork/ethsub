import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { ServiceOption, InitOption, INIT_KEY } from "use-services";
import { Service as StoreService } from "./store";
import { sleep, BridgeMsg } from "./utils";
import { srvs } from "./services";

export type Deps = [StoreService];
export type Option<S extends Service> = ServiceOption<Args, S>;

export interface Args {
  chainId: number;
  url: string;
  secret: string;
  startBlock: number;
}

export async function init<S extends Service>(
  option: InitOption<Args, S>
): Promise<S> {
  const srv = new (option.ctor || Service)(option);
  await srv[INIT_KEY]();
  return srv as S;
}

export class Service {
  private api: ApiPromise;
  private args: Args;
  private currentBlock: number;
  private store: StoreService;
  private wallet: KeyringPair;
  public constructor(option: InitOption<Args, Service>) {
    if (option.deps.length !== 1) {
      throw new Error("miss deps [store]");
    }
    this.store = option.deps[0];
    this.args = option.args;
  }
  public async [INIT_KEY]() {
    this.api = new ApiPromise({
      provider: new WsProvider(this.args.url),
    });
    await this.api.isReady;
    this.wallet = await createWallet(this.args.secret);
    this.currentBlock = Math.max(
      this.args.startBlock,
      await this.store.loadSubBlockNum()
    );
  }

  public async pullBlocks() {
    while (true) {
      const finalizedHash = await this.api.rpc.chain.getFinalizedHead();
      const header = await this.api.rpc.chain.getHeader(finalizedHash);
      const latestBlock = header.number.toNumber();
      if (latestBlock <= this.currentBlock) {
        await sleep(3000);
        continue;
      }
      await this.parseBlock();
      await this.store.storeSubBlockNum(this.currentBlock);
    }
  }
  private async parseBlock() {
    const blockNum = this.currentBlock;
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNum);
    srvs.logger.debug(`Parse sub block ${blockNum}`);
    const events = await this.api.query.system.events.at(blockHash);
    for (const evt of events) {
      const { event } = evt;
      if (event.section === "bridge") {
        if (event.method === "FungibleTransfer") {
          const resourceId = event.data[2].toString();
          const resourceIdData = srvs.settings.resources.find(
            (v) => v.sub === resourceId
          );
          if (!resourceIdData) continue;
          const destination = parseInt(event.data[0].toString());
          const depositNonce = parseInt(event.data[1].toString());
          const amount = event.data[3].toString();
          const recipent = event.data[4].toString();
          const msg: BridgeMsg = {
            source: this.args.chainId,
            destination,
            depositNonce,
            type: resourceIdData.type,
            resource: resourceIdData.name,
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
