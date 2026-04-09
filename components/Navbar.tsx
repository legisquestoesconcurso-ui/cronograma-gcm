'use client';

import React from 'react';
import { Shield, LogOut, User as UserIcon, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <Link href="/" className="flex items-center group">
            <div className="bg-white p-1.5 rounded-xl shadow-lg transition-transform group-hover:scale-105">
              <img 
                src="https://github.com/legisquestoesconcurso-ui/cronograma-gcm/raw/main/public/logo-gcm-v1.png" 
                alt="Projeto ser GCM" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <span className="ml-4 font-black text-xl tracking-tighter hidden sm:block">PROJETO SER GCM</span>
          </Link>

          <div className="flex items-center space-x-6">
            {user ? (
              <div className="flex items-center space-x-6">
                <div className="hidden md:flex items-center space-x-3 text-sm font-bold text-slate-300">
                  <div className="bg-slate-800 p-2 rounded-lg">
                    <UserIcon className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="max-w-[180px] truncate">{user.email}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="flex items-center space-x-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all border border-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
