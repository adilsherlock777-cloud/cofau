export default function Support() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Support</h2>

      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-6xl mb-4">💬</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Support Requests</h3>
        <p className="text-gray-500">
          Customer support messages will appear here when available.
        </p>
      </div>

      {/* Placeholder for future support features */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Coming Soon:</strong> Real-time customer chat support
        </p>
      </div>
    </div>
  );
}
