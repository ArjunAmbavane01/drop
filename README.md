# Drop

Drop is a secure, room-based file and text sharing application. It allows users to quickly spin up a temporary space to transfer data between devices.

Users can create or join rooms, share text snippets, and upload individual files or entire folders to access them from any other device connected to the same room.

## Security

Files are encrypted client-side using AES-256-GCM. The symmetric file keys are wrapped using RSA-OAEP before being sent to the server. The server and storage provider only ever receive and store encrypted file contents and wrapped keys.

## Stack

- Next.js, React, TypeScript
- Neon (PostgreSQL) & Drizzle ORM
- Upstash Redis
- Better Auth
- Storage: Cloudflare R2
- Hosting: Vercel

## Local Development

Install dependencies:

```bash
pnpm install
```

Set up the required environment variables in a `.env` file:

```env
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Run the development server:

```bash
pnpm dev
```