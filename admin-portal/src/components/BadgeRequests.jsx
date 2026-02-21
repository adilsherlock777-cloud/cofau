import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

const PROFILE_PIC_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : '';

export default function BadgeRequests({ token, onStatsChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/badge/admin/requests`, {
        params: { status_filter: filter, limit: 50 },
        headers,
      });
      setRequests(res.data.requests);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Error fetching badge requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const handleApprove = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this badge request?')) return;
    setActionLoading(requestId);
    try {
      await axios.post(`${API_URL}/badge/admin/requests/${requestId}/approve`, {}, { headers });
      fetchRequests();
      onStatsChange();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      await axios.post(
        `${API_URL}/badge/admin/requests/${rejectModal}/reject`,
        { reject_reason: rejectReason || null },
        { headers }
      );
      setRejectModal(null);
      setRejectReason('');
      fetchRequests();
      onStatsChange();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (requestId) => {
    if (!window.confirm('Are you sure you want to revoke this badge?')) return;
    setActionLoading(requestId);
    try {
      await axios.post(`${API_URL}/badge/admin/requests/${requestId}/revoke`, {}, { headers });
      fetchRequests();
      onStatsChange();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to revoke');
    } finally {
      setActionLoading(null);
    }
  };

  const getProfilePicUrl = (pic) => {
    if (!pic) return null;
    if (pic.startsWith('http')) return pic;
    return `${PROFILE_PIC_BASE}${pic}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              filter === f
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {f}
            {f === filter && total > 0 && (
              <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-48 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">
            {filter === 'pending' ? '🎉' : '📭'}
          </p>
          <p className="text-gray-500">
            {filter === 'pending'
              ? 'No pending badge requests!'
              : `No ${filter} requests found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Profile Picture */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex-shrink-0 overflow-hidden">
                    {getProfilePicUrl(req.profile_picture) ? (
                      <img
                        src={getProfilePicUrl(req.profile_picture)}
                        alt={req.username}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                        {(req.full_name || req.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">
                        {req.full_name || req.username}
                      </p>
                      <span className="text-xs text-gray-400">@{req.username}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>Level {req.level}</span>
                      <span>·</span>
                      <span>{req.total_points?.toLocaleString()} pts</span>
                      <span>·</span>
                      <span>{req.followers_count} followers</span>
                      <span>·</span>
                      <span>{req.post_count} posts</span>
                    </div>
                    {req.reason && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-2 italic">
                        "{req.reason}"
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Requested: {formatDate(req.requested_at)}
                      {req.reviewed_at && (
                        <span className="ml-3">
                          Reviewed: {formatDate(req.reviewed_at)} by {req.reviewed_by}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {req.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {actionLoading === req.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => {
                          setRejectModal(req.id);
                          setRejectReason('');
                        }}
                        disabled={actionLoading === req.id}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {req.status === 'approved' && (
                    <button
                      onClick={() => handleRevoke(req.id)}
                      disabled={actionLoading === req.id}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-50"
                    >
                      Revoke Badge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Reject Badge Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Optionally provide a reason for rejection. The user will be notified.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectModal}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50"
              >
                {actionLoading === rejectModal ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-400' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
    revoked: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  };

  const c = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {status}
    </span>
  );
}
