import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

export default function SendNotification({ token }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/notification-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(res.data.history || []);
    } catch (err) {
      console.error('Error fetching notification history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setSending(true);
    setResult(null);
    setError(null);

    try {
      const res = await axios.post(
        `${API_URL}/admin/send-notification`,
        { title: title.trim(), body: body.trim(), target },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data);
      setTitle('');
      setBody('');
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Send Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Send Push Notification</h3>
        <p className="text-sm text-gray-500 mb-6">
          Send a notification to all users on both Android and iOS devices.
        </p>

        <form onSubmit={handleSend} className="space-y-4 max-w-xl">
          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send to</label>
            <div className="flex gap-3">
              {[
                { value: 'all', label: 'All' },
                { value: 'users', label: 'Users Only' },
                { value: 'restaurants', label: 'Restaurants Only' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTarget(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    target === opt.value
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Feature Alert!"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
              maxLength={100}
              required
            />
            <p className="text-xs text-gray-400 mt-1">{title.length}/100</p>
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Check out the latest restaurants added in your area!"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm resize-none"
              rows={3}
              maxLength={500}
              required
            />
            <p className="text-xs text-gray-400 mt-1">{body.length}/500</p>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className={`w-full py-3 rounded-xl text-sm font-semibold text-white transition ${
              sending || !title.trim() || !body.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
            }`}
          >
            {sending ? 'Sending...' : 'Send Notification'}
          </button>
        </form>

        {/* Success Result */}
        {result && result.success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm font-medium text-green-800">Notification sent successfully!</p>
            <div className="flex gap-4 mt-2 text-xs text-green-600">
              <span>Total: {result.total_tokens} devices</span>
              <span>iOS: {result.ios_tokens}</span>
              <span>Android: {result.android_tokens}</span>
              <span>Users: {result.users_reached}</span>
              <span>Restaurants: {result.restaurants_reached}</span>
            </div>
          </div>
        )}

        {/* No devices */}
        {result && !result.success && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-800">{result.message}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Notification History</h3>

        {loadingHistory ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">No notifications sent yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.body}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>iOS: {item.ios_tokens}</span>
                      <span>Android: {item.android_tokens}</span>
                      <span>Total: {item.total_tokens}</span>
                      <span className="capitalize">To: {item.target}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {item.sent_at
                        ? new Date(item.sent_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">by {item.sent_by}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
