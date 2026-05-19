import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3100);
const defaultGatewayWsUrl = process.env.GATEWAY_WS_URL ?? "ws://localhost:3000/ws/prices";
const defaultApiKey = process.env.ALPHAX_API_KEY ?? "";

function renderPage() {
  const config = JSON.stringify({
    defaultApiKey,
    defaultGatewayWsUrl,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AlphaX WebSocket Consumer</title>
    <style>
      :root {
        color-scheme: light;
        --primary: #2f5f4f;
        --primary-strong: #244a3e;
        --ink: #121615;
        --muted: #66706b;
        --line: #d8ddd8;
        --paper: #fbfaf6;
        --panel: #ffffff;
        --code: #f4efe6;
        --green-soft: #e5f2ec;
        --red-soft: #f8e8e5;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--paper);
        color: var(--ink);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 24px 0;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 16px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background:
          radial-gradient(circle at top left, rgba(47, 95, 79, 0.12), transparent 34rem),
          rgba(255, 255, 255, 0.84);
        box-shadow: 0 16px 44px rgba(18, 22, 21, 0.07);
        padding: 18px 20px;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(1.55rem, 2.4vw, 2.25rem);
        line-height: 1.05;
        letter-spacing: 0;
        text-wrap: balance;
      }

      h2 {
        font-size: 1rem;
      }

      .lede {
        margin-top: 6px;
        max-width: 600px;
        color: var(--muted);
        font-size: 0.95rem;
        line-height: 1.45;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .mark {
        display: grid;
        width: 52px;
        height: 52px;
        place-items: center;
        flex: 0 0 auto;
        border-radius: 11px;
        background: var(--primary);
        color: white;
        font-size: 1.25rem;
        font-weight: 800;
      }

      .eyebrow {
        display: block;
        margin-bottom: 5px;
        color: var(--primary);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .status-pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.78);
        padding: 9px 13px;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 750;
        white-space: nowrap;
      }

      .status-pill.connected {
        border-color: rgba(47, 95, 79, 0.25);
        background: var(--green-soft);
        color: var(--primary-strong);
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(320px, 0.9fr) minmax(360px, 1.1fr);
        gap: 16px;
      }

      section {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
        box-shadow: 0 18px 48px rgba(18, 22, 21, 0.06);
      }

      .panel {
        padding: 20px;
      }

      .stack {
        display: grid;
        gap: 14px;
      }

      label {
        display: grid;
        gap: 7px;
        color: var(--muted);
        font-size: 0.8125rem;
        font-weight: 650;
      }

      input,
      textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fffdf8;
        color: var(--ink);
        font: inherit;
        font-size: 0.95rem;
        outline: none;
        padding: 12px 13px;
      }

      textarea {
        min-height: 88px;
        resize: vertical;
      }

      input:focus,
      textarea:focus {
        border-color: rgba(47, 95, 79, 0.55);
        box-shadow: 0 0 0 3px rgba(47, 95, 79, 0.12);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      button {
        border: 1px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 750;
        min-height: 42px;
        padding: 0 14px;
      }

      button.primary {
        background: var(--primary);
        color: white;
      }

      button.secondary {
        border-color: var(--line);
        background: white;
        color: var(--ink);
      }

      button.danger {
        border-color: rgba(150, 47, 35, 0.18);
        background: var(--red-soft);
        color: #822d24;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .hint {
        color: var(--muted);
        font-size: 0.8rem;
        line-height: 1.5;
      }

      .cards {
        display: grid;
        gap: 10px;
      }

      .price-card {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #fffdf8;
        padding: 14px;
      }

      .symbol {
        font-size: 1.1rem;
        font-weight: 800;
      }

      .price {
        font-size: 1.6rem;
        font-weight: 850;
        text-align: right;
      }

      .meta {
        color: var(--muted);
        font-size: 0.78rem;
      }

      .empty {
        border: 1px dashed var(--line);
        border-radius: 10px;
        color: var(--muted);
        padding: 28px;
        text-align: center;
      }

      pre {
        min-height: 320px;
        max-height: 520px;
        overflow: auto;
        margin: 0;
        border-top: 1px solid var(--line);
        background: var(--code);
        color: #28231a;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: 0.8125rem;
        line-height: 1.55;
        padding: 16px;
        white-space: pre-wrap;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 20px;
      }

      .mini {
        color: var(--muted);
        font-size: 0.78rem;
      }

      @media (max-width: 820px) {
        header,
        .grid {
          grid-template-columns: 1fr;
        }

        header {
          align-items: flex-start;
          flex-direction: column;
          padding: 16px;
        }

        .status-pill {
          white-space: normal;
        }

        .brand {
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <div class="brand">
            <div class="mark">AX</div>
            <div>
              <span class="eyebrow">AlphaX realtime tester</span>
              <h1>WebSocket Consumer</h1>
              <p class="lede">Connect to AlphaX realtime market data, subscribe to symbols, and inspect the normalized price messages.</p>
            </div>
          </div>
        </div>
        <div class="status-pill" id="status">Disconnected</div>
      </header>

      <div class="grid">
        <section class="panel stack">
          <h2>Connection</h2>
          <label>
            Gateway WebSocket URL
            <input id="gatewayUrl" autocomplete="off" spellcheck="false" />
          </label>
          <label>
            API key
            <input id="apiKey" autocomplete="off" placeholder="ax_<api-key>" type="password" />
          </label>
          <label>
            Symbols
            <textarea id="symbols" spellcheck="false">AAPL, MSFT, NVDA</textarea>
          </label>
          <p class="hint">Browser WebSocket clients cannot send custom headers, so this tester connects with <code>?api_key=&lt;api-key&gt;</code>.</p>
          <div class="actions">
            <button class="primary" id="connect" type="button">Connect</button>
            <button class="secondary" id="subscribe" type="button" disabled>Subscribe</button>
            <button class="secondary" id="unsubscribe" type="button" disabled>Unsubscribe</button>
            <button class="danger" id="disconnect" type="button" disabled>Disconnect</button>
          </div>
        </section>

        <section>
          <div class="section-head">
            <div>
              <h2>Latest prices</h2>
              <p class="mini">Normalized downstream <code>type: "price"</code> payloads</p>
            </div>
          </div>
          <div class="panel">
            <div class="cards" id="prices">
              <div class="empty">No prices yet.</div>
            </div>
          </div>
        </section>
      </div>

      <section style="margin-top: 16px;">
        <div class="section-head">
          <div>
            <h2>Event log</h2>
            <p class="mini">Connection events and raw server messages</p>
          </div>
          <button class="secondary" id="clear" type="button">Clear</button>
        </div>
        <pre id="log"></pre>
      </section>
    </main>

    <script>
      window.__CONSUMER_CONFIG__ = ${config};

      const els = {
        apiKey: document.querySelector("#apiKey"),
        clear: document.querySelector("#clear"),
        connect: document.querySelector("#connect"),
        disconnect: document.querySelector("#disconnect"),
        gatewayUrl: document.querySelector("#gatewayUrl"),
        log: document.querySelector("#log"),
        prices: document.querySelector("#prices"),
        status: document.querySelector("#status"),
        subscribe: document.querySelector("#subscribe"),
        symbols: document.querySelector("#symbols"),
        unsubscribe: document.querySelector("#unsubscribe"),
      };

      let socket = null;
      const latest = new Map();

      els.gatewayUrl.value = window.__CONSUMER_CONFIG__.defaultGatewayWsUrl;
      els.apiKey.value = window.__CONSUMER_CONFIG__.defaultApiKey;

      function log(message, data) {
        const time = new Date().toLocaleTimeString();
        const suffix = data === undefined ? "" : "\\n" + JSON.stringify(data, null, 2);
        els.log.textContent = "[" + time + "] " + message + suffix + "\\n\\n" + els.log.textContent;
      }

      function setConnected(isConnected, label = isConnected ? "Connected" : "Disconnected") {
        els.status.textContent = label;
        els.status.classList.toggle("connected", isConnected);
        els.connect.disabled = isConnected;
        els.disconnect.disabled = !isConnected;
        els.subscribe.disabled = !isConnected;
        els.unsubscribe.disabled = !isConnected;
      }

      function getSymbols() {
        return els.symbols.value
          .split(/[\\s,]+/)
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean);
      }

      function socketUrl() {
        const rawUrl = els.gatewayUrl.value.trim();
        const apiKey = els.apiKey.value.trim();

        if (!rawUrl) {
          throw new Error("Gateway WebSocket URL is required");
        }

        if (!apiKey) {
          throw new Error("API key is required");
        }

        const url = new URL(rawUrl);
        url.searchParams.set("api_key", apiKey);
        return url.toString();
      }

      function sendSubscription(type) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          log("Socket is not open.");
          return;
        }

        const symbols = getSymbols();

        if (symbols.length === 0) {
          log("Add at least one symbol first.");
          return;
        }

        const message = { type, symbols };
        socket.send(JSON.stringify(message));
        log("Sent " + type, message);
      }

      function renderPrices() {
        if (latest.size === 0) {
          els.prices.innerHTML = '<div class="empty">No prices yet.</div>';
          return;
        }

        els.prices.innerHTML = Array.from(latest.values())
          .sort((a, b) => a.symbol.localeCompare(b.symbol))
          .map((data) => {
            const price = Number(data.price);
            const formattedPrice = Number.isFinite(price) ? price.toFixed(2) : String(data.price ?? "-");
            const marketState = data.marketState ?? "unknown";
            const source = data.source ?? "unknown";
            const stale = data.stale ? "stale" : "fresh";

            return \`
              <article class="price-card">
                <div>
                  <div class="symbol">\${data.symbol}</div>
                  <div class="meta">\${marketState} · \${source} · \${stale}</div>
                </div>
                <div>
                  <div class="price">\${formattedPrice}</div>
                  <div class="meta">\${data.percentChange ?? "-"}%</div>
                </div>
              </article>
            \`;
          })
          .join("");
      }

      els.connect.addEventListener("click", () => {
        try {
          const url = socketUrl();
          socket = new WebSocket(url);
          setConnected(false, "Connecting...");
          log("Connecting to " + els.gatewayUrl.value.trim());

          socket.addEventListener("open", () => {
            setConnected(true);
            log("Socket opened.");
            sendSubscription("subscribe");
          });

          socket.addEventListener("message", (event) => {
            let payload;

            try {
              payload = JSON.parse(event.data);
            } catch {
              log("Received non-JSON message", event.data);
              return;
            }

            log("Received message", payload);

            if (payload.type === "price" && payload.data?.symbol) {
              latest.set(payload.data.symbol, payload.data);
              renderPrices();
            }
          });

          socket.addEventListener("close", (event) => {
            setConnected(false);
            log("Socket closed", { code: event.code, reason: event.reason });
          });

          socket.addEventListener("error", () => {
            log("Socket error. Check the gateway URL, API key, and whether the gateway is running.");
          });
        } catch (error) {
          setConnected(false);
          log(error.message);
        }
      });

      els.subscribe.addEventListener("click", () => sendSubscription("subscribe"));
      els.unsubscribe.addEventListener("click", () => sendSubscription("unsubscribe"));
      els.disconnect.addEventListener("click", () => {
        if (socket) {
          socket.close();
        }
      });
      els.clear.addEventListener("click", () => {
        els.log.textContent = "";
      });

      setConnected(false);
    </script>
  </body>
</html>`;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }

  if (url.pathname !== "/") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
  });
  res.end(renderPage());
});

server.listen(port, () => {
  console.log(`Consumer tester listening on http://localhost:${port}`);
});
