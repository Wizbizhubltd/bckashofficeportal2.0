import * as Yup from 'yup';
import { GitBranchIcon } from 'lucide-react';
import { inputClass, ToggleField, VersionedConfigPanel } from './VersionedConfigPanel';
import {
  branchRulesConfigurationService,
  type BranchRulesConfiguration,
  type CreateBranchRulesConfigurationPayload,
} from '../../services/platform-config/platform-config.service';

type FormValues = {
  maxActiveBranches: string;
  defaultFundLimitNaira: string;
  requireManagerApproval: boolean;
  autoDisbursementLimitNaira: string;
};

const EMPTY_FORM: FormValues = {
  maxActiveBranches: '20',
  defaultFundLimitNaira: '50000000',
  requireManagerApproval: true,
  autoDisbursementLimitNaira: '500000',
};

function toFormValues(record: BranchRulesConfiguration): FormValues {
  return {
    maxActiveBranches: String(record.maxActiveBranches),
    defaultFundLimitNaira: String(record.defaultFundLimitKobo / 100),
    requireManagerApproval: record.requireManagerApproval,
    autoDisbursementLimitNaira: String(record.autoDisbursementLimitKobo / 100),
  };
}

function buildPayload(values: FormValues): CreateBranchRulesConfigurationPayload {
  return {
    maxActiveBranches: parseInt(values.maxActiveBranches, 10),
    defaultFundLimitKobo: Math.round(parseFloat(values.defaultFundLimitNaira) * 100),
    requireManagerApproval: values.requireManagerApproval,
    autoDisbursementLimitKobo: Math.round(parseFloat(values.autoDisbursementLimitNaira) * 100),
  };
}

const schema = Yup.object({
  maxActiveBranches: Yup.number().typeError('Enter a whole number').integer().min(1).required('Required'),
  defaultFundLimitNaira: Yup.number().typeError('Enter a valid amount').min(0).required('Required'),
  autoDisbursementLimitNaira: Yup.number().typeError('Enter a valid amount').min(0).required('Required'),
});

export function BranchRulesPanel() {
  return (
    <VersionedConfigPanel<BranchRulesConfiguration, CreateBranchRulesConfigurationPayload, FormValues>
      title="Branch Rules"
      description="Limits and approval rules for branch operations"
      icon={<GitBranchIcon size={20} />}
      entityType="BRANCH_RULES_CONFIG"
      listRecords={branchRulesConfigurationService.list}
      proposeRecord={branchRulesConfigurationService.propose}
      emptyFormValues={EMPTY_FORM}
      toFormValues={toFormValues}
      buildPayload={buildPayload}
      validationSchema={schema}
      renderFields={(formik) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Max Active Branches</label>
              <input name="maxActiveBranches" type="number" min={1} value={formik.values.maxActiveBranches} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
              {formik.touched.maxActiveBranches && formik.errors.maxActiveBranches && <p className="text-xs text-red-600 mt-1">{formik.errors.maxActiveBranches}</p>}
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Default Branch Fund Limit (₦)</label>
              <input name="defaultFundLimitNaira" type="number" value={formik.values.defaultFundLimitNaira} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
              {formik.touched.defaultFundLimitNaira && formik.errors.defaultFundLimitNaira && <p className="text-xs text-red-600 mt-1">{formik.errors.defaultFundLimitNaira}</p>}
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Auto-Disbursement Limit (₦)</label>
              <input name="autoDisbursementLimitNaira" type="number" value={formik.values.autoDisbursementLimitNaira} onChange={formik.handleChange} onBlur={formik.handleBlur} className={inputClass} />
              {formik.touched.autoDisbursementLimitNaira && formik.errors.autoDisbursementLimitNaira && <p className="text-xs text-red-600 mt-1">{formik.errors.autoDisbursementLimitNaira}</p>}
            </div>
          </div>
          <ToggleField
            label="Require Branch Manager Approval"
            description="All disbursements above the auto-limit require manager sign-off"
            enabled={formik.values.requireManagerApproval}
            onToggle={() => formik.setFieldValue('requireManagerApproval', !formik.values.requireManagerApproval, false)}
          />
        </div>
      )}
      renderRecordSummary={(record) => (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Max Active Branches</p>
            <p className="font-bold text-gray-800">{record.maxActiveBranches}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Default Fund Limit</p>
            <p className="font-bold text-gray-800">₦{(record.defaultFundLimitKobo / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Auto-Disbursement Limit</p>
            <p className="font-bold text-gray-800">₦{(record.autoDisbursementLimitKobo / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Manager Approval</p>
            <p className="font-bold text-gray-800">{record.requireManagerApproval ? 'Required' : 'Not required'}</p>
          </div>
        </div>
      )}
      renderPendingSummary={(payload) => {
        const max = typeof payload.maxActiveBranches === 'number' ? payload.maxActiveBranches : '—';
        return <span>New version: max {max} active branches</span>;
      }}
    />
  );
}
