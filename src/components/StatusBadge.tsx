import React from 'react';
type StatusType =
'Active' |
'Draft' |
'Pending' |
'Pending Approval' |
'Pending Review' |
'Completed' |
'Approved' |
'Rejected' |
'Overdue' |
'Disbursed' |
'Verified' |
'Captured' |
'On Leave' |
'Suspended' |
'Inactive' |
'New';
interface StatusBadgeProps {
  status: StatusType;
}
export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusStyles = (status: StatusType) => {
    switch (status) {
      case 'Active':
      case 'Approved':
      case 'Completed':
      case 'Disbursed':
      case 'Verified':
      case 'Captured':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending':
      case 'Pending Approval':
      case 'Pending Review':
      case 'New':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Rejected':
      case 'Overdue':
      case 'Suspended':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'On Leave':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Inactive':
      case 'Draft':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-heading font-medium border ${getStatusStyles(status)}`}>
      
      {status}
    </span>);

}