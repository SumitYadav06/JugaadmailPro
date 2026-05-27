/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Copy,
  Bookmark,
  QrCode,
  RefreshCw,
  Wand2,
  Clock,
  Shield,
  Layers,
  Vault as VaultIcon,
  ShieldCheck,
  Share2,
  Trash2,
  Download,
  CheckCircle,
  HelpCircle,
  Mail,
  Loader2,
  Globe,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Domain, Message, VaultItem } from './types';
import Toast from './components/Toast';
import QRCodeSheet from './components/QRCodeSheet';
import ReaderSheet from './components/ReaderSheet';
import VaultList from './components/VaultList';

const API_SERVERS = ['https://api.mail.gw', 'https://api.mail.tm'];

export default function App() {
  // Navigation Tabs: 'home' | 'vault' | 'info'
  const [currentTab, setCurrentTab] = useState<'home' | 'vault' | 'info'>('home');
  
  // App Core States
  const [apiServer, setApiServer] = useState<string>(() => {
    return localStorage.getItem('jmp_pro_v1_api') || API_SERVERS[0];
  });
  const [domains, setDomains] = useState<Domain[]>([]);
  const [address, setAddress] = useState<string | null>(() => {
    return localStorage.getItem('jmp_pro_v1_addr');
  });
  const [password, setPassword] = useState<string | null>(() => {
    return localStorage.getItem('jmp_pro_v1_pwd');
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('jmp_pro_v1_token');
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [vault, setVault] = useState<VaultItem[]>(() => {
    const raw = localStorage.getItem('jmp_pro_v1_vault');
    return raw ? JSON.parse(raw) : [];
  });

  // Generator & UI Forms
  const [creationMode, setCreationMode] = useState<'random' | 'custom'>('random');
  const [customName, setCustomName] = useState<string>('');
  const [customDomain, setCustomDomain] = useState<string>('');
  
  // Interactive Loader / Timing states
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);

  // Sheets & Notification states
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [isQRSheetOpen, setIsQRSheetOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'info' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  // Trigger Toast Helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({
      visible: true,
      message,
      type
    });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  // 1. Initialize mail servers on mount, check fallback nodes
  const initializeServersAndLoad = async (forceAddressCreation = false) => {
    let loadedDomains: Domain[] = [];
    let workingServer = apiServer;
    let fallbackWorked = false;

    for (const server of API_SERVERS) {
      try {
        const response = await fetch(`${server}/domains`);
        if (response.ok) {
          const data = await response.json();
          loadedDomains = data['hydra:member'] || [];
          if (loadedDomains.length > 0) {
            workingServer = server;
            setApiServer(server);
            setDomains(loadedDomains);
            localStorage.setItem('jmp_pro_v1_api', server);
            fallbackWorked = true;
            break;
          }
        }
      } catch (err) {
        console.warn(`Node ${server} unreachable, switching...`);
      }
    }

    if (!fallbackWorked) {
      showToast('Global mail servers are currently congested.', 'error');
      setIsInitializing(false);
      return;
    }

    // Default the custom domain select item
    if (loadedDomains.length > 0) {
      setCustomDomain(loadedDomains[0].domain);
    }

    // Checking if we already have credentials stored, list and poll
    const savedAddr = localStorage.getItem('jmp_pro_v1_addr');
    const savedToken = localStorage.getItem('jmp_pro_v1_token');

    if (savedAddr && savedToken && !forceAddressCreation) {
      setAddress(savedAddr);
      setAuthToken(savedToken);
      setIsInitializing(false);
      // Immediately run sync
      fetchInboxMessages(workingServer, savedToken);
    } else {
      // Create random address instantly on initial load for flawless zero-click setup
      await generateNewIdentity(true, loadedDomains, workingServer);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initializeServersAndLoad();
  }, []);

  // 2. Poll Messages Sync Loop
  useEffect(() => {
    if (!authToken || currentTab !== 'home') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchInboxMessages(apiServer, authToken);
          return 5; // Reset interval to 5 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [authToken, apiServer, currentTab]);

  // Fetch Message List
  const fetchInboxMessages = async (server: string, token: string) => {
    if (!token) return;
    setIsPolling(true);
    try {
      const response = await fetch(`${server}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.status === 401) {
        // Authenticator expired or invalidated
        console.warn('Mail session expired on server side, regenerating...');
        await generateNewIdentity(true);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        const incoming = data['hydra:member'] || [];
        
        // Notify if state is updated with fresh payload
        setMessages(prev => {
          if (incoming.length > prev.length && prev.length > 0) {
            showToast('New payload decrypted in secure stream!', 'success');
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
          }
          return incoming;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPolling(false);
    }
  };

  // 3. Delete individual payload from mail stream
  const deleteMessage = async (msgId: string) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${apiServer}/messages/${msgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        showToast('Payload purged successfully.', 'success');
      } else {
        showToast('Could not purge message from workspace.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed during purge.', 'error');
    }
  };

  // 4. Create Node Credentials
  const executeIdentityCreation = async (addrStr: string, passwordStr: string, targetServer: string) => {
    setIsGenerating(true);
    let success = false;

    // Retry creation fallback on backup nodes
    const serversToTry = [targetServer, ...API_SERVERS.filter(s => s !== targetServer)];

    for (const server of serversToTry) {
      try {
        const accRes = await fetch(`${server}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: addrStr, password: passwordStr })
        });

        if (accRes.status === 422) {
          showToast('Desire name already registered. Try another.', 'error');
          setIsGenerating(false);
          return;
        }

        if (!accRes.ok) throw new Error('Account register payload error');

        const tokenRes = await fetch(`${server}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: addrStr, password: passwordStr })
        });

        if (!tokenRes.ok) throw new Error('Authorization token invalid');

        const tokenData = await tokenRes.json();
        
        // Successfully bounded
        setApiServer(server);
        setAddress(addrStr);
        setPassword(passwordStr);
        setAuthToken(tokenData.token);
        setMessages([]);
        setCountdown(5);

        // Store active key local
        localStorage.setItem('jmp_pro_v1_api', server);
        localStorage.setItem('jmp_pro_v1_addr', addrStr);
        localStorage.setItem('jmp_pro_v1_pwd', passwordStr);
        localStorage.setItem('jmp_pro_v1_token', tokenData.token);

        showToast('Secure Identity Operational', 'success');
        success = true;
        setCustomName('');
        break;
      } catch (err) {
        console.warn(`Registration fell through on: ${server}`);
      }
    }

    setIsGenerating(false);
    if (!success) {
      showToast('Gateway connection error. Re-route node.', 'error');
    } else {
      // Fetch initial items
      fetchInboxMessages(targetServer, localStorage.getItem('jmp_pro_v1_token') || '');
    }
  };

  // Build identity strings and dispatch creation
  const generateNewIdentity = async (
    isRandom: boolean, 
    customDomainsList?: Domain[], 
    customServerUrl?: string
  ) => {
    const activeDomains = customDomainsList || domains;
    const activeServer = customServerUrl || apiServer;

    if (activeDomains.length === 0) {
      showToast('Network error: server list loading', 'error');
      return;
    }

    let addrStr = '';
    const pwdStr = 'SEC' + Math.random().toString(36).substring(2, 12);

    if (isRandom) {
      const selectedDomainObj = activeDomains[Math.floor(Math.random() * activeDomains.length)];
      const randomUser = 'id_' + Math.random().toString(36).substring(2, 9);
      addrStr = `${randomUser}@${selectedDomainObj.domain}`;
    } else {
      const sanitized = customName.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
      if (sanitized.length < 3) {
        showToast('Desired username must be at least 3 letters.', 'error');
        return;
      }
      addrStr = `${sanitized}@${customDomain}`;
    }

    await executeIdentityCreation(addrStr, pwdStr, activeServer);
  };

  // Copy active address
  const copyActiveAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    showToast('Address Copied!', 'success');
  };

  // 5. Offline Private Vault Management
  const saveToVault = () => {
    if (!address || !password) {
      showToast('No active address to save', 'error');
      return;
    }

    if (vault.some(item => item.address.toLowerCase() === address.toLowerCase())) {
      showToast('This identity is already secured in vault.', 'info');
      return;
    }

    const newItem: VaultItem = {
      address,
      password,
      api: apiServer,
      date: new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    };

    const updated = [...vault, newItem];
    setVault(updated);
    localStorage.setItem('jmp_pro_v1_vault', JSON.stringify(updated));
    showToast('Identity secured in offline Vault', 'success');
  };

  const deleteFromVault = (index: number) => {
    const updated = vault.filter((_, i) => i !== index);
    setVault(updated);
    localStorage.setItem('jmp_pro_v1_vault', JSON.stringify(updated));
    showToast('Identity purged from Vault.', 'info');
  };

  const restoreFromVault = async (index: number) => {
    const item = vault[index];
    showToast('Re-authorizing session...', 'info');

    try {
      const response = await fetch(`${item.api}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: item.address, password: item.password })
      });

      if (!response.ok) {
        throw new Error('Permanent node domain expired or pruned');
      }

      const raw = await response.json();
      setApiServer(item.api);
      setAddress(item.address);
      setPassword(item.password);
      setAuthToken(raw.token);
      setMessages([]);
      setCountdown(5);

      localStorage.setItem('jmp_pro_v1_api', item.api);
      localStorage.setItem('jmp_pro_v1_addr', item.address);
      localStorage.setItem('jmp_pro_v1_pwd', item.password);
      localStorage.setItem('jmp_pro_v1_token', raw.token);

      showToast('Active Node Restored!', 'success');
      setCurrentTab('home');
      fetchInboxMessages(item.api, raw.token);
    } catch (err) {
      console.error(err);
      showToast('Node domain check failed. Pruned on host.', 'error');
    }
  };

  // 6. Native Share Link Trigger
  const shareApplicationLink = () => {
    const textStr = `Jugaad Mail Pro v1.0 - Enterprise multi-node disposable email client.\n${window.location.href}`;
    if (navigator.share) {
      navigator.share({
        title: 'Jugaad Mail Pro Client',
        text: textStr
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(textStr);
      showToast('App link copied to clipboard!', 'success');
    }
  };

  // Custom User Input Handler
  const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const clean = rawVal.replace(/[^a-z0-9.]/gi, '');
    setCustomName(clean);
  };

  return (
    <div className="relative min-h-screen bg-[#020205] text-white">
      {/* Dynamic Ambient Blur Layers */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[70vw] w-[70vw] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute -right-[15%] -bottom-[10%] h-[80vw] w-[80vw] rounded-full bg-purple-600/15 blur-[120px]" />
      </div>

      {/* Elegant Banner Alerts */}
      <Toast 
        message={toast.message} 
        type={toast.type} 
        visible={toast.visible} 
        onClose={closeToast} 
      />

      {/* Top Header Workspace */}
      <header className="relative z-50 flex items-center justify-center border-b border-white/[0.04] bg-black/40 px-6 py-4.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0076ff] to-[#01c5ff] text-white shadow-[0_4px_20px_rgba(3,121,255,0.45)]">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          <h1 className="font-sans text-lg font-black tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Jugaad Mail Pro
          </h1>
        </div>
      </header>

      {/* Main Container Views */}
      <main className="relative z-10 mx-auto max-w-2xl px-5 pb-32 pt-6">
        {isInitializing ? (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#0076ff]" />
            <p className="mt-4 font-mono text-xs text-neutral-450 tracking-wider">Securing failsafe multi-node gateway...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: DASHBOARD STREAM */}
            {currentTab === 'home' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Active Credentials Glass Panel */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-3xl">
                  
                  {/* Status header indicator */}
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-sans text-[10px] font-black uppercase tracking-widest text-[#9ba1a6]">
                      Active Payload Node
                    </span>
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
                      <span className="pulse-ring-active h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Live Connect
                    </div>
                  </div>

                  {/* Active Email address slot */}
                  <div className="mb-5 rounded-2xl border border-white/5 bg-black/40 px-5 py-4.5 text-center group transition hover:border-[#0076ff]/20">
                    {address ? (
                      <p className="break-all font-mono text-lg font-black tracking-tight text-white select-all group-hover:text-[#0076ff] transition-colors">
                        {address}
                      </p>
                    ) : (
                      <div className="mx-auto h-6 w-3/4 animate-pulse rounded bg-white/10" />
                    )}
                  </div>

                  {/* Interactive Dashboard Actions */}
                  <div className="mb-6 grid grid-cols-3 gap-3">
                    <button
                      onClick={copyActiveAddress}
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] py-3.5 text-xs font-bold text-white transition hover:bg-white/[0.06] hover:border-white/10 active:scale-95"
                    >
                      <Copy className="h-5 w-5 text-neutral-400" />
                      Copy Address
                    </button>
                    <button
                      onClick={saveToVault}
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] py-3.5 text-xs font-bold text-white transition hover:bg-white/[0.06] hover:border-white/10 active:scale-95"
                    >
                      <Bookmark className="h-5 w-5 text-neutral-400" />
                      Save Vault
                    </button>
                    <button
                      onClick={() => setIsQRSheetOpen(true)}
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] py-3.5 text-xs font-bold text-white transition hover:bg-white/[0.06] hover:border-white/10 active:scale-95"
                    >
                      <QrCode className="h-5 w-5 text-neutral-400" />
                      Scan QR
                    </button>
                  </div>

                  {/* Creation Mode Tabs */}
                  <div className="flex rounded-xl bg-black/60 p-1 border border-white/5">
                    <button
                      onClick={() => setCreationMode('random')}
                      className={`flex-1 rounded-lg py-2.5 text-center text-xs font-extrabold transition-all duration-200 ${
                        creationMode === 'random'
                          ? 'bg-white/10 text-white shadow-md border border-white/5'
                          : 'text-[#9ba1a6] hover:text-white'
                      }`}
                    >
                      Random Address
                    </button>
                    <button
                      onClick={() => setCreationMode('custom')}
                      className={`flex-1 rounded-lg py-2.5 text-center text-xs font-extrabold transition-all duration-200 ${
                        creationMode === 'custom'
                          ? 'bg-white/10 text-white shadow-md border border-white/5'
                          : 'text-[#9ba1a6] hover:text-white'
                      }`}
                    >
                      Custom Name
                    </button>
                  </div>

                  {/* Mode input control sheets */}
                  <div className="mt-5">
                    {creationMode === 'random' ? (
                      <button
                        onClick={() => generateNewIdentity(true)}
                        disabled={isGenerating}
                        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#0076ff] to-[#01c5ff] py-4.5 font-sans text-sm font-extrabold tracking-wide text-white shadow-[0_10px_25px_rgba(0,118,255,0.35)] transition-all hover:opacity-90 active:scale-98 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Provisioning node identity...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4.5 w-4.5" />
                            Generate New Identity
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center rounded-2xl border border-white/5 bg-black/60 overflow-hidden pr-3 transition-all focus-within:border-[#0076ff] focus-within:shadow-[0_0_15px_rgba(0,118,255,0.1)]">
                          <input
                            type="text"
                            placeholder="Desired username"
                            value={customName}
                            onChange={handleCustomNameChange}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            className="flex-1 border-none bg-transparent py-4 pl-5 font-mono text-sm font-bold text-white outline-none placeholder:font-sans placeholder:font-medium placeholder:text-neutral-500"
                          />
                          <select
                            value={customDomain}
                            onChange={(e) => setCustomDomain(e.target.value)}
                            className="appearance-none rounded-xl bg-white/5 px-4.5 py-2.5 font-mono text-xs font-black text-white outline-none cursor-pointer border border-white/5"
                          >
                            {domains.map((d) => (
                              <option key={d.id} value={d.domain} className="bg-[#0d0e14] text-white">
                                @{d.domain}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={() => generateNewIdentity(false)}
                          disabled={isGenerating || !customName}
                          className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#0076ff] to-[#01c5ff] py-4.5 font-sans text-sm font-extrabold tracking-wide text-white shadow-[0_10px_25px_rgba(0,118,255,0.35)] transition-all hover:opacity-90 active:scale-98 disabled:opacity-50 disabled:shadow-none"
                        >
                          {isGenerating ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Customizing server node...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <Wand2 className="h-4.5 w-4.5" />
                              Build Custom Identity
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inbox Stream list section */}
                <div>
                  <div className="mb-4 flex items-center justify-between px-1">
                    <h3 className="font-sans text-base font-extrabold tracking-tight text-white">
                      Secure Inbox Stream
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#9ba1a6]">
                      {isPolling ? (
                        <span className="flex items-center gap-1.5 font-mono">
                          <Loader2 className="h-3 w-3 animate-spin text-[#0076ff]" />
                          Syncing
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-neutral-500" />
                          Sync: <span className="text-[#0076ff] font-mono">{countdown}s</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.01] py-16 px-4 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0076ff]/5 text-[#0076ff] border border-[#0076ff]/10">
                          <Mail className="h-6 w-6" />
                        </div>
                        <h4 className="font-sans text-sm font-extrabold text-white">Inbox stream empty</h4>
                        <p className="mt-1 max-w-xs font-sans text-xs text-[#9ba1a6]">
                          Node connected. Awaiting secure incoming verifications or email payloads...
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const avatarLetter = (msg.from.name || msg.from.address).charAt(0).toUpperCase();
                        const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div
                            key={msg.id}
                            onClick={() => setSelectedMsgId(msg.id)}
                            className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 cursor-pointer transition-all duration-300 hover:bg-white/[0.05] hover:border-white/12 active:scale-99 hover:-translate-y-0.5"
                          >
                            {/* Visual Avatar */}
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0076ff]/10 font-sans text-base font-black text-[#0076ff] border border-[#0076ff]/15">
                              {avatarLetter}
                            </div>

                            {/* Message details clip */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="truncate font-sans text-sm font-bold text-white pr-2">
                                  {msg.from.name || msg.from.address}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] font-bold text-neutral-400">
                                  {timeStr}
                                </span>
                              </div>
                              <p className="mt-1 truncate font-sans text-xs font-semibold text-[#9ba1a6]">
                                {msg.subject || 'No Subject Payload'}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: SECURED VAULT INDEX */}
            {currentTab === 'vault' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <h3 className="font-sans text-base font-extrabold tracking-tight text-white">
                      Local Offline Vault
                    </h3>
                    <p className="font-sans text-xs text-[#9ba1a6] mt-0.5">
                      Private browser keys storage. Credentials never contact third-party clouds.
                    </p>
                  </div>
                  <div className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-black uppercase text-neutral-400 border border-white/5">
                    Local Access
                  </div>
                </div>

                <VaultList
                  vault={vault}
                  onRestore={restoreFromVault}
                  onDelete={deleteFromVault}
                  activeAddress={address}
                />
              </motion.div>
            )}

            {/* TAB 3: APP INFO */}
            {currentTab === 'info' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-3xl">
                  {/* Big Glowing Zap launcher logo */}
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0076ff] to-[#01c5ff] text-white shadow-[0_8px_30px_rgba(3,118,255,0.55)]">
                    <Zap className="h-8 w-8 fill-current animate-pulse" />
                  </div>

                  <h2 className="font-sans text-xl font-black text-white">
                    Jugaad Mail Pro
                  </h2>
                  <p className="mt-1 font-mono text-xs font-extrabold text-[#0076ff] tracking-wider uppercase">
                    v1.0.4 Enterprise Client
                  </p>

                  <button
                    onClick={shareApplicationLink}
                    className="mx-auto mt-8 flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-6 py-4.5 font-sans text-sm font-extrabold text-white transition-all hover:bg-white/10 hover:scale-102 active:scale-98 border border-white/5 w-full max-w-sm"
                  >
                    <Share2 className="h-4.5 w-4.5 text-[#0076ff]" />
                    Share Application Client
                  </button>

                  <div className="mt-8 border-t border-white/5 pt-6 text-left space-y-4">
                    <h4 className="font-sans text-xs font-black uppercase tracking-wider text-white">
                      Active protocol specifications
                    </h4>
                    
                    <div className="space-y-3 font-sans text-xs text-[#9ba1a6] leading-relaxed">
                      <div className="flex gap-2 items-start">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#0076ff] mt-1.5 shrink-0" />
                        <p>
                          <strong className="text-white">Failsafe Gateway Rotation:</strong> Rotates accounts automatically across different operational nodes to ensure 100% address creation rates.
                        </p>
                      </div>
                      <div className="flex gap-2 items-start">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#0076ff] mt-1.5 shrink-0" />
                        <p>
                          <strong className="text-white">Smart Verification Extractor:</strong> Integrates custom heuristic string filters that look for active Pins, verification codes, or Otps and render them at the top of decrypted bodies.
                        </p>
                      </div>
                      <div className="flex gap-2 items-start">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#0076ff] mt-1.5 shrink-0" />
                        <p>
                          <strong className="text-white">Protected Sandbox Isolator:</strong> Incorporates strict sandbox parameters to render incoming mail bodies cleanly without interfering with the parent application styles.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Persistent Dock Navigation menu */}
      <nav className="fixed bottom-6 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/80 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        <button
          onClick={() => setCurrentTab('home')}
          className={`flex items-center gap-2 rounded-full px-5 py-3 font-sans text-xs font-black transition-all duration-300 ${
            currentTab === 'home'
              ? 'bg-white text-black shadow-lg scale-102 font-extrabold'
              : 'text-[#9ba1a6] hover:text-white hover:scale-102'
          }`}
        >
          <Layers className="h-4.5 w-4.5" />
          {currentTab === 'home' && <span>Dashboard</span>}
        </button>
        <button
          onClick={() => setCurrentTab('vault')}
          className={`flex items-center gap-2 rounded-full px-5 py-3 font-sans text-xs font-black transition-all duration-300 ${
            currentTab === 'vault'
              ? 'bg-white text-black shadow-lg scale-102 font-extrabold'
              : 'text-[#9ba1a6] hover:text-white hover:scale-102'
          }`}
        >
          <VaultIcon className="h-4.5 w-4.5" />
          {currentTab === 'vault' && <span>Vault</span>}
        </button>
        <button
          onClick={() => setCurrentTab('info')}
          className={`flex items-center gap-2 rounded-full px-5 py-3 font-sans text-xs font-black transition-all duration-300 ${
            currentTab === 'info'
              ? 'bg-white text-black shadow-lg scale-102 font-extrabold'
              : 'text-[#9ba1a6] hover:text-white hover:scale-102'
          }`}
        >
          <Shield className="h-4.5 w-4.5" />
          {currentTab === 'info' && <span>Protocol Info</span>}
        </button>
      </nav>

      {/* Sheets Drawers and Overlays */}
      <QRCodeSheet
        isOpen={isQRSheetOpen}
        onClose={() => setIsQRSheetOpen(false)}
        address={address}
        onCopy={copyActiveAddress}
      />

      <ReaderSheet
        isOpen={selectedMsgId !== null}
        onClose={() => setSelectedMsgId(null)}
        messageId={selectedMsgId}
        authToken={authToken}
        apiServer={apiServer}
        onDeleteMessage={deleteMessage}
        showToast={showToast}
      />
    </div>
  );
}
