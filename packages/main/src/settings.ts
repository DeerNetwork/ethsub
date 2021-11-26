const settings = {
  baseDir: process.env.BASE_DIR || process.cwd(),
  dataDir: "data",
  resources: [
    {
      type: "erc20",
      name: "tok",
      eth: "0x000000000000000000000021605f71845f372A9ed84253d2D024B7B10999f400",
      sub: "0x0000000000000000000000000000009b35c2b05a300b65107a1b47a320f65f01",
    },
  ],
};

export = settings;
