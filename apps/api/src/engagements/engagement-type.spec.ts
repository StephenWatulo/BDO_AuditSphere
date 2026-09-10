import { EngagementType } from '@auditsphere/db';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePlanItemDto, UpdatePlanItemDto } from '../plans/plans.dto';
import { CreateEngagementDto, EngagementListQueryDto, UpdateEngagementDto } from './engagements.dto';
import { buildEngagementWhere } from './engagements.service';

describe('Internal audit engagement type', () => {
  it('is exposed by the generated database enum', () => {
    expect(EngagementType.INTERNAL_AUDIT).toBe('INTERNAL_AUDIT');
  });

  it.each(Object.values(EngagementType))('accepts %s when creating, editing and filtering engagements', (type) => {
    expect(validateSync(plainToInstance(CreateEngagementDto, { title: 'Synthetic audit', type }))).toEqual([]);
    expect(validateSync(plainToInstance(UpdateEngagementDto, { type }))).toEqual([]);
    expect(validateSync(plainToInstance(EngagementListQueryDto, { type }))).toEqual([]);
  });

  it('accepts internal audit on new and edited plan items', () => {
    expect(validateSync(plainToInstance(CreatePlanItemDto, { title: 'Synthetic audit', plannedYear: 2026, engagementType: 'INTERNAL_AUDIT' }))).toEqual([]);
    expect(validateSync(plainToInstance(UpdatePlanItemDto, { engagementType: 'INTERNAL_AUDIT' }))).toEqual([]);
  });

  it('passes the internal audit filter to the engagement query', () => {
    expect(buildEngagementWhere({ type: 'INTERNAL_AUDIT' }, 'user-1')).toMatchObject({ type: 'INTERNAL_AUDIT', deletedAt: null });
  });

  it('still rejects unknown type values', () => {
    const errors = validateSync(plainToInstance(CreateEngagementDto, { title: 'Synthetic audit', type: 'UNKNOWN' }));
    expect(errors).toEqual([expect.objectContaining({ property: 'type', constraints: expect.objectContaining({ isEnum: expect.any(String) }) })]);
  });
});
