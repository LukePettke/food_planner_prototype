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

  // Migration: add recipe_units to existing DBs before running schema that references it
  try {
    db.exec(`ALTER TABLE preferences ADD COLUMN recipe_units TEXT DEFAULT 'imperial'`);
  } catch (_) {
    // Column already exists (new install or already migrated)
  }
  try {
    db.exec(`ALTER TABLE preferences ADD COLUMN meal_complexity_levels TEXT DEFAULT '["quick_easy","everyday","from_scratch"]'`);
  } catch (_) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE meal_library ADD COLUMN complexity_level TEXT`);
  } catch (_) {
    // Column already exists
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS preferences (
      id TEXT PRIMARY KEY,
      breakfasts_per_week INTEGER DEFAULT 7,
      lunches_per_week INTEGER DEFAULT 7,
      dinners_per_week INTEGER DEFAULT 7,
      people_per_meal INTEGER DEFAULT 1,
      dietary_restrictions TEXT DEFAULT '[]',
      meal_complexity_levels TEXT DEFAULT '["quick_easy","everyday","from_scratch"]',
      protein_per_serving INTEGER DEFAULT 25,
      carbs_per_serving INTEGER DEFAULT 40,
      fat_per_serving INTEGER DEFAULT 15,
      recipe_units TEXT DEFAULT 'imperial',
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

    CREATE TABLE IF NOT EXISTS meal_library (
      id TEXT PRIMARY KEY,
      meal_type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_meal_library_type ON meal_library(meal_type);

    INSERT OR IGNORE INTO preferences (id, breakfasts_per_week, lunches_per_week, dinners_per_week, people_per_meal, dietary_restrictions, protein_per_serving, carbs_per_serving, fat_per_serving, recipe_units)
    VALUES ('default', 7, 7, 7, 1, '[]', 25, 40, 15, 'imperial');
  `);
}
