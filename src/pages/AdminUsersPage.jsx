import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [createMessage, setCreateMessage] = useState('');
  const [createMessageColor, setCreateMessageColor] = useState('');

  // Roles available
  const roleOptions = ['agent', 'admin', 'viewer', 'Delivery Support', 'Refund Manager', 'Kitchen Supervisor', 'Customer Support'];

  // Check admin access
  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch('/api/user');
        if (!res.ok) {
          setIsAdmin(false);
          setError('Access denied');
          setLoading(false);
          return;
        }
        const data = await res.json();
        const isAdminUser = data && (data.role || '').toString().toLowerCase() === 'admin';
        setIsAdmin(isAdminUser);
        if (!isAdminUser) {
          setError('Access denied - admin only');
          setLoading(false);
          return;
        }
        setLoading(false);
      } catch (e) {
        setIsAdmin(false);
        setError('Failed to check admin status');
        setLoading(false);
      }
    }
    checkAdmin();
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      if (res.status === 403) {
        setError('Access denied');
        setUsers([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        const msg = data?.message || data?.error || JSON.stringify(data) || 'Unknown error';
        setError(`Failed to load users: ${msg}`);
        setUsers([]);
        return;
      }
      setUsers(data);
      setError('');
    } catch (e) {
      setError('Failed to load users');
      setUsers([]);
    }
  };

  // Load users when admin is verified
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // Handle user update
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
        alert('Failed to update user');
      }
    } catch (e) {
      alert('Error updating user');
    }
  };

  // Handle password reset
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
        alert('Failed to reset password');
      }
    } catch (e) {
      alert('Error resetting password');
    }
  };

  // Handle force logout
  const handleForceLogout = async (userId) => {
    try {
      await fetch(`/api/admin/users/${userId}/force-logout`, {
        method: 'POST'
      });
      alert('Force logout requested');
      await fetchUsers();
    } catch (e) {
      alert('Error forcing logout');
    }
  };

  // Handle user delete
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
        alert(`Delete failed: ${err.message || err.error || res.statusText}`);
      }
    } catch (e) {
      alert('Error deleting user');
    }
  };

  // Handle create user
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

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <div className="p-6">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <div className="p-6 text-red-600 font-bold">Access denied - admin only</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Admin Users</h1>
              <p className="text-gray-600 mt-2">Manage system users and permissions</p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            {/* Create User Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Create New User</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create User
              </button>
              {createMessage && (
                <p className={`mt-3 ${createMessageColor}`}>{createMessage}</p>
              )}
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
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
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        roleOptions={roleOptions}
                        onUpdate={handleUpdateUser}
                        onResetPassword={handleResetPassword}
                        onForceLogout={handleForceLogout}
                        onDelete={handleDeleteUser}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// UserRow component
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
          className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
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

export default AdminUsersPage;
