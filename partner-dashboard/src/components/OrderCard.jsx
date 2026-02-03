import { useState } from 'react';

export default function OrderCard({ order, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false);

  const getStatusActions = () => {
    switch (order.status) {
      case 'pending':
        return [
          { label: 'Accept Order', nextStatus: 'accepted', color: 'bg-green-500', primary: true },
          { label: 'Cancel', nextStatus: 'cancelled', color: 'bg-red-500', primary: false }
        ];
      case 'accepted':
        return [
          { label: 'Start Preparing', nextStatus: 'preparing', color: 'bg-blue-500', primary: true },
          { label: 'Cancel Order', nextStatus: 'cancelled', color: 'bg-red-500', primary: false }
        ];
      case 'preparing':
        return [
          { label: 'Out for Delivery', nextStatus: 'out_for_delivery', color: 'bg-purple-500', primary: true },
          { label: 'Cancel Order', nextStatus: 'cancelled', color: 'bg-red-500', primary: false }
        ];
      case 'out_for_delivery':
        return [
          { label: 'Complete', nextStatus: 'completed', color: 'bg-green-600', primary: true },
          { label: 'Cancel Order', nextStatus: 'cancelled', color: 'bg-red-500', primary: false }
        ];
      default:
        return [];
    }
  };

  const handleAction = async (nextStatus, requiresConfirmation = false) => {
    // Confirm cancellation
    if (nextStatus === 'cancelled') {
      const confirmed = window.confirm(
        'Are you sure you want to cancel this order? This action cannot be undone and the customer will be notified.'
      );
      if (!confirmed) return;
    }

    setUpdating(true);
    await onStatusUpdate(order.order_id, nextStatus);
    setUpdating(false);
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  const actions = getStatusActions();

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {/* Order Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Dish Image */}
        {order.post_media_url && (
          <img
            src={order.post_media_url}
            alt={order.dish_name}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}

        {/* Order Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">
            {order.dish_name}
          </h3>
          <p className="text-sm text-gray-600 truncate">{order.restaurant_name}</p>
          <p className="text-xs text-gray-500 mt-1">{order.post_location}</p>
        </div>

        {/* Time */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-500">{formatTime(order.created_at)}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm font-medium text-gray-700">Customer</p>
        <p className="text-sm text-gray-900">{order.customer_name}</p>
        <p className="text-xs text-gray-600 mt-1">{order.delivery_address}</p>
      </div>

      {/* Suggestions */}
      {order.suggestions && (
        <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-xs font-medium text-orange-800 mb-1">Special Instructions:</p>
          <p className="text-sm text-gray-700">{order.suggestions}</p>
        </div>
      )}

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleAction(action.nextStatus)}
              disabled={updating}
              className={`${action.primary ? 'flex-1' : ''} ${action.color} text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-sm ${
                !action.primary ? 'min-w-fit' : ''
              }`}
            >
              {updating ? 'Updating...' : action.label}
            </button>
          ))}
        </div>
      )}

      {/* Completed/Cancelled status badge */}
      {(order.status === 'completed' || order.status === 'cancelled') && (
        <div className={`text-center py-2 px-4 rounded-lg font-medium text-sm ${
          order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {order.status === 'completed' ? '✓ Completed' : '✗ Cancelled'}
        </div>
      )}
    </div>
  );
}
