import * as Yup from 'yup';
import { AlertTriangleIcon } from 'lucide-react';
import { inputClass, ToggleField, VersionedConfigPanel } from './VersionedConfigPanel';
import {
  repaymentPenaltyConfigurationService,
  type CreateRepaymentPenaltyConfigurationPayload,
  type RepaymentFrequency,
  type RepaymentPenaltyConfiguration,
} from '../../services/platform-config/platform-config.service';

const FREQUENCY_OPTIONS: { value: RepaymentFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

type FormValues = {
  penaltyRatePercent: string;
  penaltyGracePeriodDays: string;
  maxPenaltyCapPercent: string;
  autoPenalty: boolean;
  repaymentFrequency: RepaymentFrequency;
};

const EMPTY_FORM: FormValues = {
  penaltyRatePercent: '2.5',
  penaltyGracePeriodDays: '3',
  maxPenaltyCapPercent: '25',
  autoPenalty: true,
  repaymentFrequency: 'MONTHLY',
};

function toFormValues(record: RepaymentPenaltyConfiguration): FormValues {
  return {
    penaltyRatePercent: (record.penaltyRate / 100).toFixed(2),
    penaltyGracePeriodDays: String(record.penaltyGracePeriodDays),
    maxPenaltyCapPercent: (record.maxPenaltyCap / 100).toFixed(2),
    autoPenalty: record.autoPenalty,
    repaymentFrequency: record.repaymentFrequency,
  };
}

function buildPayload(values: FormValues): CreateRepaymentPenaltyConfigurationPayload {
  return {
    penaltyRate: Math.round(parseFloat(values.penaltyRatePercent) * 100),
    penaltyGracePeriodDays: parseInt(values.penaltyGracePeriodDays, 10),
    maxPenaltyCap: Math.round(parseFloat(values.maxPenaltyCapPercent) * 100),
    autoPenalty: values.autoPenalty,
    repaymentFrequency: values.repaymentFrequency,
  };
}

const schema = Yup.object({
  penaltyRatePercent: Yup.number().typeError('Enter a valid rate').min(0).required('Required'),
  penaltyGracePeriodDays: Yup.number().typeError('Enter a whole number of days').integer().min(0).required('Required'),
  maxPenaltyCapPercent: Yup.number().typeError('Enter a valid rate').min(0).required('Required'),
});

export function RepaymentPenaltyPanel() {
  return (
    <VersionedConfigPanel<RepaymentPenaltyConfiguration, CreateRepaymentPenaltyConfigurationPayload, FormValues>
      title="Repayment & Penalties"
      description="Late payment penalties and repayment schedule rules"
      icon={<AlertTriangleIcon size={20} />}
      entityType="REPAYMENT_PENALTY_CONFIG"
      listRecords={repaymentPenaltyConfigurationService.list}
      proposeRecord={repaymentPenaltyConfigurationService.propose}
      emptyFormValues={EMPTY_FORM}
      toFormValues={toFormValues}
      buildPayload={buildPayload}
      validationSchema={schema}
      renderFields={(formik) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Late Payment Penalty Rate (%)</label>
              <input name="penaltyRatePercent" type="number" step="0.01" value={formik.values.penaltyRatePercent} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
              {formik.touched.penaltyRatePercent && formik.errors.penaltyRatePercent && <p className="text-xs text-red-600 mt-1">{formik.errors.penaltyRatePercent}</p>}
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Penalty Grace Period (days)</label>
              <input name="penaltyGracePeriodDays" type="number" min={0} value={formik.values.penaltyGracePeriodDays} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
              {formik.touched.penaltyGracePeriodDays && formik.errors.penaltyGracePeriodDays && <p className="text-xs text-red-600 mt-1">{formik.errors.penaltyGracePeriodDays}</p>}
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Max Penalty Cap (%)</label>
              <input name="maxPenaltyCapPercent" type="number" step="0.01" value={formik.values.maxPenaltyCapPercent} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
              {formik.touched.maxPenaltyCapPercent && formik.errors.maxPenaltyCapPercent && <p className="text-xs text-red-600 mt-1">{formik.errors.maxPenaltyCapPercent}</p>}
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Repayment Frequency</label>
              <select
                name="repaymentFrequency"
                value={formik.values.repaymentFrequency}
                onChange={formik.handleChange}
                className={`${inputClass} bg-white`}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ToggleField
            label="Auto-Penalty"
            description="Automatically apply penalties after grace period"
            enabled={formik.values.autoPenalty}
            onToggle={() => formik.setFieldValue('autoPenalty', !formik.values.autoPenalty, false)}
          />
        </div>
      )}
      renderRecordSummary={(record) => (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Penalty Rate</p>
            <p className="font-bold text-gray-800">{(record.penaltyRate / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Grace Period</p>
            <p className="font-bold text-gray-800">{record.penaltyGracePeriodDays}d</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cap</p>
            <p className="font-bold text-gray-800">{(record.maxPenaltyCap / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Frequency</p>
            <p className="font-bold text-gray-800">{FREQUENCY_OPTIONS.find((f) => f.value === record.repaymentFrequency)?.label}</p>
          </div>
        </div>
      )}
      renderPendingSummary={(payload) => {
        const rate = typeof payload.penaltyRate === 'number' ? `${(payload.penaltyRate / 100).toFixed(2)}%` : '—';
        const freq = typeof payload.repaymentFrequency === 'string' ? payload.repaymentFrequency : '—';
        return <span>New version: {rate} penalty rate, {freq.toLowerCase()} repayments</span>;
      }}
    />
  );
}
