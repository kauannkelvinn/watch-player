# Watch.Party

A real-time, synchronized video viewing platform built for low-latency media playback and live chat. Watch YouTube videos together with friends in perfectly synced private rooms.

## Architecture & Tech Stack

This project is structured as a highly scalable monorepo using **Turborepo** and **PNPM Workspaces**, ensuring strict typing and shared resources across the full stack.

- **Frontend (`apps/web`):** Next.js 15 (App Router), React 19, TypeScript, TailwindCSS.
- **Backend (`apps/server`):** Node.js, Socket.io (WebSocket), TypeScript.
- **State Management:** Upstash Redis (Serverless, low-latency room state persistence).
- **Shared Packages (`packages/types`):** Strictly typed Socket.io events and shared domain interfaces.
- **Deployment:** Vercel (Edge) and Render (Web Services).

## Key Features

- **Real-Time Sync:** Frame-accurate video synchronization across all connected clients.
- **Live Chat:** Integrated real-time messaging system with system notifications.
- **Ephemeral Rooms:** URL-based automatic room creation and joining mechanism.
- **Strict Type Safety:** End-to-end TypeScript enforcement without `any` bypasses.

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PNPM](https://pnpm.io/) (v10+)
- An [Upstash Redis](https://upstash.com/) database URL

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/watch-player.git
cd watch-player
```

2. Install workspace dependencies:

```bash
pnpm install
```

3. Configure environment variables:

   - Create a `.env` file in `apps/server`:

```env
   PORT=3001
   UPSTASH_REDIS_REST_URL=your_url
   UPSTASH_REDIS_REST_TOKEN=your_token
```

   - Create a `.env.local` file in `apps/web` if needed for frontend config.

4. Start the monorepo:

```bash
pnpm dev
```

Turborepo will concurrently start the Next.js client on `http://localhost:3000` and the Node.js server.

## License

Developed for educational and portfolio purposes.
