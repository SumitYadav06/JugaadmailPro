/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Copy, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRCodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  address: string | null;
  onCopy: () => void;
}

export default function QRCodeSheet({ isOpen, onClose, address, onCopy }: QRCodeSheetProps) {
  const qrUrl = address 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(address)}&color=000000&bgcolor=ffffff`
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-[10px]"
          />

          {/* Bottom Sheet Content */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative z-10 flex max-h-[94vh] w-full max-w-xl flex-col rounded-t-[36px] border-t border-white/10 bg-[#0d0e14] pb-8 shadow-2xl"
          >
            {/* Drag Pill indicator */}
            <div className="mx-auto my-4 h-1.5 w-12 rounded-full bg-white/20" />

            <div className="flex items-center justify-between border-b border-white/5 px-6 pb-6 pt-2">
              <h3 className="font-sans text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#0076ff]" />
                Share Identity
              </h3>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10 hover:scale-105 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-6 text-center">
              {address ? (
                <>
                  {/* Elegant QR Card wrapper */}
                  <div className="mb-6 rounded-[28px] bg-white p-6 shadow-2xl transition hover:rotate-1 hover:scale-[1.02]">
                    <img
                      src={qrUrl}
                      alt="Address QR Code"
                      className="h-52 w-52 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <p className="mb-8 break-all px-4 font-mono text-base font-bold text-white selection:bg-[#0076ff]">
                    {address}
                  </p>

                  <button
                    onClick={onCopy}
                    className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0076ff] to-[#00c6ff] px-6 py-4 font-sans text-sm font-extrabold tracking-wide text-white shadow-[0_10px_25px_rgba(0,118,255,0.4)] transition hover:opacity-90 active:scale-98"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Address
                  </button>
                </>
              ) : (
                <p className="text-sm text-neutral-400">No active address selected.</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
