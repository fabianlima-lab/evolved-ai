#!/bin/bash
set -e

echo "✨ Deploying Evolved AI..."

cd /home/deploy/evolved-ai

# Pull latest
git pull origin main

# Backend
echo "📦 Installing backend dependencies..."
cd backend
npm install --production
npx prisma migrate deploy
cd ..

# Frontend
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Restart
echo "🔄 Restarting services..."
pm2 restart all

echo "✅ Deploy complete!"
echo "🔍 Checking health..."
sleep 3
curl -s http://localhost:3001/health
echo ""
pm2 status
