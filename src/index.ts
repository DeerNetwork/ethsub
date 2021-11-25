import fs from "fs/promises";
import Eth from "./eth";

async function main() {
  const config = JSON.parse(await fs.readFile("../config.json", "utf-8"));
  const eth = await Eth.init(config.eth);
  await eth.listen();
}

main();
