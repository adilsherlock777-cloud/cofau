import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import axios from 'axios';

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

function App() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      axios.get(`${API_URL}/admin/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          setAdmin({ ...res.data, token });
        })
        .catch(() => {
          localStorage.removeItem('adminToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLoginSuccess = (adminData, token) => {
    localStorage.setItem('adminToken', token);
    setAdmin({ ...adminData, token });
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAdmin(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <>
      {admin ? (
        <Dashboard admin={admin} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;
