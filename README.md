# MealFlow — AI-Powered Weekly Food Plan

A full-stack web app that uses AI to generate personalized meal plans. Customize your preferences (meals per week, people, dietary restrictions, macros), get AI meal suggestions, pick your meals, receive recipes and a shopping list, and connect to Google Calendar and grocery delivery apps.

## Features

- **Customizable Preferences**
  - Meals per week: breakfast, lunch, dinner (0–14 each)
  - People per meal (1–20)
  - Dietary restrictions: vegetarian, vegan, gluten-free, keto, etc.
  - Macronutrients per serving: protein, carbs, fat (grams)

- **AI Meal Planning**
  - Generate 10 meal options per slot using AI (OpenAI)
  - Dish photos with each option (Unsplash, or placeholder)
  - Pick one meal per slot
  - Get recipes for selected meals
  - Consolidated shopping list

- **Integrations**
  - **Google Calendar** — add meal plan events to your calendar
  - **Grocery delivery** — links to Instacart, Amazon Fresh, Walmart, Target (copy list and paste into your preferred app)

## Tech Stack

- **Frontend:** React, Vite, React Router
- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **AI:** OpenAI API (gpt-4o-mini)
- **Google Calendar:** googleapis (OAuth 2.0)

## Setup

### 1. Install dependencies

```bash
cd food_planner_prototype
npm install
npm run install:all
```

Or install each workspace:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

Copy `backend/.env.example` to `backend/.env` and fill in:

- **OPENAI_API_KEY** (required for AI) — get from [platform.openai.com](https://platform.openai.com/api-keys)
- **UNSPLASH_ACCESS_KEY** (optional) — from [Unsplash Developers](https://unsplash.com/developers) for meal photos; without it, placeholders are used
- **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET** (optional) — from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application). Add `http://localhost:5173/integrations` as an authorized redirect URI.

### 3. Run the app

```bash
# From project root - runs both backend and frontend
npm run dev
```

Or run separately:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:3001  

### Without OpenAI API key

The app falls back to mock meal suggestions, recipes, and shopping lists so you can use it without an API key. Add `OPENAI_API_KEY` for real AI-generated content.

## Usage

1. **Preferences** — Set meals per week, people, dietary restrictions, macros
2. **Plan** — Choose week start date, click "Generate AI Meal Options"
3. **Select** — Pick one meal per slot from the suggestions
4. **Recipes** — View recipes for your selected meals
5. **Shopping List** — Use the consolidated list; copy it or open grocery delivery links
6. **Integrations** — Connect Google Calendar and use grocery app links

## Project Structure

```
food_planner_prototype/
├── backend/
│   ├── routes/       # API routes (preferences, meals, calendar, grocery)
│   ├── services/     # AI service (OpenAI)
│   ├── db.js         # SQLite setup
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── pages/    # Preferences, MealSuggestions, MealSelection, Recipes, ShoppingList, Integrations
│   │   ├── components/
│   │   └── api.js    # API client
│   └── index.html
├── package.json
└── README.md
```

## License

MIT
