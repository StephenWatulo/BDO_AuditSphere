import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.schema';
import { apiRoot, repoRoot } from './repo-root';

function envFiles(): string[] {
  const candidates = [join(apiRoot(), '.env'), join(repoRoot(), '.env')];
  return candidates.filter((p) => existsSync(p));
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFiles(),
      // Values already present in process.env win over .env files (dotenv semantics).
      validate: (raw) => validateEnv(raw),
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
