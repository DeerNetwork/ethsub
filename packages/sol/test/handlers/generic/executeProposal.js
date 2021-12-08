/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */

const TruffleAssert = require("truffle-assertions");
const Ethers = require("ethers");

const Helpers = require("../../helpers");

const BridgeContract = artifacts.require("Bridge");
const ChainAssetContract = artifacts.require("ChainAsset");
const GenericHandlerContract = artifacts.require("GenericHandler");

contract("GenericHandler - [Execute Proposal]", async (accounts) => {
  const relayerThreshold = 2;
  const domainID = 1;
  const expectedDepositNonce = 1;

  const depositerAddress = accounts[1];
  const relayer1Address = accounts[2];
  const relayer2Address = accounts[3];

  const initialRelayers = [relayer1Address, relayer2Address];

  const chainAssetMinCount = 10;
  const hashOfChainAsset = Ethers.utils.keccak256("0xc0ffee");

  let BridgeInstance;
  let ChainAssetInstance;
  let initialResourceIDs;
  let initialContractAddresses;
  let initialDepositFunctionSignatures;
  let initialDepositFunctionDepositerOffsets;
  let initialExecuteFunctionSignatures;
  let GenericHandlerInstance;
  let resourceID;
  let depositData;

  beforeEach(async () => {
    await Promise.all([
      BridgeContract.new(
        domainID,
        initialRelayers,
        relayerThreshold,
        0,
        100
      ).then((instance) => (BridgeInstance = instance)),
      ChainAssetContract.new(chainAssetMinCount).then(
        (instance) => (ChainAssetInstance = instance)
      ),
    ]);

    const chainAssetFuncSig = Helpers.getFunctionSignature(
      ChainAssetInstance,
      "store"
    );

    resourceID = Helpers.createResourceID(ChainAssetInstance.address, domainID);
    initialResourceIDs = [resourceID];
    initialContractAddresses = [ChainAssetInstance.address];
    initialDepositFunctionSignatures = [Helpers.blankFunctionSig];
    initialDepositFunctionDepositerOffsets = [
      Helpers.blankFunctionDepositerOffset,
    ];
    initialExecuteFunctionSignatures = [chainAssetFuncSig];

    GenericHandlerInstance = await GenericHandlerContract.new(
      BridgeInstance.address
    );

    await BridgeInstance.adminSetGenericResource(
      GenericHandlerInstance.address,
      resourceID,
      initialContractAddresses[0],
      initialDepositFunctionSignatures[0],
      initialDepositFunctionDepositerOffsets[0],
      initialExecuteFunctionSignatures[0]
    );

    depositData = Helpers.createGenericDepositData(hashOfChainAsset);
    depositProposalDataHash = Ethers.utils.keccak256(
      GenericHandlerInstance.address + depositData.substr(2)
    );
  });

  it("deposit can be executed successfully", async () => {
    await TruffleAssert.passes(
      BridgeInstance.deposit(domainID, resourceID, depositData, {
        from: depositerAddress,
      })
    );

    // relayer1 creates the deposit proposal
    await TruffleAssert.passes(
      BridgeInstance.voteProposal(
        domainID,
        expectedDepositNonce,
        resourceID,
        depositData,
        {from: relayer1Address}
      )
    );

    // relayer2 votes in favor of the deposit proposal
    // because the relayerThreshold is 2, the deposit proposal will go
    // into a finalized state
    // and then automatically executes the proposal
    await TruffleAssert.passes(
      BridgeInstance.voteProposal(
        domainID,
        expectedDepositNonce,
        resourceID,
        depositData,
        {from: relayer2Address}
      )
    );

    // Verifying asset was marked as stored in ChainAssetInstance
    assert.isTrue(
      await ChainAssetInstance._assetsStored.call(hashOfChainAsset)
    );
  });

  it("AssetStored event should be emitted", async () => {
    await TruffleAssert.passes(
      BridgeInstance.deposit(domainID, resourceID, depositData, {
        from: depositerAddress,
      })
    );

    // relayer1 creates the deposit proposal
    await TruffleAssert.passes(
      BridgeInstance.voteProposal(
        domainID,
        expectedDepositNonce,
        resourceID,
        depositData,
        {from: relayer1Address}
      )
    );

    // relayer2 votes in favor of the deposit proposal
    // because the relayerThreshold is 2, the deposit proposal will go
    // into a finalized state
    // and then automatically executes the proposal
    const voteWithExecuteTx = await BridgeInstance.voteProposal(
      domainID,
      expectedDepositNonce,
      resourceID,
      depositData,
      {from: relayer2Address}
    );

    const internalTx = await TruffleAssert.createTransactionResult(
      ChainAssetInstance,
      voteWithExecuteTx.tx
    );
    TruffleAssert.eventEmitted(internalTx, "AssetStored", (event) => {
      return event.asset === hashOfChainAsset;
    });

    assert.isTrue(
      await ChainAssetInstance._assetsStored.call(hashOfChainAsset),
      "Centrifuge Asset was not successfully stored"
    );
  });
});
