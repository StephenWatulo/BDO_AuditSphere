import { Global, Module } from '@nestjs/common';
import { GuardRegistry } from './guard-registry';
import { WorkflowService } from './workflow.service';

@Global()
@Module({
  providers: [GuardRegistry, WorkflowService],
  exports: [GuardRegistry, WorkflowService],
})
export class WorkflowModule {}
