import { ethers, Wallet } from "ethers";
import { logger, sleep } from "./utils";

export const CONTRACT_PATH = "../solidity/build/contracts";

const ContractABIs = {
  Bridge: require(CONTRACT_PATH + "/Bridge.json"),
  Erc20Handler: require(CONTRACT_PATH + "/ERC20Handler.json"),
};

export interface EthConfig {
  url: string;
  confirmBlocks: number;
  startBlock: number;
  privateKey: string;
  blockstoreFile: string;
  contracts: {
    bridge: string;
    erc20Handler: string;
  };
}

class Eth {
  private provider: ethers.providers.WebSocketProvider;
  private config: EthConfig;
  private currentBlock: number;
  private wallet: Wallet;
  public static async init(config: EthConfig) {
    const eth = new Eth();
    eth.config = config;
    eth.provider = new ethers.providers.WebSocketProvider(config.url);
    eth.wallet = new ethers.Wallet(config.privateKey, eth.provider);
    return eth;
  }
  public async listen() {
    while (true) {
      const latestBlock = await this.provider.getBlockNumber();
      if (latestBlock - this.config.confirmBlocks - this.currentBlock <= 0) {
        await sleep(6100);
      }
      console.log(latestBlock);
      await sleep(3100);
      const newBlock = this.currentBlock + 1;
    }
  }
  async processBlock(blockNum: number) {
    logger.debug(`Process block ${blockNum}`);
  }
}

export default Eth;
