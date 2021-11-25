compile-sol:
    rm -rf packages/solidity/build
    pnpm run --filter ./packages/solidity compile
 
typegen-sol:
    #!/bin/bash
    contracts=( Bridge ERC20Handler GenericHandler )
    for contract in ${contracts[@]}; do
        npx typechain --target ethers-v5 --out-dir packages/main/src/contracts/ packages/solidity/build/contracts/${contract}.json
    done

sol *args:
    -node packages/sol-cli/index.js {{args}}

run-main:
    pnpm run --filter ./packages/main dev

run-eth:
    ganache-cli \
        -b 3 \
        --account "0x000000000000000000000000000000000000000000000000000000616c696365,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000626f62,100000000000000000000" \
        --account "0x00000000000000000000000000000000000000000000000000636861726c6965,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000064617665,100000000000000000000" \
        --account "0x0000000000000000000000000000000000000000000000000000000000657665,100000000000000000000"