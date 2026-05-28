/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Trash2, ShieldCheck, HelpCircle, Lock, Calendar } from 'lucide-react';
import { VaultItem } from '../types';

interface VaultListProps {
  vault: VaultItem[];
  onRestore: (index: number) => void;
  onDelete: (index: number) => void;
  activeAddress: string | null;
}

export default function VaultList({ vault, onRestore, onDelete, activeAddress }: VaultListProps) {
  if (vault.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-[24px] border border-dashed border-white/10 bg-white/[0.01]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-neutral-500 mb-4 border border-white/5">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="font-sans text-base font-extrabold text-white">Vault Empty</h3>
        <p className="mt-1 max-w-xs font-sans text-xs text-[#9ba1a6]">
          Save permanent access credentials or random nodes dynamically to access them securely later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {vault.map((item, index) => {
        const isActive = activeAddress?.toLowerCase() === item.address?.toLowerCase();
        
        return (
          <div
            key={item.address + index}
            className={`group relative flex items-center justify-between rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 ${
              isActive
                ? 'border-[#0076ff] bg-[#0076ff]/5 shadow-[0_0_20px_rgba(0,118,255,0.15)]'
                : 'border-white/5 bg-[#0d0e14] hover:border-white/15 hover:bg-white/[0.02]'
            }`}
          >
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-bold text-white max-w-[85%] select-all group-hover:text-[#0076ff] transition-colors">
                  {item.address}
                </span>
                {isActive && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Live
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-4 text-[10px] font-bold text-[#9ba1a6] uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-neutral-500" />
                  {item.date || 'Recently'}
                </span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-neutral-400 text-[9px] border border-white/5">
                  Node: {item.api.replace('https://api.', '')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onRestore(index)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                  isActive
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 cursor-default'
                    : 'border-white/10 bg-white/5 text-[#0076ff] hover:bg-[#0076ff]/10 hover:border-[#0076ff]/20 active:scale-90'
                }`}
                disabled={isActive}
                title={isActive ? 'Active Identity' : 'Switch to this Identity'}
              >
                <Play className="h-4.5 w-4.5 fill-current" />
              </button>
              <button
                onClick={() => onDelete(index)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-rose-500 transition-all hover:bg-rose-500/10 hover:border-rose-500/20 active:scale-90"
                title="Remove identity"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
