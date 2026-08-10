const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const isWin = process.platform === "win32";
const excelPath = isWin 
  ? 'C:\\Users\\laksh\\Downloads\\Global_Designations_List.xlsx'
  : '/home/ubuntu/downloads/Global_Designations_List.xlsx';

async function run() {
  try {
    console.log(`Reading Excel file from: ${excelPath}`);
    if (!fs.existsSync(excelPath)) {
      throw new Error(`File not found at: ${excelPath}`);
    }
    
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Parsed ${rows.length} rows from Excel.`);
    
    // Create designations table if it doesn't exist
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS designations (
        id SERIAL PRIMARY KEY,
        employment_type VARCHAR(100) NOT NULL,
        designation VARCHAR(150) NOT NULL
      )
    `);
    console.log('Checked/Created table designations.');
    
    // Truncate to reset
    await db.pool.query('TRUNCATE designations RESTART IDENTITY');
    console.log('Truncated designations table.');
    
    // Insert rows in batches
    const batchSize = 100;
    let values = [];
    let paramsIndex = 1;
    let insertedCount = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const empType = row['Employment Type'] ? String(row['Employment Type']).trim() : null;
      const designation = row['Designation'] ? String(row['Designation']).trim() : null;
      
      if (empType && designation) {
        values.push(empType, designation);
        insertedCount++;
        
        // If we reach batch size or end of rows, perform insert
        if (insertedCount % batchSize === 0 || i === rows.length - 1) {
          const placeholders = [];
          for (let j = 0; j < values.length / 2; j++) {
            placeholders.push(`($${j * 2 + 1}, $${j * 2 + 2})`);
          }
          
          if (placeholders.length > 0) {
            await db.pool.query(
              `INSERT INTO designations (employment_type, designation) VALUES ${placeholders.join(', ')}`,
              values
            );
          }
          values = [];
        }
      }
    }
    
    // Create index on employment_type
    await db.pool.query('CREATE INDEX IF NOT EXISTS idx_designations_emp_type ON designations (employment_type)');
    console.log(`Successfully imported ${insertedCount} designation records into database.`);
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await db.pool.end();
  }
}

run();
