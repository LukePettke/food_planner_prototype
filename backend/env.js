/**
 * Load .env before any other application code runs.
 * Must be the first import in server.js so OPENAI_API_KEY is set when ai.js creates the OpenAI client.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
