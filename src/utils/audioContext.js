export async function resumeAudioContext(audioContext) {
  if (!audioContext) return false;
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
    return true;
  }
  return true;
}
