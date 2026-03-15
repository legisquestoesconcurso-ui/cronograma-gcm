import React from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import DashboardClient from '@/components/DashboardClient';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'lucide-react';

// Estratégia de Cache: Revalida a cada 60 segundos
export const revalidate = 60;

async function getInitialData() {
  // 1. Buscar todas as metas ordenadas por ordem
  const { data: metas } = await supabase
    .from('metas')
    .select('id, nome_meta, ordem')
    .order('ordem', { ascending: true });

  // 2. Buscar total de tarefas para o contador global
  const { count: totalTasks } = await supabase
    .from('tarefas')
    .select('*', { count: 'exact', head: true });

  return {
    metas: metas || [],
    totalTasks: totalTasks || 0
  };
}

export default async function DashboardPage() {
  const { metas, totalTasks } = await getInitialData();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-[1600px] mx-auto px-6 sm:px-12 py-20">
        <div className="mb-24 flex flex-col items-center text-center">
          <div className="mb-6 relative">
            <div className="relative h-[160px] w-[300px]">
              <Image 
                src="/logo-projeto.png" 
                alt="Logo Projeto Ser GCM" 
                fill
                className="object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <Link 
              href="/perfil"
              className="absolute -right-16 top-1/2 -translate-y-1/2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 text-slate-900 hover:text-blue-600 transition-all group flex items-center justify-center"
              title="Meu Perfil"
            >
              <User className="w-6 h-6" />
              <span className="absolute left-full ml-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Meu Perfil
              </span>
            </Link>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 uppercase tracking-tight mb-8">
            MEU CRONOGRAMA DE ESTUDOS
          </h1>

          <div className="flex justify-center">
            <p className="text-blue-600 font-bold uppercase tracking-widest text-sm sm:text-base">
              A farda não é apenas uma roupa, é um compromisso.
            </p>
          </div>
        </div>

        {/* Componente de Cliente que gerencia o progresso individual */}
        <DashboardClient initialMetas={metas} totalTasks={totalTasks} />
      </main>
    </div>
  );
}
