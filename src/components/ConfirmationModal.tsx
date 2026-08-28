import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, AlertTriangleIcon } from 'lucide-react';
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  description: string;
  icon?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'blue' | 'orange';
  inputType?: 'textarea' | 'amount' | 'select' | 'none';
  inputLabel?: string;
  inputPlaceholder?: string;
  selectOptions?: {
    label: string;
    value: string;
  }[];
  requireInput?: boolean;
  /** Greys out the confirm button and blocks `onConfirm` regardless of input — e.g. the signed-in staff member isn't allowed to take this action at all. Pair with `disabledReason` to explain why. */
  confirmDisabled?: boolean;
  /** Shown under the buttons only while `confirmDisabled` is true. */
  disabledReason?: string;
}
const variantClasses: Record<string, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  blue: 'bg-blue-600 text-white hover:bg-blue-700',
  orange: 'bg-accent text-white hover:bg-accent/90'
};
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  icon,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  inputType = 'none',
  inputLabel,
  inputPlaceholder,
  selectOptions,
  requireInput = false,
  confirmDisabled = false,
  disabledReason
}: ConfirmationModalProps) {
  const [inputValue, setInputValue] = useState('');
  function handleConfirm() {
    if (confirmDisabled) return;
    if (requireInput && !inputValue.trim()) return;
    onConfirm(inputValue || undefined);
    setInputValue('');
  }
  function handleClose() {
    setInputValue('');
    onClose();
  }
  return (
    <AnimatePresence>
      {isOpen &&
      <motion.div
        initial={{
          opacity: 0
        }}
        animate={{
          opacity: 1
        }}
        exit={{
          opacity: 0
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4">
        
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <motion.div
          initial={{
            opacity: 0,
            scale: 0.95,
            y: 10
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
            y: 10
          }}
          transition={{
            duration: 0.2
          }}
          className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          
            <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            
              <XIcon size={18} />
            </button>

            <div className="flex items-start gap-4 mb-4">
              {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
              <div>
                <h3 className="text-lg font-heading font-bold text-gray-900">
                  {title}
                </h3>
                <p className="text-sm font-body text-gray-500 mt-1">
                  {description}
                </p>
              </div>
            </div>

            {inputType === 'textarea' &&
          <div className="mb-4">
                {inputLabel &&
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                    {inputLabel}
                  </label>
            }
                <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder || 'Enter details...'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            
              </div>
          }

            {inputType === 'amount' &&
          <div className="mb-4">
                {inputLabel &&
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                    {inputLabel}
                  </label>
            }
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-body">
                    ₦
                  </span>
                  <input
                type="text"
                value={inputValue}
                onChange={(e) =>
                setInputValue(e.target.value.replace(/[^0-9,]/g, ''))
                }
                placeholder={inputPlaceholder || '0'}
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" />
              
                </div>
              </div>
          }

            {inputType === 'select' && selectOptions &&
          <div className="mb-4">
                {inputLabel &&
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                    {inputLabel}
                  </label>
            }
                <select
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
              
                  <option value="">Select...</option>
                  {selectOptions.map((opt) =>
              <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
              )}
                </select>
              </div>
          }

            <div className="flex justify-end gap-3 mt-6">
              <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">

                Cancel
              </button>
              <button
              onClick={handleConfirm}
              disabled={confirmDisabled || (requireInput && !inputValue.trim())}
              className={`px-4 py-2 text-sm font-heading font-bold rounded-lg transition-colors ${variantClasses[confirmVariant]} ${confirmDisabled || (requireInput && !inputValue.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}>

                {confirmLabel}
              </button>
            </div>

            {confirmDisabled && disabledReason &&
          <p className="text-xs text-amber-600 text-right mt-2">{disabledReason}</p>
          }
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}