import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshVoiceEngine } from '../src/services/voice/meshVoiceEngine.js';

class FakeStream {
  constructor() { this.track = { kind: 'audio', enabled: false, stop() {} }; }
  getAudioTracks() { return [this.track]; }
}

class FakePeerConnection {
  constructor() { this.signalingState = 'stable'; this.connectionState = 'new'; this.iceConnectionState = 'new'; this.senders = []; FakePeerConnection.instances.push(this); }
  addTrack(track, stream) { this.senders.push({ track, stream }); }
  async setLocalDescription(description = { type: 'offer', sdp: 'v=0' }) { this.localDescription = description; this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable'; }
  async setRemoteDescription(description) { this.remoteDescription = description; this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'; }
  async addIceCandidate(candidate) { this.candidate = candidate; }
  close() { this.closed = true; this.connectionState = 'closed'; }
}
FakePeerConnection.instances = [];

function setup() {
  FakePeerConnection.instances = [];
  globalThis.RTCPeerConnection = FakePeerConnection;
  globalThis.MediaStream = class { addTrack() {} getTracks() { return []; } };
  const socket = { id: 'socket-a', emitted: [], emit(event, payload) { this.emitted.push({ event, payload }); } };
  return { socket, engine: new MeshVoiceEngine({ socket, localStream: new FakeStream() }) };
}

test('mesh engine prevents duplicate peers and attaches local audio', () => {
  const { engine } = setup();
  const first = engine.createPeer('peer-b');
  assert.equal(engine.createPeer('peer-b'), first);
  assert.equal(engine.peers.size, 1);
  assert.equal(first.pc.senders.length, 1);
});

test('mesh engine exchanges offer, answer, and queued ICE', async () => {
  const { socket, engine } = setup();
  engine.createPeer('peer-b');
  await engine.handleCandidate('peer-b', { candidate: 'candidate:1' });
  await engine.handleOffer('peer-b', { type: 'offer', sdp: 'v=0' });
  assert.equal(socket.emitted.some(({ event }) => event === 'voice:answer'), true);
  assert.deepEqual(engine.peers.get('peer-b').pc.candidate, { candidate: 'candidate:1' });
  await engine.handleAnswer('peer-b', { type: 'answer', sdp: 'v=0' });
});

test('mesh engine cleans remote peers and all peer connections', async () => {
  const { engine } = setup();
  engine.createPeer('peer-b');
  engine.createPeer('peer-c');
  const peer = engine.peers.get('peer-b').pc;
  engine.removePeer('peer-b');
  assert.equal(peer.closed, true);
  assert.equal(engine.peers.has('peer-b'), false);
  await engine.close();
  assert.equal(engine.peers.size, 0);
  assert.equal(FakePeerConnection.instances.every((instance) => instance.closed), true);
});
