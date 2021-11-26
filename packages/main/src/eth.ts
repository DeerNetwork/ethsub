import { ethers, Wallet } from "ethers";
import { Bridge } from "./contracts/Bridge";
import { ERC20Handler } from "./contracts/ERC20Handler";
import { logger, sleep } from "./utils";
import { BridgeMsg, ResourceIdConfig } from "./bridge";
import store from "./store";

const EventSig = {
  Deposit: "Deposit(uint8,bytes32,uint64,address,bytes,bytes)",
};

const CONTRACT_PATH = "ethsub-sol/build/contracts";

const ContractABIs = {
  Bridge: require(CONTRACT_PATH + "/Bridge.json"),
  Erc20Handler: require(CONTRACT_PATH + "/ERC20Handler.json"),
};

export interface EthConfig {
  chainId: number;
  url: string;
  confirmBlocks: number;
  startBlock: number;
  privateKey: string;
  contracts: {
    bridge: string;
    erc20Handler: string;
  };
  resourceIds: ResourceIdConfig[];
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
        await sleep(2000);
        continue;
      }
      await this.parseBlock();
      await store.storeEthBlockNum(this.currentBlock);
    }
  }
  public async writeMsg(msg: BridgeMsg) {
    if (msg.type === "erc20") {
    } else if (msg.type === "generic") {
    } else {
      throw new Error(`Write eth throw unknown msg type ${msg.type}`);
    }
  }
  private async parseBlock() {
    const blockNum = this.currentBlock;
    logger.debug(`Parse eth block ${blockNum}`);
    const logs = await this.provider.getLogs({
      fromBlock: blockNum,
      toBlock: blockNum,
      address: this.bridge.address,
      topics: [ethers.utils.id(EventSig.Deposit)],
    });
    for (const log of logs) {
      const logDesc = this.bridge.interface.parseLog(log);
      const resourceIdData = this.config.resourceIds.find(
        (v) => v.value.toLowerCase() === logDesc.args.resourceID
      );
      if (!resourceIdData) continue;
      const msg: BridgeMsg = {
        source: this.config.chainId,
        destination: logDesc.args.destinationDomainID,
        depositNonce: logDesc.args.depositNonce.toString(),
        type: resourceIdData.type,
        resourceName: resourceIdData.name,
        resourceId: resourceIdData.value,
        payload: parseDepositErc20(logDesc.args.data),
      };
      console.log(msg);
    }
    this.currentBlock += 1;
  }
}

function parseDepositErc20(data: string) {
  const amount = ethers.BigNumber.from(
    ethers.utils.stripZeros(data.slice(0, 66))
  ).toString();
  const recipent = data.slice(130);
  return { recipent, amount };
}
