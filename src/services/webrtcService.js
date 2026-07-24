export class WebRTCService {
  constructor({ debug = false } = {}) {
    this.debug = debug;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceCandidates = [];
    this.onStateChange = null;
    this.onRemoteStream = null;
    this.onError = null;
    this.onTrack = null;
    this.onIceCandidate = null;
  }

  log(...args) {
    if (this.debug) {
      console.info('[WebRTCService]', ...args);
    }
  }

  async acquireMicrophone(constraints = { audio: true }) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone access');
    }

    this.log('Requesting microphone access');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream = stream;
    this.log('Microphone acquired', stream.getAudioTracks().length);
    return stream;
  }

  createPeerConnection({ iceServers = [{ urls: 'stun:stun.l.google.com:19302' }] } = {}) {
    if (this.peerConnection) {
      this.cleanupPeerConnection();
    }

    const pc = new RTCPeerConnection({ iceServers });
    this.peerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.iceCandidates.push(event.candidate);
        if (typeof this.onIceCandidate === 'function') {
          this.onIceCandidate(event.candidate);
        }
        this.log('ICE candidate generated');
      }
    };

    pc.onconnectionstatechange = () => {
      this.log('Connection state', pc.connectionState);
      if (typeof this.onStateChange === 'function') {
        this.onStateChange(pc.connectionState);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      this.remoteStream = stream;
      this.log('Remote track received');
      if (typeof this.onRemoteStream === 'function') {
        this.onRemoteStream(stream);
      }
      if (typeof this.onTrack === 'function') {
        this.onTrack(event);
      }
    };

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    return pc;
  }

  attachLocalStream(stream) {
    this.localStream = stream;
    if (this.peerConnection && stream) {
      stream.getAudioTracks().forEach((track) => {
        this.peerConnection.addTrack(track, stream);
      });
    }
  }

  async setRemoteDescription(description) {
    if (!this.peerConnection) {
      throw new Error('No peer connection available');
    }
    await this.peerConnection.setRemoteDescription(description);
  }

  async createOffer() {
    if (!this.peerConnection) {
      throw new Error('No peer connection available');
    }
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer) {
    if (!this.peerConnection) {
      throw new Error('No peer connection available');
    }
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async addIceCandidate(candidate) {
    if (!this.peerConnection || !candidate) return;
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      this.log('Failed to add ICE candidate', error);
    }
  }

  async addIceCandidates(candidates = []) {
    for (const candidate of candidates) {
      await this.addIceCandidate(candidate);
    }
  }

  setMute(muted) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  async cleanupPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.iceCandidates = [];
  }

  stopLocalStream() {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }

  cleanup() {
    this.cleanupPeerConnection();
    this.stopLocalStream();
    this.remoteStream = null;
  }
}

export const createWebRTCService = (options) => new WebRTCService(options);
