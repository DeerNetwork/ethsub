import path from "path";
import Eth from "./eth";
import { loadJsonValue } from "./utils";

async function main() {
  const config = await loadJsonValue(path.resolve(__dirname, "../config.json"));
  const eth = await Eth.init(config.eth);
  await eth.listen();
}

main();
