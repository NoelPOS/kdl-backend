import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app/app.module';
import { ParentEntity } from 'src/parent/entities/parent.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const parentRepository = dataSource.getRepository(ParentEntity);

  console.log('Fetching all parents...');
  const parents = await parentRepository.find();
  console.log(`Found ${parents.length} parents.`);

  const updates = [];
  const logData = [];

  for (const parent of parents) {
    if (parent.password) {
      console.log(
        `Parent ${parent.id} (${parent.name}) already has a password. Skipping.`,
      );
      continue;
    }

    const defaultPassword = '123456';
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    parent.password = hashedPassword;
    updates.push(parentRepository.save(parent));

    logData.push({
      id: parent.id,
      name: parent.name,
      email: parent.email,
      phone: parent.contactNo,
      password: defaultPassword,
    });
  }

  if (updates.length > 0) {
    console.log(`Updating ${updates.length} parents...`);
    await Promise.all(updates);
    console.log('All parents updated successfully.');

    // Write log to file in the current directory (which will be dist/src/scripts probably or root?)
    // Let's write to absolute path or just 'parent-passwords.json'
    const logContent = JSON.stringify(logData, null, 2);
    fs.writeFileSync('parent-passwords.json', logContent);
    console.log('Password log written to parent-passwords.json');
  } else {
    console.log('No parents needed updates.');
  }

  await app.close();
}

bootstrap();
