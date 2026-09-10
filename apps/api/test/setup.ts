import { join } from 'node:path';
import { testEnvironment } from './environment';

Object.assign(process.env, testEnvironment(process.env, join(__dirname, '../../../.local-dev/test-storage')));
