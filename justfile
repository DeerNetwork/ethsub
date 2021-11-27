set dotenv-load := true

npm pkg +args:
    pnpm --filter ./packages/{{pkg}} {{args}}

sol-cli *args:
    -node packages/sol-cli/index.js {{args}}

sub-cli *args:
    -node packages/sub-cli/index.js {{args}}

run:
    rm -rf packages/main/data
    pnpm run --filter ./packages/main dev

run-eth +args='-b 3 -l 8000000':
    ganache-cli \
        {{args}} \
        --account "0x000000000000000000000000000000000000000000000000000000616c696365,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000626f62,100000000000000000000" \
        --account "0x00000000000000000000000000000000000000000000000000636861726c6965,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000064617665,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000657665,100000000000000000000"

run-sub +args='--tmp --dev':
    sub-node \
        {{args}} \
        --port 30333 \
        --ws-port 9944 \
        --rpc-port 9933 \
        --rpc-methods Unsafe \
        --unsafe-rpc-external \
        --rpc-cors all \
        --unsafe-ws-external

init-eth:
    just sol-cli deploy --all --relayerThreshold 1
    just sol-cli bridge register-resource --resourceId $ERC20_RESOURCEID --targetContract $ERC20_ADDRESS
    just sol-cli bridge set-burn --tokenContract $ERC20_ADDRESS
    just sol-cli erc20 add-minter --minter $ERC20_HANDLER_ADDRESS
    just sol-cli erc20 mint --amount 100000
    just sol-cli erc20 approve --amount 100000 --recipient $ERC20_HANDLER_ADDRESS 

init-sub:
    just sub-cli --sudo bridge.addRelayer $SUB_ALICE_ADDRESS
    just sub-cli --sudo bridge.setResource $SUB_TOKEN_RESOURCEID $PALLET_TRANSFER_METHOD
    just sub-cli --sudo bridge.whitelistChain 0
    just sub-cli --sudo bridgeTransfer.changeFee 1 1 0
    just sub-cli balances.transfer $SUB_BRIDGE_ACCOUNT 10000

trans-eth amount="100" to="$SUB_BOB_ADDRESS":
    just sol-cli erc20 deposit --dest 1 --resourceId $ERC20_RESOURCEID --amount {{amount}} --recipient {{to}} 

trans-sub amount="100" to="$ETH_BOB_ADDRESS":
    just sub-cli bridgeTransfer.transferNative {{amount}} {{to}} 0

balance-eth account="$ETH_BOB_ADDRESS":
    just sol-cli erc20 balance --address {{account}}

balance-sub account="$SUB_BOB_ADDRESS":
    just sub-cli system.account {{account}}