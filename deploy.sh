#!/bin/bash
# Search Star — Quick Deploy Script
# Run this on your local machine after downloading the repo

echo "🌟 Search Star — Deploy to Vercel"
echo "================================="
echo ""

# Check if gh CLI is available
if command -v gh &> /dev/null; then
    echo "✓ GitHub CLI found"
    
    # Create GitHub repo
    echo "→ Creating GitHub repo..."
    gh repo create searchstar --public --source=. --remote=origin --push
    
    echo ""
    echo "✓ Repo created and pushed!"
    echo ""
    echo "Now connect to Vercel:"
    echo "  1. Go to https://vercel.com/new"
    echo "  2. Import 'searchstar' from GitHub"
    echo "  3. Click Deploy"
    echo ""
    echo "Or run: npx vercel --yes"
else
    echo "✗ GitHub CLI not found."
    echo ""
    echo "Option A — Manual GitHub setup:"
    echo "  1. Go to https://github.com/new"
    echo "  2. Create repo named 'searchstar'"
    echo "  3. Run:"
    echo "     git remote add origin https://github.com/YOUR_USERNAME/searchstar.git"
    echo "     git push -u origin main"
    echo ""
    echo "Option B — Direct Vercel deploy (no GitHub needed):"
    echo "  npx vercel --yes"
fi
