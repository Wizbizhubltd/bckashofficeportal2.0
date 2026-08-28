import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FingerprintIcon,
  XIcon,
  CheckCircleIcon,
  AlertCircleIcon } from
'lucide-react';
type Step = 'ready' | 'scanning' | 'matching' | 'success' | 'failed';
interface DisbursementFingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrowerName: string;
  borrowerId: string;
  onVerified: (borrowerId: string) => Promise<void> | void;
}
export function DisbursementFingerprintModal({
  isOpen,
  onClose,
  borrowerName,
  borrowerId,
  onVerified
}: DisbursementFingerprintModalProps) {
  const [step, setStep] = useState<Step>('ready');
  useEffect(() => {
    if (!isOpen) {
      setStep('ready');
    }
  }, [isOpen]);
  useEffect(() => {
    if (step === 'scanning') {
      const timer = setTimeout(() => setStep('matching'), 1800);
      return () => clearTimeout(timer);
    }
    if (step === 'matching') {
      const timer = setTimeout(() => setStep('success'), 1200);
      return () => clearTimeout(timer);
    }
  }, [step]);
  function handleStartScan() {
    setStep('scanning');
  }
  async function handleDone() {
    await onVerified(borrowerId);
    onClose();
  }
  if (!isOpen) return null;
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}>
        
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
          initial={{
            opacity: 0,
            scale: 0.95,
            y: 20
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
            y: 20
          }}
          transition={{
            duration: 0.2
          }}
          className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}>
          
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FingerprintIcon size={16} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-base font-heading font-bold text-gray-900">
                    Verify Facial Capture
                  </h3>
                  <p className="text-xs font-body text-gray-500">
                    Pre-disbursement biometric check
                  </p>
                </div>
              </div>
              <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              
                <XIcon size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
              {step === 'ready' &&
            <div className="text-center space-y-5">
                  <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                    <FingerprintIcon size={40} className="text-accent" />
                  </div>
                  <div>
                    <h4 className="text-base font-heading font-bold text-gray-900">
                      Verify: {borrowerName}
                    </h4>
                    <p className="text-xs font-body text-gray-400 mt-0.5">
                      {borrowerId}
                    </p>
                    <p className="text-sm font-body text-gray-500 mt-2">
                      Ask the borrower to face the camera to verify identity
                      before loan disbursement.
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-left">
                    <div className="flex items-start gap-2">
                      <AlertCircleIcon
                    size={16}
                    className="text-amber-600 mt-0.5 flex-shrink-0" />
                  
                      <p className="text-xs font-body text-amber-700">
                        The face will be matched against the stored biometric
                        data captured during customer onboarding.
                      </p>
                    </div>
                  </div>
                  <button
                onClick={handleStartScan}
                className="w-full px-5 py-3 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                
                    <FingerprintIcon size={18} />
                    Start Facial Scan
                  </button>
                </div>
            }

              {step === 'scanning' &&
            <div className="text-center space-y-5">
                  <div className="relative w-24 h-24 mx-auto">
                    <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 0.1, 0.3]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="absolute inset-0 rounded-full bg-accent/20" />
                
                    <motion.div
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.5, 0.2, 0.5]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.2
                  }}
                  className="absolute inset-2 rounded-full bg-accent/20" />
                
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                    animate={{
                      opacity: [0.6, 1, 0.6]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}>
                    
                        <FingerprintIcon size={44} className="text-accent" />
                      </motion.div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-base font-heading font-bold text-gray-900">
                      Capturing Face...
                    </h4>
                    <p className="text-sm font-body text-gray-500 mt-1">
                      Keep the face centered in the frame.
                    </p>
                  </div>
                  <motion.div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                  initial={{
                    width: '0%'
                  }}
                  animate={{
                    width: '100%'
                  }}
                  transition={{
                    duration: 1.8,
                    ease: 'linear'
                  }}
                  className="h-full bg-accent rounded-full" />
                
                  </motion.div>
                </div>
            }

              {step === 'matching' &&
            <div className="text-center space-y-5">
                  <motion.div
                animate={{
                  rotate: [0, 360]
                }}
                transition={{
                  duration: 1.2,
                  ease: 'linear',
                  repeat: Infinity
                }}
                className="w-16 h-16 mx-auto border-4 border-gray-200 border-t-accent rounded-full" />
              
                  <div>
                    <h4 className="text-base font-heading font-bold text-gray-900">
                      Matching Face...
                    </h4>
                    <p className="text-sm font-body text-gray-500 mt-1">
                      Comparing against stored facial data.
                    </p>
                  </div>
                </div>
            }

              {step === 'success' &&
            <div className="text-center space-y-5">
                  <motion.div
                initial={{
                  scale: 0
                }}
                animate={{
                  scale: 1
                }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 15
                }}
                className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                
                    <CheckCircleIcon size={44} className="text-green-600" />
                  </motion.div>
                  <div>
                    <h4 className="text-base font-heading font-bold text-gray-900">
                      Identity Verified
                    </h4>
                    <p className="text-sm font-body text-gray-500 mt-1">
                      {borrowerName}'s face matches the stored record.
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm font-body text-left">
                      <div>
                        <p className="text-xs text-green-600">Match Score</p>
                        <p className="font-medium text-green-800">
                          96% — Confirmed
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-green-600">Identity</p>
                        <p className="font-medium text-green-800">
                          {borrowerId} ✓
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                onClick={handleDone}
                className="w-full px-5 py-3 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors">
                
                    Done
                  </button>
                </div>
            }

              {step === 'failed' &&
            <div className="text-center space-y-5">
                  <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                    <XIcon size={44} className="text-red-500" />
                  </div>
                  <div>
                    <h4 className="text-base font-heading font-bold text-gray-900">
                      Verification Failed
                    </h4>
                    <p className="text-sm font-body text-gray-500 mt-1">
                      Face does not match stored record. Please try again.
                    </p>
                  </div>
                  <button
                onClick={() => setStep('ready')}
                className="w-full px-5 py-3 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors">
                
                    Try Again
                  </button>
                </div>
            }
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}