import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let db = null;

export function createDb(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  db = new Database(path);
  return db;
}

export function getDb() {
  return db;
}

export function initDb(path) {
  if (!db) createDb(path);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      id TEXT PRIMARY KEY,
      breakfasts_per_week INTEGER DEFAULT 7,
      lunches_per_week INTEGER DEFAULT 7,
      dinners_per_week INTEGER DEFAULT 7,
      people_per_meal INTEGER DEFAULT 1,
      dietary_restrictions TEXT DEFAULT '[]',
      protein_per_serving INTEGER DEFAULT 25,
      carbs_per_serving INTEGER DEFAULT 40,
      fat_per_serving INTEGER DEFAULT 15,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id TEXT PRIMARY KEY,
      preferences_id TEXT,
      week_start TEXT,
      meals TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preferences_id) REFERENCES preferences(id)
    );

    CREATE TABLE IF NOT EXISTS selected_meals (
      id TEXT PRIMARY KEY,
      plan_id TEXT,
      meal_type TEXT,
      day INTEGER,
      meal_name TEXT,
      recipe TEXT,
      ingredients TEXT,
      macronutrients TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES meal_plans(id)
    );

    CREATE TABLE IF NOT EXISTS grocery_lists (
      id TEXT PRIMARY KEY,
      plan_id TEXT,
      items TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES meal_plans(id)
    );

    CREATE TABLE IF NOT EXISTS google_tokens (
      id TEXT PRIMARY KEY,
      access_token TEXT,
      refresh_token TEXT,
      expiry_date INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
