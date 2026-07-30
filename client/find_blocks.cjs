const fs = require('fs');
const lines = fs.readFileSync('src/components/AdminDashboard.jsx', 'utf8').split('\n');
let openBraces = 0;
let activeTabSettingsLevel = -1;
let formBuilderLevel = -1;

for(let i=4000; i<lines.length; i++) {
  const l = lines[i];
  for(let char of l) {
    if(char === '{') openBraces++;
    if(char === '}') openBraces--;
  }
  
  if(l.includes('activeTab === \\\'settings\\\' && (')) {
    console.log('activeTab settings starts at line ' + (i+1) + ', braces: ' + openBraces);
    activeTabSettingsLevel = openBraces;
  }
  if(activeTabSettingsLevel !== -1 && openBraces < activeTabSettingsLevel) {
    console.log('activeTab settings ends around line ' + (i+1));
    activeTabSettingsLevel = -1;
  }
  
  if(l.includes('activeSettingsSubTab === \\\'form_builder\\\'')) {
    console.log('form_builder starts at line ' + (i+1) + ', braces: ' + openBraces);
    formBuilderLevel = openBraces;
  }
  if(formBuilderLevel !== -1 && openBraces < formBuilderLevel) {
    console.log('form_builder ends around line ' + (i+1));
    formBuilderLevel = -1;
  }
}
