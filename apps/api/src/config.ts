import { loadEnv } from './env.js';

// Load apps/api/.env if present; every variable has a default, so a missing
// file is fine (see .env.example).
const dotenv = await import('dotenv');
dotenv.config({ quiet: true });

export const env = loadEnv();
