#!/usr/bin/env node

const { cryptoWaitReady } = require("@polkadot/util-crypto");
const { Keyring } = require("@polkadot/keyring");
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { BN } = require("@polkadot/util");
const { Command } = require("commander");

const program = new Command()
  .arguments("<call> <callArgs...>")
  .option("--url <ws>", "websocket url", "ws://localhost:9944")
  .option("--secret <mnemonic>", "account secret", "//Alice")
  .option("--sudo", "Sudo call")
  .action(async (call, callArgs, program) => {
    const options = program.opts();
    await main(call, callArgs, options);
    process.exit(0);
  });

if (process.argv && process.argv.length <= 2) {
  program.help();
} else {
  program.parse(process.argv);
}

async function main(call, callArgs, options) {
  const api = new ApiPromise({
    provider: new WsProvider(options.url),
  });
  await api.isReady;
  const wallet = await createWallet(options.secret);
  const callParts = call.split(".");
  const fn =
    retrivePart(api.tx, callParts) || retrivePart(api.query, callParts);
  if (fn?.meta) {
    const argLen = fn.meta.args.length;
    if (callArgs.length !== argLen) {
      throw new Error(`Invalid args`);
    }
    for (let i = 0; i < argLen; i++) {
      const fnArg = fn.meta.args[i];
      if (fnArg.typeName.toString() === "BalanceOf") {
        callArgs[i] = new BN(callArgs[i])
          .mul(new BN(10).pow(new BN(api.registry.chainDecimals[0])))
          .toString();
      }
    }
    if (!fn.key) {
      if (options.sudo) {
        await sendTx(api, wallet, api.tx.sudo.sudo(fn(...callArgs)));
      } else {
        await sendTx(api, wallet, fn(...callArgs));
      }
    } else {
      const res = await fn(...callArgs);
      console.log(JSON.stringify(res.toHuman(), null, 2));
    }
  } else {
    throw new Error(`Miss op ${call}`);
  }
}

async function createWallet(secret) {
  await cryptoWaitReady();
  const keyring = new Keyring({ type: "sr25519" });
  return keyring.addFromUri(secret);
}

function retrivePart(scope, callParts) {
  for (const part of callParts) {
    scope = scope[part];
    if (!scope) return null;
  }
  return scope;
}

async function sendTx(api, keyPair, tx) {
  return new Promise((resolve, reject) => {
    tx.signAndSend(keyPair, ({ events = [], status }) => {
      if (status.isInvalid || status.isDropped || status.isUsurped) {
        reject(new Error(`${status.type} transaction.`));
      } else {
      }

      if (status.isInBlock) {
        events.forEach(({ event: { data, method, section } }) => {
          if (section === "system" && method === "ExtrinsicFailed") {
            const [dispatchError] = data;
            if (dispatchError.isModule) {
              const mod = dispatchError.asModule;
              const error = api.registry.findMetaError(
                new Uint8Array([mod.index.toNumber(), mod.error.toNumber()])
              );
              throw new Error(
                `Transaction throw ${error.section}.${
                  error.name
                }, ${error.docs.join("")}`
              );
            } else {
              throw new Error(`Transaction throw ${dispatchError.type}`);
            }
          } else if (method === "ExtrinsicSuccess") {
            resolve();
          }
        });
      } else {
      }
    }).catch((e) => {
      reject(e);
    });
  });
}
