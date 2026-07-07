import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import {
  getSettings,
  saveSettings,
  applyTheme,
  applyFontSize,
  applyZoom,
  AUTOPILOT_MODES,
  getFontSizeLabel
} from '../services/settingsService';

function SettingsPage() {
  const [activeSection, setActiveSection] = useState('account');
  const [notification, setNotification] = useState('');
  const [settings, setSettings] = useState(getSettings());
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [createMessage, setCreateMessage] = useState('');
  const [createMessageColor, setCreateMessageColor] = useState('');

  const roleOptions = ['agent', 'admin', 'viewer', 'Delivery Support', 'Refund Manager', 'Kitchen Supervisor', 'Customer Support'];

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

  const showNotification = (message) => {
    setNotification(message);
    window.setTimeout(() => setNotification(''), 3000);
  };

  const handleSaveSettings = () => {
    saveSettings(settings);
    showNotification('Settings saved successfully!');
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
        showNotification('Failed to update user');
      }
    } catch (e) {
      showNotification('Error updating user');
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
        showNotification('Failed to reset password');
      }
    } catch (e) {
      showNotification('Error resetting password');
    }
  };

  const handleForceLogout = async (userId) => {
    try {
      await fetch(`/api/admin/users/${userId}/force-logout`, {
        method: 'POST'
      });
      showNotification('Force logout requested');
      await fetchUsers();
    } catch (e) {
      showNotification('Error forcing logout');
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
        showNotification(`Delete failed: ${err.message || err.error || res.statusText}`);
      }
    } catch (e) {
      showNotification('Error deleting user');
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
      const reader = new FileReader();
      reader.onload = (event) => {
        localStorage.setItem('userAvatar', event.target?.result || '');
        showNotification('Avatar updated');
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
      className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
        activeSection === id
          ? 'bg-indigo-600 text-white shadow-md'
          : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />

        {/* Notification */}
        {notification && (
          <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
            {notification}
          </div>
        )}

        {/* Settings Container */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h3>
            </div>
            <nav className="p-4 space-y-2">
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
            <div className="max-w-4xl mx-auto p-8">
              {/* Account Section */}
              {activeSection === 'account' && (
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-8">Account Settings</h2>

                  <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="md:col-span-1 flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 mb-4">
                          {(settings.displayName || 'User')[0].toUpperCase()}
                        </div>
                        <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer text-sm font-medium">
                          Upload Avatar
                          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                        </label>
                      </div>

                      <div className="md:col-span-2 space-y-4">
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
                          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                          <input
                            type="password"
                            placeholder="Enter new password (leave blank to keep current)"
                            onChange={(e) => setPasswordChanged(e.target.value.length > 0)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <p className="text-xs text-slate-500 mt-1">Leave blank if you don't want to change password</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'notifications' && (
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-8">Notification Settings</h2>

                  <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-medium text-slate-900">Message Alerts</label>
                        <p className="text-sm text-slate-500">Receive alerts for new messages</p>
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

                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-center justify-between">
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

                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-center justify-between">
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

                    <div className="border-t border-slate-200 pt-6">
                      <button
                        onClick={handleSaveSettings}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
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
                  <h2 className="text-3xl font-bold text-slate-900 mb-8">Chat Settings</h2>

                  <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Auto Reply</label>
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
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* AI Settings Section */}
              {activeSection === 'ai' && (
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-8">AI Settings</h2>

                  <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-4">Autopilot Mode</label>
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        {Object.entries(AUTOPILOT_MODES).map(([mode, info]) => (
                          <button
                            key={mode}
                            onClick={() => setSettings({ ...settings, autopilotMode: mode })}
                            className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                              settings.autopilotMode === mode
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                            }`}
                          >
                            {info.title.split(' ')[0]}
                          </button>
                        ))}
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                        <h4 className="font-semibold text-slate-900 mb-2">
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

                    <div className="border-t border-slate-200 pt-6">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Auto Assign</label>
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

                    <div className="border-t border-slate-200 pt-6">
                      <button
                        onClick={handleSaveSettings}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
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
                  <h2 className="text-3xl font-bold text-slate-900 mb-8">Appearance</h2>

                  <div className="bg-white rounded-lg shadow p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Theme</label>
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

                    <div className="border-t border-slate-200 pt-6">
                      <label className="block text-sm font-medium text-slate-700 mb-3">Font Size</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="90"
                          max="120"
                          step="10"
                          value={settings.fontSize}
                          onChange={(e) => handleFontSizeChange(e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium text-slate-600 min-w-32">
                          {getFontSizeLabel(settings.fontSize)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <label className="block text-sm font-medium text-slate-700 mb-3">Page Zoom</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleZoomChange(Math.max(25, Number(settings.pageZoom) - 5))}
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
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
                        <span className="text-sm font-medium text-slate-600 min-w-16 text-center">
                          {settings.pageZoom}%
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-6 bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-600">
                        <strong>Note:</strong> Sidebar position and width changes apply immediately. Refresh the page or navigate to see full effect.
                      </p>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <button
                        onClick={handleSaveSettings}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
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
                  <h2 className="text-3xl font-bold text-slate-900 mb-8">Manage Users</h2>

                  {/* Create User Section */}
                  <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Create New User</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
                      className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Create User
                    </button>
                    {createMessage && (
                      <p className={`mt-3 ${createMessageColor}`}>{createMessage}</p>
                    )}
                  </div>

                  {/* Users Table */}
                  <div className="bg-white rounded-lg shadow overflow-x-auto">
                    {usersLoading ? (
                      <div className="p-6 text-center text-gray-600">Loading users...</div>
                    ) : users.length === 0 ? (
                      <div className="p-6 text-center text-gray-600">
                        {users.length === 0 ? 'No users found' : 'Click "Manage Users" to load users'}
                      </div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 font-semibold text-gray-700">ID</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Name</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Email</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Role</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Active</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Disabled</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Actions</th>
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
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
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
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="px-6 py-3 text-gray-900">{user.id}</td>
      <td className="px-6 py-3 text-gray-900">{user.name}</td>
      <td className="px-6 py-3 text-gray-600">{user.email}</td>
      <td className="px-6 py-3">
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
      <td className="px-6 py-3">
        {user.active ? (
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
            <span className="text-green-700 text-xs font-medium">Active</span>
          </span>
        ) : (
          <span className="text-gray-500 text-xs">Offline</span>
        )}
      </td>
      <td className="px-6 py-3">
        <input
          type="checkbox"
          checked={disabled}
          onChange={(e) => setDisabled(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
      </td>
      <td className="px-6 py-3">
        <div className="flex gap-2">
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
