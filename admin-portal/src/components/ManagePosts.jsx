import { useState } from 'react';
import axios from 'axios';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

export default function ManagePosts({ token }) {
  const [username, setUsername] = useState('');
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const searchUser = async (e) => {
    e?.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await axios.get(`${API_URL}/admin/users/${trimmed}/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data.user);
      setPosts(res.data.posts || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('User not found');
      } else {
        setError('Failed to fetch posts');
      }
      setUser(null);
      setPosts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

    setDeletingId(postId);
    try {
      await axios.delete(`${API_URL}/admin/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete post');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      {/* Header with Search */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Manage Posts</h3>
        <form onSubmit={searchUser} className="flex gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username to search..."
            className="flex-1 max-w-sm px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="px-5 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        </div>
      )}

      {/* User Info */}
      {user && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold">
              {(user.full_name || user.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{user.full_name || '—'}</p>
              <p className="text-xs text-gray-500">@{user.username} &middot; {user.email}</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                {total} post{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : searched && !error && posts.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 font-medium">No posts found for this user</p>
        </div>
      ) : posts.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {posts.map((post) => (
            <div key={post.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex gap-4">
                {/* Media Preview */}
                {post.media_url && (
                  <div className="flex-shrink-0">
                    {post.media_type === 'video' ? (
                      <div className="w-20 h-20 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400 text-2xl border border-gray-200">
                        ▶
                      </div>
                    ) : (
                      <img
                        src={post.media_url}
                        alt=""
                        className="w-20 h-20 rounded-xl object-cover border border-gray-200"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                )}

                {/* Post Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {post.dish_name && (
                        <p className="text-sm font-semibold text-gray-800 truncate">{post.dish_name}</p>
                      )}
                      {post.review_text && (
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{post.review_text}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {post.rating != null && (
                          <span className="text-orange-500 font-medium">★ {post.rating}</span>
                        )}
                        {post.category && <span>{post.category}</span>}
                        {post.location_name && <span>{post.location_name}</span>}
                        <span>❤ {post.likes_count}</span>
                        <span>💬 {post.comments_count}</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => deletePost(post.id)}
                      disabled={deletingId === post.id}
                      className="flex-shrink-0 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition disabled:opacity-40 border border-red-200"
                    >
                      {deletingId === post.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !searched ? (
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500 font-medium">Search a username to view their posts</p>
        </div>
      ) : null}
    </div>
  );
}
