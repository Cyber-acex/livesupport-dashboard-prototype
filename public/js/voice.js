(function(){
  if (typeof io === 'undefined') return;

  const state = {
    user: null,
    socket: null,
    rawLocalStream: null,
    localStream: null,
    processedLocalStream: null,
    noiseAudioContext: null,
    peers: {},
    currentSession: null,
    currentChannelId: null,
    activeTab: 'staff',
    channels: [],
    staff: [],
    isMuted: false,
    isDeafened: false,
    noiseSuppressionEnabled: true,
    timerId: null,
    callStartedAt: null,
    audioElements: {},
    voiceToasts: [],
    pttSession: null
  };

  const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  const panelHtml = `
    <div id="voiceFloatingContainer" class="voice-floating-control">
      <button id="voiceFloatingButton" class="voice-floating-button" aria-label="Open voice chat panel">🗣</button>
      <div id="voiceWidget" class="voice-widget closed" aria-hidden="true">
        <div class="voice-panel-header">
          <div class="voice-phone-sensor">
            <span></span><span></span>
          </div>
          <div>
            <div class="voice-panel-title">Staff Voice</div>
            <div class="voice-panel-subtitle">Office smart dialer</div>
          </div>
          <button id="voiceClose" class="voice-toggle" aria-label="Close voice panel">✕</button>
        </div>
        <div class="voice-panel-body">
          <div class="voice-screen-frame">
            <div class="voice-status-row">
              <span id="voiceStatusLabel">Not connected</span>
              <span id="voiceTimer">00:00</span>
            </div>
            <div id="voiceTabStaffPanel" class="voice-tab-panel active"></div>
            <div id="voiceTabChannelsPanel" class="voice-tab-panel"></div>
            <div id="voiceTabActivePanel" class="voice-tab-panel"></div>
          </div>
          <div class="voice-toolbar">
            <button id="voiceTabStaff" class="voice-tab active" data-tab="staff"><span class="voice-tab-icon">👥</span><span>Staff</span></button>
            <button id="voiceTabChannels" class="voice-tab" data-tab="channels"><span class="voice-tab-icon">#️⃣</span><span>Channel</span></button>
            <button id="voiceTabActive" class="voice-tab" data-tab="active"><span class="voice-tab-icon">🎧</span><span>Session</span></button>
          </div>
        </div>
      </div>
    </div>
    <div id="voiceToastContainer" class="voice-toast-container"></div>
  `;

  function createPanel() {
    if (document.getElementById('voiceWidget')) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = panelHtml;
    document.body.appendChild(wrapper);

    document.getElementById('voiceFloatingButton').addEventListener('click', togglePanel);
    document.getElementById('voiceClose').addEventListener('click', togglePanel);
    document.getElementById('voiceTabStaff').addEventListener('click', () => switchTab('staff'));
    document.getElementById('voiceTabChannels').addEventListener('click', () => switchTab('channels'));
    document.getElementById('voiceTabActive').addEventListener('click', () => switchTab('active'));

    render();
  }

  function togglePanel() {
    const panel = document.getElementById('voiceWidget');
    if (!panel) return;
    panel.classList.toggle('closed');
    panel.setAttribute('aria-hidden', String(panel.classList.contains('closed')));
  }

  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.voice-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    document.querySelectorAll('.voice-tab-panel').forEach(el => el.classList.toggle('active', el.id === `voiceTab${capitalize(tab)}Panel`));
    render();
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('voiceToastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `voice-toast voice-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 350);
    }, 3800);
  }

  function showIncomingNotification({ title, message, notificationLabel = 'Incoming Call', acceptLabel = 'Accept', rejectLabel = 'Reject', onAccept, onReject }) {
    const panel = document.getElementById('voiceWidget');
    const floatingButton = document.getElementById('voiceFloatingButton');

    if (panel && panel.classList.contains('closed')) {
      panel.classList.remove('closed');
      panel.setAttribute('aria-hidden', 'false');
    }
    panel?.classList.add('incoming-call');
    floatingButton?.classList.add('incoming');

    let overlay = document.getElementById('voiceIncomingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'voiceIncomingOverlay';
      overlay.className = 'voice-incoming-overlay';
      document.body.appendChild(overlay);
    }

    const notification = document.createElement('div');
    notification.className = 'voice-incoming-notification';
    notification.innerHTML = `
      <div class="voice-notification-backdrop"></div>
      <div class="voice-notification-content">
        <div class="voice-notification-avatar">📞</div>
        <div class="voice-notification-info">
          <div class="voice-notification-label">${notificationLabel}</div>
          <div class="voice-notification-caller">${title.replace(' is calling', '')}</div>
          <div class="voice-notification-description">${message}</div>
        </div>
        <div class="voice-notification-actions">
          <button type="button" class="voice-btn voice-btn-accept voice-notification-accept">
            <span>✓</span> ${acceptLabel}
          </button>
          <button type="button" class="voice-btn voice-btn-reject voice-notification-reject">
            <span>✕</span> ${rejectLabel}
          </button>
        </div>
      </div>
    `;
    overlay.appendChild(notification);

    const acceptBtn = notification.querySelector('.voice-notification-accept');
    const rejectBtn = notification.querySelector('.voice-notification-reject');

    let timeoutId = null;
    const removeNotification = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      floatingButton?.classList.remove('incoming');
      panel?.classList.remove('incoming-call');
      if (notification.parentElement) notification.parentElement.removeChild(notification);
      if (overlay && overlay.childElementCount === 0 && overlay.parentElement) overlay.parentElement.removeChild(overlay);
    };

    acceptBtn?.addEventListener('click', () => {
      removeNotification();
      if (typeof onAccept === 'function') onAccept();
    });
    rejectBtn?.addEventListener('click', () => {
      removeNotification();
      if (typeof onReject === 'function') onReject();
    });

    timeoutId = setTimeout(() => {
      removeNotification();
      if (typeof onReject === 'function') onReject();
    }, 20000);
  }

  async function getLocalStream(forceNew = false) {
    if (!state.rawLocalStream || forceNew) {
      if (state.rawLocalStream) {
        state.rawLocalStream.getTracks().forEach(track => track.stop());
        state.rawLocalStream = null;
      }
      try {
        const rawStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true
          }
        });
        state.rawLocalStream = rawStream;
        startVoiceActivityDetection(rawStream);
      } catch (err) {
        console.warn('getUserMedia failed', err);
        showToast('Microphone permission required for voice chat.', 'warning');
        throw err;
      }
    }

    const stream = selectLocalStreamSource();
    stream.getAudioTracks().forEach(track => {
      track.enabled = !state.isMuted;
    });
    if (forceNew) {
      replaceLocalAudioTrack(stream);
    }
    return stream;
  }

  function selectLocalStreamSource() {
    if (!state.rawLocalStream) return null;

    if (state.noiseSuppressionEnabled) {
      if (!state.processedLocalStream) {
        state.processedLocalStream = createNoiseProcessedStream(state.rawLocalStream);
      }
      state.localStream = state.processedLocalStream;
    } else {
      cleanupNoiseProcessing();
      state.localStream = state.rawLocalStream;
    }
    return state.localStream;
  }

  function cleanupNoiseProcessing() {
    if (state.noiseAudioContext) {
      state.noiseAudioContext.close().catch(() => {});
      state.noiseAudioContext = null;
    }
    if (state.processedLocalStream) {
      state.processedLocalStream.getTracks().forEach(track => track.stop());
      state.processedLocalStream = null;
    }
  }

  function stopLocalStream() {
    cleanupNoiseProcessing();

    if (state.rawLocalStream) {
      state.rawLocalStream.getTracks().forEach(track => track.stop());
      state.rawLocalStream = null;
    }
    if (state.localStream && state.localStream !== state.rawLocalStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    state.localStream = null;
  }

  function createNoiseProcessedStream(rawStream) {
    if (!window.AudioContext || !rawStream) return rawStream;
    cleanupNoiseProcessing();

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(rawStream);

    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 100;
    highpass.Q.value = 0.7;

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000;
    lowpass.Q.value = 0.7;

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-30, audioContext.currentTime);
    compressor.knee.setValueAtTime(10, audioContext.currentTime);
    compressor.ratio.setValueAtTime(4, audioContext.currentTime);
    compressor.attack.setValueAtTime(0.008, audioContext.currentTime);
    compressor.release.setValueAtTime(0.2, audioContext.currentTime);

    const gateGain = audioContext.createGain();
    gateGain.gain.value = 0.01;
    const destination = audioContext.createMediaStreamDestination();

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(gateGain);
    gateGain.connect(destination);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    lowpass.connect(analyser);

    const data = new Float32Array(analyser.fftSize);
    let smoothedGain = 0.01;
    const threshold = 0.018;
    const openGain = 1;
    const closedGain = 0.05;

    function processGate() {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);
      const targetGain = rms > threshold ? openGain : closedGain;
      const smoothing = rms > threshold ? 0.15 : 0.08;
      smoothedGain += (targetGain - smoothedGain) * smoothing;
      gateGain.gain.setTargetAtTime(smoothedGain, audioContext.currentTime, 0.01);
      if (state.noiseAudioContext === audioContext) {
        requestAnimationFrame(processGate);
      }
    }
    processGate();

    state.noiseAudioContext = audioContext;
    return destination.stream;
  }

  function replaceLocalAudioTrack(stream) {
    const newTrack = stream.getAudioTracks()[0];
    if (!newTrack) return;
    Object.values(state.peers).forEach(peer => {
      const pc = peer.pc;
      if (!pc) return;
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (sender) {
        sender.replaceTrack(newTrack).catch(err => console.warn('Failed to replace local audio track', err));
      } else {
        pc.addTrack(newTrack, stream);
      }
    });
  }

  async function toggleNoiseSuppression() {
    state.noiseSuppressionEnabled = !state.noiseSuppressionEnabled;
    showToast(`Noise suppression ${state.noiseSuppressionEnabled ? 'enabled' : 'disabled'}`);
    if (!state.rawLocalStream) {
      await getLocalStream();
    }
    const stream = selectLocalStreamSource();
    if (stream) {
      replaceLocalAudioTrack(stream);
    }
    render();
  }

  function createPeerConnection(targetUserId, sessionId, onTrack) {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pc.onicecandidate = event => {
      if (event.candidate) {
        state.socket.emit('voice:signal', {
          targetUserId,
          sessionId,
          signal: { candidate: event.candidate },
          type: 'ice'
        });
      }
    };
    pc.ontrack = event => {
      if (typeof onTrack === 'function') onTrack(event);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        cleanupPeer(targetUserId);
      }
    };
    if (state.localStream && !state.isDeafened) {
      state.localStream.getAudioTracks().forEach(track => pc.addTrack(track, state.localStream));
    }
    return pc;
  }

  function cleanupPeer(userId) {
    const peer = state.peers[userId];
    if (!peer) return;
    if (peer.pc) {
      peer.pc.close();
    }
    if (peer.audio) {
      peer.audio.pause();
      peer.audio.remove();
    }
    delete state.peers[userId];
  }

  function render() {
    const staffPanel = document.getElementById('voiceTabStaffPanel');
    const channelsPanel = document.getElementById('voiceTabChannelsPanel');
    const activePanel = document.getElementById('voiceTabActivePanel');
    const statusLabel = document.getElementById('voiceStatusLabel');
    const timerLabel = document.getElementById('voiceTimer');

    if (statusLabel) {
      let status = 'Not connected';
      if (state.currentSession) {
        status = state.currentSession.type === 'private' ? 'In call' : state.currentSession.type === 'broadcast' ? 'Broadcast active' : 'In channel';
      }
      statusLabel.textContent = status;
    }
    if (timerLabel) {
      timerLabel.textContent = formatTimer(getSessionDuration());
    }

    if (staffPanel) {
      staffPanel.innerHTML = '';
      const list = state.staff.filter(item => item.userId !== state.user?.id);
      if (!list.length) {
        staffPanel.innerHTML = '<div class="voice-empty">No other staff online</div>';
      }
      list.forEach(item => {
        const isCallActive = state.currentSession && state.currentSession.type === 'private' && state.currentSession.peer?.userId === item.userId;
        const isPTTActive = state.pttSession && Number(state.pttSession.targetUserId) === Number(item.userId);
        const card = document.createElement('div');
        card.className = 'voice-staff-card';
        card.innerHTML = `
          <div class="voice-avatar ${item.speaking ? 'speaking' : ''}">${item.avatarUrl ? `<img src="${item.avatarUrl}" alt="${item.name}"/>` : item.name.charAt(0).toUpperCase()}</div>
          <div class="voice-details">
            <div class="voice-name">${item.name || 'Staff'}</div>
            <div class="voice-meta">${item.role || 'Agent'} · ${item.status || 'online'}</div>
          </div>
          <div class="voice-actions">
            <button class="voice-btn voice-btn-ptt ${isPTTActive ? 'active' : ''}" title="Push and hold to talk" data-ptt-id="${item.userId}" data-ptt-name="${item.name}">
              <span class="voice-ptt-icon">🎤</span>
              <span class="voice-ptt-wave"></span>
            </button>
            <button class="voice-btn ${isCallActive ? 'voice-btn-danger' : 'voice-btn-secondary'}" data-action="${isCallActive ? 'hangup' : 'private'}" data-id="${item.userId}">${isCallActive ? 'Hang up' : 'Call'}</button>
            ${!isCallActive ? `<button class="voice-btn voice-btn-primary" data-action="broadcast-invite" data-id="${item.userId}">Invite to Broadcast</button>` : ''}
          </div>
        `;
        staffPanel.appendChild(card);
      });
      staffPanel.querySelectorAll('[data-action="private"]').forEach(btn => btn.addEventListener('click', onPrivateCallClick));
      staffPanel.querySelectorAll('[data-action="hangup"]').forEach(btn => btn.addEventListener('click', onHangupClick));
      staffPanel.querySelectorAll('[data-action="broadcast-invite"]').forEach(btn => btn.addEventListener('click', onBroadcastInviteClick));
      staffPanel.querySelectorAll('.voice-btn-ptt').forEach(btn => {
        btn.addEventListener('mousedown', onPTTStart);
        btn.addEventListener('mouseup', onPTTEnd);
        btn.addEventListener('mouseleave', onPTTEnd);
      });
    }

    if (channelsPanel) {
      channelsPanel.innerHTML = '';
      if (!state.channels.length) {
        channelsPanel.innerHTML = '<div class="voice-empty">No voice channels configured</div>';
      }
      state.channels.forEach(channel => {
        const active = state.currentChannelId === channel.id;
        const card = document.createElement('div');
        card.className = `voice-channel-card ${active ? 'active' : ''}`;
        card.innerHTML = `
          <div>
            <div class="voice-channel-name">${channel.name}</div>
            <div class="voice-channel-meta">${channel.description || ''}</div>
          </div>
          <div class="voice-channel-actions">
            <span class="voice-channel-count">${channel.memberCount || 0} members</span>
            <button class="voice-btn ${active ? 'voice-btn-secondary' : 'voice-btn-primary'}" data-action="${active ? 'leave' : 'join'}" data-id="${channel.id}">${active ? 'Leave' : 'Join'}</button>
          </div>
        `;
        channelsPanel.appendChild(card);
      });
      channelsPanel.querySelectorAll('[data-action="join"]').forEach(btn => btn.addEventListener('click', onChannelToggle));
      channelsPanel.querySelectorAll('[data-action="leave"]').forEach(btn => btn.addEventListener('click', onChannelToggle));
      const isAdmin = ['admin', 'administrator'].includes((state.user?.role || '').toLowerCase());
      const isBroadcastActive = state.currentSession?.type === 'broadcast';
      const isBroadcastHost = isBroadcastActive && String(state.currentSession.hostId) === String(state.user?.id);
      const broadcastButton = document.createElement('button');
      broadcastButton.className = 'voice-btn voice-btn-wide';
      if (!isBroadcastActive) {
        broadcastButton.textContent = 'Start Broadcast';
        broadcastButton.title = isAdmin ? 'Start a live broadcast' : 'Only admins can start broadcasts';
        broadcastButton.disabled = !isAdmin;
        if (!isAdmin) broadcastButton.classList.add('voice-btn-disabled');
        broadcastButton.addEventListener('click', onStartBroadcast);
      } else if (isBroadcastHost) {
        broadcastButton.textContent = 'End Broadcast';
        broadcastButton.title = 'End the active broadcast';
        broadcastButton.addEventListener('click', onEndBroadcast);
      } else {
        broadcastButton.textContent = 'Broadcast Active';
        broadcastButton.title = 'A broadcast is currently active';
        broadcastButton.disabled = true;
        broadcastButton.classList.add('voice-btn-disabled');
      }
      channelsPanel.appendChild(broadcastButton);
    }

    if (activePanel) {
      activePanel.innerHTML = '';
      if (!state.currentSession) {
        activePanel.innerHTML = '<div class="voice-empty">No active voice session</div>';
        return;
      }
      const session = state.currentSession;
      const participants = Object.values(state.peers).map(peer => peer.meta).filter(Boolean);
      const sessionHtml = document.createElement('div');
      sessionHtml.className = 'voice-session-summary';
      sessionHtml.innerHTML = `
        <div class="voice-session-type">${capitalize(session.type)} Session</div>
        <div class="voice-session-timer">${formatTimer(getSessionDuration())}</div>
      `;
      activePanel.appendChild(sessionHtml);

      const participantList = document.createElement('div');
      participantList.className = 'voice-participant-list';
      participants.forEach(p => {
        const participant = document.createElement('div');
        participant.className = `voice-participant-card ${p.speaking ? 'speaking' : ''}`;
        participant.innerHTML = `
          <div class="voice-avatar ${p.speaking ? 'speaking' : ''}">${p.name.charAt(0).toUpperCase()}</div>
          <div class="voice-details">
            <div class="voice-name">${p.name}</div>
            <div class="voice-meta">${p.role || 'Agent'} · ${p.muted ? 'Muted' : 'Live'}</div>
          </div>
        `;
        participantList.appendChild(participant);
      });
      activePanel.appendChild(participantList);

      const controlRow = document.createElement('div');
      controlRow.className = 'voice-control-row';
      controlRow.innerHTML = `
        <button id="voiceMuteBtn" class="voice-btn ${state.isMuted ? 'voice-btn-secondary' : 'voice-btn-primary'}">${state.isMuted ? '🔇 Unmute' : '🔈 Mute'}</button>
        <button id="voiceNoiseBtn" class="voice-btn ${state.noiseSuppressionEnabled ? 'voice-btn-primary' : 'voice-btn-secondary'}">${state.noiseSuppressionEnabled ? '🛡️ Noise On' : '🔊 Noise Off'}</button>
        <button id="voiceDeafenBtn" class="voice-btn ${state.isDeafened ? 'voice-btn-secondary' : 'voice-btn-primary'}">${state.isDeafened ? '👂 Undeafen' : '🙉 Deafen'}</button>
        <button id="voiceLeaveBtn" class="voice-btn voice-btn-danger">❌ Leave</button>
      `;
      activePanel.appendChild(controlRow);
      document.getElementById('voiceMuteBtn').addEventListener('click', toggleMute);
      document.getElementById('voiceNoiseBtn').addEventListener('click', toggleNoiseSuppression);
      document.getElementById('voiceDeafenBtn').addEventListener('click', toggleDeafen);
      document.getElementById('voiceLeaveBtn').addEventListener('click', leaveCurrentSession);
    }
  }

  function onPrivateCallClick(event) {
    const userId = event.currentTarget.dataset.id;
    const target = state.staff.find(u => String(u.userId) === String(userId));
    if (!target) return;
    if (!state.user) {
      showToast('Please sign in to start a call.', 'warning');
      return;
    }
    const sessionId = `private-${Date.now()}-${target.userId}`;
    state.currentSession = { id: sessionId, type: 'private', peer: target, status: 'calling' };
    render();
    state.socket.emit('voice:private:request', { targetUserId: target.userId, sessionId });
    showToast(`Calling ${target.name}...`);
  }

  function onHangupClick(event) {
    leaveCurrentSession();
  }

  function onBroadcastInviteClick(event) {
    event.preventDefault();
    const userId = event.currentTarget.dataset.id;
    const target = state.staff.find(u => String(u.userId) === String(userId));
    if (!target) return;
    if (!state.currentSession || state.currentSession.type !== 'broadcast') {
      showToast('Start a broadcast first to invite staff.', 'warning');
      return;
    }
    if (state.currentSession.hostId && String(state.currentSession.hostId) !== String(state.user?.id)) {
      showToast('Only the broadcast host can invite staff.', 'warning');
      return;
    }
    state.socket.emit('voice:broadcast:invite', { targetUserId: target.userId, sessionId: state.currentSession.id });
    showToast(`Broadcast invite sent to ${target.name}`);
  }

  function onChannelToggle(event) {
    const action = event.currentTarget.dataset.action;
    const channelId = Number(event.currentTarget.dataset.id);
    if (action === 'join') {
      if (state.currentChannelId === channelId) return;
      state.socket.emit('voice:channel:join', { channelId });
    } else if (action === 'leave') {
      state.socket.emit('voice:channel:leave', { channelId });
    }
  }

  async function onStartBroadcast() {
    if (!state.user) {
      showToast('Please sign in to broadcast.', 'warning');
      return;
    }
    const role = (state.user.role || '').toLowerCase();
    if (!['admin', 'administrator'].includes(role)) {
      showToast('Only admins can start broadcasts.', 'warning');
      return;
    }
    await getLocalStream();
    const sessionId = `broadcast-${Date.now()}`;
    state.currentSession = { id: sessionId, type: 'broadcast', status: 'active', hostId: state.user?.id, peers: {} };
    state.socket.emit('voice:broadcast:start', { sessionId });
    showToast('Broadcast started');
    render();
  }

  async function onPTTStart(event) {
    event.preventDefault();
    if (state.pttSession) return;

    const button = event.currentTarget;
    const targetUserId = Number(button.dataset.pttId);
    const targetName = button.dataset.pttName;

    try {
      await getLocalStream();
      if (!state.localStream) return;

      state.localStream.getAudioTracks().forEach(track => { track.enabled = true; });
      const sessionId = `ptt-${Date.now()}-${targetUserId}`;
      const pc = createPeerConnection(targetUserId, sessionId, attachRemoteAudio);
      state.peers[targetUserId] = { pc, meta: { userId: targetUserId, name: targetName }, audio: null };
      state.pttSession = { id: sessionId, targetUserId, targetName, status: 'transmitting' };

      button.classList.add('active');
      showToast(`🎤 Transmitting to ${targetName}...`, 'info');
      markSessionStarted();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      state.socket.emit('voice:signal', { targetUserId, sessionId, signal: offer, type: 'offer' });
      state.socket.emit('voice:ptt:start', { targetUserId, sessionId });
    } catch (err) {
      console.error('PTT start error:', err);
      showToast('Failed to start push to talk', 'error');
    }
  }

  async function onEndBroadcast() {
    if (!state.currentSession || state.currentSession.type !== 'broadcast') return;
    state.socket.emit('voice:end', { sessionId: state.currentSession.id });
    Object.keys(state.peers).forEach(cleanupPeer);
    state.currentSession = null;
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    stopLocalStream();
    showToast('Broadcast ended');
    render();
  }

  function onPTTEnd(event) {
    event.preventDefault();
    if (!state.pttSession) return;
    
    const button = event.currentTarget;
    const targetUserId = Number(button.dataset.pttId);
    
    if (state.pttSession.targetUserId !== targetUserId) return;
    
    // Clean up peer connection on sender side
    cleanupPeer(String(targetUserId));
    
    // Disable mic unless still in an active voice session.
    if (state.localStream) {
      const enabled = state.currentSession ? !state.isMuted : false;
      state.localStream.getAudioTracks().forEach(track => { track.enabled = enabled; });
    }
    
    button.classList.remove('active');
    showToast('🎤 Stopped transmitting', 'info');
    
    // Notify the receiver and stop timer on both sides
    state.socket.emit('voice:ptt:end', { targetUserId, sessionId: state.pttSession.id });
    
    // Stop timer on sender side if no active session
    if (!state.currentSession) {
      stopLocalStream();
      state.socket.emit('voice:timer:stop');
      stopSessionTimer();
    }
    
    state.pttSession = null;
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach(track => { track.enabled = !state.isMuted; });
    }
    showToast(state.isMuted ? 'Microphone muted' : 'Microphone unmuted');
    render();
  }

  function toggleDeafen() {
    state.isDeafened = !state.isDeafened;
    Object.values(state.audioElements).forEach(audio => { audio.muted = state.isDeafened; });
    showToast(state.isDeafened ? 'Audio muted' : 'Audio enabled');
    render();
  }

  function leaveCurrentSession() {
    if (!state.currentSession) return;
    state.socket.emit('voice:end', { sessionId: state.currentSession.id });
    Object.keys(state.peers).forEach(cleanupPeer);
    state.currentSession = null;
    state.currentChannelId = null;
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    stopLocalStream();
    render();
  }

  function formatTimer(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function getSessionDuration() {
    if (!state.callStartedAt) return 0;
    return (Date.now() - state.callStartedAt) / 1000;
  }

  function markSessionStarted() {
    if (!state.callStartedAt) {
      state.callStartedAt = Date.now();
      state.timerId = setInterval(render, 1000);
    }
  }

  function stopSessionTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    state.callStartedAt = null;
    render();
  }

  function handleVoicePresence(list) {
    state.staff = list.filter(u => u.userId !== state.user?.id);
    render();
  }

  function handleVoiceChannels(channels) {
    state.channels = Array.isArray(channels) ? channels : [];
    render();
  }

  function handlePrivateIncoming(payload) {
    if (!payload || !payload.sessionId || !payload.from) return;
    showIncomingNotification({
      title: `${payload.from.name} is calling`,
      message: 'Incoming private voice call',
      acceptLabel: 'Join',
      rejectLabel: 'Decline',
      onAccept: () => {
        state.currentSession = { id: payload.sessionId, type: 'private', peer: payload.from, status: 'incoming' };
        getLocalStream().then(() => {
          state.socket.emit('voice:private:response', { sessionId: payload.sessionId, accepted: true });
          render();
        }).catch(() => {
          state.socket.emit('voice:private:response', { sessionId: payload.sessionId, accepted: false });
        });
      },
      onReject: () => {
        state.socket.emit('voice:private:response', { sessionId: payload.sessionId, accepted: false });
      }
    });
  }

  function handlePrivateAccepted(payload) {
    if (!payload || !payload.sessionId || !payload.peer) return;
    state.currentSession = { id: payload.sessionId, type: 'private', peer: payload.peer, status: 'active' };
    getLocalStream().then(async () => {
      const targetId = payload.peer.userId;
      const pc = createPeerConnection(targetId, payload.sessionId, attachRemoteAudio);
      state.peers[targetId] = { pc, meta: payload.peer, audio: null };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      state.socket.emit('voice:signal', { targetUserId: targetId, sessionId: payload.sessionId, signal: offer, type: 'offer' });
      markSessionStarted();
      render();
    }).catch(() => {});
  }

  async function handleSignal(payload) {
    if (!payload || !payload.sessionId || !payload.fromUserId || !payload.signal) return;
    const fromId = payload.fromUserId;
    const peerMeta = (state.peers[fromId] && state.peers[fromId].meta) || { userId: fromId, name: 'Peer' };
    let peerConnection = state.peers[fromId] && state.peers[fromId].pc;
    const createAudioTrack = event => attachRemoteAudio(event, fromId, peerMeta);
    if (!peerConnection) {
      peerConnection = createPeerConnection(fromId, payload.sessionId, createAudioTrack);
      state.peers[fromId] = { pc: peerConnection, meta: peerMeta, audio: null };
    }

    if (payload.signal.type === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.signal));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      state.socket.emit('voice:signal', { targetUserId: fromId, sessionId: payload.sessionId, signal: answer, type: 'answer' });
      markSessionStarted();
    } else if (payload.signal.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.signal));
      markSessionStarted();
    } else if (payload.signal.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.signal.candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate', err);
      }
    }
  }

  function attachRemoteAudio(event, userId, meta) {
    const stream = event.streams && event.streams[0];
    if (!stream) return;
    let audio = state.audioElements[userId];
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = state.isDeafened;
      audio.srcObject = stream;
      document.body.appendChild(audio);
      state.audioElements[userId] = audio;
    } else {
      audio.srcObject = stream;
    }
    if (state.isDeafened) audio.muted = true;
  }

  function handleBroadcastIncoming(payload) {
    if (!payload || !payload.sessionId || !payload.from) return;
    showIncomingNotification({
      title: `${payload.from.name} started a broadcast`,
      notificationLabel: 'Incoming Broadcast',
      message: 'Join the broadcast now?',
      acceptLabel: 'Join',
      rejectLabel: 'Reject',
      onAccept: () => {
        state.currentSession = { id: payload.sessionId, type: 'broadcast', status: 'joining', peer: payload.from, hostId: payload.from.userId };
        getLocalStream().then(() => {
          state.socket.emit('voice:broadcast:join', { sessionId: payload.sessionId });
          render();
        }).catch(() => {});
      },
      onReject: () => {
        showToast('Broadcast rejected', 'warning');
      }
    });
  }

  function handleBroadcastJoinRequest(payload) {
    if (!payload || !payload.sessionId || !payload.user) return;
    const user = payload.user;
    if (!state.currentSession || state.currentSession.id !== payload.sessionId) return;
    getLocalStream().then(async () => {
      const targetId = user.userId;
      const pc = createPeerConnection(targetId, payload.sessionId, attachRemoteAudio);
      state.peers[targetId] = { pc, meta: user, audio: null };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      state.socket.emit('voice:signal', { targetUserId: targetId, sessionId: payload.sessionId, signal: offer, type: 'offer' });
      render();
    }).catch(() => {});
  }

  async function handlePTTIncoming(payload) {
    if (!payload || !payload.sessionId || !payload.fromUserId) return;
    const fromId = payload.fromUserId;
    const sender = state.staff.find(s => s.userId === fromId);
    const senderName = sender ? sender.name : 'Staff Member';
    
    // Mark sender as speaking
    if (sender) {
      sender.speaking = true;
    }
    
    showToast(`🎤 ${senderName} is transmitting...`, 'info');
    markSessionStarted();
    render();
    
    // Receiver only marks sender as transmitting and waits for an offer
    const peerMeta = (state.peers[fromId] && state.peers[fromId].meta) || { userId: fromId, name: senderName };
    if (!state.peers[fromId]) {
      state.peers[fromId] = { pc: null, meta: peerMeta, audio: null };
    }
    
    // Receiver will use handleSignal to answer the sender's offer and attach remote audio
  }

  function handlePTTEnd(payload) {
    if (!payload || !payload.fromUserId) return;
    const fromId = payload.fromUserId;
    const sender = state.staff.find(s => s.userId === fromId);
    const senderName = sender ? sender.name : 'Staff Member';
    
    // Clean up peer first
    cleanupPeer(String(fromId));
    
    // Mark sender as not speaking
    if (sender) {
      sender.speaking = false;
    }
    
    showToast(`🎤 ${senderName} stopped transmitting`, 'info');
    render();
  }

  function handleChannelJoined(payload) {
    if (!payload || !payload.channel || !Array.isArray(payload.members)) return;
    state.currentSession = { id: `channel-${payload.channel.id}`, type: 'channel', channel: payload.channel, status: 'joined' };
    state.currentChannelId = payload.channel.id;
    state.peers = {};
    payload.members.forEach(member => {
      if (String(member.userId) === String(state.user?.id)) return;
      state.peers[member.userId] = { meta: member, pc: null, audio: null };
    });
    render();
  }

  async function prepareChannelPeer(userId, channelId) {
    const peer = state.peers[userId];
    if (!peer) return;
    const pc = createPeerConnection(userId, `channel-${channelId}`, event => attachRemoteAudio(event, userId, peer.meta));
    state.peers[userId].pc = pc;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    state.socket.emit('voice:channel:signal', { targetUserId: userId, channelId, signal: offer });
  }

  function handleChannelSignal(payload) {
    if (!payload || !payload.channelId || !payload.fromUserId || !payload.signal) return;
    const fromId = payload.fromUserId;
    let peer = state.peers[fromId];
    const createAudioTrack = event => attachRemoteAudio(event, fromId, peer?.meta || { userId: fromId, name: 'Peer' });
    if (!peer) {
      peer = { meta: { userId: fromId, name: 'Peer' }, pc: null, audio: null };
      state.peers[fromId] = peer;
    }
    if (!peer.pc) {
      peer.pc = createPeerConnection(fromId, `channel-${payload.channelId}`, createAudioTrack);
    }
    const pc = peer.pc;
    if (payload.signal.type === 'offer') {
      pc.setRemoteDescription(new RTCSessionDescription(payload.signal)).then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          state.socket.emit('voice:channel:signal', { targetUserId: fromId, channelId: payload.channelId, signal: pc.localDescription });
        }).catch(err => console.warn('Channel answer failed', err));
    } else if (payload.signal.type === 'answer') {
      pc.setRemoteDescription(new RTCSessionDescription(payload.signal)).catch(err => console.warn('Channel answer set failed', err));
    } else if (payload.signal.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(payload.signal.candidate)).catch(err => console.warn('Channel ICE failed', err));
    }
  }

  function handleChannelMemberUpdate(payload) {
    if (!payload || !payload.channelId || !payload.user) return;
    if (!state.currentChannelId || Number(state.currentChannelId) !== Number(payload.channelId)) return;
    const member = payload.user;
    state.peers[member.userId] = { meta: member, pc: null, audio: null };
    prepareChannelPeer(member.userId, payload.channelId);
    render();
  }

  function handleChannelMemberLeft(payload) {
    if (!payload || !payload.channelId || !payload.userId) return;
    if (!state.currentChannelId || Number(state.currentChannelId) !== Number(payload.channelId)) return;
    cleanupPeer(payload.userId);
    render();
  }

  function startVoiceActivityDetection(stream) {
    if (!window.AudioContext) return;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const threshold = 0.03;
    function sample() {
      analyser.getByteFrequencyData(data);
      const sum = data.reduce((acc, value) => acc + Math.abs(value - 128), 0);
      const level = sum / data.length / 128;
      const speaking = level > threshold;
      if (speaking !== state.speaking) {
        state.speaking = speaking;
        if (state.socket && state.user) {
          state.socket.emit('voice:activity', { speaking, muted: state.isMuted, status: speaking ? 'speaking' : 'online' });
        }
      }
      requestAnimationFrame(sample);
    }
    sample();
  }

  function initSocket() {
    state.socket = window.voiceSocket || io();
    window.voiceSocket = state.socket;

    state.socket.on('connect', () => {
      getCurrentUser().then(user => {
        state.user = user;
        if (user && (user.id || user.name)) {
          state.socket.emit('voice:register', { userId: user.id, name: user.name || user.displayName || 'Staff', role: user.role || 'agent' });
        }
      });
    });

    state.socket.on('voice:presenceUpdate', handleVoicePresence);
    state.socket.on('voice:channels', handleVoiceChannels);
    state.socket.on('voice:private:incoming', handlePrivateIncoming);
    state.socket.on('voice:private:accepted', handlePrivateAccepted);
    state.socket.on('voice:signal', handleSignal);
    state.socket.on('voice:ended', () => {
      showToast('Voice session ended', 'info');
      state.currentSession = null;
      Object.keys(state.peers).forEach(cleanupPeer);
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      stopLocalStream();
      render();
    });
    state.socket.on('voice:broadcast:incoming', handleBroadcastIncoming);
    state.socket.on('voice:broadcast:joinRequest', handleBroadcastJoinRequest);
    state.socket.on('voice:broadcast:joined', payload => {
      state.currentSession = { id: payload.sessionId, type: 'broadcast', status: 'active', hostId: state.currentSession?.hostId };
      render();
    });
    state.socket.on('voice:channel:joined', handleChannelJoined);
    state.socket.on('voice:channel:memberUpdate', handleChannelMemberUpdate);
    state.socket.on('voice:channel:memberLeft', handleChannelMemberLeft);
    state.socket.on('voice:channel:signal', handleChannelSignal);
    state.socket.on('voice:private:rejected', payload => {
      showToast('Call rejected', 'warning');
      state.currentSession = null;
      render();
    });
    state.socket.on('voice:ptt:start', handlePTTIncoming);
    state.socket.on('voice:ptt:end', handlePTTEnd);
    state.socket.on('voice:timer:stop', () => {
      if (!state.currentSession) {
        stopSessionTimer();
      }
    });

    state.socket.on('disconnect', () => {
      showToast('Voice socket disconnected', 'warning');
    });
  }

  function init() {
    createPanel();
    getCurrentUser().then(user => {
      state.user = user;
      initSocket();
    }).catch(() => {
      initSocket();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
