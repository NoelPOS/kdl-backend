import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app/app.module';
import { ParentService } from 'src/parent/parent.service';
import { ParentEntity } from 'src/parent/entities/parent.entity';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const parentRepository = dataSource.getRepository(ParentEntity);

  console.log('Fetching all parents...');
  const parents = await parentRepository.find();
  console.log(`Found ${parents.length} parents.`);

  let emptyEmailCount = 0;
  let emptyPhoneCount = 0;

  for (const parent of parents) {
    if (!parent.email || parent.email.trim() === '') {
      emptyEmailCount++;
      console.log(`Parent ${parent.id} (${parent.name}) has missing/empty email.`);
    }
    if (!parent.contactNo || parent.contactNo.trim() === '') {
      emptyPhoneCount++;
      console.log(`Parent ${parent.id} (${parent.name}) has missing/empty phone.`);
    }
  }

  console.log('--- Summary ---');
  console.log(`Total Parents: ${parents.length}`);
  console.log(`Missing Email: ${emptyEmailCount}`);
  console.log(`Missing Phone: ${emptyPhoneCount}`);

  if (emptyPhoneCount > 0) {
    console.log('⚠️ WARNING: Some parents are missing phone numbers.');
    console.log('Writing list of parents with missing phones to missing-phones.json...');
    const missingPhones = parents.filter(p => !p.contactNo || p.contactNo.trim() === '');
    const fs = require('fs');
    fs.writeFileSync('missing-phones.json', JSON.stringify(missingPhones.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        contactNo: p.contactNo
    })), null, 2));
    console.log('Done.');
  } else {
    console.log('✅ GREAT NEWS: All parents have a phone number!');
  }

  await app.close();
}

bootstrap();
