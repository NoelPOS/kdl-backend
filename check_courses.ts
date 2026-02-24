import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const res = await client.query('SELECT id, title, "ageRange", medium FROM courses ORDER BY id ASC');
  fs.writeFileSync('courses_dump.json', JSON.stringify(res.rows, null, 2));
  console.log('Saved to courses_dump.json');
  await client.end();
}

main().catch(console.error);
