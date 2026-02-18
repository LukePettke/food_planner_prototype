const fs = require('fs');
const path = require('path');
const src = path.join(process.cwd(), 'frontend', 'dist');
const dest = path.join(process.cwd(), 'backend', 'public');
if (!fs.existsSync(src)) {
  console.error('Frontend build not found. Run: npm run build --workspace=frontend');
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied frontend build to backend/public');
