import { ethers, Wallet } from "ethers";
import { Bridge } from "ethsub-sol/build/ethers/Bridge";
import { ERC20Handler } from "ethsub-sol/build/ethers/ERC20Handler";
import { ServiceOption, InitOption, INIT_KEY } from "use-services";
import { Service as StoreService } from "./store";
import { exchangeAmountDecimals, sleep } from "./utils";
import { BridgeMsg, BridgeMsgErc20, ResourceData, ResourceType } from "./types";
import { srvs } from "./services";

export type Deps = [StoreService];
export type Option<S extends Service> = ServiceOption<Args, S>;

const EventSig = {
  Deposit: "Deposit(uint8,bytes32,uint64,address,bytes,bytes)",
};

const CONTRACT_PATH = "ethsub-sol/build/contracts";

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
  maxGasPrice: number;
  minGasPrice: number;
  gasMultiplier: number;
  // The speed which a transaction should be processed: average, fast, fastest. Default: fast
  egsSpeed?: string;
  egsApiKey?: string;
  contracts: {
    bridge: string;
    erc20Handler: string;
  };
}

export async function init<S extends Service>(
  option: InitOption<Args, S>
): Promise<S> {
  const srv = new (option.ctor || Service)(option);
  await srv[INIT_KEY]();
  return srv as S;
}

export class Service {
  private provider: ethers.providers.WebSocketProvider;
  private args: Args;
  private currentBlock: number;
  private wallet: Wallet;
  private store: StoreService;
  private bridge: Bridge;
  private gasPrice: number;
  private erc20Handler: ERC20Handler;
  public constructor(option: InitOption<Args, Service>) {
    if (option.deps.length !== 1) {
      throw new Error("miss deps [store]");
    }
    this.store = option.deps[0];
    this.args = option.args;
    this.gasPrice = option.args.maxGasPrice;
  }
  public async [INIT_KEY]() {
    const { url, startBlock, privateKey, contracts } = this.args;
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
    this.currentBlock = Math.max(
      startBlock,
      await this.store.loadEthBlockNum()
    );
  }
  public async pullBlocks() {
    while (true) {
      const latestBlock = await this.provider.getBlockNumber();
      if (latestBlock - this.args.confirmBlocks - this.currentBlock <= 0) {
        await sleep(3000);
        continue;
      }
      await this.parseBlock();
      await this.store.storeEthBlockNum(this.currentBlock);
    }
  }
  public async writeChain(msg: BridgeMsg) {
    if (msg.type === ResourceType.ERC20) {
      await this.createErc20Proposal(msg);
    } else {
      throw new Error(`Write eth throw unknown msg type ${msg.type}`);
    }
  }
  private async parseBlock() {
    const blockNum = this.currentBlock;
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
      await srvs.sub.writeChain(msg);
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
    const logCtx = { source, nonce };
    try {
      srvs.logger.info(`Write erc20 propsoal`, logCtx);
      const realAmount = exchangeAmountDecimals(
        amount,
        resource.sub.decimals,
        resource.eth.decimals
      );
      const data =
        "0x" +
        ethers.utils
          .hexZeroPad(ethers.BigNumber.from(realAmount).toHexString(), 32)
          .substr(2) + // Deposit Amount        (32 bytes)
        ethers.utils
          .hexZeroPad(ethers.utils.hexlify((recipient.length - 2) / 2), 32)
          .substr(2) + // len(recipientAddress) (32 bytes)
        recipient.substr(2); // recipientAddress      (?? bytes)

      const dataHash = ethers.utils.solidityKeccak256(
        ["address", "bytes"],
        [this.erc20Handler.address, data]
      );

      let proposal = await this.getProposal(msg, dataHash);
      if (proposal._status === 3 || proposal._status === 4) {
        srvs.logger.info(`Proposal complete, skip voting`, logCtx);
        return;
      } else if (proposal._status === 0) {
        srvs.logger.info(`Proposal vote`, logCtx);
        await this.voteProposal(msg, data, dataHash);
      } else if (proposal._status === 1) {
        const voted = await this.hasVoted(msg, dataHash);
        if (voted) {
          srvs.logger.info(`Relayer has already voted`, logCtx);
          return;
        }
        await this.voteProposal(msg, data, dataHash);
        srvs.logger.info(`Proposal vote`, logCtx);
      }
      proposal = await this.getProposal(msg, dataHash);
      if (proposal._status === 2) {
        await this.executeProposal(msg, data);
        srvs.logger.info(`Proposal execute`, logCtx);
      }
    } catch (err) {
      srvs.logger.error(err, logCtx);
    }
  }

  private parseErc20(
    log: ethers.utils.LogDescription,
    resourceData: ResourceData
  ) {
    const { data, destinationDomainID, depositNonce } = log.args;
    const amount = ethers.BigNumber.from(
      ethers.utils.stripZeros(data.slice(0, 66))
    ).toString();
    const recipient = data.slice(130);
    const msg: BridgeMsg = {
      source: this.args.chainId,
      destination: destinationDomainID,
      nonce: depositNonce.toNumber(),
      type: ResourceType.ERC20,
      resource: resourceData,
      payload: { amount, recipient },
    };
    return msg;
  }

  private async waitTx(tx: ethers.ContractTransaction) {
    try {
      await tx.wait(this.args.confirmBlocks);
    } catch (err) {
      throw new Error(`Transaction ${tx.hash} throw`);
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
    const { source, nonce, resource } = msg;
    const {
      eth: { resourceId },
    } = resource;
    const tx = await this.bridge.voteProposal(source, nonce, resourceId, data, {
      gasLimit: this.args.gasLimit,
      gasPrice: this.gasPrice,
    });
    await this.waitTx(tx);
  }

  private async executeProposal(msg: BridgeMsg, data: string) {
    const { source, nonce, resource } = msg;
    const {
      eth: { resourceId },
    } = resource;
    const tx = await this.bridge.executeProposal(
      source,
      nonce,
      data,
      resourceId,
      true,
      {
        gasLimit: this.args.gasLimit,
        gasPrice: this.gasPrice,
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
}
