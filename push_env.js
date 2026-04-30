const { execSync } = require('child_process');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const lines = envFile.split('\n');

for (const line of lines) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...rest] = line.split('=');
    let value = rest.join('=');
    value = value.trim();
    if (key === 'GOOGLE_REDIRECT_URI') {
      value = 'https://reportclinics.vercel.app/api/calendar/callback';
    }
    console.log(`Pushing ${key}...`);
    try {
      execSync(`npx -y vercel env rm ${key.trim()} production -y`, { stdio: 'ignore' });
    } catch (e) {}
    try {
      execSync(`npx -y vercel env add ${key.trim()} production`, { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
    } catch (e) {
      console.error(`Failed to push ${key}`);
    }
  }
}
