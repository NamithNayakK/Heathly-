import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, LayoutDashboard, MessageCircle, ClipboardList, Users, LogOut, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('full_name') || 'User';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('full_name');
    localStorage.removeItem('email');
    setIsOpen(false);
    navigate('/login');
  };

  const navLinks = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Assessment', path: '/assessment', icon: ClipboardList },
    { label: 'Chat', path: '/chat', icon: MessageCircle },
    { label: 'Forum', path: '/forum', icon: Users },
  ];

  return (
    <nav className="sticky top-0 z-20 border-b border-white/20 bg-white/65 text-slate-800 shadow-sm backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
          >
            <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 p-2">
              <span className="text-white font-bold text-lg">❤️</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Healthly</span>
          </div>

          {/* Desktop Navigation */}
          {token && (
            <div className="hidden md:flex gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="nav-link-interactive focus-ring inline-flex items-center gap-2 font-medium text-slate-700 hover:text-indigo-700"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </button>
              ))}
            </div>
          )}

          {/* User Menu / Login */}
          <div className="flex items-center gap-4">
            {token ? (
              <div className="relative">
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="btn-ripple focus-ring rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 font-medium text-white transition hover:opacity-90"
                >
                  <span className="text-sm">👤 {userName}</span>
                  <span>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg bg-white text-gray-800 shadow-xl">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-left font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="btn-ripple focus-ring rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 font-medium text-white transition hover:opacity-90"
              >
                Login
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="focus-ring text-xl md:hidden"
            >
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && token && (
          <div className="md:hidden pb-4 space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => {
                  navigate(link.path);
                  setIsOpen(false);
                }}
                className="block w-full rounded px-4 py-2 text-left transition hover:bg-indigo-50"
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
