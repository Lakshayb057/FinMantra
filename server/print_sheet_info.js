const xlsx = require('xlsx');

const filePath = "C:\\Users\\laksh\\Downloads\\XFIF....ETB NTB & Card Assist & Sales Force& Cred & CDCC - as on 2nd Jul'26 (1).xlsx";

try {
  const workbook = xlsx.readFile(filePath);
  console.log('Sheet Names in workbook:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const parsed = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`Sheet "${sheetName}" has ${parsed.length} rows.`);
  });
} catch (err) {
  console.error('Error:', err);
}
