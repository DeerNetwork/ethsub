#!/usr/bin/env node

const { cryptoWaitReady } = require("@polkadot/util-crypto");
const { Keyring } = require("@polkadot/keyring");
const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Command } = require("commander");

const program = new Command()
  .arguments("<call> <callArgs...>")
  .option("--url <ws>", "websocket url", "ws://localhost:9944")
  .option("--wallet <mnemonic>", "wallet mnemonic", "//Alice")
  .option("--sudo", "Sudo call")
  .action((call, callArgs, program) => {
    const options = program.opts();
    main(call, callArgs, options);
    console.log(call, callArgs, options);
  });

if (process.argv && process.argv.length <= 2) {
  program.help();
} else {
  program.parse(process.argv);
}

async function main(call, callArgs, options) {
  await cryptoWaitReady();
  const api = new ApiPromise({
    provider: new WsProvider(options.url),
  });
  const keyring = new Keyring();
  const keyPair = keyring.addFromUri(options.mnemonic);
  const callParts = call.split(".");
  const fn =
    retrivePart(api.tx, callParts) || retrivePart(api.query, callParts);
  if (typeof fn === "function") {
    if (fn.signAndSend) {
      if (options.sudo) {
        await sendTx(keyPair, api.tx.sudo.sudo(fn(...args)));
      } else {
        await sendTx(keyPair, fn(...args));
      }
    } else {
      const res = await fn(...args);
      console.log(JSON.stringify(res.toHuman(), null, 2));
    }
  } else {
    throw new Error(`Invalid op ${call}`);
  }
}

function retrivePart(scope, callParts) {
  for (const part of callParts) {
    scope = scope[part];
    if (!scope) return null;
  }
  return scope;
}

async function sendTx(keyPair, tx) {
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
