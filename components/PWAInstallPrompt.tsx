'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('Service Worker registration successful with scope: ', registration.scope);
        },
        (err) => {
          console.log('Service Worker registration failed: ', err);
        }
      );
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md"
      >
        <div className="bg-blue-900 text-white p-4 rounded-2xl shadow-2xl shadow-blue-900/40 border border-blue-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-tight">Instalar App Projeto GCM</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest">Acesso rápido e offline</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-white text-blue-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-50 transition-colors"
            >
              Instalar
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 text-blue-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
