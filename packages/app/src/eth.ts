import {ethers, Wallet} from "ethers";
import {Bridge} from "@ethsub/sol/build/ethers/Bridge";
import {ERC20Handler} from "@ethsub/sol/build/ethers/ERC20Handler";
import {
  ServiceOption,
  InitOption,
  INIT_KEY,
  STOP_KEY,
  createInitFn,
} from "use-services";
import {Service as StoreService} from "./store";
import {exchangeAmount, sleep} from "./utils";
import {
  BridgeMsg,
  BridgeMsgErc20,
  BridgeMsgStatus,
  ResourceData,
  ResourceType,
} from "./types";
import {srvs} from "./services";

export type Option<S extends Service> = ServiceOption<Args, S>;

export type Deps = [StoreService];

const EventSig = {
  Deposit: "Deposit(uint8,bytes32,uint64,address,bytes,bytes)",
};

const {BigNumber} = ethers;

const CONTRACT_PATH = "@ethsub/sol/build/contracts";

const ContractABIs = {
  Bridge: require(CONTRACT_PATH + "/Bridge.json"),
  Erc20Handler: require(CONTRACT_PATH + "/ERC20Handler.json"),
};

export interface Args {
  chainId: number;
  url: string;
  confirmBlocks: number;
  startBlock: number;
  privateKey: string;
  gasLimit: number;
  contracts: {
    bridge: string;
    erc20Handler: string;
  };
}

export class Service {
  public chainId: number;

  private provider: ethers.providers.Provider;
  private args: Args;
  private latestBlockNum: number;
  private currentBlockNum: number;
  private wallet: Wallet;
  private store: StoreService;
  private bridge: Bridge;
  private gasOpts: Partial<ethers.providers.FeeData>;
  private erc20Handler: ERC20Handler;
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
    const {url, startBlock, privateKey, contracts} = this.args;
    this.provider = new ethers.providers.WebSocketProvider(url);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.bridge = new ethers.Contract(
      contracts.bridge,
      ContractABIs.Bridge.abi,
      this.wallet
    ) as Bridge;
    this.erc20Handler = new ethers.Contract(
      contracts.erc20Handler,
      ContractABIs.Erc20Handler.abi,
      this.wallet
    ) as ERC20Handler;
    this.currentBlockNum = Math.max(
      startBlock,
      await this.store.loadEthBlockNum()
    );
    this.latestBlockNum = 0;
  }

  public async [STOP_KEY]() {
    this.destoryed = true;
  }

  public async pullBlocks() {
    this.subscribeLatestBlock();
    while (true) {
      if (this.destoryed) break;
      const confirmBlockNum = this.latestBlockNum - this.args.confirmBlocks;
      if (this.currentBlockNum >= confirmBlockNum) {
        await sleep(2500);
        continue;
      }
      await this.parseBlock();
      await this.store.storeEthBlockNum(this.currentBlockNum);
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
    const {source, nonce} = msg;
    const logCtx = {source, nonce};
    try {
      let proposalData: ProposalData;
      if (msg.type === ResourceType.ERC20) {
        proposalData = this.createErc20Data(msg);
      } else {
        throw new Error(`Write eth throw unknown msg type ${msg.type}`);
      }
      const {data, dataHash} = proposalData;
      let proposal = await this.getProposal(msg, dataHash);
      if (proposal._status === 3 || proposal._status === 4) {
        srvs.logger.info(`Proposal completed, skip voting`, logCtx);
        return true;
      } else if (proposal._status === 0) {
        await this.voteProposal(msg, data, dataHash);
        srvs.logger.info(`Proposal vote`, logCtx);
      } else if (proposal._status === 1) {
        const voted = await this.hasVoted(msg, dataHash);
        if (voted) {
          srvs.logger.info(`Proposal voted`, logCtx);
          return true;
        }
        await this.voteProposal(msg, data, dataHash);
        srvs.logger.info(`Proposal vote`, logCtx);
      }
      proposal = await this.getProposal(msg, dataHash);
      if (proposal._status === 2) {
        await this.executeProposal(msg, data);
        srvs.logger.info(`Proposal execute`, logCtx);
      }
      return true;
    } catch (err) {
      srvs.logger.error(err, logCtx);
      return false;
    }
  }

  private async subscribeLatestBlock() {
    while (true) {
      if (this.destoryed) break;
      const latestBlockNum = await this.provider.getBlockNumber();
      if (latestBlockNum > this.latestBlockNum) {
        this.latestBlockNum = latestBlockNum;
        const {gasPrice, maxFeePerGas, maxPriorityFeePerGas} =
          await this.provider.getFeeData();
        if (maxFeePerGas) {
          this.gasOpts = {maxFeePerGas, maxPriorityFeePerGas};
        } else {
          this.gasOpts = {gasPrice};
        }
      } else {
        await sleep(2500);
      }
    }
  }

  private async parseBlock() {
    const blockNum = this.currentBlockNum;
    srvs.logger.debug(`Parse eth block ${blockNum}`);
    const logs = await this.provider.getLogs({
      fromBlock: blockNum,
      toBlock: blockNum,
      address: this.bridge.address,
      topics: [ethers.utils.id(EventSig.Deposit)],
    });
    for (const log of logs) {
      const logDesc = this.bridge.interface.parseLog(log);
      const resourceIdData = srvs.settings.resources.find(
        (v) => v.eth.resourceId.toLowerCase() === logDesc.args.resourceID
      );
      if (!resourceIdData) continue;
      let msg: BridgeMsg;
      if (resourceIdData.type === ResourceType.ERC20) {
        msg = this.parseErc20(logDesc, resourceIdData);
      } else {
        continue;
      }
      await srvs.store.storeMsg(msg);
    }
    this.currentBlockNum += 1;
  }

  private createErc20Data(msg: BridgeMsgErc20): ProposalData {
    const {
      source,
      nonce,
      resource,
      payload: {recipient, amount},
    } = msg;
    srvs.logger.info(`Write erc20 propsoal`, {source, nonce});
    const realAmount = exchangeAmount(
      amount,
      resource.sub.decimals,
      resource.eth.decimals
    );
    const data =
      "0x" +
      ethers.utils
        .hexZeroPad(BigNumber.from(realAmount).toHexString(), 32)
        .substr(2) + // Deposit Amount        (32 bytes)
      ethers.utils
        .hexZeroPad(ethers.utils.hexlify((recipient.length - 2) / 2), 32)
        .substr(2) + // len(recipientAddress) (32 bytes)
      recipient.substr(2); // recipientAddress      (?? bytes)

    const dataHash = ethers.utils.solidityKeccak256(
      ["address", "bytes"],
      [this.erc20Handler.address, data]
    );
    return {data, dataHash};
  }

  private parseErc20(
    log: ethers.utils.LogDescription,
    resourceData: ResourceData
  ) {
    const {data, destinationDomainID, depositNonce} = log.args;
    const amount = BigNumber.from(
      ethers.utils.stripZeros(data.slice(0, 66))
    ).toString();
    const recipient = data.slice(130);
    const msg: BridgeMsg = {
      source: this.args.chainId,
      destination: destinationDomainID,
      nonce: depositNonce.toNumber(),
      type: ResourceType.ERC20,
      resource: resourceData,
      payload: {amount, recipient},
    };
    return msg;
  }

  private async waitTx(tx: ethers.ContractTransaction) {
    try {
      await tx.wait(this.args.confirmBlocks);
    } catch (err) {
      const reason = await this.revertReason(tx);
      if (/proposal already executed\/cancelled/.test(reason)) {
        return;
      }
      throw new Error(`Transaction ${tx.hash} throws ${reason}`);
    }
  }

  private async hasVoted(msg: BridgeMsg, dataHash: string) {
    return this.bridge._hasVotedOnProposal(
      this.idAndNonce(msg),
      dataHash,
      this.wallet.address
    );
  }

  private async voteProposal(msg: BridgeMsg, data: string, dataHash: string) {
    const {source, nonce, resource} = msg;
    const {
      eth: {resourceId},
    } = resource;
    const tx = await this.bridge.voteProposal(source, nonce, resourceId, data, {
      gasLimit: this.args.gasLimit,
      ...this.gasOpts,
    });
    await this.waitTx(tx);
  }

  private async executeProposal(msg: BridgeMsg, data: string) {
    const {source, nonce, resource} = msg;
    const {
      eth: {resourceId},
    } = resource;
    const tx = await this.bridge.executeProposal(
      source,
      nonce,
      data,
      resourceId,
      true,
      {
        gasLimit: this.args.gasLimit,
        ...this.gasOpts,
      }
    );
    await this.waitTx(tx);
  }

  private getProposal(msg: BridgeMsg, dataHash: string) {
    return this.bridge.getProposal(msg.source, msg.nonce, dataHash);
  }

  private idAndNonce(msg: BridgeMsg) {
    return (msg.nonce << 8) + msg.source;
  }

  private async revertReason(tx: ethers.ContractTransaction) {
    try {
      if (tx.maxFeePerGas) delete tx.gasPrice;
      const code = await this.provider.call(tx, tx.blockNumber);
      return ethers.utils.toUtf8String("0x" + code.substr(138));
    } catch (err) {
      let reason = err.error?.message;
      if (reason) reason = reason.replace("execution reverted: ", "");
      return reason;
    }
  }
}

export const init = createInitFn(Service);

interface ProposalData {
  data: string;
  dataHash: string;
}
