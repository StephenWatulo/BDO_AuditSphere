import { HttpException, HttpStatus } from '@nestjs/common';

export interface GuardFailure {
  guard: string;
  message: string;
}

/** 422 with `{ guards: [{ guard, message }] }` per the API contract. */
export class WorkflowGuardException extends HttpException {
  constructor(
    public readonly guards: GuardFailure[],
    message = 'Workflow guard failed',
  ) {
    super(
      { statusCode: HttpStatus.UNPROCESSABLE_ENTITY, error: 'Unprocessable Entity', message, guards },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
