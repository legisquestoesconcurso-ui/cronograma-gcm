import React from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import MotivationalMentor from '@/components/MotivationalMentor';
import DashboardClient from '@/components/DashboardClient';

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
      
      <main className="max-w-[1600px] mx-auto px-6 sm:px-12 py-16">
        <div className="mb-24 text-center">
          <h1 className="text-4xl sm:text-6xl font-black text-slate-950 uppercase tracking-[0.25em] mb-8 leading-tight">
            MEU CRONOGRAMA GCM
          </h1>
          <div className="flex justify-center mt-6">
            <MotivationalMentor />
          </div>
        </div>

        {/* Componente de Cliente que gerencia o progresso individual */}
        <DashboardClient initialMetas={metas} totalTasks={totalTasks} />
      </main>
    </div>
  );
}
