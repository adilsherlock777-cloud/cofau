import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

export default function NewUsers({ token }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 30;

  const fetchNewUsers = async (pageNum = 0) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/new-users?skip=${pageNum * limit}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Error fetching new users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewUsers(page);
  }, [page]);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const daysAgo = (isoString) => {
    if (!isoString) return '';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 day ago';
    return `${diff} days ago`;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">New Users (Last 30 Days)</h3>
          <p className="text-sm text-gray-500 mt-0.5">{total} user{total !== 1 ? 's' : ''} signed up</p>
        </div>
        <button
          onClick={() => fetchNewUsers(page)}
          className="text-sm text-orange-500 hover:text-orange-700 font-medium transition flex items-center gap-1"
        >
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-gray-500 font-medium">No new users in the last 30 days</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Username</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Level</th>
                  <th className="px-6 py-3">Signed Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user, idx) => (
                  <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-400">{page * limit + idx + 1}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {user.profile_picture ? (
                          <img
                            src={user.profile_picture}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white text-xs font-bold">
                            {(user.full_name || user.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-800">{user.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">@{user.username || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{user.email || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{user.phone_number || '—'}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        Lv {user.level || 1}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-sm text-gray-700">{formatDate(user.created_at)}</div>
                      <div className="text-xs text-gray-400">{daysAgo(user.created_at)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
