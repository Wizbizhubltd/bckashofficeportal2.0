import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { useRolePath } from '../hooks/useRolePath';

/**
 * "Go back" at the top of every page except the dashboard. Goes to the previous page in this tab,
 * or — when the page was opened directly (a link, a refresh) — up to its parent page.
 */
export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const rolePath = useRolePath();
  const home = rolePath();

  if (location.pathname === home || location.pathname === `${home}/`) {
    return null;
  }

  const goBack = () => {
    // React Router records its position in history.state.idx; 0 means nothing to go back to in-app.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
      return;
    }

    const parent = location.pathname.replace(/\/[^/]+\/?$/, '');
    navigate(parent.length > home.length ? parent : home);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-gray-500 transition-colors hover:bg-white hover:text-primary"
    >
      <ArrowLeftIcon size={16} />
      Go back
    </button>
  );
}
