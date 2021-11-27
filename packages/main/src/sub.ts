import { ApiPromise, WsProvider } from "@polkadot/api";
import { ITuple } from "@polkadot/types/types";
import { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import { Keyring } from "@polkadot/keyring";
import { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { DispatchError, Event } from "@polkadot/types/interfaces";
import _ from "lodash";
import { BN } from "@polkadot/util";
import { ServiceOption, InitOption, INIT_KEY } from "use-services";
import { Service as StoreService } from "./store";
import { exchangeAmountDecimals, sleep } from "./utils";
import { BridgeMsg, ResourceType, BridgeMsgErc20, ResourceData } from "./types";
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

  public async writeChain(msg: BridgeMsg) {
    if (msg.type === ResourceType.ERC20) {
      await this.createErc20Proposal(msg);
    } else {
      throw new Error(`Write sub throw unknown msg type ${msg.type}`);
    }
  }

  private async parseBlock() {
    const blockNum = this.currentBlock;
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNum);
    srvs.logger.info(`Parse sub block ${blockNum}`);
    const events = await this.api.query.system.events.at(blockHash);
    for (const evt of events) {
      let msg: BridgeMsg;
      const { event } = evt;
      if (event.section !== "bridge") continue;
      if (event.method === "FungibleTransfer") {
        const resourceId = event.data[2].toString();
        const resourceIdData = srvs.settings.resources.find(
          (v) => v.sub.resourceId === resourceId
        );
        if (!resourceIdData) continue;
        msg = this.parseErc20(event, resourceIdData);
      } else {
        continue;
      }
      await srvs.eth.writeChain(msg);
    }
    this.currentBlock += 1;
  }

  private async createErc20Proposal(msg: BridgeMsgErc20) {
    const {
      source,
      nonce,
      resource,
      payload: { recipient, amount },
    } = msg;
    const logCtx = { source, nonce, resource };
    srvs.logger.info(`Write erc20 propsoal`, logCtx);
    const {
      sub: { resourceId },
    } = resource;
    const maybeMethod = await this.api.query.bridge.resources(resourceId);
    if (maybeMethod.isNone) {
      throw new Error(`Resource ${resource.name} not found on eth chain`);
    }
    const realAmount = exchangeAmountDecimals(
      amount,
      resource.eth.decimals,
      resource.sub.decimals
    );
    const method = maybeMethod.unwrap();
    const call: SubmittableExtrinsic = (
      _.get(this.api.tx, method.toString()) as any
    )(...[new BN(realAmount), recipient, source]);
    const should = await this.shouldProposal(msg, call);
    if (!should) {
      srvs.logger.info(`Ignoring proposal`, logCtx);
      return false;
    }
    srvs.logger.info(`Acknowledging proposal on chain`, logCtx);
    await this.sendTx(
      this.api.tx.bridge.acknowledgeProposal(nonce, source, resourceId, call)
    );
    return true;
  }

  private parseErc20(event: Event, resourceData: ResourceData) {
    const destination = parseInt(event.data[0].toString());
    const nonce = parseInt(event.data[1].toString());
    const amount = event.data[3].toString();
    const recipient = event.data[4].toString();
    const msg: BridgeMsg = {
      source: this.args.chainId,
      destination,
      nonce,
      type: ResourceType.ERC20,
      resource: resourceData,
      payload: { amount, recipient },
    };
    return msg;
  }

  private async shouldProposal(
    msg: BridgeMsgErc20,
    call: SubmittableExtrinsic
  ) {
    const { source, nonce, resource } = msg;
    const maybeVote = await this.api.query.bridge.votes(msg.source, [
      msg.nonce,
      call,
    ]);
    if (maybeVote.isNone) {
      return true;
    }
    const vote = maybeVote.unwrap();
    if (vote.status.isInitiated) {
      if (
        vote.votesFor.find((v) => v.eq(this.wallet.address)) ||
        vote.votesAgainst.find((v) => v.eq(this.wallet.address))
      ) {
        srvs.logger.info("proposal voted", { source, nonce, resource });
        return false;
      }
      return true;
    } else {
      srvs.logger.info("proposal complete", { source, nonce, resource });
      return false;
    }
  }
  async sendTx(tx: SubmittableExtrinsic): Promise<void> {
    if (process.env.DRY_RUN) return;
    return new Promise((resolve, reject) => {
      tx.signAndSend(this.wallet, ({ events = [], status }) => {
        if (status.isInvalid || status.isDropped || status.isUsurped) {
          reject(new Error(`${status.type} transaction.`));
        } else {
        }

        if (status.isInBlock) {
          events.forEach(({ event: { data, method, section } }) => {
            if (section === "system" && method === "ExtrinsicFailed") {
              const [dispatchError] = data as unknown as ITuple<
                [DispatchError]
              >;
              if (dispatchError.isModule) {
                const mod = dispatchError.asModule;
                const error = this.api.registry.findMetaError(
                  new Uint8Array([mod.index.toNumber(), mod.error.toNumber()])
                );
                throw new Error(
                  `Transaction throw ${error.section}.${
                    error.name
                  }, ${error.docs.join("")}`
                );
              } else {
                throw new Error(`Transaction throw ${dispatchError.type}`);
              }
            } else if (method === "ExtrinsicSuccess") {
              resolve();
            }
          });
        } else {
        }
      }).catch((e) => {
        reject(e);
      });
    });
  }
}

async function createWallet(privateKey: string) {
  await cryptoWaitReady();
  const keyring = new Keyring();
  return keyring.addFromUri(privateKey);
}
