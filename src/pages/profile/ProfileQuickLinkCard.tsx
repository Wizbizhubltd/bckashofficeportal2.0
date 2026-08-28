import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, LucideIcon } from 'lucide-react';

/** One role-relevant shortcut — this is the bit that actually differs between the five profile pages. */
export function ProfileQuickLinkCard({
  icon: Icon,
  title,
  description,
  to,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
  cta: string;
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 hover:border-primary/30 hover:shadow-md transition-all"
    >
      <div className="w-11 h-11 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-heading font-bold text-primary">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium text-primary flex-shrink-0">
        {cta} <ArrowRightIcon size={14} />
      </div>
    </button>
  );
}
