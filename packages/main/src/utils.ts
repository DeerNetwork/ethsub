import fs from "fs";
import { Decimal } from "decimal.js";
import _ from "lodash";

export async function sleep(timeMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeMs);
  });
}

export function mergeJson(data: any, file: string) {
  try {
    const content = fs.readFileSync(file, "utf8");
    _.merge(data, JSON.parse(content));
  } catch (err) {}
}

export function exchangeAmountDecimals(
  amount: string,
  fromDecimals: number,
  toDecimals: number
) {
  return new Decimal(amount)
    .div(new Decimal(10).pow(fromDecimals))
    .mul(new Decimal(10).pow(toDecimals))
    .floor()
    .toFixed(0);
}
