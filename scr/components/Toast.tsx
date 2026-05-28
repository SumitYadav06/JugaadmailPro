/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  visible: boolean;
}

export default function Toast({ message, type = 'success', onClose, visible }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ top: -80, opacity: 0, x: '-50%', scale: 0.9 }}
          animate={{ top: 24, opacity: 1, x: '-50%', scale: 1 }}
          exit={{ top: -80, opacity: 0, x: '-50%', scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="fixed left-1/2 z-[4000] flex items-center gap-3 rounded-full border border-neutral-800 bg-white px-6 py-3 text-sm font-bold text-black shadow-2xl backdrop-blur-md md:max-w-md w-max max-w-[90vw]"
        >
          {type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
          {type === 'error' && <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />}
          {type === 'info' && <Info className="h-5 w-5 text-blue-500 shrink-0" />}
          
          <span className="truncate max-w-[70vw] font-sans tracking-tight text-neutral-900 font-semibold">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
