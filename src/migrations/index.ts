import * as migration_20260814_035349_initial_schema from './20260814_035349_initial_schema';
import * as migration_20260815_065443_localization_foundation from './20260815_065443_localization_foundation';

export const migrations = [
  {
    up: migration_20260814_035349_initial_schema.up,
    down: migration_20260814_035349_initial_schema.down,
    name: '20260814_035349_initial_schema',
  },
  {
    up: migration_20260815_065443_localization_foundation.up,
    down: migration_20260815_065443_localization_foundation.down,
    name: '20260815_065443_localization_foundation'
  },
];
