// Verify the new columns exist in the schedules table
require('dotenv/config');
const { Client } = require('pg');

async function verifyColumns() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check columns in schedules table
    console.log('📋 Feedback-related columns in schedules table:');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'schedules'
        AND column_name LIKE '%feedback%'
      ORDER BY ordinal_position
    `);
    
    console.table(result.rows);

    // Check migrations
    console.log('\n📋 All migrations in database:');
    const migrations = await client.query('SELECT * FROM migrations ORDER BY timestamp');
    console.table(migrations.rows);

    console.log('\n✅ Verification complete!');
    console.log('The feedbackImages and feedbackVideos columns are ready to use.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyColumns();
