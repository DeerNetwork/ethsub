const ethers = require("ethers");
const { Command } = require("commander");

const { setupParentArgs, log } = require("./utils");

const constants = require("../constants");

const getHashCmd = new Command("getHash")
  .description("Returns if a the given hash exists")
  .requiredOption(
    "--hash <value>",
    "A hash to lookup",
    ethers.utils.hexZeroPad("0x", 32)
  )
  .option(
    "--address <value>",
    "Chain asset store contract address",
    constants.CHAIN_ASSET_STORE_ADDRESS
  )
  .action(async function (args) {
    await setupParentArgs(args, args.parent.parent);
    const assetStore = new ethers.Contract(
      args.address,
      constants.ContractABIs.ChainAssetStore.abi,
      args.wallet
    );
    const res = await assetStore._assetsStored(
      ethers.utils.hexZeroPad(args.hash, 32)
    );
    log(args, `The hash ${args.hash} was ${res ? "found!" : "NOT found!"}`);
  });

const assetCmd = new Command("asset");

assetCmd.addCommand(getHashCmd);

module.exports = assetCmd;
