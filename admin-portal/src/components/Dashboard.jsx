import { useState, useEffect } from 'react';
import axios from 'axios';
import BadgeRequests from './BadgeRequests';
import VoucherClaims from './VoucherClaims';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

export default function Dashboard({ admin, onLogout }) {
  const [activeTab, setActiveTab] = useState('badge-requests');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${admin.token}` },
      });
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                Cofau
              </h1>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">
                Admin
              </span>
            </div>

            {/* Admin Info + Logout */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {admin.name || admin.username}
              </span>
              <button
                onClick={onLogout}
                className="text-sm text-red-500 hover:text-red-700 font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <StatCard
            label="Total Users"
            value={stats?.total_users}
            loading={loadingStats}
            icon="👥"
          />
          <StatCard
            label="Total Posts"
            value={stats?.total_posts}
            loading={loadingStats}
            icon="📝"
          />
          <StatCard
            label="Restaurants"
            value={stats?.total_restaurants}
            loading={loadingStats}
            icon="🍽️"
          />
          <StatCard
            label="Pending Badges"
            value={stats?.pending_badges}
            loading={loadingStats}
            icon="⏳"
            highlight={stats?.pending_badges > 0}
          />
          <StatCard
            label="Approved Badges"
            value={stats?.approved_badges}
            loading={loadingStats}
            icon="✅"
          />
          <StatCard
            label="Pending Vouchers"
            value={stats?.pending_vouchers}
            loading={loadingStats}
            icon="🎟️"
            highlight={stats?.pending_vouchers > 0}
          />
          <StatCard
            label="Total Vouchers"
            value={stats?.total_vouchers}
            loading={loadingStats}
            icon="🎁"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 max-w-lg">
          <TabButton
            active={activeTab === 'badge-requests'}
            onClick={() => setActiveTab('badge-requests')}
            label="Badge Requests"
            count={stats?.pending_badges}
          />
          <TabButton
            active={activeTab === 'voucher-claims'}
            onClick={() => setActiveTab('voucher-claims')}
            label="Voucher Claims"
            count={stats?.pending_vouchers}
          />
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            label="Overview"
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'badge-requests' && (
          <BadgeRequests token={admin.token} onStatsChange={fetchStats} />
        )}

        {activeTab === 'voucher-claims' && (
          <VoucherClaims token={admin.token} onStatsChange={fetchStats} />
        )}

        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Admin Overview</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>Welcome to the Cofau Admin Portal. Manage badge requests and voucher claims from the tabs above.</p>
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-700 mb-2">Quick Guide</h4>
                <ul className="space-y-2 text-gray-500">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">●</span>
                    <span><strong>Badge Requests</strong> — Review and approve/reject user verified badge applications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">●</span>
                    <span><strong>Voucher Claims</strong> — View and process Amazon voucher redemption requests</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, icon, highlight }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-4 ${highlight ? 'border-orange-300 bg-orange-50' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xl">{icon}</span>
      </div>
      {loading ? (
        <div className="h-7 w-12 bg-gray-200 rounded animate-pulse"></div>
      ) : (
        <p className={`text-xl font-bold ${highlight ? 'text-orange-600' : 'text-gray-800'}`}>
          {value ?? '—'}
        </p>
      )}
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function TabButton({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
        active
          ? 'bg-white text-gray-800 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
          active ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}
