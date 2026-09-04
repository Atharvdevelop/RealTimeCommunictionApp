/**
 * WebRTC ICE Server Configuration
 *
 * Strategy:
 * 1. If VITE_TURN_URL is set in .env, use it as an authenticated TURN relay.
 * 2. Falls back gracefully to a broad set of public STUN servers.
 *
 * For production, set the following in your .env.local:
 *   VITE_TURN_URL=turn:your-coturn-server.com:3478
 *   VITE_TURN_USERNAME=your_username
 *   VITE_TURN_CREDENTIAL=your_credential
 *
 * Compatible with Metered.ca, Twilio ICE, Open Relay, and self-hosted Coturn.
 */

const TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

const PUBLIC_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // OpenRelay free TURN as last-resort (no auth required)
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
];

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...PUBLIC_STUN_SERVERS];

  if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
    // Prepend private TURN with priority (index 0 = highest priority)
    servers.unshift({
      urls: [
        TURN_URL,
        TURN_URL.replace(/^turn:/, 'turns:'),    // TLS variant
      ],
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    });
  }

  return servers;
}

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // change to 'relay' to force TURN (useful for debugging NAT)
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};
