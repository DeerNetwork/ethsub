import path from "path";
import { ethers, Wallet } from "ethers";
import { Bridge } from "./contracts/Bridge";
import { ERC20Handler } from "./contracts/ERC20Handler";
import { loadJsonValue, logger, sleep } from "./utils";

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
  private bridge: Bridge;
  private erc20Handler: ERC20Handler;
  public static async init(config: EthConfig) {
    const eth = new Eth();
    eth.config = config;
    eth.provider = new ethers.providers.WebSocketProvider(config.url);
    eth.wallet = new ethers.Wallet(config.privateKey, eth.provider);
    eth.bridge = new ethers.Contract(
      config.contracts.bridge,
      (await loadContractAbi("Bridge")).abi,
      eth.wallet
    ) as Bridge;
    eth.erc20Handler = new ethers.Contract(
      config.contracts.erc20Handler,
      (await loadContractAbi("ERC20Handler")).abi,
      eth.wallet
    ) as ERC20Handler;
    return eth;
  }
  public async listen() {
    while (true) {
      const latestBlock = await this.provider.getBlockNumber();
      if (latestBlock - this.config.confirmBlocks - this.currentBlock <= 0) {
        await sleep(6100);
      }
      await this.processBlock();
    }
  }
  async processBlock() {
    const blockNum = this.currentBlock;
    await sleep(2);
    logger.debug(`Process block ${blockNum}`);
    this.currentBlock += 1;
  }
}

async function loadContractAbi(name: string) {
  return loadJsonValue(
    path.resolve(__dirname, "../../solidity/build/contracts", `${name}.json`)
  );
}
export default Eth;
