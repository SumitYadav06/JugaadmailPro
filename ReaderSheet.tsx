/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, MailOpen, Shield, Copy, CircleSlash, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageDetail } from '../types';

interface ReaderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string | null;
  authToken: string | null;
  apiServer: string;
  onDeleteMessage: (msgId: string) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function ReaderSheet({
  isOpen,
  onClose,
  messageId,
  authToken,
  apiServer,
  onDeleteMessage,
  showToast
}: ReaderSheetProps) {
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [extractedOTP, setExtractedOTP] = useState<string | null>(null);

  // Smart context-aware OTP/Verification Code Extractor
  const extractOTP = (text: string): string | null => {
    // 1. Context phrase matching (such as otp, code, pin, verification) followed by code within 50 chars
    const contextRegex = /(?:otp|code|pin|verification|password|token|verify)[\s\S]{0,50}?\b([a-z0-9]{4,8}|g-\d{4,8}|\d{4,8})\b/i;
    const match = text.match(contextRegex);
    if (match && !/^(19|20)\d{2}$/.test(match[1])) {
      return match[1].toUpperCase();
    }

    // 2. Alphanumeric 5-8 chars containing both alpha and digits
    const alphaNumRegex = /\b(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{5,8}\b/i;
    const alphaMatch = text.match(alphaNumRegex);
    if (alphaMatch) {
      return alphaMatch[0].toUpperCase();
    }

    // 3. Fallback to 4-8 digit standalone numbers, excluding standard years (1900-2099)
    const numRegex = /\b\d{4,8}\b/g;
    const numMatches = text.match(numRegex);
    if (numMatches) {
      const filtered = numMatches.filter(n => !/^(19|20)\d{2}$/.test(n));
      if (filtered.length > 0) {
        return filtered[0];
      }
    }

    return null;
  };

  useEffect(() => {
    if (!isOpen || !messageId || !authToken) {
      setDetail(null);
      setExtractedOTP(null);
      return;
    }

    const fetchMessageDetail = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiServer}/messages/${messageId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve full email body');
        }
        const data = await response.json();
        setDetail(data);

        // Process source content to extract OTP
        const rawText = data.text || '';
        const rawHtml = data.html ? data.html[0] : '';
        // Strip html tags for parsing if raw text is brief
        const parseSource = rawText.length > 5 
          ? rawText 
          : rawHtml.replace(/<[^>]*>?/gm, ' ');

        const otp = extractOTP(parseSource);
        setExtractedOTP(otp);

      } catch (err) {
        console.error(err);
        showToast('Error decrypting temporary payload', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessageDetail();
  }, [isOpen, messageId, authToken, apiServer]);

  const copyOTP = () => {
    if (extractedOTP) {
      navigator.clipboard.writeText(extractedOTP);
      showToast('OTP copied to clipboard!', 'success');
    }
  };

  const handleDelete = () => {
    if (messageId) {
      onDeleteMessage(messageId);
      onClose();
    }
  };

  const getIframeSrcDoc = () => {
    if (!detail) return '';
    const cleanBody = detail.html && detail.html.length > 0 ? detail.html[0] : (detail.text || '');
    
    // Inject custom neutral styling that aligns and encapsulates inside iframe
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1a1a24;
              line-height: 1.6;
              word-break: break-word;
              background-color: #ffffff;
            }
            a {
              color: #0076ff;
              font-weight: 700;
              text-decoration: underline;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 12px;
            }
            p {
              margin-top: 0;
              margin-bottom: 16px;
            }
          </style>
        </head>
        <body>
          ${cleanBody}
        </body>
      </html>
    `;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center">
          {/* Blur back drop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-[10px]"
          />

          {/* Slider Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative z-10 flex h-[94vh] w-full max-w-2xl flex-col rounded-t-[36px] border-t border-white/10 bg-[#0d0e14] shadow-2xl"
          >
            {/* Handle bar */}
            <div className="mx-auto my-3.5 h-1.5 w-12 rounded-full bg-white/20" />

            {/* Header section with content actions */}
            <div className="flex items-center justify-between border-b border-white/5 px-6 pb-4">
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0076ff]">
                  {isLoading ? 'Decrypting payload...' : 'Decrypted payload'}
                </p>
                <h3 className="truncate font-sans text-base font-extrabold text-white">
                  {isLoading ? 'Securing network...' : (detail?.subject || 'No Subject')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!isLoading && detail && (
                  <button
                    onClick={handleDelete}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition hover:bg-rose-500/20 active:scale-90"
                    title="Delete payload"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10 active:scale-90"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Main view body */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-3/4 flex-col items-center justify-center text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[#0076ff]" />
                  <p className="mt-4 font-mono text-sm text-neutral-400">Performing military-grade payload decryption...</p>
                </div>
              ) : detail ? (
                <div className="flex h-full flex-col">
                  
                  {/* Smart extracted OTP banner layout */}
                  {extractedOTP && (
                    <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-[#0076ff]/10 to-[#00c6ff]/10 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/10">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
                            Smart Extracted Code
                          </p>
                          <p className="font-mono text-2xl font-black text-white tracking-widest leading-none mt-1">
                            {extractedOTP}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={copyOTP}
                        className="flex items-center gap-1.5 rounded-xl bg-[#0076ff] px-4 py-2.5 font-sans text-xs font-black text-white hover:opacity-90 active:scale-95 shadow-md"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code
                      </button>
                    </div>
                  )}

                  {/* Sender details and Date */}
                  <div className="border-b border-white/5 bg-white/[0.01] px-6 py-4">
                    <div className="flex items-center justify-between">
                      <p className="font-sans text-sm font-bold text-neutral-200">
                        From: <span className="text-white">{detail.from.name || detail.from.address}</span>
                      </p>
                      <p className="font-mono text-[10px] font-extrabold text-[#9ba1a6]">
                        {new Date(detail.createdAt).toLocaleDateString()} {new Date(detail.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {detail.to && detail.to.length > 0 && (
                      <p className="font-sans text-xs text-neutral-450 mt-1 select-all">
                        To: <span className="text-neutral-400 font-mono">{detail.to[0].address}</span>
                      </p>
                    )}
                  </div>

                  {/* Sandbox isolated Email body frame */}
                  <div className="w-full flex-1 bg-white">
                    <iframe
                      id="email-frame"
                      srcDoc={getIframeSrcDoc()}
                      sandbox="allow-same-origin allow-popups"
                      className="h-full w-full border-none"
                      title="Disposable Message Frame"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-3/4 flex-col items-center justify-center text-center text-neutral-500">
                  <CircleSlash className="h-10 w-10 text-neutral-600 mb-2" />
                  <p className="font-sans text-sm font-semibold">Error decrypting message segment.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
