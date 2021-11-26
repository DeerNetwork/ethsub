import fs from "fs";
import path from "path";
import { createLogger, format, transports } from "winston";
import { EthConfig } from "./eth";
import { SubConfig } from "./sub";

export interface Config {
  logLevel: string;
  dataDir: string;
  eth: EthConfig;
  sub: SubConfig;
}

export const config: Config = requireJsonSync(
  path.resolve(__dirname, "../config.json")
);

export async function sleep(timeMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeMs);
  });
}

export const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.colorize(),
    format.errors({ stack: true }),
    format.printf(
      (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
    )
  ),
  transports: [new transports.Console()],
});

export async function requireJson(file: string) {
  return JSON.parse(await fs.promises.readFile(file, "utf8"));
}

export function requireJsonSync(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
