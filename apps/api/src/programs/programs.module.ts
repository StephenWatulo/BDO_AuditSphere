import { Module } from '@nestjs/common';
import { WorkpapersModule } from '../workpapers/workpapers.module';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
  imports: [WorkpapersModule],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
