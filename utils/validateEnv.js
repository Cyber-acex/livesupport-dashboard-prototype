const requiredVars = ['DATABASE_URL', 'SESSION_SECRET', 'MISTRAL_API_KEY'];
const optionalVars = ['OSRM_URL', 'APP_URL', 'VOICE_STUN_URLS', 'VOICE_TURN_URL', 'VOICE_TURN_USERNAME', 'VOICE_TURN_CREDENTIAL'];

function validateEnv() {
  const missing = [];
  requiredVars.forEach((name) => {
    if (!process.env[name] || String(process.env[name]).trim() === '') {
      missing.push(name);
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. Please add them to your .env file or environment configuration.`);
  }

  if (!process.env.OSRM_URL) {
    console.warn('[Env] OSRM_URL not configured. Using public OSRM at https://router.project-osrm.org for routing. For production, set OSRM_URL to your self-hosted OSRM instance.');
  }

  if (!process.env.SESSION_SECRET || String(process.env.SESSION_SECRET).trim() === '') {
    console.warn('[Env] SESSION_SECRET is not configured; using default session secret. This is not secure for production. Set SESSION_SECRET in production.');
  }
}

export { validateEnv };
