import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";

const port = Number(process.env.PORT ?? 3000);
const dev = process.argv.includes("--dev");
const app = next({ dev });
const handle = app.getRequestHandler();
const symbols = new Set(["AAPLx", "AMZNx", "GOOGLx", "NVDAx", "TSLAx", "METAx", "MSFTx", "COINx", "CRCLx", "SPYx"]);
const sockets = new Set();

await app.prepare();
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/") request.url = "/landing" + url.search;
  handle(request, response);
});
const stream = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname !== "/api/market-stream") return socket.destroy();
  const symbol = url.searchParams.get("symbol") ?? "";
  if (!symbols.has(symbol)) return socket.destroy();
  stream.handleUpgrade(request, socket, head, (client) => stream.emit("connection", client, symbol));
});
stream.on("connection", (client, symbol) => {
  let stopped = false;
  let alive = true;
  sockets.add(client);
  const publish = async () => {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/api/market-stream/" + encodeURIComponent(symbol));
      if (!response.ok || stopped || client.readyState !== client.OPEN) return;
      client.send(JSON.stringify(await response.json()));
    } catch {
      if (!stopped && client.readyState === client.OPEN) {
        client.send(JSON.stringify({ symbol, error: "Live market context is reconnecting." }));
      }
    }
  };
  const timer = setInterval(() => void publish(), 30_000);
  const heartbeat = setInterval(() => {
    if (!alive) return client.terminate();
    alive = false;
    client.ping();
  }, 25_000);
  client.on("pong", () => { alive = true; });
  client.on("close", () => {
    stopped = true;
    sockets.delete(client);
    clearInterval(timer);
    clearInterval(heartbeat);
  });
  void publish();
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const client of sockets) {
    client.close(1001, "Server is restarting");
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 25_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
server.listen(port, "0.0.0.0", () => console.log("OpenStock live server ready on http://localhost:" + port));
