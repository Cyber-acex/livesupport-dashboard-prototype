import { buildSecureAudioConstraints } from '../webrtcService';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

export class WebRTCManager {
  constructor({ onRemoteStream, onStateChange, onStats, onError, onIceCandidate, logger = () => {} } = {}) {
    this.onRemoteStream = onRemoteStream;
    this.onStateChange = onStateChange;
    this.onStats = onStats;
    this.onError = onError;
    this.onIceCandidate = onIceCandidate;
    this.logger = logger;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.remoteAudio = null;
    this.queuedCandidates = [];
    this.iceRestartTimer = null;
    this.statsTimer = null;
    this.connectionState = 'idle';
    this.iceConnectionState = 'new';
    this.signalingState = 'stable';
    this.quality = 'Excellent';
  }

  async acquireMicrophone(constraints = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser does not support microphone access');
    }

    const secureConstraints = buildSecureAudioConstraints({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
        sampleSize: 16,
        ...constraints.audio
      },
      video: false
    });

    const stream = await navigator.mediaDevices.getUserMedia(secureConstraints);
    this.localStream = stream;
    if (this.peerConnection) {
      stream.getAudioTracks().forEach((track) => {
        this.peerConnection.addTrack(track, stream);
      });
    }
    this.logger('microphone acquired', stream.getAudioTracks().length);
    return stream;
  }

  async switchMicrophone(deviceId) {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = stream;
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') {
          sender.replaceTrack(stream.getAudioTracks()[0]);
        }
      });
    }
    return stream;
  }

  createPeerConnection({ iceServers = DEFAULT_ICE_SERVERS } = {}) {
    if (this.peerConnection) return this.peerConnection;

    const pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all',
      sdpSemantics: 'unified-plan'
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.logger('ice candidate generated');
        this.onIceCandidate?.(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      this.remoteStream = stream;
      this.attachRemoteStream(stream);
      this.onRemoteStream?.(stream);
    };

    pc.onconnectionstatechange = () => {
      this.connectionState = pc.connectionState;
      this.onStateChange?.({ connectionState: this.connectionState, quality: this.quality });
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      this.iceConnectionState = pc.iceConnectionState;
      this.onStateChange?.({ connectionState: this.connectionState, iceConnectionState: this.iceConnectionState, quality: this.quality });
    };

    pc.onicegatheringstatechange = () => {
      this.onStateChange?.({ connectionState: this.connectionState, iceGatheringState: pc.iceGatheringState, quality: this.quality });
    };

    pc.onsignalingstatechange = () => {
      this.signalingState = pc.signalingState;
      this.onStateChange?.({ connectionState: this.connectionState, signalingState: this.signalingState, quality: this.quality });
    };

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    this.peerConnection = pc;
    this.startStatsMonitoring();
    return pc;
  }

  async createOffer() {
    if (!this.peerConnection) this.createPeerConnection();
    const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer) {
    if (!this.peerConnection) this.createPeerConnection();
    await this.peerConnection.setRemoteDescription(offer);
    for (const candidate of this.queuedCandidates.splice(0)) {
      await this.addIceCandidate(candidate);
    }
    const answer = await this.peerConnection.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description) {
    if (!this.peerConnection) this.createPeerConnection();
    await this.peerConnection.setRemoteDescription(description);
    for (const candidate of this.queuedCandidates.splice(0)) {
      await this.addIceCandidate(candidate);
    }
  }

  async addIceCandidate(candidate) {
    if (!candidate) return;
    if (!this.peerConnection) {
      this.queuedCandidates.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      this.logger('failed to add ICE candidate', error);
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

  async restartIce() {
    if (!this.peerConnection || this.iceRestartTimer) return;
    this.iceRestartTimer = window.setTimeout(async () => {
      this.iceRestartTimer = null;
      try {
        await this.peerConnection.restartIce?.();
      } catch (error) {
        this.logger('ICE restart failed', error);
      }
    }, 800);
  }

  attachRemoteStream(stream) {
    if (!stream) return;
    this.remoteAudio?.remove();
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audio.srcObject = stream;
    audio.dataset.voiceCall = 'remote';
    audio.style.position = 'fixed';
    audio.style.left = '-9999px';
    audio.style.width = '1px';
    audio.style.height = '1px';
    document.body.appendChild(audio);
    this.remoteAudio = audio;
    audio.play().catch(() => {});
  }

  startStatsMonitoring() {
    this.stopStatsMonitoring();
    this.statsTimer = window.setInterval(() => {
      this.collectStats();
    }, 2000);
  }

  stopStatsMonitoring() {
    if (this.statsTimer) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  async collectStats() {
    if (!this.peerConnection) return;
    try {
      const report = await this.peerConnection.getStats();
      let rtt = null;
      let packetLoss = null;
      let bitrate = null;
      report.forEach((entry) => {
        if (entry.type === 'candidate-pair' && entry.currentRoundTripTime != null) {
          rtt = entry.currentRoundTripTime;
        }
        if (entry.type === 'inbound-rtp' && entry.framesDecoded != null) {
          bitrate = entry.bytesReceived;
        }
        if (entry.type === 'transport' && entry.packetLossSent != null) {
          packetLoss = entry.packetLossSent;
        }
      });
      if (rtt != null) {
        if (rtt < 0.05) this.quality = 'Excellent';
        else if (rtt < 0.1) this.quality = 'Good';
        else if (rtt < 0.2) this.quality = 'Fair';
        else this.quality = 'Poor';
      }
      this.onStats?.({ rtt, packetLoss, bitrate, quality: this.quality });
    } catch (error) {
      this.logger('stats collection failed', error);
    }
  }

  async cleanup() {
    this.stopStatsMonitoring();
    this.iceRestartTimer && window.clearTimeout(this.iceRestartTimer);
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.remoteAudio?.remove();
    this.remoteAudio = null;
    this.queuedCandidates = [];
  }
}
