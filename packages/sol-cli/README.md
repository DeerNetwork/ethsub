# sol-cli

A cli to interact with ethereum

> Forked from https://github.com/ChainSafe/chainbridge-deploy/tree/main/cb-sol-cli

## Usage

```
Usage:  [options] [command]

Options:
  --url <value>                 URL to connect to (default: "http://localhost:8545")
  --privateKey <value>          Private key to use (default: "0x000000000000000000000000000000000000000000000000000000616c696365")
  --jsonWallet <path>           (Optional) Encrypted JSON wallet
  --jsonWalletPassword <value>  (Optional) Password for encrypted JSON wallet
  --gasLimit <value>            Gas limit for transactions (default: "8000000")
  --gasPrice <value>            Gas limit for transactions (default: "20000000")
  --networkId <value>           Network Id
  -h, --help                    display help for command

Commands:
  deploy [options]              Deploys contracts via RPC
  bridge
  admin
  erc20 [options]
  erc721
  asset
  help [command]                display help for command
```

## Example

```sh
# deploy all contracts
sol-cli deploy --all --relayerThreshold 1

# register resource 
sol-cli bridge register-resource --resourceId $ERC20_RESOURCEID --targetContract $ERC20_ADDRESS

# enable brun
sol-cli bridge set-burn --tokenContract $ERC20_ADDRESS

# add minter
sol-cli erc20 add-minter --minter $ERC20_HANDLER_ADDRESS

# mint token
sol-cli erc20 mint --amount 100000

# approve transfer
sol-cli erc20 approve --amount 100000 --recipient $ERC20_HANDLER_ADDRESS 
```