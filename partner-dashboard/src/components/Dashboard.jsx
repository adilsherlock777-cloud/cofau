import { useState, useEffect } from 'react';
import { getAllOrders, updateOrderStatus, clearPin } from '../api/orders';
import OrderCard from './OrderCard';
import Support from './Support';

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('new');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [orders, setOrders] = useState({
    pending: [],
    confirmed: [],
    preparing: [],
    ready: [],
    completed: [],
    cancelled: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    try {
      setError(null);
      const data = await getAllOrders();
      setOrders(data);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('login again')) {
        setTimeout(() => {
          onLogout();
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      // Refresh orders after update
      await fetchOrders();
    } catch (err) {
      alert(`Failed to update order: ${err.message}`);
    }
  };

  const handleLogout = () => {
    clearPin();
    onLogout();
  };

  // Group orders for tabs
  const newOrders = orders.pending || [];
  const inProgressOrders = [...(orders.confirmed || []), ...(orders.preparing || []), ...(orders.ready || [])];
  const completedOrders = [...(orders.completed || []), ...(orders.cancelled || [])];

  const getOrdersByTab = () => {
    switch (activeTab) {
      case 'new':
        return newOrders;
      case 'in-progress':
        return inProgressOrders;
      case 'completed':
        return completedOrders;
      default:
        return [];
    }
  };

  const currentOrders = getOrdersByTab();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex-shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-cofau-orange mb-1">Cofau</h1>
          <p className="text-sm text-gray-600">Partner Dashboard</p>
        </div>

        <nav className="mt-6">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`w-full text-left px-6 py-3 ${
              activeSection === 'dashboard'
                ? 'bg-orange-50 text-cofau-orange border-r-4 border-cofau-orange'
                : 'text-gray-700 hover:bg-gray-50'
            } font-medium transition-colors`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveSection('support')}
            className={`w-full text-left px-6 py-3 ${
              activeSection === 'support'
                ? 'bg-orange-50 text-cofau-orange border-r-4 border-cofau-orange'
                : 'text-gray-700 hover:bg-gray-50'
            } font-medium transition-colors`}
          >
            💬 Support
          </button>
        </nav>

        <div className="absolute bottom-0 w-64 p-6 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeSection === 'dashboard' ? (
          <>
            {/* Header */}
            <div className="bg-white shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
              <p className="text-sm text-gray-600 mt-1">
                Auto-refreshes every 15 seconds
              </p>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('new')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'new'
                      ? 'border-b-2 border-cofau-orange text-cofau-orange'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  New Orders
                  {newOrders.length > 0 && (
                    <span className="ml-2 bg-cofau-orange text-white text-xs px-2 py-1 rounded-full">
                      {newOrders.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('in-progress')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'in-progress'
                      ? 'border-b-2 border-cofau-orange text-cofau-orange'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  In Progress
                  {inProgressOrders.length > 0 && (
                    <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      {inProgressOrders.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'completed'
                      ? 'border-b-2 border-cofau-orange text-cofau-orange'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>

            {/* Orders Content */}
            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cofau-orange mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading orders...</p>
                </div>
              ) : currentOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-md">
                  <div className="text-6xl mb-4">📦</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Orders</h3>
                  <p className="text-gray-500">
                    {activeTab === 'new' && 'No new orders at the moment'}
                    {activeTab === 'in-progress' && 'No orders in progress'}
                    {activeTab === 'completed' && 'No completed orders yet'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentOrders.map((order) => (
                    <OrderCard
                      key={order.order_id}
                      order={order}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <Support />
        )}
      </div>
    </div>
  );
}
