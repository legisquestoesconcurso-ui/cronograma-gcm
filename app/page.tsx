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
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-20 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 uppercase tracking-widest mb-6">
            MEU CRONOGRAMA GCM
          </h1>
          <div className="flex justify-center mt-4">
            <MotivationalMentor />
          </div>
        </div>

        {/* Componente de Cliente que gerencia o progresso individual */}
        <DashboardClient initialMetas={metas} totalTasks={totalTasks} />
      </main>
    </div>
  );
}
