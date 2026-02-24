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
  - Dish photos with each option (Unsplash/Pexels, or placeholder)
  - Pick one meal per slot
  - Get recipes for selected meals (Spoonacular or AI fallback)
  - Consolidated shopping list

- **Integrations**
  - **Google Calendar** — add meal plan events to your calendar
  - **Grocery delivery** — links to Instacart, Amazon Fresh, Walmart, Target (copy list and paste into your preferred app)

## Tech Stack

- **Frontend:** React, Vite, React Router
- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **AI:** OpenAI API (gpt-4o-mini)
- **APIs:** Spoonacular (recipes), Unsplash/Pexels (photos), Google Calendar (OAuth 2.0)

## How to Run the Application

### Prerequisites

- **Node.js** (v18 or later recommended)
- **npm** (comes with Node.js)

### 1. Install dependencies

From the project root:

```bash
cd food_planner_prototype
npm install
npm run install:all
```

Or install each part separately:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

Copy `backend/.env.example` to `backend/.env` and set at least:

| Variable | Required | Description |
|----------|----------|-------------|
| **JWT_SECRET** | Yes | Any long random string (used for sign-in/sign-up). Use a strong secret in production. |
| **OPENAI_API_KEY** | For AI features | From [platform.openai.com](https://platform.openai.com/api-keys). Without it, the app uses mock suggestions and AI fallback where possible. |

Optional (for richer features):

- **SPOONACULAR_API_KEY** — [Spoonacular](https://spoonacular.com/food-api/console) — real recipes (fallback: AI)
- **UNSPLASH_ACCESS_KEY** or **PEXELS_API_KEY** — [Unsplash](https://unsplash.com/developers) / [Pexels](https://www.pexels.com/api/) — meal photos (otherwise placeholders)
- **GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET**, **GOOGLE_REDIRECT_URI** — [Google Cloud Console](https://console.cloud.google.com/) (OAuth 2.0). Set redirect URI to `http://localhost:5173/integrations` for local dev.

### 3. Run the app

From the project root (runs both backend and frontend):

```bash
npm run dev
```

Or run backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:3001  

### Running without an API key

You can run the app without `OPENAI_API_KEY`; it will use mock meal suggestions and fallbacks. Add `OPENAI_API_KEY` for full AI-generated meal options, recipes, and shopping lists.

## Usage

1. **Sign up / Log in** — Create an account or sign in.
2. **Preferences** — Set meals per week, people, dietary restrictions, and macros.
3. **Plan** — Pick a week start date and click “Generate AI Meal Options.”
4. **Select** — Choose one meal per slot from the suggestions.
5. **Recipes** — View recipes for your selected meals.
6. **Shopping List** — Use the consolidated list; copy it or open grocery delivery links.
7. **Integrations** — Connect Google Calendar and use grocery app links.

## Project Structure

```
food_planner_prototype/
├── backend/
│   ├── routes/       # API routes (auth, preferences, meals, calendar, grocery)
│   ├── services/     # AI and external APIs (OpenAI, Spoonacular)
│   ├── db.js         # SQLite setup
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── pages/    # Preferences, MealSuggestions, Recipes, Integrations, etc.
│   │   ├── components/
│   │   └── api.js    # API client
│   └── index.html
├── package.json      # Root scripts (e.g. npm run dev)
└── README.md
```

## License

MIT
