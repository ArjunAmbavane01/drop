export function getIceServers(): RTCIceServer[] {
  const configured = process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS;
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as RTCIceServer[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      console.warn("NEXT_PUBLIC_WEBRTC_ICE_SERVERS must be valid JSON.");
    }
  }

  const meteredDomain = process.env.NEXT_PUBLIC_METERED_DOMAIN;
  const meteredUsername = process.env.NEXT_PUBLIC_METERED_USERNAME;
  const meteredCredential = process.env.NEXT_PUBLIC_METERED_CREDENTIAL;
  if (meteredDomain && meteredUsername && meteredCredential) {
    return [
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: [
          "turn:global.relay.metered.ca:80",
          "turn:global.relay.metered.ca:80?transport=tcp",
          "turn:global.relay.metered.ca:443",
          "turns:global.relay.metered.ca:443?transport=tcp",
        ],
        username: meteredUsername,
        credential: meteredCredential,
      },
    ];
  }

  return [{ urls: "stun:stun.l.google.com:19302" }];
}
