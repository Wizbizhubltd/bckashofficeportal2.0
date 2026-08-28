import * as Yup from 'yup';
import { BanknoteIcon } from 'lucide-react';
import { inputClass, VersionedConfigPanel } from './VersionedConfigPanel';
import { loanConfigurationService, type CreateLoanConfigurationPayload, type LoanConfiguration } from '../../services/platform-config/platform-config.service';

type FormValues = {
  interestRatePercent: string;
  maxLoanAmountNaira: string;
  minLoanAmountNaira: string;
  maxTenureMonths: string;
  gracePeriodDays: string;
  maxGroupSize: string;
  minGroupSize: string;
};

const EMPTY_FORM: FormValues = {
  interestRatePercent: '24',
  maxLoanAmountNaira: '5000000',
  minLoanAmountNaira: '50000',
  maxTenureMonths: '24',
  gracePeriodDays: '7',
  maxGroupSize: '15',
  minGroupSize: '5',
};

function toFormValues(record: LoanConfiguration): FormValues {
  return {
    interestRatePercent: (record.interestRate / 100).toFixed(2),
    maxLoanAmountNaira: String(record.maxLoanAmountKobo / 100),
    minLoanAmountNaira: String(record.minLoanAmountKobo / 100),
    maxTenureMonths: String(record.maxTenureMonths),
    gracePeriodDays: String(record.gracePeriodDays),
    maxGroupSize: String(record.maxGroupSize),
    minGroupSize: String(record.minGroupSize),
  };
}

function buildPayload(values: FormValues): CreateLoanConfigurationPayload {
  return {
    interestRate: Math.round(parseFloat(values.interestRatePercent) * 100),
    maxLoanAmountKobo: Math.round(parseFloat(values.maxLoanAmountNaira) * 100),
    minLoanAmountKobo: Math.round(parseFloat(values.minLoanAmountNaira) * 100),
    maxTenureMonths: parseInt(values.maxTenureMonths, 10),
    gracePeriodDays: parseInt(values.gracePeriodDays, 10),
    maxGroupSize: parseInt(values.maxGroupSize, 10),
    minGroupSize: parseInt(values.minGroupSize, 10),
  };
}

const schema = Yup.object({
  interestRatePercent: Yup.number().typeError('Enter a valid rate').min(0).required('Required'),
  maxLoanAmountNaira: Yup.number().typeError('Enter a valid amount').min(0).required('Required'),
  minLoanAmountNaira: Yup.number().typeError('Enter a valid amount').min(0).required('Required'),
  maxTenureMonths: Yup.number().typeError('Enter a whole number of months').integer().min(1).required('Required'),
  gracePeriodDays: Yup.number().typeError('Enter a whole number of days').integer().min(0).required('Required'),
  maxGroupSize: Yup.number().typeError('Enter a whole number').integer().min(1).required('Required'),
  minGroupSize: Yup.number().typeError('Enter a whole number').integer().min(1).required('Required'),
});

export function LoanConfigurationPanel() {
  return (
    <VersionedConfigPanel<LoanConfiguration, CreateLoanConfigurationPayload, FormValues>
      title="Loan Configuration"
      description="Interest rate, loan limits, tenure and group size rules"
      icon={<BanknoteIcon size={20} />}
      entityType="LOAN_CONFIG"
      listRecords={loanConfigurationService.list}
      proposeRecord={loanConfigurationService.propose}
      emptyFormValues={EMPTY_FORM}
      toFormValues={toFormValues}
      buildPayload={buildPayload}
      validationSchema={schema}
      renderFields={(formik) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Interest Rate (per annum, %)</label>
            <input name="interestRatePercent" type="number" step="0.01" value={formik.values.interestRatePercent} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
            {formik.touched.interestRatePercent && formik.errors.interestRatePercent && <p className="text-xs text-red-600 mt-1">{formik.errors.interestRatePercent}</p>}
          </div>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Max Loan Tenure (months)</label>
            <input name="maxTenureMonths" type="number" min={1} value={formik.values.maxTenureMonths} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
            {formik.touched.maxTenureMonths && formik.errors.maxTenureMonths && <p className="text-xs text-red-600 mt-1">{formik.errors.maxTenureMonths}</p>}
          </div>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Max Loan Amount (₦)</label>
            <input name="maxLoanAmountNaira" type="number" value={formik.values.maxLoanAmountNaira} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
            {formik.touched.maxLoanAmountNaira && formik.errors.maxLoanAmountNaira && <p className="text-xs text-red-600 mt-1">{formik.errors.maxLoanAmountNaira}</p>}
          </div>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Min Loan Amount (₦)</label>
            <input name="minLoanAmountNaira" type="number" value={formik.values.minLoanAmountNaira} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
            {formik.touched.minLoanAmountNaira && formik.errors.minLoanAmountNaira && <p className="text-xs text-red-600 mt-1">{formik.errors.minLoanAmountNaira}</p>}
          </div>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Grace Period (days)</label>
            <input name="gracePeriodDays" type="number" min={0} value={formik.values.gracePeriodDays} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
            {formik.touched.gracePeriodDays && formik.errors.gracePeriodDays && <p className="text-xs text-red-600 mt-1">{formik.errors.gracePeriodDays}</p>}
          </div>
          <div />
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Min Group Size</label>
            <input name="minGroupSize" type="number" min={1} value={formik.values.minGroupSize} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
            {formik.touched.minGroupSize && formik.errors.minGroupSize && <p className="text-xs text-red-600 mt-1">{formik.errors.minGroupSize}</p>}
          </div>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Max Group Size</label>
            <input name="maxGroupSize" type="number" min={1} value={formik.values.maxGroupSize} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
            {formik.touched.maxGroupSize && formik.errors.maxGroupSize && <p className="text-xs text-red-600 mt-1">{formik.errors.maxGroupSize}</p>}
          </div>
        </div>
      )}
      renderRecordSummary={(record) => (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Interest Rate</p>
            <p className="font-bold text-gray-800">{(record.interestRate / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Loan Range</p>
            <p className="font-bold text-gray-800">
              ₦{(record.minLoanAmountKobo / 100).toLocaleString()} – ₦{(record.maxLoanAmountKobo / 100).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Max Tenure</p>
            <p className="font-bold text-gray-800">{record.maxTenureMonths} months</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Group Size</p>
            <p className="font-bold text-gray-800">
              {record.minGroupSize}–{record.maxGroupSize}
            </p>
          </div>
        </div>
      )}
      renderPendingSummary={(payload) => {
        const rate = typeof payload.interestRate === 'number' ? `${(payload.interestRate / 100).toFixed(2)}%` : '—';
        const tenure = typeof payload.maxTenureMonths === 'number' ? `${payload.maxTenureMonths} months` : '—';
        return <span>New version: {rate} interest, up to {tenure}</span>;
      }}
    />
  );
}
