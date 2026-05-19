import "dotenv/config";
import { MarketDataWorker } from "./twelvedata-worker.js";

const worker = new MarketDataWorker();

process.on("SIGINT", () => {
  void worker.stop().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void worker.stop().finally(() => process.exit(0));
});

await worker.start();
