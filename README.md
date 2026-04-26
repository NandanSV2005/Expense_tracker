# Family Expense Tracker

A shared family expense tracker for Nandan, Vandhana, and Vinod — built with **Python Flask** and **SQLite** (no paid database required).

## Features
- ➕ Add expenses with Amount, Category, Description, and Added By
- 📂 Category dropdown with ability to add custom categories on the fly
- 📊 Dashboard with Month / Year / Overall summary cards
- 🔍 Filter by date range, category, person, or keyword search
- 🗂️ Categories View tab — see expenses grouped by category
- 📥 Export filtered expenses to CSV
- 🔄 Auto-refreshes every 5 seconds for real-time family updates

## Tech Stack
| Layer | Tech |
|-------|------|
| Backend | Python Flask |
| Database | SQLite (built into Python, no setup needed) |
| Frontend | Bootstrap 5, Vanilla JS |
| Deployment | Render / PythonAnywhere / Railway (Free Tier) |

---

## Local Setup (2 Steps Only)

### Step 1 — Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2 — Run the App
```bash
python app.py
```

That's it! The app will:
- Automatically create `expense_tracker.db` in the project folder
- Create the `categories` and `expenses` tables
- Insert all 10 default categories
- Start the server at `http://127.0.0.1:5000`

No `.env` file, no MySQL, no configuration needed.

---

## Project Structure
```
expense_tracker/
├── app.py                  # Flask backend + SQLite logic
├── expense_tracker.db      # SQLite database (auto-created on first run)
├── requirements.txt
├── README.md
├── templates/
│   └── index.html          # Main UI
└── static/
    ├── css/style.css
    └── js/app.js
```

---

## Deployment (Free Forever)

### Option 1: Render.com (Recommended)
1. Push your code to GitHub (excluding `expense_tracker.db` — add it to `.gitignore`).
2. Go to [render.com](https://render.com) and create a new **Web Service**.
3. Connect your GitHub repo.
4. Set the **Start Command** to:
   ```
   gunicorn app:app
   ```
5. Deploy — it's free on the Starter plan.

> **Note:** On Render free tier, the SQLite file resets on each deployment since the filesystem is ephemeral. For persistent storage on Render, upgrade to a paid plan or use PythonAnywhere instead.

### Option 2: PythonAnywhere (Best for SQLite Persistence)
1. Sign up at [pythonanywhere.com](https://www.pythonanywhere.com) (free account).
2. Upload your project files via the **Files** tab.
3. Create a new **Web App** → select **Flask** → point it to `app.py`.
4. Install dependencies in the console:
   ```bash
   pip install flask gunicorn
   ```
5. The SQLite file persists permanently on PythonAnywhere's free plan ✅

---

## .gitignore Reminder
Make sure your `.gitignore` includes:
```
expense_tracker.db
__pycache__/
*.pyc
venv/
.vscode/
```
