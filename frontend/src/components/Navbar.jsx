import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, LayoutDashboard, MessageCircle, ClipboardList, Users, LogOut, Menu, X, Heart } from 'lucide-react';

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
    <nav className="sticky top-0 z-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 cursor-pointer text-teal-700"
          >
            <Heart className="h-6 w-6" />
            <span className="text-xl font-bold text-slate-900">Healthly</span>
          </div>

          {/* Desktop Navigation */}
          {token && (
            <div className="hidden md:flex gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="inline-flex items-center gap-2 font-medium text-slate-600 hover:text-teal-700 transition-colors"
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
                  className="btn-secondary flex items-center gap-2 px-3 py-1.5"
                >
                  <span className="text-sm font-medium">👤 {userName}</span>
                </button>

                {isOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-md bg-white border border-slate-200 shadow-lg py-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="btn-primary"
              >
                Login
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
               onClick={() => setIsOpen(!isOpen)}
               className="text-slate-600 md:hidden"
            >
               {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && token && (
          <div className="md:hidden border-t border-slate-100 py-2 space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => {
                  navigate(link.path);
                  setIsOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-teal-700"
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
