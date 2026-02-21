import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

const PROFILE_PIC_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : '';

export default function VoucherClaims({ token, onStatsChange }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/voucher-claims`, {
        params: { status_filter: filter, limit: 50 },
        headers,
      });
      setClaims(res.data.claims);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Error fetching voucher claims:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [filter]);

  const handleProcess = async (claimId) => {
    if (!window.confirm('Mark this voucher claim as processed? The user will be notified.')) return;
    setActionLoading(claimId);
    try {
      await axios.post(`${API_URL}/admin/voucher-claims/${claimId}/process`, {}, { headers });
      fetchClaims();
      onStatsChange();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to process');
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
        {['pending', 'processed', 'all'].map((f) => (
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

      {/* Claims List */}
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
      ) : claims.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">
            {filter === 'pending' ? '🎉' : '📭'}
          </p>
          <p className="text-gray-500">
            {filter === 'pending'
              ? 'No pending voucher claims!'
              : `No ${filter} claims found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Profile Picture */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex-shrink-0 overflow-hidden">
                    {getProfilePicUrl(claim.profile_picture) ? (
                      <img
                        src={getProfilePicUrl(claim.profile_picture)}
                        alt={claim.username}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                        {(claim.full_name || claim.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">
                        {claim.full_name || claim.username}
                      </p>
                      <span className="text-xs text-gray-400">@{claim.username}</span>
                      <VoucherStatusBadge status={claim.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="font-medium text-green-600">₹{claim.amount_deducted} voucher</span>
                      <span>·</span>
                      <span>Wallet: ₹{claim.wallet_balance}</span>
                      {claim.level && (
                        <>
                          <span>·</span>
                          <span>Level {claim.level}</span>
                        </>
                      )}
                      {claim.total_points != null && (
                        <>
                          <span>·</span>
                          <span>{claim.total_points?.toLocaleString()} pts</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {claim.user_email && <span>📧 {claim.user_email}</span>}
                      {claim.user_phone && <span>📱 {claim.user_phone}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {formatDate(claim.created_at)}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {claim.status === 'pending' && (
                    <button
                      onClick={() => handleProcess(claim.id)}
                      disabled={actionLoading === claim.id}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition disabled:opacity-50"
                    >
                      {actionLoading === claim.id ? '...' : 'Mark Processed'}
                    </button>
                  )}
                  {claim.status === 'processed' && (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-600">
                      ✓ Processed
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VoucherStatusBadge({ status }) {
  const config = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
    processed: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-400' },
  };

  const c = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {status}
    </span>
  );
}
