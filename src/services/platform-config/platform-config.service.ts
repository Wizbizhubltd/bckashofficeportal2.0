import { api } from '../../app/api';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';
import type {
  BranchRulesConfiguration,
  CreateBranchRulesConfigurationPayload,
  CreateLoanConfigurationPayload,
  CreateRepaymentPenaltyConfigurationPayload,
  LoanConfiguration,
  RepaymentPenaltyConfiguration,
} from './platform-config.types';

/** `loan-configurations` tag — see platform-config.types.ts's own doc comment for the versioning model. */
export const loanConfigurationService = {
  list: (): Promise<LoanConfiguration[]> => api.get<LoanConfiguration[]>('/loan-configurations'),
  /** The current ACTIVE version, or null if none has ever been approved. */
  getActive: (): Promise<LoanConfiguration | null> =>
    api.get<LoanConfiguration | null>('/loan-configurations/active'),
  /** Admin/SuperAdmin-initiated — returns a pending WorkflowRequest, not the record. */
  propose: (payload: CreateLoanConfigurationPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, CreateLoanConfigurationPayload>('/loan-configurations', payload),
};

/** `repayment-penalty-configurations` tag — see platform-config.types.ts's own doc comment. */
export const repaymentPenaltyConfigurationService = {
  list: (): Promise<RepaymentPenaltyConfiguration[]> =>
    api.get<RepaymentPenaltyConfiguration[]>('/repayment-penalty-configurations'),
  getActive: (): Promise<RepaymentPenaltyConfiguration | null> =>
    api.get<RepaymentPenaltyConfiguration | null>('/repayment-penalty-configurations/active'),
  propose: (payload: CreateRepaymentPenaltyConfigurationPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, CreateRepaymentPenaltyConfigurationPayload>(
      '/repayment-penalty-configurations',
      payload,
    ),
};

/** `branch-rules-configurations` tag — see platform-config.types.ts's own doc comment. */
export const branchRulesConfigurationService = {
  list: (): Promise<BranchRulesConfiguration[]> =>
    api.get<BranchRulesConfiguration[]>('/branch-rules-configurations'),
  getActive: (): Promise<BranchRulesConfiguration | null> =>
    api.get<BranchRulesConfiguration | null>('/branch-rules-configurations/active'),
  propose: (payload: CreateBranchRulesConfigurationPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, CreateBranchRulesConfigurationPayload>(
      '/branch-rules-configurations',
      payload,
    ),
};

export * from './platform-config.types';
