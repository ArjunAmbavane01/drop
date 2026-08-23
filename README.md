# Drop

A secure, room-based file and text sharing application designed for reliable data transfer between devices.

## Features

- Temporary, room-based workspaces for quick access across devices.
- End-to-end client-side encryption (AES-256-GCM) with RSA-OAEP key wrapping. The server and storage provider only receive encrypted file contents and wrapped keys.
- Support for individual file and bulk folder uploads.
- Real-time text snippet sharing.

## Tech stack

- **Framework**: Next.js, React, TypeScript
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **Authentication**: Better Auth
- **Storage**: Cloudflare R2
- **Caching & Rate Limiting**: Upstash Redis
- **Styling**: Tailwind CSS, shadcn/ui

## Getting started

### Prerequisites

- Node.js (v20 or newer)
- pnpm

### Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/ArjunAmbavane01/drop.git
cd drop
pnpm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

3. Initialize the database schema:

```bash
pnpm db:push
```

4. Start the development server:

```bash
pnpm dev
```

The application will be accessible at `http://localhost:3000`.

## Project structure

- `app/`: Next.js App Router pages and API routes.
- `components/`: Reusable React components and UI configuration.
- `db/`: Drizzle ORM schema and database configuration.
- `lib/`: Shared utilities and client-side helpers.
- `server/`: Server-side business logic and handlers.