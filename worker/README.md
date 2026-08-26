# Drop direct signaling Worker

The direct signaling Worker is the coordination layer used to establish
WebRTC connections between devices.

It provides a WebSocket endpoint for exchanging connection metadata such
as SDP offers, answers, and ICE candidates. Once WebRTC is established,
file data moves directly between the connected browsers.

The Worker does not store or proxy file contents.

## Deployment

From the repository root:

``` bash
npx wrangler login
npx wrangler secret put DIRECT_SIGNALING_SECRET --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

The deployment creates the `drop-direct-signaling` Worker and its
Durable Object used to coordinate devices connected to the same Drop
room.

After deployment, configure the Vercel application:

``` text
DIRECT_SIGNALING_SECRET=<same secret used by the Worker>
DIRECT_SIGNALING_URL=wss://<your-worker>.workers.dev
```