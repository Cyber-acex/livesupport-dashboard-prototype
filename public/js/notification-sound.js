const NOTIFICATION_API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : undefined;
const notificationSocket = window.notificationSocket || (typeof io !== 'undefined' ? io(NOTIFICATION_API_BASE) : null);
window.notificationSocket = notificationSocket;
let notificationTimeout = null;

function playNotificationSound() {
    // No-op: audio playback removed per request
}

function playHandoffAudio() {
    const audio = new Audio('/uploads/handoff.mp3');
    audio.volume = 0.7; // Set volume to 70%
    audio.play().catch(error => {
        console.log('Failed to play handoff audio:', error);
    });
}

function notifyDesktop(message, title = 'LiveSupport') {
    if (localStorage.getItem('msgAlert') !== 'true') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, {
        body: message,
        icon: '/favicon.png'
    });
}

function createNotificationBar() {
    let bar = document.getElementById('notificationBar');
    let text = document.getElementById('notificationText');
    if (bar && text) return { bar, text };

    // Add premium CSS animations and styling
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateX(-50%) translateY(-120%);
                opacity: 0;
                filter: blur(4px);
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                filter: blur(0);
            }
        }
        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                filter: blur(0);
            }
            to {
                transform: translateX(-50%) translateY(-120%);
                opacity: 0;
                filter: blur(4px);
            }
        }
        @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.3), 0 20px 60px rgba(0, 0, 0, 0.3); }
            50% { box-shadow: 0 0 40px rgba(255, 255, 255, 0.5), 0 20px 80px rgba(0, 0, 0, 0.4); }
        }
        @keyframes iconPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
        }
        .notification-bar {
            animation: slideDown 0.5s cubic-bezier(0.23, 1, 0.320, 1) !important;
        }
        .notification-bar.hiding {
            animation: slideUp 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
        }
        .notification-bar-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            margin-right: 12px;
            font-size: 16px;
            vertical-align: middle;
            animation: iconPulse 2s ease-in-out infinite;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            flex-shrink: 0;
        }
        .notification-bar-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            object-fit: cover;
            margin-right: 10px;
            flex-shrink: 0;
            box-shadow: 0 0 12px rgba(0, 0, 0, 0.2);
        }
        .notification-bar-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex: 1;
        }
        .notification-bar-close {
            transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 50%;
        }
        .notification-bar-close:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.1) rotate(90deg);
            backdrop-filter: blur(10px);
        }
        .notification-bar-close:active {
            transform: scale(0.95) rotate(90deg);
        }
    `;
    document.head.appendChild(style);

    bar = document.createElement('div');
    bar.id = 'notificationBar';
    bar.className = 'notification-bar';
    Object.assign(bar.style, {
        display: 'none',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
        color: 'white',
        padding: '16px 24px',
        textAlign: 'center',
        position: 'fixed',
        top: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '9999',
        maxWidth: '820px',
        width: 'calc(100% - 40px)',
        borderRadius: '16px',
        boxSizing: 'border-box',
        fontSize: '14px',
        fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
        fontWeight: '500',
        boxShadow: '0 0 20px rgba(255, 255, 255, 0.3), 0 20px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        letterSpacing: '0.4px',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    });

    const content = document.createElement('div');
    content.className = 'notification-bar-content';
    Object.assign(content.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
    });

    const icon = document.createElement('span');
    icon.className = 'notification-bar-icon';
    icon.id = 'notificationIcon';
    icon.innerHTML = '✓';
    icon.style.fontSize = '16px';

    const avatar = document.createElement('img');
    avatar.className = 'notification-bar-avatar';
    avatar.id = 'notificationAvatar';
    avatar.style.display = 'none';
    avatar.alt = 'Staff avatar';

    text = document.createElement('span');
    text.id = 'notificationText';
    text.textContent = 'New message received!';
    text.style.flex = '1';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'closeNotification';
    closeBtn.className = 'notification-bar-close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '✕';
    Object.assign(closeBtn.style, {
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: 'white',
        fontSize: '16px',
        position: 'absolute',
        right: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        cursor: 'pointer',
        padding: '0',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        opacity: '0.85',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });
    closeBtn.addEventListener('click', () => {
        bar.classList.add('hiding');
        setTimeout(() => {
            bar.style.display = 'none';
            bar.classList.remove('hiding');
            if (notificationTimeout) {
                clearTimeout(notificationTimeout);
                notificationTimeout = null;
            }
        }, 400);
    });

    content.appendChild(icon);
    content.appendChild(avatar);
    content.appendChild(text);
    bar.appendChild(content);
    bar.appendChild(closeBtn);
    document.body.insertBefore(bar, document.body.firstChild);

    return { bar, text };
}

function showNotification(message, options = {}) {
    const { bar, text } = createNotificationBar();
    const icon = bar.querySelector('.notification-bar-icon');
    const avatar = bar.querySelector('.notification-bar-avatar');
    
    // Premium glassmorphic gradients with neon accents
    const gradients = {
        message: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
        resolved: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)',
        info: 'linear-gradient(135deg, rgba(37, 99, 235, 0.95) 0%, rgba(29, 78, 216, 0.95) 100%)',
        warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%)',
        success: 'linear-gradient(135deg, rgba(6, 182, 212, 0.95) 0%, rgba(8, 145, 178, 0.95) 100%)'
    };
    
    const icons = {
        message: '💬',
        resolved: '✓',
        info: 'ℹ',
        warning: '⚠',
        success: '✓'
    };
    
    const notificationType = options.type || 'info';
    const bgGradient = options.bgColor || gradients[notificationType] || gradients.info;
    
    bar.style.background = bgGradient;
    text.textContent = message;
    
    if (icon) {
        icon.innerHTML = icons[notificationType] || '✓';
    }
    
    // Handle avatar display
    if (avatar) {
        if (options.avatar_url) {
            avatar.src = options.avatar_url;
            avatar.style.display = 'inline-block';
            if (icon) icon.style.display = 'none';
        } else {
            avatar.style.display = 'none';
            if (icon) icon.style.display = 'inline-flex';
        }
    }
    
    bar.style.display = 'block';
    bar.classList.remove('hiding');
    
    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = window.setTimeout(() => {
        bar.classList.add('hiding');
        setTimeout(() => {
            bar.style.display = 'none';
            bar.classList.remove('hiding');
            notificationTimeout = null;
        }, 400);
    }, 6000);
}

window.showNotification = showNotification;
window.mainNotificationBar = window.mainNotificationBar || {};
window.mainNotificationBar.showNotification = showNotification;
window.mainNotificationBar.create = createNotificationBar;

function buildMessageLabel(data) {
    if (!data) return 'New message received.';
    const senderName = data.sender_name ? String(data.sender_name) : (data.sender ? String(data.sender) : '');
    const message = data.message ? String(data.message) : '';
    if (message && senderName) return `${senderName}: ${message}`;
    if (message) return message;
    if (senderName) return `New message from ${senderName}`;
    return 'New message received.';
}

notificationSocket.on('newMessage', msg => {
    if (localStorage.getItem('soundAlert') === 'true') {
        playNotificationSound();
    }

    if (msg && localStorage.getItem('msgAlert') === 'true' && !document.hasFocus()) {
        notifyDesktop(msg.message || 'You have a new customer message.', 'LiveSupport - New Message');
    }

    showNotification(buildMessageLabel(msg), {
        type: 'message'
    });
});

notificationSocket.on('ticketResolved', data => {
    const ticketId = data && data.ticket_id ? `#${data.ticket_id}` : '';
    const resolvedBy = data && data.resolved_by ? String(data.resolved_by) : 'Staff';
    const message = ticketId ? `Ticket ${ticketId} resolved by ${resolvedBy}` : `Ticket resolved by ${resolvedBy}`;
    showNotification(message, {
        type: 'resolved',
        avatar_url: data && data.resolver_avatar ? String(data.resolver_avatar) : null
    });
});

notificationSocket.on('staffNotification', data => {
    if (!data) return;
    const from = data.from ? String(data.from) : 'Staff';
    const message = data.message ? String(data.message) : 'Staff notification received.';
    showNotification(`${from}: ${message}`, {
        type: 'info',
        avatar_url: data && data.from_avatar ? String(data.from_avatar) : null
    });
});

notificationSocket.on('handoffAlert', () => {
    if (localStorage.getItem('msgAlert') === 'true' && !document.hasFocus()) {
        notifyDesktop('AI has handed off the chat to staff.', 'LiveSupport - Handoff Alert');
    }
});
