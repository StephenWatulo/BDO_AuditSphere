import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

/** Imported by AppModule only when `--worker` or `RUN_JOBS=true`. */
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class JobsModule {}

export function jobsEnabled(): boolean {
  const flag = (process.env.RUN_JOBS ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(flag) || process.argv.includes('--worker');
}
