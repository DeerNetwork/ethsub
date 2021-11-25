### Run chains

```sh
just run-eth
just run-sub
```

## Export env vars

```sh
export CONTRACT_BRIDGE='0x62877dDCd49aD22f5eDfc6ac108e9a4b5D2bD88B'
export CONTRACT_ERC20_HANDLER='0x3167776db165D8eA0f51790CA2bbf44Db5105ADF'
export CONTRACT_GENERIC_HANDLER='0x2B6Ab4b880A45a07d83Cf4d664Df4Ab85705Bc07'
export CONTRACT_ERC20='0x21605f71845f372A9ed84253d2D024B7B10999f4'
export RESOURCE_ID_ERC20='0x000000000000000000000000000000c76ebe4a02bbc34786d860b355f5a5ce00'
```

## Setup eth chain

```sh
cb-sol-cli deploy --all --relayerThreshold 1

cb-sol-cli bridge register-resource --resourceId $RESOURCE_ID_ERC20 --targetContract $CONTRACT_ERC20

cb-sol-cli bridge set-burn --tokenContract $CONTRACT_ERC20

cb-sol-cli erc20 add-minter --minter $CONTRACT_ERC20_HANDLER
```

## Setup sub chain

```sh
sudo.call chainBridge.addRelayer Alice
sudo.call chainBridge.setResource $RESOURCE_ID_ERC20 0x4578616d706c652e7472616e73666572
sudo.call chainBridge.whitelistChain 0
```

## Run bridge

```sh
chainbridge --config config.json --testkey alice --latest
```