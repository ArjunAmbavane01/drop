# Drop

Drop is a minimal, room-based workspace for moving text, files, folders,
and screenshots between devices.

Persistent room uploads are encrypted client-side and stored in
Cloudflare R2. For device-to-device transfers, Drop can establish a
direct WebRTC connection so files move between browsers without being
stored by Drop.

## How it works

Drop has two transfer paths:

-   **Room uploads**: files are encrypted in the browser and uploaded to
    R2, where they remain available in the room.
-   **Direct transfers**: two devices connect through WebRTC and
    transfer files directly. Cloudflare Worker handles only the
    signaling required to establish the connection; file data does not
    pass through it.

## Features

- Temporary, room-based workspaces for quick access across devices.
- End-to-end client-side encryption (AES-256-GCM) with RSA-OAEP key wrapping. The server and storage provider only receive encrypted file contents and wrapped keys.
- Support for individual file and bulk folder uploads.
- Real-time text snippet sharing.
- Direct device-to-device file and folder transfer over WebRTC. Files are transferred directly between connected devices and are not persisted by Drop.

## Tech stack

-   **Framework:** Next.js, React, TypeScript
-   **Database:** PostgreSQL, Neon, Drizzle ORM
-   **Authentication:** Better Auth
-   **Storage:** Cloudflare R2
-   **Rate limiting:** Upstash Redis
-   **Direct transfers:** WebRTC, Cloudflare Workers, Durable Objects
-   **UI:** Tailwind CSS, shadcn/ui
-   **Validation:** Zod

## Getting started

### Prerequisites

-   Node.js 20+
-   pnpm

### Local setup

Clone the repository and install dependencies:

``` bash
git clone https://github.com/ArjunAmbavane01/drop.git
cd drop
pnpm install
```

Create the environment file:

``` bash
cp .env.example .env
```

Configure the required database, authentication, R2, Redis, and
application environment variables.

Initialize the database:

``` bash
pnpm db:push
```

Start the development server:

``` bash
pnpm dev
```

The application runs at `http://localhost:3000`.

## Direct transfer deployment

Direct transfers use a separate Cloudflare Worker for WebSocket
signaling.

From the repository root:

``` bash
npx wrangler login
npx wrangler secret put DIRECT_SIGNALING_SECRET --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

The deployment returns the Worker URL. Configure the Vercel application
with:

``` text
DIRECT_SIGNALING_SECRET=<same secret used by the Worker>
DIRECT_SIGNALING_URL=wss://<your-worker>.workers.dev
```

The signaling secret is shared only between the Next.js server and the
Worker. It is used to authorize short-lived signaling sessions.

### WebRTC ICE configuration

Drop supports either a custom ICE server list:

``` text
NEXT_PUBLIC_WEBRTC_ICE_SERVERS=[...]
```

or Metered STUN/TURN configuration:

``` text
NEXT_PUBLIC_METERED_DOMAIN=
NEXT_PUBLIC_METERED_USERNAME=
NEXT_PUBLIC_METERED_CREDENTIAL=
```

## Project structure

``` text
app/          Next.js routes and pages
components/   Reusable UI components
db/           Drizzle schema and database configuration
lib/          Shared utilities and client-side logic
server/       Server-side application logic
worker/       Cloudflare signaling Worker
```