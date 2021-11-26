import { init, srvs } from "./services";
import pEvent from "p-event";

async function main() {
  process.on("unhandledRejection", (reason) => {
    const { logger } = srvs;
    if (logger) srvs.logger.error(reason as any, { unhandledRejection: true });
  });
  process.on("uncaughtException", (err) => {
    const { logger } = srvs;
    if (logger) srvs.logger.error(err, { uncaughtException: true });
  });
  let stop;
  try {
    stop = await init();
    await Promise.all([srvs.eth.pullBlocks(), srvs.sub.pullBlocks()]);
    await Promise.race([
      ...["SIGINT", "SIGHUP", "SIGTERM"].map((s) =>
        pEvent(
          process,
          s
          // {
          //   rejectionEvents: ["uncaughtException", "unhandledRejection"],
          // },
        )
      ),
    ]);
  } catch (err) {
    process.exitCode = 1;
    if (srvs.logger) {
      srvs.logger.error(err);
    } else {
      console.log(err);
    }
  } finally {
    if (stop) await stop();
    setTimeout(() => process.exit(), 10000).unref();
  }
}

main();
