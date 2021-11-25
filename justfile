compile-sol:
    rm -rf packages/solidity/build
    pnpm run --filter ./packages/solidity compile

run-eth:
    ganache-cli \
        -b 3 \
        --account "0x000000000000000000000000000000000000000000000000000000616c696365,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000626f62,100000000000000000000" \
        --account "0x00000000000000000000000000000000000000000000000000636861726c6965,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000064617665,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000657665,100000000000000000000"