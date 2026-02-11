
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ClassOption } from '../src/class-option/entities/class-option.entity';
import * as path from 'path';

async function fixClassOptions() {
  console.log('🔧 Starting Class Options Fix...');

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
    console.log('✅ Connected to database');

    const classOptionRepo = dataSource.getRepository(ClassOption);
    const options = await classOptionRepo.find();

    console.log(`Found ${options.length} class options to check.`);

    let updatedCount = 0;

    for (const option of options) {
      let newType = 'check'; // Default fallback
      const mode = option.classMode.toLowerCase();

      if (mode.includes('camp')) {
        newType = 'camp';
      } else if (mode.includes('fixed') || mode.includes('times')) {
        newType = 'fixed'; // In the dialog code, 'times' also implies fixed logic
      } else {
        newType = 'check';
      }

      // Special case: '1 times check' or anything with 'check' explicitly should remain 'check'
      // The previous logic puts "12 times check" into 'fixed' because of 'times'.
      // Let's refine based on the Dialog's getOptionType fallback logic which was:
      // if (name.includes('camp')) return 'camp';
      // if (name.includes('fixed') || name.includes('times')) return 'fixed';
      // BUT "12 times check" should probably be 'check'? 
      // Actually, looking at class_options.csv:
      // 2,12 times check,12,14700 -> This likely implies a check-in system, not fixed schedule?
      // Wait, "12 times fixed" implies you pick 12 fixed slots.
      // "12 times check" implies you buy 12 credits and check in when you come.
      // So 'check' is correct for "12 times check".
      
      if (mode.includes('check')) {
        newType = 'check';
      }

      if (option.optionType !== newType) {
        console.log(`Updating ID ${option.id} (${option.classMode}): ${option.optionType} -> ${newType}`);
        option.optionType = newType;
        await classOptionRepo.save(option);
        updatedCount++;
      }
    }

    console.log(`✅ Updated ${updatedCount} class options.`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('🔌 Disconnected from database');
    }
  }
}

fixClassOptions();
