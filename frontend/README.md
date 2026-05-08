# Smart Composter Frontend

Next.js 14 dashboard that replaces the Blynk App for the Smart Composter IoT system.

## Quick Start

```bash
npm install
npm run dev
```

Opens on `http://localhost:3000`. Make sure the backend is running on port 3001.

## Environment Variables

Copy `.env.local.example` → `.env.local`:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend REST API URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001/ws` | Backend WebSocket URL |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — real-time metrics, system status, manual control |
| `/controls` | Placeholder |
| `/history` | Placeholder |
| `/schedule` | Placeholder |
| `/settings` | Placeholder |

## Architecture

- **Zustand** store holds the live composter state
- **WebSocket** hook (`useLiveState`) connects to backend for real-time updates
- Falls back to REST polling every 5s if WS disconnects
- Manual controls send REST POST to backend which forwards to ESP32
