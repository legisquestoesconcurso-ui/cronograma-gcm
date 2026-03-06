'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Lock, MessageCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function SuspendedPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-12 text-center"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 text-blue-600 mb-8">
          <Lock className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-medium text-slate-900 mb-4">
          Acesso ao Cronograma Suspenso
        </h1>
        
        <p className="text-slate-500 font-medium text-sm mb-10 leading-relaxed">
          Identificamos que sua assinatura expirou ou o pagamento ainda não foi processado.
        </p>

        <div className="space-y-4">
          <a 
            href="#"
            className="flex items-center justify-center w-full bg-blue-600 text-white py-4 rounded-2xl text-sm font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            RENOVAR ASSINATURA
          </a>

          <a 
            href="https://wa.me/5500000000000" // Replace with actual WhatsApp link if available
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full text-slate-500 py-2 text-sm font-medium hover:text-blue-600 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Já pagou? Fale com o suporte no WhatsApp
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100">
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 text-slate-400 font-medium text-xs hover:text-slate-600 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sair da Conta
          </button>
        </div>
      </motion.div>
    </div>
  );
}
