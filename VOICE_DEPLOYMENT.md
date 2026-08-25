# Staff Voice Deployment Notes

## Final architecture

LiveSupport authentication and branch authorization remain the application control plane. The authenticated backend issues a short-lived LiveKit room token only for the staff member's own deterministic branch channel. Socket.IO remains responsible for authenticated application presence; LiveKit is responsible for room membership, audio transport, reconnection, remote audio, and active-speaker state.

```text
Staff browser -> LiveSupport session -> branch authorization
								  -> /api/voice/livekit-token
								  -> LiveKit SFU -> authorized branch room
```

## Current transport

The application now uses LiveKit as the production media transport. Socket.IO is limited to authenticated application presence and control-plane state; it does not carry SDP, ICE, or audio for the LiveKit path. The backend checks LiveKit room occupancy before issuing a token and enforces a ten-participant application limit. It does not persist presence, tokens, or audio. Development diagnostics are available in the open voice panel when running Vite in development mode.

## LiveKit deployment

LiveKit Cloud is configured for this environment. The backend reads `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`; it logs only boolean configuration status. LiveKit is the SFU and media plane. The LiveSupport backend remains the authentication and authorization control plane.

## Required production infrastructure

- HTTPS for the LiveSupport frontend and backend.
- WSS through the existing Socket.IO endpoint.
- LiveKit Cloud connectivity and TURN behavior must be confirmed on the actual staff networks before production sign-off.
- The application limit is ten participants per branch room.
- The LiveSupport backend and LiveKit must be reachable over HTTPS/WSS from every staff network.

## Environment variables

Add these to the backend service only:

| Variable | Purpose | Secret | Development | Production |
| --- | --- | --- | --- | --- |
| `LIVEKIT_URL` | Backend/client LiveKit endpoint | No | Optional | Required |
| `LIVEKIT_API_KEY` | Server token signing | Yes | Optional | Required |
| `LIVEKIT_API_SECRET` | Server token signing | Yes | Optional | Required |
No separate `TURN_*` variables are currently used. LiveKit Cloud supplies connectivity infrastructure for this deployment; cross-network relay behavior remains an operational test requirement.

Never expose API secrets or long-lived TURN credentials through `VITE_*` variables.

At startup the backend logs only boolean configuration status for LiveKit. It never logs the URL, API key, API secret, access tokens, or TURN credentials.

## Manual real-browser test

Use two real browser profiles and two staff accounts assigned to the same branch.

1. Open the deployed HTTPS app in Browser A and Browser B; log in separately.
2. Confirm both users appear under Active staff in the voice panel.
3. Open Staff Voice in both browsers and select Join voice.
4. Grant microphone permission in both browsers. Verify the panel shows Connected and both users appear under In voice.
5. Hold Hold to talk in A and confirm B hears A; repeat in the reverse direction.
6. Release PTT and confirm the sender remains connected and stops transmitting.
7. Test Mute, Unmute, Deafen, Undeafen, Leave, and Rejoin independently.
8. Navigate Dashboard, Inbox, Orders, Tables, Tickets, and Settings while joined.
9. Repeat with one device on a mobile hotspot or separate network. Record ICE state and whether the selected candidate is `relay`.
10. Use a fourth account assigned to another branch and confirm the server rejects an attempted cross-branch join.

## Verification status

- LiveKit credentials: configured in the backend `.env` and never printed.
- Token endpoint: not tested with an authenticated staff session in this environment.
- LiveKit health: unauthenticated request correctly returns `401`; direct backend room-service connectivity to LiveKit Cloud returned `AVAILABLE`. Authenticated `/api/voice/health` was not available in the shared browser session.
- Two-user audio, active speaker, PTT, mute, deafen, reconnection, multi-user, room capacity, branch isolation, and cleanup: not physically verified here.
- STUN/TURN: delegated to LiveKit Cloud; relay candidate behavior was not verified on a second network.
- SFU: configured by LiveKit Cloud and reachable through the backend room service; browser media connectivity was not verified here.

## Health diagnostics

Authenticated staff can query `/api/voice/health`. It reports only `AVAILABLE`, `UNAVAILABLE`, `CONFIGURED`, or `NOT_CONFIGURED` for authentication, Socket.IO, database, TURN, and SFU. It never returns credentials.

When configured, the health route separately probes LiveKit connectivity. Environment variables alone do not imply that LiveKit is reachable.

## Troubleshooting

- `Microphone access is required`: allow microphone access for the HTTPS origin and retry.
- `Staff voice unavailable` or no presence: check the authenticated Socket.IO request and session cookie.
- ICE remains `checking` or fails on another network: deploy and verify TURN, or use LiveKit's configured TURN support.
- Room access rejected: verify the session branch matches the authorized `VoiceChannel`.

## Current verification boundary

Local static validation passed with `npm run build`, `node --check server.js`, `npx prisma validate`, and `npx prisma generate`. The shared browser session was not authenticated for the voice endpoints, so no token, authenticated health, microphone, real audio, or cross-network result is claimed as passed. Use two separately authenticated real browser/device sessions for final activation testing; headless browser checks cannot establish physical microphone or two-way audio.

Do not claim production readiness until two separate authenticated browsers pass the manual audio test, then TURN and SFU are deployed and tested.