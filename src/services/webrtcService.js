export function buildSecureAudioConstraints(constraints = {}) {
  const requestedAudio = constraints.audio ?? true;

  if (requestedAudio === false) {
    return { audio: false, video: false };
  }

  const secureAudio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000
  };

  if (requestedAudio === true) {
    return { audio: secureAudio, video: false };
  }

  return {
    audio: {
      ...secureAudio,
      ...requestedAudio
    },
    video: false
  };
}

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

    const secureConstraints = buildSecureAudioConstraints(constraints);
    this.log('Requesting microphone access with constraints', secureConstraints);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(secureConstraints);
      this.localStream = stream;
      const audioTracks = stream.getAudioTracks();
      this.log('Microphone acquired', audioTracks.length, 'audio tracks');
      if (audioTracks.length === 0) {
        throw new Error('getUserMedia succeeded but returned no audio tracks');
      }
      return stream;
    } catch (error) {
      this.log('Failed to acquire microphone:', error.name, error.message);
      if (secureConstraints.audio !== false) {
        this.log('Retrying with basic audio constraint...');
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.localStream = fallbackStream;
        this.log('Microphone acquired via fallback:', fallbackStream.getAudioTracks().length, 'tracks');
        return fallbackStream;
      }
      throw error;
    }
  }

  createPeerConnection({ iceServers = [{ urls: 'stun:stun.l.google.com:19302' }] } = {}) {
    if (this.peerConnection) {
      this.cleanupPeerConnection();
    }

    const pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all',
      sdpSemantics: 'unified-plan'
    });
    this.peerConnection = pc;
    this.log('✅ Peer connection created with secure transport settings');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.iceCandidates.push(event.candidate);
        if (typeof this.onIceCandidate === 'function') {
          this.onIceCandidate(event.candidate);
        }
        this.log('📍 ICE candidate generated:', event.candidate.candidate.substring(0, 50) + '...');
      }
    };

    pc.onconnectionstatechange = () => {
      this.log('🔗 Connection state:', pc.connectionState);
      if (typeof this.onStateChange === 'function') {
        this.onStateChange(pc.connectionState);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      this.remoteStream = stream;
      this.log('🎧 Remote track received:', event.track.kind, event.track.label, 'enabled:', event.track.enabled);
      if (typeof this.onRemoteStream === 'function') {
        this.onRemoteStream(stream);
      }
      if (typeof this.onTrack === 'function') {
        this.onTrack(event);
      }
    };

    pc.onicegatheringstatechange = () => {
      this.log('🧊 ICE gathering state:', pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      this.log('❄️ ICE connection state:', pc.iceConnectionState);
    };

    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      this.log('📤 Adding', audioTracks.length, 'audio track(s) to peer connection');
      audioTracks.forEach((track) => {
        pc.addTrack(track, this.localStream);
        this.log('📌 Audio track added:', track.label, 'enabled:', track.enabled);
      });
    } else {
      this.log('⚠️ No local stream available to add tracks');
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
    const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer) {
    if (!this.peerConnection) {
      throw new Error('No peer connection available');
    }
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
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
