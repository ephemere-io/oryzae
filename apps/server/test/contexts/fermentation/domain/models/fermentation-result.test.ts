import { describe, expect, it } from 'vitest';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result.js';

const generateId = () => 'test-id';

describe('FermentationResult', () => {
  it('creates with pending status', () => {
    const result = FermentationResult.create(
      {
        userId: 'u1',
        questionId: 'q1',
        entryId: 'e1',
        targetPeriod: '2025-12-01',
      },
      generateId,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe('pending');
      expect(result.value.id).toBe('test-id');
      expect(result.value.questionId).toBe('q1');
    }
  });

  it('rejects empty target period', () => {
    const result = FermentationResult.create(
      {
        userId: 'u1',
        questionId: 'q1',
        entryId: 'e1',
        targetPeriod: '  ',
      },
      generateId,
    );

    expect(result.success).toBe(false);
  });

  it('transitions status with withStatus', () => {
    const result = FermentationResult.create(
      { userId: 'u1', questionId: 'q1', entryId: 'e1', targetPeriod: '2025-12-01' },
      generateId,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    const processing = result.value.withStatus('processing');
    expect(processing.success).toBe(true);
    if (processing.success) {
      expect(processing.value.status).toBe('processing');
      expect(processing.value.id).toBe(result.value.id);
    }
  });

  it('roundtrips through toProps/fromProps', () => {
    const result = FermentationResult.create(
      { userId: 'u1', questionId: 'q1', entryId: 'e1', targetPeriod: '2025-12-01' },
      generateId,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    const props = result.value.toProps();
    const restored = FermentationResult.fromProps(props);
    expect(restored.toProps()).toEqual(props);
  });
});
