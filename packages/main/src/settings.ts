import { ResourceData, ResourceType } from "./types";

const settings = {
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
        decimals: 10,
      },
    },
  ] as ResourceData[],
};

export = settings;
