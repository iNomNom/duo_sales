# 🚛 Duo Enterprizes — Sales Platform Setup Guide
## Complete Step-by-Step Instructions (No Coding Experience Needed)

---

## WHAT YOU HAVE
Your software has:
- ✅ Login system (Admin / Manager / Agent roles)
- ✅ Sales submission form with all 15 fields
- ✅ Dashboard with charts, KPIs, revenue trends
- ✅ Agent leaderboard & company analytics
- ✅ Search, filter, edit, delete sales
- ✅ Export to CSV
- ✅ Automatic email backup on every sale
- ✅ Dark professional UI

---

## STEP 1 — Install Required Tools (One Time Only)

### Install Node.js
1. Go to: https://nodejs.org
2. Click the big green "LTS" button to download
3. Run the installer — click Next, Next, Install (all defaults)
4. When done, open **Command Prompt** (Windows) or **Terminal** (Mac)
5. Type: `node --version` and press Enter
6. You should see something like: `v20.11.0` ✅

---

## STEP 2 — Set Up the Software on Your Computer

Open **Command Prompt** (Windows) or **Terminal** (Mac/Linux):

```bash
# Navigate to where you extracted the zip file
# For example, if it's on your Desktop:
cd Desktop/duo-sales

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## STEP 3 — Configure Your Email Backup

1. In the `backend` folder, find the file called `.env.example`
2. Make a copy of it and rename the copy to `.env` (remove the .example part)
3. Open `.env` with Notepad and fill in:

```
GMAIL_USER=youremail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   ← see below
BACKUP_EMAIL=youremail@gmail.com
JWT_SECRET=make_up_any_long_random_text_here_123456
```

### How to get your Gmail App Password:
1. Go to: https://myaccount.google.com
2. Click "Security" on the left
3. Under "How you sign in to Google", click "2-Step Verification" and turn it ON
4. Go back to Security → scroll down → click "App passwords"
5. Choose "Mail" from the dropdown → click "Generate"
6. Copy the 16-character password → paste it into your .env file

---

## STEP 4 — Run the Software

Open **two** Command Prompt / Terminal windows:

**Window 1 — Start the Backend:**
```bash
cd Desktop/duo-sales/backend
npm start
```
You'll see: `Duo Sales server running on port 5000` ✅

**Window 2 — Start the Frontend:**
```bash
cd Desktop/duo-sales/frontend
npm start
```
A browser will automatically open at: **http://localhost:3000** ✅

---

## STEP 5 — First Login

Open your browser and go to: **http://localhost:3000**

**Default Admin Login:**
- Email: `admin@duoenterprizes.com`
- Password: `admin123`

⚠️ **IMPORTANT: Change this password immediately after logging in!**
Go to Settings → Change Password

---

## STEP 6 — Add Your Sales Agents

1. Log in as Admin
2. Click **Agents** in the sidebar
3. Click **+ Add User**
4. Fill in their name, email, password, and set role to "Agent"
5. Share their login details with them

Each agent logs in and sees **only their own sales** when submitting.
You (admin) can see **all sales** from everyone.

---

## STEP 7 — Your Agents Submit Sales

Tell your agents to:
1. Go to your software URL (e.g. http://localhost:3000)
2. Log in with their credentials
3. Click **+ New Sale** in the sidebar
4. Fill in all the fields and hit **Submit Sale**

The moment they submit:
- ✅ Sale appears in your dashboard instantly
- ✅ Backup email is sent to your Gmail automatically

---

## STEP 8 — Put It Online (So Everyone Can Access It)

Currently the software runs only on YOUR computer. To make it accessible from anywhere (your agents' computers, phones, etc.), you need to deploy it online.

### Easiest Free Option: Railway.app

1. Go to: https://railway.app
2. Sign up with your GitHub account (create one at github.com if needed)
3. Click "New Project" → "Deploy from GitHub repo"
4. Upload your code (I'll provide a guide for this if needed)
5. Add your .env variables in Railway's settings panel
6. Railway gives you a URL like: `https://duo-sales.railway.app`

**Share that URL with your agents — that's your permanent link!**

---

## HOW EMAIL BACKUP WORKS

Every time any agent submits a sale, you automatically receive an email like this:

```
Subject: New Sale: ABC Trucking LLC — $3,500

Date:           2025-05-09
Agent:          John Smith
Carrier Name:   ABC Trucking LLC
Company:        Acme Corp
Lane Details:   Chicago → Dallas
Amount:         $3,500
Status:         Pending
...all 15 fields...
```

This is your backup — even if the software goes down, every sale is in your Gmail.

---

## DEFAULT CREDENTIALS (CHANGE THESE!)

| Role  | Email                         | Password  |
|-------|-------------------------------|-----------|
| Admin | admin@duoenterprizes.com      | admin123  |

---

## TROUBLESHOOTING

**"Cannot find module" error:**
→ Run `npm install` again in the backend and frontend folders

**Login not working:**
→ Make sure the backend is running (Window 1)

**Email not arriving:**
→ Check your .env file — make sure you used an App Password, not your regular Gmail password

**Port already in use:**
→ Change `PORT=5000` to `PORT=5001` in your .env file

---

## SUPPORT

For any issues, bring your error message back to Claude and I'll fix it!
