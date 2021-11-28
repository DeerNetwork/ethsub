import { ApiPromise, WsProvider } from "@polkadot/api";
import { AugmentedSubmittable } from "@polkadot/api/types";
import { ITuple } from "@polkadot/types/types";
import { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import { Keyring } from "@polkadot/keyring";
import { KeyringPair } from "@polkadot/keyring/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { DispatchError, Event } from "@polkadot/types/interfaces";
import _ from "lodash";
import { ServiceOption, InitOption, INIT_KEY, STOP_KEY } from "use-services";
import { Service as StoreService } from "./store";
import { exchangeAmount, sleep } from "./utils";
import {
  BridgeMsg,
  ResourceType,
  BridgeMsgErc20,
  ResourceData,
  BridgeMsgStatus,
} from "./types";
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
  public chainId: number;

  private api: ApiPromise;
  private args: Args;
  private currentBlock: number;
  private store: StoreService;
  private wallet: KeyringPair;
  private destoryed = false;

  public constructor(option: InitOption<Args, Service>) {
    if (option.deps.length !== 1) {
      throw new Error("miss deps [store]");
    }
    this.store = option.deps[0];
    this.args = option.args;
    this.chainId = this.args.chainId;
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

  public async [STOP_KEY]() {
    this.destoryed = true;
  }

  public async pullBlocks() {
    while (true) {
      if (this.destoryed) break;
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

  public async pullMsgs(source: number) {
    while (true) {
      if (this.destoryed) break;
      const msg = await this.store.nextMsg(source, this.chainId);
      if (!msg) {
        await sleep(3000);
        continue;
      }
      const ok = await this.writeChain(msg);
      if (ok) {
        await srvs.store.storeMsgStatus(msg, BridgeMsgStatus.Success);
      } else {
        await srvs.store.storeMsgStatus(msg, BridgeMsgStatus.Fail);
      }
    }
  }

  private async writeChain(msg: BridgeMsg) {
    const { source, nonce, resource } = msg;
    const logCtx = { source, nonce };
    try {
      const {
        sub: { resourceId },
      } = resource;
      const maybeMethod = (await this.api.query.bridge.resources(
        resourceId
      )) as any;
      if (maybeMethod.isNone) {
        throw new Error(`Write sub throw invalid resource ${resource.name}`);
      }
      const method = maybeMethod.unwrap().toUtf8();
      let callData: SubmittableExtrinsic;
      if (msg.type === ResourceType.ERC20) {
        callData = this.createErc20Call(msg, method);
      } else {
        throw new Error(`Write sub throw unknown msg type ${msg.type}`);
      }
      const should = await this.shouldProposal(msg, callData);
      if (!should) {
        return true;
      }
      await this.sendTx(
        this.api.tx.bridge.acknowledgeProposal(
          nonce,
          source,
          resourceId,
          callData
        )
      );
      srvs.logger.info(`Proposal acknowledge`, logCtx);
      return true;
    } catch (err) {
      srvs.logger.error(err, logCtx);
      return false;
    }
  }

  private async parseBlock() {
    const blockNum = this.currentBlock;
    const blockHash = await this.api.rpc.chain.getBlockHash(blockNum);
    srvs.logger.debug(`Parse sub block ${blockNum}`);
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
      await srvs.store.storeMsg(msg);
    }
    this.currentBlock += 1;
  }

  private createErc20Call(msg: BridgeMsgErc20, method: string) {
    const {
      source,
      nonce,
      resource,
      payload: { recipient, amount },
    } = msg;
    srvs.logger.info(`Write erc20 propsoal`, { source, nonce });
    const realAmount = exchangeAmount(
      amount,
      resource.eth.decimals,
      resource.sub.decimals
    );
    const fn: AugmentedSubmittable<(...args: any[]) => SubmittableExtrinsic> =
      _.get(this.api.tx, method) as any;
    if (!fn || fn.meta.args.length !== 3) {
      `Resource ${resource.name} with invalid method ${method}`;
    }
    return fn("0x" + recipient, realAmount, resource.sub.resourceId);
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
    const { source, nonce } = msg;
    const maybeVote = (await this.api.query.bridge.votes(msg.source, [
      msg.nonce,
      call,
    ])) as any;
    if (maybeVote.isNone) {
      return true;
    }
    const vote = maybeVote.unwrap();
    if (vote.status.isInitiated) {
      if (
        vote.votesFor.find((v) => v.eq(this.wallet.address)) ||
        vote.votesAgainst.find((v) => v.eq(this.wallet.address))
      ) {
        srvs.logger.info("Proposal voted", { source, nonce });
        return false;
      }
      return true;
    } else {
      srvs.logger.info("Proposal completed", { source, nonce });
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
  const keyring = new Keyring({ type: "sr25519" });
  return keyring.addFromUri(privateKey);
}
