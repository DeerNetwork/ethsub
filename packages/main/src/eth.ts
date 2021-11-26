import { ethers, Wallet } from "ethers";
import { Bridge } from "./contracts/Bridge";
import { ERC20Handler } from "./contracts/ERC20Handler";
import { logger, sleep } from "./utils";
import { BridgeMsg, BridgeMsgType } from "./bridge";
import store from "./store";

const EventSig = {
  Deposit: "Deposit(uint8,bytes32,uint64)",
  ProposalEvent: "ProposalEvent(uint8,uint64,uint8,bytes32,bytes32)",
  ProposalVote: "ProposalVote(uint8,uint64,uint8,bytes32)",
};

const CONTRACT_PATH = "ethsub-solidity/build/contracts";

const ContractABIs = {
  Bridge: require(CONTRACT_PATH + "/Bridge.json"),
  Erc20Handler: require(CONTRACT_PATH + "/ERC20Handler.json"),
};

export interface EthConfig {
  url: string;
  confirmBlocks: number;
  startBlock: number;
  privateKey: string;
  contracts: {
    bridge: string;
    erc20Handler: string;
  };
}

export default class Eth {
  private provider: ethers.providers.WebSocketProvider;
  private config: EthConfig;
  private currentBlock: number;
  private wallet: Wallet;
  private bridge: Bridge;
  private erc20Handler: ERC20Handler;
  public static async init(config: EthConfig) {
    const eth = new Eth();
    eth.config = config;
    eth.provider = new ethers.providers.WebSocketProvider(config.url);
    eth.wallet = new ethers.Wallet(config.privateKey, eth.provider);
    eth.bridge = new ethers.Contract(
      config.contracts.bridge,
      ContractABIs.Bridge.abi,
      eth.wallet
    ) as Bridge;
    eth.erc20Handler = new ethers.Contract(
      config.contracts.erc20Handler,
      ContractABIs.Erc20Handler.abi,
      eth.wallet
    ) as ERC20Handler;
    eth.currentBlock = Math.max(
      config.startBlock,
      await store.loadEthBlockNum()
    );
    return eth;
  }
  public async pullBlocks() {
    while (true) {
      const latestBlock = await this.provider.getBlockNumber();
      if (latestBlock - this.config.confirmBlocks - this.currentBlock <= 0) {
        await sleep(6100);
      }
      await this.getMsgs();
      await store.storeEthBlockNum(this.currentBlock);
    }
  }
  public async writeMsg(msg: BridgeMsg) {
    if (msg.type === BridgeMsgType.FungibleTransfer) {
    } else if (msg.type === BridgeMsgType.GenericTransfer) {
    } else {
      throw new Error(`Writechain throw unknown msg type ${msg.type}`);
    }
  }
  private async getMsgs() {
    const blockNum = this.currentBlock;
    logger.debug(`Querying eth block ${blockNum} for deposit events`);
    const logs = await this.provider.getLogs({
      fromBlock: blockNum,
      toBlock: blockNum,
      address: this.bridge.address,
      topics: [ethers.utils.id(EventSig.Deposit)],
    });
    for (const log of logs) {
      console.log(JSON.stringify(log));
    }
    this.currentBlock += 1;
  }
}
