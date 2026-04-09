'use client';

import React from 'react';
import { Shield, LogOut, User as UserIcon, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center">
            <div className="bg-white p-1.5 rounded-md shadow-md">
              <img 
                src="https://cdn.jsdelivr.net/gh/legisquestoesconcurso-ui/cronograma-gcm/public/logo-projeto.png?v=3" 
                alt="Projeto ser GCM" 
                className="h-10 w-auto object-contain"
              />
            </div>
          </Link>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex items-center space-x-2 text-sm text-slate-300">
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[150px] truncate">{user.email}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md text-sm font-medium transition-colors"
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
