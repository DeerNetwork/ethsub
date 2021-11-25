/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const GenericHandlerContract = artifacts.require("GenericHandler");
const ChainAssetContract = artifacts.require("ChainAsset");
const HandlerHelpersContract = artifacts.require("HandlerHelpers");
const ERC20SafeContract = artifacts.require("ERC20Safe");

contract("Gas Benchmark - [contract deployments]", async () => {
  const domainID = 1;
  const relayerThreshold = 1;
  const ChainAssetMinCount = 1;
  const gasBenchmarks = [];

  let BridgeInstance;

  it("Should deploy all contracts and print benchmarks", async () => {
    let contractInstances = [
      await BridgeContract.new(domainID, [], relayerThreshold, 0, 100).then(
        (instance) => (BridgeInstance = instance)
      ),
    ];
    contractInstances = contractInstances.concat(
      await Promise.all([
        ERC20HandlerContract.new(BridgeInstance.address),
        GenericHandlerContract.new(BridgeInstance.address),
        ChainAssetContract.new(ChainAssetMinCount),
        HandlerHelpersContract.new(BridgeInstance.address),
        ERC20SafeContract.new(),
      ])
    );

    for (const contractInstance of contractInstances) {
      const txReceipt = await web3.eth.getTransactionReceipt(
        contractInstance.transactionHash
      );
      gasBenchmarks.push({
        type: contractInstance.constructor._json.contractName,
        gasUsed: txReceipt.gasUsed,
      });
    }

    console.table(gasBenchmarks);
  });
});
