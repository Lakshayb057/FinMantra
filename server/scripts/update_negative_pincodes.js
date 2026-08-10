const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelPath = 'C:\\Users\\laksh\\Downloads\\OCL & Negative pincode Latest (2).xlsx';
const jsonPath = path.join(__dirname, '..', 'data', 'negative_pincodes.json');

try {
  console.log(`Reading Excel file from: ${excelPath}`);
  if (!fs.existsSync(excelPath)) {
    throw new Error(`File not found at: ${excelPath}`);
  }
  
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  console.log(`Reading sheet: ${sheetName}`);
  const sheet = workbook.Sheets[sheetName];
  
  // Convert sheet to JSON array
  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log(`Parsed ${rows.length} rows from Excel sheet.`);
  
  const pincodes = new Set();
  
  rows.forEach((row, index) => {
    // Look for properties that look like pincode (e.g. 'Pin code', 'pincode', 'Pincode')
    const rawVal = row['Pin code'] || row['Pin Code'] || row['pincode'] || row['Pincode'] || Object.values(row)[0];
    if (rawVal) {
      const pinStr = String(rawVal).trim();
      // Match 6-digit numeric pattern
      if (/^\d{6}$/.test(pinStr)) {
        pincodes.add(pinStr);
      }
    }
  });
  
  const uniqueList = Array.from(pincodes).sort();
  console.log(`Extracted ${uniqueList.length} unique 6-digit negative pincodes.`);
  
  // Ensure the destination data directory exists
  const destDir = path.dirname(jsonPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Overwrite the JSON file
  fs.writeFileSync(jsonPath, JSON.stringify(uniqueList, null, 2), 'utf8');
  console.log(`Successfully wrote ${uniqueList.length} negative pincodes to: ${jsonPath}`);
  
} catch (err) {
  console.error('Error updating negative pincodes:', err);
  process.exit(1);
}
