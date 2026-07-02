import { describe, expect, it } from 'vitest';
import { mapTranscriptionProgress } from '../server/pipeline';

describe('caption pipeline progress', () => {
	it('maps Whisper progress into the transcription portion of the pipeline', () => {
		expect(mapTranscriptionProgress(0)).toBe(0.55);
		expect(mapTranscriptionProgress(0.5)).toBeCloseTo(0.725);
		expect(mapTranscriptionProgress(1)).toBe(0.9);
	});

	it('clamps invalid callback values', () => {
		expect(mapTranscriptionProgress(-1)).toBe(0.55);
		expect(mapTranscriptionProgress(2)).toBe(0.9);
		expect(mapTranscriptionProgress(Number.NaN)).toBe(0.55);
	});
});
