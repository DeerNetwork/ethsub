sol-cli *args:
    -node packages/sol-cli/index.js {{args}}

sub-cli *args:
    -node packages/sub-cli/index.js {{args}}

run:
    pnpm run --filter ./packages/main dev

run-eth:
    ganache-cli \
        -b 3 \
        -l 8000000 \
        --account "0x000000000000000000000000000000000000000000000000000000616c696365,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000626f62,100000000000000000000" \
        --account "0x00000000000000000000000000000000000000000000000000636861726c6965,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000064617665,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000657665,100000000000000000000"

run-sub:
    sub-node \
        --dev \
        --tmp \
        --port 30333 \
        --ws-port 9944 \
        --rpc-port 9933 \
        --rpc-methods Unsafe \
        --unsafe-rpc-external \
        --rpc-cors all \
        --unsafe-ws-external

setup-eth:
    just sol-cli deploy --all --relayerThreshold 1
    just sol-cli bridge register-resource --resourceId $ERC20_RESOURCEID --targetContract $CONTRACT_ERC20
    just sol-cli bridge set-burn --tokenContract $CONTRACT_ERC20
    just sol-cli erc20 add-minter --minter $CONTRACT_ERC20_HANDLER

setup-sub:
    just sub-cli --sudo bridge.addRelayer Alice
    just sub-cli --sudo bridge.setResource $ERC20_RESOURCEID $PALLET_METHOD_TRANSFER
    just sub-cli --sudo bridge.whitelistChain 0

transfer-eth:
    just sol-cli erc20 mint --amount 1000
    just sol-cli erc20 approve --amount 1000 --recipient $CONTRACT_ERC20_HANDLER 
    just sol-cli erc20 deposit --amount 1 --dest 1 --recipient $SUB_ADDRESS --resourceId $ERC20_RESOURCEID

transfer-sub:
    just sub-cli bridgeTransfer.transferNative 1000 $ETH_ADDRESS 0