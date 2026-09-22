import { SimpleCrudScreen } from './SimpleCrudScreen';

interface Setting {
  id: number;
  settingKey: string;
  settingValue: string | null;
}

/** Simple key/value admin screen over Phase 0's SettingsController — no new backend work needed here. */
export function SettingsAdmin() {
  return (
    <SimpleCrudScreen<Setting>
      title="Settings"
      description="System-wide key/value configuration."
      endpoint="/settings"
      columns={[
        { key: 'settingKey', label: 'Key' },
        { key: 'settingValue', label: 'Value' },
      ]}
      fields={[
        { key: 'settingKey', label: 'Key', type: 'text' },
        { key: 'settingValue', label: 'Value', type: 'text' },
      ]}
      emptyItem={{ settingKey: '', settingValue: '' }}
    />
  );
}
