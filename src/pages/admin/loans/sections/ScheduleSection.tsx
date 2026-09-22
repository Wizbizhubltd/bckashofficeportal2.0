import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '../../../../api/apiClient';

interface ScheduleInstallment {
  id: number;
  installment: number | null;
  dueDate: string | null;
  principal: number | null;
  principalPaid: number | null;
  interest: number | null;
  interestPaid: number | null;
  fees: number | null;
  feesPaid: number | null;
  penalty: number | null;
  penaltyPaid: number | null;
  totalDue: number | null;
  paid: boolean;
}

interface ScheduleSectionProps {
  loanId: number;
  refreshToken?: number;
}

export function ScheduleSection({ loanId, refreshToken }: ScheduleSectionProps) {
  const [items, setItems] = useState<ScheduleInstallment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get<ScheduleInstallment[]>(`/loans/${loanId}/schedule`)
      .then((response) => setItems(response.data))
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load schedule.'))
      .finally(() => setLoading(false));
  }, [loanId, refreshToken]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Due Date</th>
            <th className="px-4 py-3 font-medium">Principal</th>
            <th className="px-4 py-3 font-medium">Interest</th>
            <th className="px-4 py-3 font-medium">Total Due</th>
            <th className="px-4 py-3 font-medium">Paid</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No schedule yet — the loan hasn't been disbursed.</td></tr>
          ) : (
            items.map((item) => {
              const totalPaid = (item.principalPaid ?? 0) + (item.interestPaid ?? 0) + (item.feesPaid ?? 0) + (item.penaltyPaid ?? 0);
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{item.installment}</td>
                  <td className="px-4 py-3 text-gray-700">{item.dueDate}</td>
                  <td className="px-4 py-3 text-gray-700">{item.principal?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{item.interest?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{item.totalDue?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{totalPaid.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${item.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.paid ? 'Paid' : 'Outstanding'}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
