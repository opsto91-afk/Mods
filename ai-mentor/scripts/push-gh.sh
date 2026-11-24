#!/usr/bin/env bash
# Repo GitHub pe daalne ke liye — tab tak local commit chalte rahenge.
# Use: ./scripts/push-gh.sh [repo-name]   (default: ai-mentor, private)
set -euo pipefail

REPO="${1:-ai-mentor}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌ Yeh folder git repo nahi hai" >&2
  exit 1
fi

# Pehle local quality gate
echo "🔍 npm run check (typecheck + test + build)…"
npm run check

if ! gh auth status >/dev/null 2>&1; then
  echo "⚠️  gh CLI login nahi hai. Local commits safe hain — baad me push karna."
  exit 0
fi

if gh repo view "opsto91-afk/$REPO" >/dev/null 2>&1; then
  echo "🔗 Existing repo mila: opsto91-afk/$REPO — push kar raha hoon…"
  git push -u origin HEAD
else
  echo "🆕 Naya repo bana raha hai: opsto91-afk/$REPO (private)…"
  if gh repo create "$REPO" --private --source=. --push; then
    echo "✅ Repo ban gaya aur push ho gaya."
  else
    echo "⚠️  Token me repo-create permission nahi hai."
    echo "   Tum manually GitHub pe empty repo banao, phir:"
    echo "     git remote add origin https://github.com/opsto91-afk/$REPO.git"
    echo "     git push -u origin HEAD"
    exit 1
  fi
fi

echo "🎉 Done — https://github.com/opsto91-afk/$REPO"
