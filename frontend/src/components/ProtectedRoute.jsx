import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    setIsAuthorized(true);
    setIsLoading(false);
  }, [token, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return children;
}
