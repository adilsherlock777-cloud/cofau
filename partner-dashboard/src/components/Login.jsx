import { useState } from 'react';
import { loginWithPin } from '../api/orders';

export default function Login({ onLoginSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await loginWithPin(pin);

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Invalid PIN');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cofau-orange mb-2">Cofau</h1>
            <p className="text-gray-600">Partner Dashboard</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                Enter PIN
              </label>
              <input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cofau-orange focus:border-transparent outline-none"
                placeholder="Enter your PIN"
                maxLength="4"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length === 0}
              className="w-full bg-cofau-orange text-white py-3 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Contact support if you've forgotten your PIN
          </div>
        </div>
      </div>
    </div>
  );
}
