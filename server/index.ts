import { startGateway } from "./gateway.js";

const gateway = startGateway();

function shutdown() {
  gateway.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
