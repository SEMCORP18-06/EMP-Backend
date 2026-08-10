import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(filepath, callback);
      }
    } else {
      callback(filepath);
    }
  }
}

const clientDir = 'c:/Users/Divyansh Agarwal/Desktop/SEMCORP/Antigravity/Agents/Enquiry Portal Agent/client';
walk(clientDir, (file) => {
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('localhost:5000')) {
      console.log('Found hardcoded localhost:5000 in:', file);
      // Print lines containing it
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('localhost:5000')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
