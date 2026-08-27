# LiveSupport Staff Voice Implementation Map

## Phase 1 Audit

| Area | Current implementation | Voice integration point | Status |
| --- | --- | --- | --- |
| Frontend | React 19, Vite, Tailwind CSS | `src/main.jsx`, `src/App.jsx`, `src/components/` | Existing voice files are currently deleted and not mounted |
| Backend | Express 5 in `server.js` | Authenticated REST routes and Socket.IO handlers | Existing Socket.IO is available, but voice routes/events are missing |
| Database | PostgreSQL through Prisma 7 and `@prisma/adapter-pg` | `prisma/schema.prisma`, Prisma migrations | Existing `Staff` and `Branch` models; no voice models currently present |
| Authentication | `express-session`; `req.session.user` | `isAuthenticated` and Socket.IO session middleware | Reuse existing session identity; never accept client identity as authority |
| Authorization | Role and `branch_id` on the authenticated staff session | New server-side voice authorization helper | Must resolve branch and channel access from the session/database |
| Staff model | Prisma `Staff` model mapped to `staffs` | User identity, role, branch membership | Reuse; do not create another staff model |
| Branch model | Prisma `Branch` model mapped to `branches` | Branch-scoped voice room | Reuse; do not create another branch model |
| Realtime | Socket.IO attached to the HTTP server | Authenticated presence and control-plane events | Existing process-local `onlineAgents` map; needs voice-specific authenticated events and branch filtering |
| Audio transport | No installed LiveKit SDK in the current package manifest | LiveKit SFU client/server SDKs | Required for production group voice; secrets remain backend-only |
| Global shell | Routes are composed in `src/App.jsx`; providers in `src/main.jsx` | Mount one voice provider/widget around routes | Currently absent |
| Deployment | Node backend plus Vite frontend; `vite.config.js` proxies `/api` and `/socket.io` | HTTPS/WSS, LiveKit URL, TURN/SFU config | Existing deployment notes were removed; environment contract must be restored |

## Controlling flow

```text
Authenticated session
  -> server-resolved Staff and Branch
  -> authorized deterministic branch channel
  -> authenticated Socket.IO presence
  -> short-lived LiveKit token
  -> LiveKit SFU audio
  -> global floating voice UI
```

## Falsifiable first check

The existing client voice implementation cannot currently function because its provider/widget are not mounted, its SDK dependencies are absent, and the backend does not expose the token/staff endpoints it requests. A focused build and endpoint check after restoring this slice will falsify that hypothesis without touching unrelated application features.

## Current blockers before production acceptance

- The current worktree has user changes deleting prior voice artifacts; implementation must be rebuilt on top of the present state.
- LiveKit server availability and cross-network TURN behavior require deployment-level verification and cannot be proven by a local build alone.
- Presence is process-local and will require shared coordination (or sticky/single-instance deployment) before horizontal scaling.
- Two authenticated browsers with microphone permission are required for the final audio smoke test.
