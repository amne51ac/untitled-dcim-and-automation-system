# Publishing this repository to GitHub (public)

Run these commands on your machine from the project root (`untitled-dcim-and-automation-system/`). Adjust `YOUR_USER` and `YOUR_REPO`.

## One-time: initialize Git and commit

```bash
cd untitled-dcim-and-automation-system
git init
git add README.md LICENSE .gitignore cleanroom docs
git commit -m "Initial commit: cleanroom research and platform roadmap"
```

## Create the GitHub repository and push

### Option A — GitHub CLI (`gh`)

```bash
gh auth login   # if needed
gh repo create YOUR_REPO --public --source=. --remote=origin --push
```

### Option B — GitHub website + SSH

1. Create a **new public** empty repository (no README) under your account.
2. Then:

```bash
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Option B — HTTPS

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

After the first push, add **branch protection** and **required reviews** on `main` when collaborators join.
