/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../helpers");

const BridgeContract = artifacts.require("Bridge");
const GenericHandlerContract = artifacts.require("GenericHandler");
const ChainAssetContract = artifacts.require("ChainAsset");

contract("GenericHandler - [constructor]", async () => {
  const relayerThreshold = 2;
  const domainID = 1;
  const ChainAssetMinCount = 1;
  const blankFunctionSig = "0x00000000";
  const blankFunctionDepositerOffset = 0;
  const ChainAssetFuncSig = "store(bytes32)";

  let BridgeInstance;
  let ChainAssetInstance1;
  let ChainAssetInstance2;
  let ChainAssetInstance3;
  let initialResourceIDs;
  let initialContractAddresses;
  let initialDepositFunctionSignatures;
  let initialDepositFunctionDepositerOffsets;
  let initialExecuteFunctionSignatures;

  beforeEach(async () => {
    await Promise.all([
      BridgeContract.new(domainID, [], relayerThreshold, 0, 100).then(
        (instance) => (BridgeInstance = instance)
      ),
      ChainAssetContract.new(ChainAssetMinCount).then(
        (instance) => (ChainAssetInstance1 = instance)
      ),
      ChainAssetContract.new(ChainAssetMinCount).then(
        (instance) => (ChainAssetInstance2 = instance)
      ),
      ChainAssetContract.new(ChainAssetMinCount).then(
        (instance) => (ChainAssetInstance3 = instance)
      ),
    ]);

    initialResourceIDs = [
      Helpers.createResourceID(ChainAssetInstance1.address, domainID),
      Helpers.createResourceID(ChainAssetInstance2.address, domainID),
      Helpers.createResourceID(ChainAssetInstance3.address, domainID),
    ];
    initialContractAddresses = [
      ChainAssetInstance1.address,
      ChainAssetInstance2.address,
      ChainAssetInstance3.address,
    ];

    const executeProposalFuncSig = Ethers.utils
      .keccak256(
        Ethers.utils.hexlify(Ethers.utils.toUtf8Bytes(ChainAssetFuncSig))
      )
      .substr(0, 10);

    initialDepositFunctionSignatures = [
      blankFunctionSig,
      blankFunctionSig,
      blankFunctionSig,
    ];
    initialDepositFunctionDepositerOffsets = [
      blankFunctionDepositerOffset,
      blankFunctionDepositerOffset,
      blankFunctionDepositerOffset,
    ];
    initialExecuteFunctionSignatures = [
      executeProposalFuncSig,
      executeProposalFuncSig,
      executeProposalFuncSig,
    ];
  });

  it("[sanity] contract should be deployed successfully", async () => {
    TruffleAssert.passes(
      await GenericHandlerContract.new(BridgeInstance.address)
    );
  });

  it("contract mappings were set with expected values", async () => {
    const GenericHandlerInstance = await GenericHandlerContract.new(
      BridgeInstance.address
    );

    for (let i = 0; i < initialResourceIDs.length; i++) {
      await BridgeInstance.adminSetGenericResource(
        GenericHandlerInstance.address,
        initialResourceIDs[i],
        initialContractAddresses[i],
        initialDepositFunctionSignatures[i],
        initialDepositFunctionDepositerOffsets[i],
        initialExecuteFunctionSignatures[i]
      );
    }

    for (let i = 0; i < initialResourceIDs.length; i++) {
      const retrievedTokenAddress =
        await GenericHandlerInstance._resourceIDToContractAddress.call(
          initialResourceIDs[i]
        );
      assert.strictEqual(
        initialContractAddresses[i].toLowerCase(),
        retrievedTokenAddress.toLowerCase()
      );

      const retrievedResourceID =
        await GenericHandlerInstance._contractAddressToResourceID.call(
          initialContractAddresses[i]
        );
      assert.strictEqual(
        initialResourceIDs[i].toLowerCase(),
        retrievedResourceID.toLowerCase()
      );

      const retrievedDepositFunctionSig =
        await GenericHandlerInstance._contractAddressToDepositFunctionSignature.call(
          initialContractAddresses[i]
        );
      assert.strictEqual(
        initialDepositFunctionSignatures[i].toLowerCase(),
        retrievedDepositFunctionSig.toLowerCase()
      );

      const retrievedDepositFunctionDepositerOffset =
        await GenericHandlerInstance._contractAddressToDepositFunctionDepositerOffset.call(
          initialContractAddresses[i]
        );
      assert.strictEqual(
        initialDepositFunctionDepositerOffsets[i],
        retrievedDepositFunctionDepositerOffset.toNumber()
      );

      const retrievedExecuteFunctionSig =
        await GenericHandlerInstance._contractAddressToExecuteFunctionSignature.call(
          initialContractAddresses[i]
        );
      assert.strictEqual(
        initialExecuteFunctionSignatures[i].toLowerCase(),
        retrievedExecuteFunctionSig.toLowerCase()
      );
    }
  });
});
