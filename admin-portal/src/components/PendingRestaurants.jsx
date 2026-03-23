import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

const BACKEND_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : '';

export default function PendingRestaurants({ token, onStatsChange }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectMessage, setRejectMessage] = useState('');
  const [docPreview, setDocPreview] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/referral/admin/pending-restaurants`, {
        params: { limit: 50 },
        headers,
      });
      setRestaurants(res.data.restaurants);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Error fetching pending restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleApprove = async (restaurantId, name) => {
    if (!window.confirm(`Approve restaurant "${name}"? This will verify the restaurant and notify them.`)) return;
    setActionLoading(restaurantId);
    try {
      await axios.post(
        `${API_URL}/referral/admin/restaurant/${restaurantId}/review`,
        { action: 'approve' },
        { headers }
      );
      fetchRestaurants();
      if (onStatsChange) onStatsChange();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await axios.post(
        `${API_URL}/referral/admin/restaurant/${rejectModal.id}/review`,
        { action: 'reject', message: rejectMessage || null },
        { headers }
      );
      setRejectModal(null);
      setRejectMessage('');
      fetchRestaurants();
      if (onStatsChange) onStatsChange();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const getFoodTypeLabel = (type) => {
    switch (type) {
      case 'veg': return { label: 'Vegetarian', color: 'bg-green-100 text-green-700' };
      case 'non_veg': return { label: 'Non-Veg', color: 'bg-red-100 text-red-700' };
      case 'veg_and_non_veg': return { label: 'Veg & Non-Veg', color: 'bg-amber-100 text-amber-700' };
      default: return { label: type, color: 'bg-gray-100 text-gray-700' };
    }
  };

  const getDocUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BACKEND_BASE}${path}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-500">Loading restaurants...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              🍽️ Restaurants Under Review
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {total} restaurant{total !== 1 ? 's' : ''} pending verification
            </p>
          </div>
          <button
            onClick={fetchRestaurants}
            className="text-sm text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1 transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Restaurant List */}
      {restaurants.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500 font-medium">No restaurants pending review</p>
          <p className="text-gray-400 text-sm mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {restaurants.map((r) => {
            const foodType = getFoodTypeLabel(r.food_type);
            const docUrl = getDocUrl(r.fssai_license_document);
            const isPdf = r.fssai_license_document?.toLowerCase().endsWith('.pdf');

            return (
              <div key={r.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-4">
                  {/* Restaurant Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-bold text-gray-800 truncate">
                        {r.restaurant_name}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${foodType.color}`}>
                        {foodType.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-gray-400">📧</span>
                        <span className="truncate">{r.email}</span>
                      </div>
                      {r.phone_number && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="text-gray-400">📱</span>
                          <span>{r.phone_number}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-gray-400">📋</span>
                        <span>FSSAI: <strong>{r.fssai_license_number}</strong></span>
                      </div>
                      {r.gst_number && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="text-gray-400">🏷️</span>
                          <span>GST: <strong>{r.gst_number}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* FSSAI Document */}
                    {docUrl && (
                      <div className="mt-3">
                        <button
                          onClick={() => setDocPreview(docUrl)}
                          className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 font-medium bg-teal-50 px-3 py-1.5 rounded-lg transition"
                        >
                          {isPdf ? '📄' : '🖼️'} View FSSAI Document
                        </button>
                      </div>
                    )}

                    {/* Referred By */}
                    {r.referred_by && (
                      <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm">
                        <span>👤</span>
                        <span>
                          Referred by <strong>{r.referred_by.name}</strong>
                          {r.referred_by.username && (
                            <span className="text-blue-500"> @{r.referred_by.username}</span>
                          )}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-400">
                      Signed up: {new Date(r.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(r.id, r.restaurant_name)}
                      disabled={actionLoading === r.id}
                      className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      {actionLoading === r.id ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        '✅'
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectModal({ id: r.id, name: r.restaurant_name })}
                      disabled={actionLoading === r.id}
                      className="px-5 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Reject Restaurant
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Rejecting <strong>{rejectModal.name}</strong>. Both the restaurant and referrer (if any) will be notified.
            </p>
            <textarea
              value={rejectMessage}
              onChange={(e) => setRejectMessage(e.target.value)}
              placeholder="Reason for rejection (optional but recommended)..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectMessage('');
                }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectModal.id}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {actionLoading === rejectModal.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {docPreview && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setDocPreview(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">FSSAI Document</h3>
              <div className="flex items-center gap-3">
                <a
                  href={docPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-teal-600 hover:text-teal-800 font-medium"
                >
                  Open in new tab ↗
                </a>
                <button
                  onClick={() => setDocPreview(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
              {docPreview.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={docPreview}
                  className="w-full h-[70vh] border-0 rounded-lg"
                  title="FSSAI Document"
                />
              ) : (
                <img
                  src={docPreview}
                  alt="FSSAI Document"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
