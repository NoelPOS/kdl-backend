
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ClassOption } from '../src/class-option/entities/class-option.entity';

async function verifyClassOptions() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    entities: [ClassOption],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    const classOptionRepo = dataSource.getRepository(ClassOption);
    const options = await classOptionRepo.find();

    console.log('--- Current Class Options Data ---');
    const data = options.map(o => ({
      id: o.id,
      mode: o.classMode,
      type: o.optionType
    })).sort((a,b) => a.id - b.id);
    
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

verifyClassOptions();
