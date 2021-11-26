import { ethers, Wallet } from "ethers";
import { Bridge } from "ethsub-sol/build/ethers/Bridge";
import { ERC20Handler } from "ethsub-sol/build/ethers/ERC20Handler";
import { ServiceOption, InitOption, INIT_KEY } from "use-services";
import { Service as StoreService } from "./store";
import { sleep, BridgeMsg } from "./utils";
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
  private bridge: Bridge;
  private store: StoreService;
  private erc20Handler: ERC20Handler;
  public constructor(option: InitOption<Args, Service>) {
    if (option.deps.length !== 1) {
      throw new Error("miss deps [store]");
    }
    this.store = option.deps[0];
    this.args = option.args;
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
  public async writeMsg(msg: BridgeMsg) {
    if (msg.type === "erc20") {
    } else if (msg.type === "generic") {
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
        (v) => v.eth.toLowerCase() === logDesc.args.resourceID
      );
      if (!resourceIdData) continue;
      const msg: BridgeMsg = {
        source: this.args.chainId,
        destination: logDesc.args.destinationDomainID,
        depositNonce: logDesc.args.depositNonce.toNumber(),
        type: resourceIdData.type,
        resource: resourceIdData.name,
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
  return { amount, recipent };
}
