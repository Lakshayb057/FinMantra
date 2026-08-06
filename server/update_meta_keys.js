const { Pool } = require('pg');

const uatPool = new Pool({
  connectionString: 'postgresql://postgres:FinMantra123!@finmantra-db.cnm6keucqfmp.ap-south-1.rds.amazonaws.com:5432/finmantra_uat',
  ssl: { rejectUnauthorized: false }
});

const settings = [
  ['wa_api_key', 'EAAVeOgEkwUQBR0suCgkJqWVJSi84GUu8QcWZCy0bNv7jBO5tQ3RmhGt9BzmJgiZBwNcwVoYtrucvrDKlyfa1ZB0ibFjMa7HHZA2Xbm8yzO7fPuz9iZA3ZCMnSzVcLdauBZC8GyNRO3pxemOOlzvlb8Y2bJHIA8MoDGwDOGxrpbK9UUZBooPPCWzKrZBwbq5n2H9MvSQZDZD'],
  ['wa_phone_number_id', '1102087192998270'],
  ['wa_otp_template_name', 'finmantra_otp'],
  ['wa_referral_template_name', 'finmantra_url_temp'],
  ['wa_template_language', 'en'],
  ['wa_api_version', 'v20.0'],
  ['wa_otp_is_auth_template', 'true'],
  ['whatsapp_gateway', 'meta']
];

async function updateUatSettings() {
  for (const [k, v] of settings) {
    await uatPool.query(
      'INSERT INTO settings ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
      [k, v]
    );
  }
  console.log('✅ UAT Database updated with permanent Production Meta WhatsApp credentials!');
  await uatPool.end();
}

updateUatSettings();
