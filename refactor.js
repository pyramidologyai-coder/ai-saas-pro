const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace super-admin
  content = content.replace(/\/super-admin/g, '/master-admin');
  content = content.replace(/components\/super-admin/g, 'components/master-admin');

  // Replace /dashboard URLs (being careful not to break (dashboard))
  content = content.replace(/['"`]\/dashboard\//g, match => match[0] + '/admin/');
  content = content.replace(/['"`]\/dashboard['"`]/g, match => match[0] + '/admin' + match[2]);
  
  // Handle relative imports
  content = content.replace(/\.\.\/\.\.\/dashboard\//g, '../../admin/');
  content = content.replace(/\.\.\/dashboard\//g, '../admin/');
  content = content.replace(/\(dashboard\)\/dashboard\//g, '(dashboard)/admin/');

  // check if there is any leftover
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  }
});
