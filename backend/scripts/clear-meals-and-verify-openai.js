#!/usr/bin/env node
/**
 * One-off script: verify OpenAI API key and delete all meal plans, selected meals, and grocery lists.
 * Usage: node scripts/clear-meals-and-verify-openai.js
 * Or: npm run clear-meals
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load .env first so OPENAI_API_KEY is set when we load ai.js
dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  const { initDb, getDb } = await import('../db.js');
  const { verifyOpenAIKey } = await import('../services/ai.js');

  const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'mealplanner.db');
  initDb(dbPath);

  console.log('Checking OpenAI API key...');
  const openaiResult = await verifyOpenAIKey();
  if (openaiResult.ok) {
    console.log('OpenAI API key: OK (valid and working)');
    if (openaiResult.response) console.log('  Response:', openaiResult.response);
  } else {
    console.log('OpenAI API key:', openaiResult.error || 'Unknown error');
    if (openaiResult.keySet) {
      console.log('  Key is set in .env but invalid or expired. Get a new key at https://platform.openai.com/api-keys');
    } else {
      console.log('  Add OPENAI_API_KEY to backend/.env for AI-generated meal suggestions (otherwise app uses mock data).');
    }
  }

  const db = getDb();
  const beforePlans = db.prepare('SELECT COUNT(*) as n FROM meal_plans').get();
  const beforeSelected = db.prepare('SELECT COUNT(*) as n FROM selected_meals').get();
  const beforeGrocery = db.prepare('SELECT COUNT(*) as n FROM grocery_lists').get();

  db.exec(`
    DELETE FROM grocery_lists;
    DELETE FROM selected_meals;
    DELETE FROM meal_plans;
  `);

  console.log('\nCleared all meal data:');
  console.log('  meal_plans:', beforePlans.n, '-> 0');
  console.log('  selected_meals:', beforeSelected.n, '-> 0');
  console.log('  grocery_lists:', beforeGrocery.n, '-> 0');
  console.log('\nDone. Restart the backend if it is running, then create a new plan from the app.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
