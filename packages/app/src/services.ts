import path from "path";
import useServices from "use-services";
import * as Winston from "@use-services/winston";
import * as Echo from "@use-services/echo";
import * as Store from "./store";
import * as Eth from "./eth";
import * as Sub from "./sub";
import {mergeJson} from "./utils";
import {ResourceData, ResourceType} from "./types";

const settings = {
  app: "ethsub",
  baseDir: process.env.BASE_DIR || process.cwd(),
  dataDir: "data",
  resources: [
    {
      type: ResourceType.ERC20,
      name: "tok",
      eth: {
        resourceId:
          "0x000000000000000000000021605f71845f372A9ed84253d2D024B7B10999f400",
        decimals: 18,
      },
      sub: {
        resourceId:
          "0x0000000000000000000000000000009b35c2b05a300b65107a1b47a320f65f01",
        decimals: 12,
      },
    },
  ] as ResourceData[],
};

const options = {
  logger: {
    init: Winston.init,
    args: {
      console: {
        level: "debug",
      },
    },
  } as Winston.Option<Winston.Service>,
  settings: {
    init: Echo.init,
    args: settings,
  } as Echo.Option<typeof settings>,
  store: {
    init: Store.init,
    args: {
      dataDir: path.resolve(settings.baseDir, "data"),
    },
  } as Store.Option<Store.Service>,
  eth: {
    init: Eth.init,
    deps: ["store"],
    args: {
      chainId: 0,
      url: "http://localhost:8545",
      confirmBlocks: 6,
      startBlock: 0,
      privateKey:
        "0x000000000000000000000000000000000000000000000000000000616c696365",
      gasLimit: 6721975,
      contracts: {
        bridge: "0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B",
        erc20Handler: "0x3167776db165D8eA0f51790CA2bbf44Db5105ADF",
      },
    },
  } as Eth.Option<Eth.Service>,
  sub: {
    init: Sub.init,
    deps: ["store"],
    args: {
      chainId: 1,
      url: "ws://localhost:9944",
      secret: "//Alice",
      startBlock: 0,
    },
  } as Sub.Option<Sub.Service>,
};

mergeJson(options, path.resolve(settings.baseDir, "config.json"));

const {srvs, init} = useServices(settings.app, options);
export {srvs, init};
