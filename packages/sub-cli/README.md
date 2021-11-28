# sub-cli

A cli to interact with substrate

## Usage

```
Usage: sub-cli [options] <call> <callArgs...>

Options:
  --url <ws>           websocket url (default: "ws://localhost:9944")
  --secret <mnemonic>  account secret (default: "//Alice")
  --sudo               Sudo call
  -h, --help           display help for command

```

## Example

```sh
# add helayer
sub-cli --sudo bridge.addRelayer $SUB_DDRESS

# set resource 
sub-cli --sudo bridge.setResource $SUB_TOKEN_RESOURCEID $PALLET_TRANSFER_METHOD

# whitelist chain
sub-cli --sudo bridge.whitelistChain 0

# set change fee
sub-cli --sudo bridgeTransfer.changeFee 1 1 0

# tranfer balance
sub-cli balances.transfer $SUB_BRIDGE_ACCOUNT 10000
```