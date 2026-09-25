import { useLocation } from 'react-router-dom';
import { MenuIcon, SearchIcon, UserIcon } from 'lucide-react';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/admin/offices') return 'Offices';
    if (path === '/admin/currencies') return 'Currencies';
    if (path === '/admin/countries') return 'Countries';
    if (path === '/admin/funds') return 'Funds';
    if (path === '/admin/payment-types') return 'Payment Types';
    if (path === '/admin/charges') return 'Charges';
    if (path === '/admin/custom-fields') return 'Custom Fields';
    if (path === '/admin/settings') return 'Settings';
    return 'BCKash Portal';
  };

  return (
    <header className="bg-white h-20 px-4 lg:px-8 flex items-center justify-between shadow-sm z-30 sticky top-0">
      <div className="flex items-center">
        <button className="lg:hidden mr-4 text-gray-600 hover:text-primary" onClick={onOpenMobileSidebar}>
          <MenuIcon size={24} />
        </button>
        <h1 className="text-xl lg:text-2xl font-heading font-bold text-primary">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center space-x-4 lg:space-x-6">
        <div className="hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2 w-64 lg:w-80 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <SearchIcon size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none focus:outline-none text-sm font-body w-full text-gray-700"
          />
        </div>

        <div className="lg:hidden">
          <div className="w-8 h-8 rounded-full border border-gray-200 bg-gray-100 text-gray-500 flex items-center justify-center">
            <UserIcon size={14} />
          </div>
        </div>
      </div>
    </header>
  );
}
