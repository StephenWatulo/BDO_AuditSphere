import { Module } from '@nestjs/common';
import { WorkpapersController } from './workpapers.controller';
import { WorkpapersService } from './workpapers.service';

@Module({
  controllers: [WorkpapersController],
  providers: [WorkpapersService],
  exports: [WorkpapersService],
})
export class WorkpapersModule {}
