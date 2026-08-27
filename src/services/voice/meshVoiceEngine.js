export class MeshVoiceEngine {
  constructor({ socket, localStream, iceServers = [], onRemoteStream, onPeerState, logger = () => {} }) {
    this.socket = socket;
    this.localStream = localStream;
    this.iceServers = iceServers;
    this.onRemoteStream = onRemoteStream;
    this.onPeerState = onPeerState;
    this.logger = logger;
    this.peers = new Map();
  }

  createPeer(peerId, polite = false) {
    if (this.peers.has(peerId)) return this.peers.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, bundlePolicy: 'max-bundle' });
    const state = { peerId, pc, polite, makingOffer: false, ignoreOffer: false, isSettingRemoteAnswerPending: false, queuedCandidates: [], remoteStream: new MediaStream(), retryCount: 0 };
    this.localStream.getAudioTracks().forEach((track) => pc.addTrack(track, this.localStream));
    pc.onicecandidate = ({ candidate }) => { if (candidate) this.socket.emit('voice:ice-candidate', { peerId, candidate }); };
    pc.ontrack = ({ track, streams }) => {
      const stream = streams?.[0] || state.remoteStream;
      if (!streams?.[0]) state.remoteStream.addTrack(track);
      this.onRemoteStream?.(peerId, stream);
    };
    pc.onnegotiationneeded = async () => {
      try {
        state.makingOffer = true;
        await pc.setLocalDescription();
        this.socket.emit('voice:offer', { peerId, offer: pc.localDescription });
      } catch (error) { this.logger('offer failed', error); }
      finally { state.makingOffer = false; }
    };
    pc.onconnectionstatechange = () => {
      this.onPeerState?.(peerId, pc.connectionState);
      if (pc.connectionState === 'failed') this.reconnectPeer(peerId);
    };
    pc.oniceconnectionstatechange = () => this.onPeerState?.(peerId, pc.iceConnectionState);
    pc.onsignalingstatechange = () => this.logger('signaling state', peerId, pc.signalingState);
    this.peers.set(peerId, state);
    return state;
  }

  async handleOffer(peerId, offer) {
    const state = this.createPeer(peerId, String(this.socket.id) > String(peerId));
    const readyForOffer = !state.makingOffer && (state.pc.signalingState === 'stable' || state.isSettingRemoteAnswerPending);
    const offerCollision = !readyForOffer;
    state.ignoreOffer = !state.polite && offerCollision;
    if (state.ignoreOffer) return;
    try {
      state.isSettingRemoteAnswerPending = offer.type === 'answer';
      await state.pc.setRemoteDescription(offer);
      state.isSettingRemoteAnswerPending = false;
      await Promise.all(state.queuedCandidates.splice(0).map((candidate) => state.pc.addIceCandidate(candidate)));
      if (offer.type === 'offer') {
        await state.pc.setLocalDescription();
        this.socket.emit('voice:answer', { peerId, answer: state.pc.localDescription });
      }
    } catch (error) { state.isSettingRemoteAnswerPending = false; this.logger('remote description failed', error); }
  }

  async handleAnswer(peerId, answer) {
    const state = this.peers.get(peerId);
    if (!state || state.pc.signalingState !== 'have-local-offer') return;
    await state.pc.setRemoteDescription(answer);
    await Promise.all(state.queuedCandidates.splice(0).map((candidate) => state.pc.addIceCandidate(candidate)));
  }

  async handleCandidate(peerId, candidate) {
    const state = this.createPeer(peerId, String(this.socket.id) > String(peerId));
    if (state.pc.remoteDescription) await state.pc.addIceCandidate(candidate);
    else state.queuedCandidates.push(candidate);
  }

  removePeer(peerId) {
    const state = this.peers.get(peerId);
    if (!state) return;
    state.pc.ontrack = null;
    state.pc.close();
    state.remoteStream.getTracks().forEach((track) => track.stop());
    this.peers.delete(peerId);
    this.onRemoteStream?.(peerId, null);
  }

  async reconnectPeer(peerId) {
    const state = this.peers.get(peerId);
    if (!state || state.retryCount >= 3) return;
    const retryCount = state.retryCount + 1;
    this.removePeer(peerId);
    window.setTimeout(() => {
      if (this.peers.has(peerId)) return;
      const replacement = this.createPeer(peerId);
      replacement.retryCount = retryCount;
    }, 500 * (2 ** (retryCount - 1)));
  }

  async close() {
    Array.from(this.peers.keys()).forEach((peerId) => this.removePeer(peerId));
  }
}
