import { transitionState, VoiceCallState } from './stateMachine';

export class CallManager {
  constructor({ signalingService, webrtcManager, presenceService, onStateChange, onError, logger = () => {} } = {}) {
    this.signalingService = signalingService;
    this.webrtcManager = webrtcManager;
    this.presenceService = presenceService;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.logger = logger;
    this.callState = VoiceCallState.Idle;
    this.callId = null;
    this.callerId = null;
    this.receiverId = null;
    this.branchId = null;
    this.socketId = null;
    this._activeIncoming = null;
    this._offerTimeout = null;
    this._missedTimeout = null;
  }

  setState(nextState) {
    this.callState = transitionState(this.callState, nextState);
    this.onStateChange?.(this.callState);
    return this.callState;
  }

  async call(staffId, { user, branchId } = {}) {
    if (!staffId || !user?.id) {
      this.onError?.({ message: 'Unable to start a call right now.' });
      return null;
    }
    this.callId = `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.callerId = user.id;
    this.receiverId = staffId;
    this.branchId = branchId || user.branchId || user.branch || null;
    this.setState(VoiceCallState.Calling);
    try {
      await this.webrtcManager.acquireMicrophone();
      await this.webrtcManager.createPeerConnection();
      const offer = await this.webrtcManager.createOffer();
      this.signalingService.call(staffId, this.callId, user, offer, this.branchId);
      this.setState(VoiceCallState.Ringing);
      this._startTimeout('offer', 30000);
      return this.callId;
    } catch (error) {
      this.logger('call failed', error);
      this.setState(VoiceCallState.Failed);
      this.onError?.({ message: error?.name === 'NotAllowedError' ? 'Microphone permission is required.' : 'Unable to start the call.' });
      return null;
    }
  }

  async accept(callId, { user, branchId } = {}) {
    if (!callId) return null;
    this.callId = callId;
    this.receiverId = user?.id;
    this.branchId = branchId || user?.branchId || user?.branch || null;
    this.setState(VoiceCallState.Connecting);
    try {
      await this.webrtcManager.acquireMicrophone();
      await this.webrtcManager.createPeerConnection();
      this.signalingService.accept(callId, this.callerId, user.id, this.branchId);
      this.setState(VoiceCallState.Connected);
      return callId;
    } catch (error) {
      this.logger('accept failed', error);
      this.setState(VoiceCallState.Failed);
      this.onError?.({ message: error?.name === 'NotAllowedError' ? 'Microphone permission is required.' : 'Unable to connect the call.' });
      return null;
    }
  }

  reject(callId, { user, branchId } = {}) {
    this.signalingService.reject(callId, this.callerId, user?.id, branchId || this.branchId);
    this.setState(VoiceCallState.Rejected);
  }

  cancel(callId, { user, branchId } = {}) {
    this.signalingService.cancel(callId, this.receiverId, user?.id, branchId || this.branchId);
    this.setState(VoiceCallState.Ended);
  }

  end(callId) {
    this.signalingService.cancel(callId, this.receiverId, this.callerId, this.branchId);
    this.dispose();
    this.setState(VoiceCallState.Ended);
  }

  toggleMute() {
    this.webrtcManager?.setMute(!this.isMuted());
  }

  isMuted() {
    return Boolean(this.webrtcManager?.localStream?.getAudioTracks().some((track) => !track.enabled));
  }

  switchMicrophone(deviceId) {
    return this.webrtcManager?.switchMicrophone(deviceId);
  }

  async handleOffer(payload) {
    this._activeIncoming = payload;
    this.callerId = payload.callerId || payload.fromUserId || null;
    this.receiverId = payload.receiverId || payload.toUserId || null;
    this.callId = payload.callId || this.callId;
    this.setState(VoiceCallState.Incoming);
    this._startTimeout('missed', 30000);
  }

  async handleAnswer(payload) {
    if (!payload?.answer || !this.webrtcManager?.peerConnection) return;
    this.setState(VoiceCallState.Connecting);
    await this.webrtcManager.setRemoteDescription(payload.answer);
    this.setState(VoiceCallState.Connected);
  }

  async handleIceCandidate(payload) {
    if (!payload?.candidate) return;
    await this.webrtcManager.addIceCandidate(payload.candidate);
  }

  _startTimeout(type, ms) {
    this._clearTimeout(type);
    this[`${type}Timeout`] = window.setTimeout(() => {
      if (type === 'offer') {
        this.setState(VoiceCallState.Missed);
      }
      if (type === 'missed') {
        this.setState(VoiceCallState.Missed);
        this.onError?.({ message: 'Call timed out.' });
      }
    }, ms);
  }

  _clearTimeout(type) {
    if (this[`${type}Timeout`]) {
      window.clearTimeout(this[`${type}Timeout`]);
      this[`${type}Timeout`] = null;
    }
  }

  restartIce() {
    return this.webrtcManager?.restartIce();
  }

  dispose() {
    this._clearTimeout('offer');
    this._clearTimeout('missed');
    this.callId = null;
    this.callerId = null;
    this.receiverId = null;
    this._activeIncoming = null;
    this.webrtcManager?.cleanup();
    this.setState(VoiceCallState.Idle);
  }
}
