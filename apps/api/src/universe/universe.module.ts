import { Module } from '@nestjs/common';
import { UniverseController } from './universe.controller';
import { UniverseService } from './universe.service';

@Module({
  controllers: [UniverseController],
  providers: [UniverseService],
  exports: [UniverseService],
})
export class UniverseModule {}
