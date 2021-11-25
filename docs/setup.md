## Setup Project

```sh
git clone https://github.com/DeerNetwork/ethsub
git clone https://github.com/ChainSafe/chainbridge-deploy
git clone https://github.com/ChainSafe/chainbridge-solidity

ln -rs chainbridge-solidity chainbridge-deploy/cb-sol-cli/

cd ethsub
ln -rs ../chainbridge-solidity solidity
ln -rs ../chainbridge-deploy/cb-sol-cli/index.js cb-sol-cli
```