/**
 * Copyright 2020 ChainSafe Systems
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const Ethers = require("ethers");

const Helpers = require("../helpers");

const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const GenericHandlerContract = artifacts.require("GenericHandler");
const ChainAssetContract = artifacts.require("ChainAsset");
const NoArgumentContract = artifacts.require("NoArgument");
const OneArgumentContract = artifacts.require("OneArgument");
const TwoArgumentsContract = artifacts.require("TwoArguments");
const ThreeArgumentsContract = artifacts.require("ThreeArguments");

contract("Gas Benchmark - [Execute Proposal]", async (accounts) => {
  const domainID = 1;
  const relayerThreshold = 1;
  const relayerAddress = accounts[0];
  const depositerAddress = accounts[1];
  const recipientAddress = accounts[2];
  const lenRecipientAddress = 20;
  const gasBenchmarks = [];

  const initialRelayers = [relayerAddress];
  const erc20TokenAmount = 100;

  let BridgeInstance;
  let ERC20MintableInstance;
  let ERC20HandlerInstance;
  let ChainAssetInstance;
  let NoArgumentInstance;
  let OneArgumentInstance;
  let TwoArgumentsInstance;
  let ThreeArgumentsInstance;

  let erc20ResourceID;
  let ChainAssetResourceID;
  let noArgumentResourceID;
  let oneArgumentResourceID;
  let twoArgumentsResourceID;
  let threeArgumentsResourceID;

  const deposit = (resourceID, depositData) =>
    BridgeInstance.deposit(domainID, resourceID, depositData, {
      from: depositerAddress,
    });
  const vote = (resourceID, depositNonce, depositData) =>
    BridgeInstance.voteProposal(
      domainID,
      depositNonce,
      resourceID,
      depositData,
      { from: relayerAddress }
    );
  const execute = (depositNonce, depositData, resourceID) =>
    BridgeInstance.executeProposal(
      domainID,
      depositNonce,
      depositData,
      resourceID,
      true
    );

  before(async () => {
    await Promise.all([
      BridgeContract.new(
        domainID,
        initialRelayers,
        relayerThreshold,
        0,
        100
      ).then((instance) => (BridgeInstance = instance)),
      ERC20MintableContract.new("token", "TOK").then(
        (instance) => (ERC20MintableInstance = instance)
      ),
      ChainAssetContract.new().then(
        (instance) => (ChainAssetInstance = instance)
      ),
      NoArgumentContract.new().then(
        (instance) => (NoArgumentInstance = instance)
      ),
      OneArgumentContract.new().then(
        (instance) => (OneArgumentInstance = instance)
      ),
      TwoArgumentsContract.new().then(
        (instance) => (TwoArgumentsInstance = instance)
      ),
      ThreeArgumentsContract.new().then(
        (instance) => (ThreeArgumentsInstance = instance)
      ),
    ]);

    erc20ResourceID = Helpers.createResourceID(
      ERC20MintableInstance.address,
      domainID
    );
    ChainAssetResourceID = Helpers.createResourceID(
      ChainAssetInstance.address,
      domainID
    );
    noArgumentResourceID = Helpers.createResourceID(
      NoArgumentInstance.address,
      domainID
    );
    oneArgumentResourceID = Helpers.createResourceID(
      OneArgumentInstance.address,
      domainID
    );
    twoArgumentsResourceID = Helpers.createResourceID(
      TwoArgumentsInstance.address,
      domainID
    );
    threeArgumentsResourceID = Helpers.createResourceID(
      ThreeArgumentsInstance.address,
      domainID
    );

    const genericInitialContractAddresses = (initialContractAddresses = [
      ChainAssetInstance.address,
      NoArgumentInstance.address,
      OneArgumentInstance.address,
      TwoArgumentsInstance.address,
      ThreeArgumentsInstance.address,
    ]);
    const genericInitialDepositFunctionSignatures = [
      Helpers.blankFunctionSig,
      Helpers.getFunctionSignature(NoArgumentInstance, "noArgument"),
      Helpers.getFunctionSignature(OneArgumentInstance, "oneArgument"),
      Helpers.getFunctionSignature(TwoArgumentsInstance, "twoArguments"),
      Helpers.getFunctionSignature(ThreeArgumentsInstance, "threeArguments"),
    ];
    const genericInitialDepositFunctionDepositerOffsets = [
      Helpers.blankFunctionDepositerOffset,
      Helpers.blankFunctionDepositerOffset,
      Helpers.blankFunctionDepositerOffset,
      Helpers.blankFunctionDepositerOffset,
      Helpers.blankFunctionDepositerOffset,
    ];
    const genericInitialExecuteFunctionSignatures = [
      Helpers.getFunctionSignature(ChainAssetInstance, "store"),
      Helpers.blankFunctionSig,
      Helpers.blankFunctionSig,
      Helpers.blankFunctionSig,
      Helpers.blankFunctionSig,
    ];

    await Promise.all([
      ERC20HandlerContract.new(BridgeInstance.address).then(
        (instance) => (ERC20HandlerInstance = instance)
      ),
      ERC20MintableInstance.mint(depositerAddress, erc20TokenAmount),
      (GenericHandlerInstance = await GenericHandlerContract.new(
        BridgeInstance.address
      )),
    ]);

    await Promise.all([
      ERC20MintableInstance.approve(
        ERC20HandlerInstance.address,
        erc20TokenAmount,
        { from: depositerAddress }
      ),
      BridgeInstance.adminSetResource(
        ERC20HandlerInstance.address,
        erc20ResourceID,
        ERC20MintableInstance.address
      ),
      BridgeInstance.adminSetGenericResource(
        GenericHandlerInstance.address,
        ChainAssetResourceID,
        genericInitialContractAddresses[0],
        genericInitialDepositFunctionSignatures[0],
        genericInitialDepositFunctionDepositerOffsets[0],
        genericInitialExecuteFunctionSignatures[0]
      ),
      BridgeInstance.adminSetGenericResource(
        GenericHandlerInstance.address,
        noArgumentResourceID,
        genericInitialContractAddresses[1],
        genericInitialDepositFunctionSignatures[1],
        genericInitialDepositFunctionDepositerOffsets[1],
        genericInitialExecuteFunctionSignatures[1]
      ),
      BridgeInstance.adminSetGenericResource(
        GenericHandlerInstance.address,
        oneArgumentResourceID,
        genericInitialContractAddresses[2],
        genericInitialDepositFunctionSignatures[2],
        genericInitialDepositFunctionDepositerOffsets[2],
        genericInitialExecuteFunctionSignatures[2]
      ),
      BridgeInstance.adminSetGenericResource(
        GenericHandlerInstance.address,
        twoArgumentsResourceID,
        genericInitialContractAddresses[3],
        genericInitialDepositFunctionSignatures[3],
        genericInitialDepositFunctionDepositerOffsets[3],
        genericInitialExecuteFunctionSignatures[3]
      ),
      BridgeInstance.adminSetGenericResource(
        GenericHandlerInstance.address,
        threeArgumentsResourceID,
        genericInitialContractAddresses[4],
        genericInitialDepositFunctionSignatures[4],
        genericInitialDepositFunctionDepositerOffsets[4],
        genericInitialExecuteFunctionSignatures[4]
      ),
    ]);
  });

  it("Should execute ERC20 deposit proposal", async () => {
    const depositNonce = 1;
    const depositData = Helpers.createERCDepositData(
      erc20TokenAmount,
      lenRecipientAddress,
      recipientAddress
    );

    await deposit(erc20ResourceID, depositData);
    const voteWithExecuteTx = await vote(
      erc20ResourceID,
      depositNonce,
      depositData,
      relayerAddress
    );

    gasBenchmarks.push({
      type: "ERC20",
      gasUsed: voteWithExecuteTx.receipt.gasUsed,
    });
  });

  it("Should execute Generic deposit proposal - Chain asset", async () => {
    const depositNonce = 4;
    const hashOfChainAsset = Ethers.utils.keccak256("0xc0ffee");
    const depositData = Helpers.createGenericDepositData(hashOfChainAsset);

    await deposit(ChainAssetResourceID, depositData);
    const voteWithExecuteTx = await vote(
      ChainAssetResourceID,
      depositNonce,
      depositData,
      relayerAddress
    );

    gasBenchmarks.push({
      type: "Generic - Chain Asset",
      gasUsed: voteWithExecuteTx.receipt.gasUsed,
    });
  });

  it("Should execute Generic deposit proposal - No Argument", async () => {
    const depositNonce = 5;
    const depositData = Helpers.createGenericDepositData(null);

    await deposit(noArgumentResourceID, depositData);
    const voteWithExecuteTx = await vote(
      noArgumentResourceID,
      depositNonce,
      depositData,
      relayerAddress
    );

    gasBenchmarks.push({
      type: "Generic - No Argument",
      gasUsed: voteWithExecuteTx.receipt.gasUsed,
    });
  });

  it("Should make Generic deposit - One Argument", async () => {
    const depositNonce = 6;
    const depositData = Helpers.createGenericDepositData(Helpers.toHex(42, 32));

    await deposit(oneArgumentResourceID, depositData);
    const voteWithExecuteTx = await vote(
      oneArgumentResourceID,
      depositNonce,
      depositData,
      relayerAddress
    );

    gasBenchmarks.push({
      type: "Generic - One Argument",
      gasUsed: voteWithExecuteTx.receipt.gasUsed,
    });
  });

  it("Should make Generic deposit - Two Arguments", async () => {
    const depositNonce = 7;
    const argumentOne = [
      NoArgumentInstance.address,
      OneArgumentInstance.address,
      TwoArgumentsInstance.address,
    ];
    const argumentTwo = Helpers.getFunctionSignature(
      ChainAssetInstance,
      "store"
    );
    const encodedMetaData = Helpers.abiEncode(
      ["address[]", "bytes4"],
      [argumentOne, argumentTwo]
    );
    const depositData = Helpers.createGenericDepositData(encodedMetaData);

    await deposit(twoArgumentsResourceID, depositData);
    const voteWithExecuteTx = await vote(
      twoArgumentsResourceID,
      depositNonce,
      depositData,
      relayerAddress
    );

    gasBenchmarks.push({
      type: "Generic - Two Argument",
      gasUsed: voteWithExecuteTx.receipt.gasUsed,
    });
  });

  it("Should make Generic deposit - Three Arguments", async () => {
    const depositNonce = 8;
    const argumentOne = "soylentGreenIsPeople";
    const argumentTwo = -42;
    const argumentThree = true;
    const encodedMetaData = Helpers.abiEncode(
      ["string", "int8", "bool"],
      [argumentOne, argumentTwo, argumentThree]
    );
    const depositData = Helpers.createGenericDepositData(encodedMetaData);

    await deposit(threeArgumentsResourceID, depositData);
    const voteWithExecuteTx = await vote(
      threeArgumentsResourceID,
      depositNonce,
      depositData,
      relayerAddress
    );

    gasBenchmarks.push({
      type: "Generic - Three Argument",
      gasUsed: voteWithExecuteTx.receipt.gasUsed,
    });
  });

  it("Should print out benchmarks", () => console.table(gasBenchmarks));
});
