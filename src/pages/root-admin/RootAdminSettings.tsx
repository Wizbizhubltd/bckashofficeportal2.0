import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ROOT_ADMIN_OPERATION_KEY_STORAGE,
  clearRootAdminSession,
} from '../../services/root-admin/root-admin.service';

export function RootAdminSettings() {
  const navigate = useNavigate();
  const [operationKey, setOperationKey] = useState(
    () => localStorage.getItem(ROOT_ADMIN_OPERATION_KEY_STORAGE) ?? '',
  );
  const [message, setMessage] = useState('');

  const onOperationKeyChange = (value: string) => {
    setOperationKey(value);
    localStorage.setItem(ROOT_ADMIN_OPERATION_KEY_STORAGE, value);
    setMessage('Operation key updated.');
  };

  const clearOperationKey = () => {
    setOperationKey('');
    localStorage.removeItem(ROOT_ADMIN_OPERATION_KEY_STORAGE);
    setMessage('Operation key cleared from browser storage.');
  };

  const logout = () => {
    clearRootAdminSession();
    navigate('/root-admin/login', { replace: true });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>
      ) : null}

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">Root Admin Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage operation key used for protected organization actions.</p>

        <div className="mt-4 space-y-3">
          <input
            value={operationKey}
            onChange={(event) => onOperationKeyChange(event.target.value)}
            placeholder="ROOT_ADMIN_OPERATION_KEY"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={clearOperationKey}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear Saved Key
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              Logout Root Admin
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
