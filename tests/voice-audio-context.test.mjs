import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeAudioContext } from '../src/utils/audioContext.js';

test('resumeAudioContext resumes a suspended audio context', async () => {
  let resumed = false;
  const audioContext = {
    state: 'suspended',
    resume: async () => {
      resumed = true;
      audioContext.state = 'running';
    }
  };

  const result = await resumeAudioContext(audioContext);

  assert.equal(result, true);
  assert.equal(resumed, true);
  assert.equal(audioContext.state, 'running');
});

test('resumeAudioContext safely ignores missing contexts', async () => {
  const result = await resumeAudioContext(null);
  assert.equal(result, false);
});
