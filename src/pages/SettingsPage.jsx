import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { useNotification } from '../contexts/NotificationContext';
import {
  getSettings,
  saveSettings,
  applyTheme,
  applyFontSize,
  applyZoom,
  AUTOPILOT_MODES,
  getFontSizeLabel
} from '../services/settingsService';
import { normalizeAutopilotMode } from '../services/autopilotMode';

function SettingsPage() {
  const location = useLocation();
  const { success, error, info } = useNotification();
  const [activeSection, setActiveSection] = useState('account');
  const [settings, setSettings] = useState(getSettings());
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [createMessage, setCreateMessage] = useState('');
  const [createMessageColor, setCreateMessageColor] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const roleOptions = ['agent', 'admin', 'viewer', 'Delivery Support', 'Refund Manager', 'Kitchen Supervisor', 'Customer Support'];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedSection = params.get('section');
    const validSections = ['account', 'notifications', 'chat', 'ai', 'appearance', 'admin-users'];

    if (requestedSection && validSections.includes(requestedSection)) {
      setActiveSection(requestedSection);
    } else {
      setActiveSection('account');
    }
  }, [location.search]);

  useEffect(() => {
    const storedAvatar = window.localStorage.getItem('userAvatar');
    if (storedAvatar) {
      setAvatarPreview(storedAvatar);
    }
  }, []);

  useEffect(() => {
    // Load initial settings
    const initial = getSettings();
    setSettings(initial);
    applyTheme(initial.theme);
    applyFontSize(initial.fontSize);
    applyZoom(Number(initial.pageZoom));

    // Check if admin
    async function checkAdmin() {
      try {
        const res = await fetch('/api/user');
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data && (data.role || '').toString().toLowerCase() === 'admin');
        }
      } catch (e) {
        setIsAdmin(false);
      }
    }
    checkAdmin();
  }, []);

  const handleSaveSettings = () => {
    const normalizedSettings = {
      ...settings,
      autopilotMode: normalizeAutopilotMode(settings.autopilotMode)
    };
    setSettings(normalizedSettings);
    // If there's a selected file, upload it first
    const doSave = async () => {
      try {
        if (avatarFile) {
          const form = new FormData();
          form.append('avatar', avatarFile);
          const res = await fetch('/api/settings/avatar', { method: 'POST', body: form, credentials: 'same-origin' });
          if (res.ok) {
            const data = await res.json();
            const avatarUrl = data && data.url ? (data.url.startsWith('http') ? data.url : window.location.origin + data.url) : null;
            if (avatarUrl) {
              window.localStorage.setItem('userAvatar', avatarUrl);
              setAvatarPreview(avatarUrl);
              window.dispatchEvent(new Event('avatar:updated'));
            }
          } else {
            console.warn('Avatar upload failed', res.statusText);
          }
        }

        // Save other settings
        await saveSettings(normalizedSettings);
        success('Settings saved successfully');
      } catch (e) {
        console.error('Error saving settings/avatar', e);
        error('Failed to save settings');
      }
    };

    doSave();
  };

  // Admin Users Functions
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      if (res.status === 403) {
        setUsers([]);
        setUsersLoading(false);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
      setUsersLoading(false);
    } catch (e) {
      setUsers([]);
      setUsersLoading(false);
    }
  };

  const handleUpdateUser = async (userId, role, disabled) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, disabled })
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        error('Failed to update user');
      }
    } catch (e) {
      error('Error updating user');
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data?.password) {
        alert(`New password: ${data.password}`);
        await fetchUsers();
      } else {
        error('Failed to reset password');
      }
    } catch (e) {
      error('Error resetting password');
    }
  };

  const handleForceLogout = async (userId) => {
    try {
      await fetch(`/api/admin/users/${userId}/force-logout`, {
        method: 'POST'
      });
      success('Force logout requested');
      await fetchUsers();
    } catch (e) {
      error('Error forcing logout');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Delete user ${userName}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        error(`Delete failed: ${err.message || err.error || res.statusText}`);
      }
    } catch (e) {
      error('Error deleting user');
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      setCreateMessage('Email and password required');
      setCreateMessageColor('text-red-600');
      setTimeout(() => setCreateMessage(''), 4000);
      return;
    }
    if (!confirm(`Create new user ${newUser.name || newUser.email}?`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || err.details || err.error || res.statusText;
        setCreateMessage(`Failed: ${msg}`);
        setCreateMessageColor('text-red-600');
        setTimeout(() => setCreateMessage(''), 6000);
        return;
      }
      const data = await res.json().catch(() => null);
      setNewUser({ name: '', email: '', password: '', role: 'agent' });
      setCreateMessage(`User created${data?.id ? ` (id: ${data.id})` : ''}`);
      setCreateMessageColor('text-green-600');
      setTimeout(() => setCreateMessage(''), 4000);
      await fetchUsers();
    } catch (e) {
      setCreateMessage('Failed to create user');
      setCreateMessageColor('text-red-600');
      setTimeout(() => setCreateMessage(''), 4000);
    }
  };

  const handleThemeChange = (newTheme) => {
    setSettings({ ...settings, theme: newTheme });
    applyTheme(newTheme);
  };

  const handleFontSizeChange = (size) => {
    setSettings({ ...settings, fontSize: size });
    applyFontSize(size);
  };

  const handleZoomChange = (zoom) => {
    setSettings({ ...settings, pageZoom: zoom });
    applyZoom(Number(zoom));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result || '';
        setAvatarPreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const SIDEBAR_POSITIONS = [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'collapsed', label: 'Collapsed' }
  ];

  const SIDEBAR_WIDTHS = [
    { value: 'narrow', label: 'Narrow (160px)' },
    { value: 'standard', label: 'Standard (220px)' },
    { value: 'wide', label: 'Wide (280px)' }
  ];

  const renderNavButton = (id, label) => (
    <button
      key={id}
      onClick={() => setActiveSection(id)}
      className={`w-full whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all sm:px-4 sm:py-3 sm:text-base ${
        activeSection === id
          ? 'bg-indigo-600 text-white shadow-md'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-dvh overflow-hidden bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />

        {/* Settings Container */}
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Sidebar */}
          <div className="border-b border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-64 lg:border-b-0 lg:border-r lg:overflow-y-auto">
            <div className="border-b border-gray-200 p-4 sm:p-6 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h3>
            </div>
            <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible lg:px-4 lg:py-4">
              {renderNavButton('account', 'Account')}
              {renderNavButton('notifications', 'Notifications')}
              {renderNavButton('chat', 'Chat Settings')}
              {renderNavButton('ai', 'AI Settings')}
              {renderNavButton('appearance', 'Appearance')}
              {isAdmin && renderNavButton('admin-users', 'Admin Users')}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-4xl p-3 sm:p-6 lg:p-8">
              {/* Account Section */}
              {activeSection === 'account' && (
                <div>
                  <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:mb-8 sm:text-3xl dark:text-white">Account Settings</h2>

                  <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-slate-900 dark:text-slate-100 sm:p-6">
                    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <div className="flex flex-col items-center lg:items-start">
                        <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
                          ) : (
                            <span>{(settings.displayName || 'User')[0].toUpperCase()}</span>
                          )}
                        </div>
                        <label className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
                          Upload Avatar
                          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                          <input
                            type="text"
                            value={settings.displayName}
                            onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter your name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter your email"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Sales Target ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={settings.monthlyTargetAmount ?? 20000}
                            onChange={(e) => setSettings({ ...settings, monthlyTargetAmount: Number(e.target.value || 0) })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="20000"
                          />
                          <p className="text-xs text-slate-500 mt-1">This value is used by the monthly target gauge on the dashboard.</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter new password (leave blank to keep current)"
                              onChange={(e) => setPasswordChanged(e.target.value.length > 0)}
                              className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((value) => !value)}
                              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? (
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                  <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                  <path d="M9.88 5.1A10.8 10.8 0 0 1 12 5c4.3 0 8 2.2 10 6.8a11 11 0 0 1-2.9 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                  <path d="M6.3 7.7A14.4 14.4 0 0 0 2 11.8c1.8 4.1 4.8 6.5 8.9 7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Leave blank if you don't want to change password</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      className="w-full rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'notifications' && (
                <div>
                  <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:mb-8 sm:text-3xl dark:text-white">Notification Settings</h2>

                  <div className="space-y-4 rounded-lg bg-white p-4 shadow dark:bg-slate-900 dark:text-slate-100 sm:p-6 sm:space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <label className="font-medium text-slate-900 dark:text-slate-100">Message Alerts</label>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Receive alerts for new messages</p>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.msgAlert}
                          onChange={(e) => setSettings({ ...settings, msgAlert: e.target.checked })}
                          className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                      </label>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <label className="font-medium text-slate-900">Ticket Alerts</label>
                          <p className="text-sm text-slate-500">Receive alerts for new tickets</p>
                        </div>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.ticketAlert}
                            onChange={(e) => setSettings({ ...settings, ticketAlert: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <label className="font-medium text-slate-900">Sound Notifications</label>
                          <p className="text-sm text-slate-500">Play sound for notifications</p>
                        </div>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.soundAlert}
                            onChange={(e) => setSettings({ ...settings, soundAlert: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <button
                        onClick={handleSaveSettings}
                        className="w-full rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Section */}
              {activeSection === 'chat' && (
                <div>
                  <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:mb-8 sm:text-3xl dark:text-white">Chat Settings</h2>

                  <div className="space-y-4 rounded-lg bg-white p-4 shadow dark:bg-slate-900 dark:text-slate-100 sm:p-6 sm:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-100 mb-2">Auto Reply</label>
                      <textarea
                        value={settings.autoReply}
                        onChange={(e) => setSettings({ ...settings, autoReply: e.target.value })}
                        placeholder="Set an automatic reply message..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Chat Enabled</label>
                      <select
                        value={settings.chatEnabled}
                        onChange={(e) => setSettings({ ...settings, chatEnabled: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="on">Enabled</option>
                        <option value="off">Disabled</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      className="w-full rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* AI Settings Section */}
              {activeSection === 'ai' && (
                <div>
                  <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:mb-8 sm:text-3xl dark:text-white">AI Settings</h2>

                  <div className="space-y-4 rounded-lg bg-white p-4 shadow sm:p-6 sm:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-4">Autopilot Mode</label>
                      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {Object.entries(AUTOPILOT_MODES).map(([mode, info]) => (
                          <button
                            key={mode}
                            onClick={() => setSettings({ ...settings, autopilotMode: mode })}
                            className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                              settings.autopilotMode === mode
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-400'
                            }`}
                          >
                            {info.title.split(' ')[0]}
                          </button>
                        ))}
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                          {AUTOPILOT_MODES[settings.autopilotMode].title}
                        </h4>
                        <p className="text-sm text-slate-600 mb-3">
                          {AUTOPILOT_MODES[settings.autopilotMode].summary}
                        </p>
                        <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                          {AUTOPILOT_MODES[settings.autopilotMode].details.map((detail, idx) => (
                            <li key={idx}>{detail}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Auto Assign</label>
                      <select
                        value={settings.autoAssign}
                        onChange={(e) => setSettings({ ...settings, autoAssign: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="on">Enabled</option>
                        <option value="off">Disabled</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Automatically assign tickets to available agents</p>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <button
                        onClick={handleSaveSettings}
                        className="w-full rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Section */}
              {activeSection === 'appearance' && (
                <div>
                  <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:mb-8 sm:text-3xl dark:text-white">Appearance</h2>

                  <div className="space-y-4 rounded-lg bg-white p-4 shadow dark:bg-slate-900 dark:text-slate-100 sm:p-6 sm:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-100 mb-2">Theme</label>
                      <select
                        value={settings.theme}
                        onChange={(e) => handleThemeChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Light">Light</option>
                        <option value="Dark">Dark</option>
                      </select>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Sidebar Position</label>
                      <select
                        value={settings.sidebarPosition}
                        onChange={(e) => setSettings({ ...settings, sidebarPosition: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {SIDEBAR_POSITIONS.map((pos) => (
                          <option key={pos.value} value={pos.value}>
                            {pos.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Sidebar Width</label>
                      <select
                        value={settings.sidebarWidth}
                        onChange={(e) => setSettings({ ...settings, sidebarWidth: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {SIDEBAR_WIDTHS.map((width) => (
                          <option key={width.value} value={width.value}>
                            {width.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-100">Font Size</label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          type="range"
                          min="90"
                          max="120"
                          step="10"
                          value={settings.fontSize}
                          onChange={(e) => handleFontSizeChange(e.target.value)}
                          className="flex-1"
                        />
                        <span className="min-w-32 text-sm font-medium text-slate-600">
                          {getFontSizeLabel(settings.fontSize)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-100">Page Zoom</label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                          onClick={() => handleZoomChange(Math.max(25, Number(settings.pageZoom) - 5))}
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          −
                        </button>
                        <input
                          type="range"
                          min="25"
                          max="150"
                          step="5"
                          value={settings.pageZoom}
                          onChange={(e) => handleZoomChange(e.target.value)}
                          className="flex-1"
                        />
                        <button
                          onClick={() => handleZoomChange(Math.min(150, Number(settings.pageZoom) + 5))}
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                        >
                          +
                        </button>
                        <span className="min-w-16 text-center text-sm font-medium text-slate-600">
                          {settings.pageZoom}%
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border-t border-slate-200 bg-slate-50 p-4 pt-4 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:pt-6">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        <strong>Note:</strong> Sidebar position and width changes apply immediately. Refresh the page or navigate to see full effect.
                      </p>
                    </div>

                    <div className="border-t border-slate-200 pt-4 sm:pt-6">
                      <button
                        onClick={handleSaveSettings}
                        className="w-full rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Users Section */}
              {activeSection === 'admin-users' && isAdmin && (
                <div>
                  <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:mb-8 sm:text-3xl dark:text-white">Manage Users</h2>

                  {/* Create User Section */}
                  <div className="mb-8 rounded-lg bg-white p-4 shadow dark:bg-slate-900 dark:text-slate-100 sm:p-6">
                    <h3 className="mb-4 text-xl font-semibold text-gray-800 dark:text-slate-100">Create New User</h3>
                    <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
                      <input
                        type="text"
                        placeholder="Name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleCreateUser}
                      className="w-full rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                    >
                      Create User
                    </button>
                    {createMessage && (
                      <p className={`mt-3 ${createMessageColor}`}>{createMessage}</p>
                    )}
                  </div>

                  {/* Users Table */}
                  <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-slate-900 dark:text-slate-100">
                    {usersLoading ? (
                      <div className="p-6 text-center text-slate-500 dark:text-slate-400">Loading users...</div>
                    ) : users.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                        {users.length === 0 ? 'No users found' : 'Click "Manage Users" to load users'}
                      </div>
                    ) : (
                      <table className="min-w-[760px] w-full text-left text-sm">
                        <thead className="bg-gray-100 border-b border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                          <tr>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-slate-200">ID</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-slate-200">Name</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-slate-200">Email</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-slate-200">Role</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-slate-200">Active</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-slate-200">Disabled</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-slate-200">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <UserRow
                              key={user.id}
                              user={user}
                              roleOptions={roleOptions}
                              onUpdate={handleUpdateUser}
                              onResetPassword={handleResetPassword}
                              onForceLogout={handleForceLogout}
                              onDelete={handleDeleteUser}
                            />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {users.length === 0 && !usersLoading && (
                    <div className="mt-6">
                      <button
                        onClick={() => { setUsersLoading(true); fetchUsers(); }}
                        className="w-full rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 sm:w-auto"
                      >
                        Load Users
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// UserRow component for the admin users table
function UserRow({ user, roleOptions, onUpdate, onResetPassword, onForceLogout, onDelete }) {
  const [role, setRole] = useState(user.role || 'agent');
  const [disabled, setDisabled] = useState(user.disabled || false);

  const handleSave = () => {
    onUpdate(user.id, role, disabled);
  };

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800">
      <td className="px-3 py-3 text-gray-900 dark:text-slate-100 sm:px-6">{user.id}</td>
      <td className="px-3 py-3 text-gray-900 dark:text-slate-100 sm:px-6">{user.name}</td>
      <td className="px-3 py-3 text-gray-600 dark:text-slate-400 sm:px-6">{user.email}</td>
      <td className="px-3 py-3 sm:px-6">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {roleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3 sm:px-6">
        {user.active ? (
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
            <span className="text-green-700 text-xs font-medium">Active</span>
          </span>
        ) : (
          <span className="text-gray-500 text-xs">Offline</span>
        )}
      </td>
      <td className="px-3 py-3 sm:px-6">
        <input
          type="checkbox"
          checked={disabled}
          onChange={(e) => setDisabled(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
      </td>
      <td className="px-3 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => onResetPassword(user.id)}
            className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700 transition-colors"
          >
            Reset PW
          </button>
          <button
            onClick={() => onForceLogout(user.id)}
            className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 transition-colors"
          >
            Logout
          </button>
          <button
            onClick={() => onDelete(user.id, user.name)}
            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default SettingsPage;
