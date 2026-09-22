import { SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Home() {
  const { userId } = useAuth();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <h1 className="text-2xl font-heading font-bold text-primary mb-2">Welcome to the BCKash Portal</h1>
      <p className="text-gray-500 mb-6">
        You're authenticated against BCKash.Api. Each module (clients, loans, savings, GL, and the rest) lands here
        as it's built out.
      </p>
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-6">
        <span className="font-medium text-gray-700">Signed in as user ID:</span> {userId ?? 'unknown'}
      </div>

      <Link
        to="/admin/offices"
        className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
      >
        <SettingsIcon size={16} />
        Organization & Reference Data
      </Link>
    </div>
  );
}
