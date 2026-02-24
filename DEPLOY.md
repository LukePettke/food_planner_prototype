# Deploy MealFlow to Production

Your app uses:
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (file in `backend/data/`)
- **One URL:** In production the backend serves both the API and the frontend.

The simplest way to run everything in one place is **Railway**. You get one URL for the whole app; you can connect your GoDaddy domain later.

---

## Step 1: Put your code on GitHub

1. Create a **GitHub** account if you don’t have one: https://github.com/join  
2. Install **Git** if needed: https://git-scm.com/downloads  
3. Open Terminal (Mac) or Command Prompt (Windows).  
4. Go to your project folder:
   ```bash
   cd /Users/lukepettke/Desktop/food_planner_prototype
   ```
5. Turn it into a Git repo and push to GitHub (replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repo name, e.g. `lukepettke` and `meal-planner`):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
   To create the repo on GitHub: https://github.com/new — create a new repo (e.g. `meal-planner`), leave “Add a README” unchecked, then use the repo URL in the commands above.

---

## Step 2: Create a Railway account and project

1. Go to **https://railway.app** and sign up (GitHub login is easiest).  
2. Click **“New Project”**.  
3. Choose **“Deploy from GitHub repo”**.  
4. Select your repo (e.g. `meal-planner`).  
5. Railway will **automatically create two services** (frontend + backend) because it detects the monorepo. We only want **one** service.

---

## Step 3: Use only ONE service (required)

Your app is built to run as a **single** service (backend serves the built frontend). The repo includes a `railway.json` that tells Railway how to build and start that single app.

1. **Delete the frontend service:** Click the **frontend** box → open the **⋮** menu (or **Settings**) → **Remove** / **Delete** service.  
2. **Keep only the backend service.**  
3. Click the **backend** service.  
4. Open the **“Settings”** tab.  
5. Set:
   - **Root Directory:** leave **empty** (so it uses the repo root; that’s where `railway.json`, `package.json`, `npm run build`, and `npm start` live).  
   - **Build Command:** `npm run build` (or leave blank; `railway.json` sets it).  
   - **Start Command:** `npm start` (or leave blank; `railway.json` sets it).  
   - **Watch Paths:** leave default.  
6. Under **“Variables”** (or “Environment”), add:

   - `NODE_ENV` = `production`  

   Then add the same keys you use locally (from `backend/.env`), with your real values:

   - `OPENAI_API_KEY` = (your OpenAI key)  
   - `PEXELS_API_KEY` = (your Pexels key)  
   Optional:
   - `UNSPLASH_ACCESS_KEY`  
   - Google Calendar: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (use your production URL when you add the domain).

   Do **not** commit `.env` or paste secrets into the repo; only add them in Railway’s Variables.

7. Save. Railway will redeploy. When the build finishes, open the **“Settings”** tab again and click **“Generate Domain”** (or use the default one). That URL is your app (frontend + API on one host).

---

## Step 4: Persistent database (so data isn’t lost on redeploy)

SQLite stores data in a file. By default the app uses `backend/data/mealflow.db`. On Railway, the disk is reset on deploy unless you use a **volume**.

1. In your Railway project, open your service.  
2. Go to the **“Volumes”** tab.  
3. Click **“Add Volume”**.  
4. Mount path: `/data`  
5. In **Variables**, add:
   - `DATABASE_PATH` = `/data/mealflow.db`  
6. Redeploy so the app starts with the volume mounted. The database file will now persist across deploys.

---

## Step 5: Test production

1. Open the URL Railway gave you (e.g. `https://your-app.up.railway.app`).  
2. You should see the MealFlow UI.  
3. Use the app (preferences, plan, meals, etc.).  
4. If something breaks, check the **“Deployments”** tab → latest deployment → **“View Logs”** for errors.

---

## Summary

| What | Value |
|------|--------|
| Stack | React (Vite) + Node (Express) + SQLite |
| Host | Railway (one service = one URL) |
| Build | `npm run build` (builds frontend, copies into backend) |
| Start | `npm start` (runs backend; serves API + frontend) |
| Env | `NODE_ENV=production` + your API keys in Railway Variables |
| DB | Add a volume at `/data` and set `DATABASE_PATH=/data/mealflow.db` |

After this, you’ll have a single production URL. When you’re ready, you can point your GoDaddy domain to that URL in Railway’s **Settings → Domains** and set the same domain (or a subdomain) in GoDaddy’s DNS.
