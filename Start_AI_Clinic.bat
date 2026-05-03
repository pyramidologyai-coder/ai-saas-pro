@echo off
cd /d C:\Users\Ahmad\.gemini\antigravity\scratch\ai-saas-clinics-restaurants
echo Starting Next.js Server...
start cmd /k "npm run dev"
echo Starting Tunnelmole for WhatsApp...
start cmd /k "npx -y tunnelmole 3000"
echo Opening Project in Google Chrome...
start chrome http://localhost:3000
echo All services started! You can close this black window.
exit
