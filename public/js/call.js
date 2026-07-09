(function() {
  const token = window.location.pathname.split('/').filter(p => p).pop();
  const statusText = document.getElementById('statusText');
  const description = document.getElementById('description');
  const answerBtn = document.getElementById('answerBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  const remoteAudio = document.getElementById('remoteAudio');
  const errorText = document.getElementById('errorText');

  if (!token || token === 'call' || token === 'call.html') {
    statusText.textContent = 'Invalid call link';
    description.textContent = 'No call token was found in the URL.';
    return;
  }

  statusText.textContent = 'Connecting...';
  document.getElementById('sessionToken').textContent = token;
  
  console.log('[Call] Token:', token);
  console.log('[Call] Page URL:', window.location.href);

  const state = {
    socket: null,
    pc: null,
    localStream: null,
    connected: false,
    callStatus: 'connecting'
  };

  const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  function setStatus(status, message) {
    state.callStatus = status;
    statusText.textContent = status;
    description.textContent = message || 'Use the buttons below to answer or reject the call.';
  }

  function showError(err) {
    errorText.textContent = typeof err === 'string' ? err : (err?.message || 'An unexpected error occurred');
    errorText.style.display = 'block';
  }

  function updateControls() {
    answerBtn.classList.toggle('hidden', state.callStatus === 'answered' || state.callStatus === 'ended' || state.callStatus === 'rejected');
    rejectBtn.classList.toggle('hidden', state.callStatus === 'ended' || state.callStatus === 'rejected');
  }

  function createPeerConnection() {
    if (state.pc) return state.pc;
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate && state.socket) {
        state.socket.emit('call:ice', { secureToken: token, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.classList.remove('hidden');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('connected', 'You are now on the call.');
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('ended', 'The call has ended.');
      }
    };

    if (state.localStream) {
      state.localStream.getTracks().forEach(track => pc.addTrack(track, state.localStream));
    }

    state.pc = pc;
    return pc;
  }

  async function attachMicrophone() {
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (state.pc) {
        state.localStream.getTracks().forEach(track => state.pc.addTrack(track, state.localStream));
      }
    } catch (err) {
      throw new Error('Microphone access is required to answer the call.');
    }
  }

  function cleanupCall() {
    if (state.pc) {
      state.pc.getSenders().forEach(sender => { if (sender.track) sender.track.stop(); });
      state.pc.close();
      state.pc = null;
    }
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
      state.localStream = null;
    }
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
  }

  function connectSocket() {
    console.log('[Call] Connecting to socket...');
    state.socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: Infinity });

    state.socket.on('connect', () => {
      console.log('[Call] Socket connected:', state.socket.id);
      state.socket.emit('call:register', { secureToken: token, role: 'customer' });
      setStatus('connected', 'Waiting for the staff endpoint to accept your call.');
      updateControls();
    });

    state.socket.on('call:status', (payload) => {
      if (!payload || payload.secureToken !== token) return;
      console.log('[Call] Status update:', payload.status);
      setStatus(payload.status || 'waiting');
      updateControls();
    });

    state.socket.on('call:ringing', () => {
      console.log('[Call] Ringing...');
      setStatus('ringing', 'The agent is being notified that you are answering the call.');
      updateControls();
    });

    state.socket.on('call:answered', () => {
      console.log('[Call] Call answered');
      setStatus('answered', 'The call was answered.');
      updateControls();
    });

    state.socket.on('call:rejected', () => {
      console.log('[Call] Call rejected');
      setStatus('rejected', 'The call was rejected.');
      updateControls();
      cleanupCall();
    });

    state.socket.on('call:ended', () => {
      console.log('[Call] Call ended');
      setStatus('ended', 'The call has ended.');
      updateControls();
      cleanupCall();
    });

    state.socket.on('call:error', (payload) => {
      console.error('[Call] Error:', payload);
      showError(payload?.message || 'Call error received.');
    });

    state.socket.on('call:offer', async (payload) => {
      if (!payload || !payload.offer || payload.secureToken !== token) return;
      console.log('[Call] Received offer');
      try {
        await attachMicrophone();
        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        state.socket.emit('call:answer', { secureToken: token, answer });
      } catch (err) {
        console.error('Answer creation failed', err);
        showError(err.message || 'Failed to answer the call.');
      }
    });

    state.socket.on('call:ice', async (payload) => {
      if (!payload || !payload.candidate || payload.secureToken !== token || !state.pc) return;
      try {
        await state.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate', err);
      }
    });

    state.socket.on('disconnect', () => {
      console.warn('[Call] Socket disconnected');
      if (state.callStatus !== 'ended' && state.callStatus !== 'rejected') {
        setStatus('disconnected', 'Connection lost. Attempting to reconnect...');
      }
      updateControls();
    });

    state.socket.on('connect_error', (error) => {
      console.error('[Call] Connection error:', error);
      showError('Connection error: ' + (error?.message || 'Unable to connect to server'));
    });
  }

  async function handleAnswer() {
    try {
      setStatus('ringing', 'Answering call...');
      updateControls();
      if (!state.socket) connectSocket();
      if (!state.pc) createPeerConnection();
      state.socket.emit('call:start', { secureToken: token });
    } catch (err) {
      showError(err);
    }
  }

  function handleReject() {
    if (state.socket) {
      state.socket.emit('call:reject', { secureToken: token });
    }
    setStatus('rejected', 'You rejected the incoming call.');
    updateControls();
    cleanupCall();
  }

  answerBtn.addEventListener('click', handleAnswer);
  rejectBtn.addEventListener('click', handleReject);

  function loadSession() {
    fetch(`/api/call-sessions/${encodeURIComponent(token)}`)
      .then((res) => {
        console.log('[Call] Session response status:', res.status);
        if (res.status === 404) {
          setStatus('invalid', 'This call session was not found. It may have expired or not been created yet.');
          throw new Error('Call session not found');
        }
        if (res.status === 410) {
          setStatus('expired', 'This call link has expired. Please ask the staff member to create a new call.');
          throw new Error('Call link expired');
        }
        return res.json();
      })
      .then((data) => {
        console.log('[Call] Session loaded:', data);
        setStatus(data.status || 'waiting', 'Waiting for the agent to start the call.');
        answerBtn.classList.remove('hidden');
        rejectBtn.classList.remove('hidden');
        updateControls();
      })
      .catch((err) => {
        console.error('[Call] Error loading session:', err);
        if (err.message !== 'Call session not found' && err.message !== 'Call link expired') {
          showError('Failed to load call session: ' + err.message);
        }
      });
  }

  if (!window.io) {
    statusText.textContent = 'Socket.IO missing';
    description.textContent = 'Unable to connect to the voice signaling server.';
    console.error('[Call] Socket.IO not loaded');
  } else {
    console.log('[Call] Socket.IO available, starting connection...');
    connectSocket();
    loadSession();
  }
})();
