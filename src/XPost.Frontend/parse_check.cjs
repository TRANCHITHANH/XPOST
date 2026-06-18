const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

try {
  const code = fs.readFileSync(path.join(__dirname, 'src/pages/FacebookAdsDashboard.tsx'), 'utf8');
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });
  console.log('Parse successful! No syntax errors.');
} catch (err) {
  console.error('Syntax Error found:');
  console.error(err.message);
  if (err.loc) {
    console.error(`Line: ${err.loc.line}, Column: ${err.loc.column}`);
  }
}
