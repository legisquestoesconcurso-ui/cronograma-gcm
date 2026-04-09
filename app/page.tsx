import React from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import DashboardClient from '@/components/DashboardClient';
import Link from 'next/link';
import { User } from 'lucide-react';

// Estratégia de Cache: Revalida a cada 60 segundos
export const revalidate = 60;

async function getInitialData() {
  // Busca em massa inicial: Concursos e Total de Tarefas em paralelo
  const [concursosRes, totalTasksRes] = await Promise.all([
    supabase
      .from('concursos')
      .select('id, nome, ativo')
      .order('nome', { ascending: true }),
    supabase
      .from('tarefas')
      .select('*', { count: 'exact', head: true })
  ]);

  return {
    concursos: concursosRes.data || [],
    metas: [], // O DashboardClient gerencia as metas específicas do usuário
    totalTasks: totalTasksRes.count || 0
  };
}

export default async function DashboardPage() {
  const { concursos, metas, totalTasks } = await getInitialData();

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Camada de Fundo Fixa Operacional (Caminho Absoluto) */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url('https://github.com/legisquestoesconcurso-ui/cronograma-gcm/raw/main/public/bg-patrulha-v1.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      />
      
      {/* Degradê de Proteção para Legibilidade (Branco Puro embaixo para Transparente em cima) */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.8) 70%, white 100%)'
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section / Header */}
          <div className="mb-16 flex flex-col items-center text-center">
            <div className="mb-8 relative group">
              <div className="mix-blend-multiply transition-transform duration-500 hover:scale-105">
                <img 
                  src="https://github.com/legisquestoesconcurso-ui/cronograma-gcm/raw/main/public/logo-gcm-v1.png" 
                  alt="Logo Projeto Ser GCM" 
                  className="w-48 sm:w-64 h-auto mx-auto" 
                />
              </div>
            </div>
            
            <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/50 shadow-2xl max-w-3xl w-full">
              <h1 className="text-4xl sm:text-6xl font-black text-slate-900 uppercase tracking-tighter mb-6 drop-shadow-sm">
                CRONOGRAMA GCM
              </h1>

              <div className="flex justify-center">
                <p className="text-blue-700 font-extrabold uppercase tracking-[0.2em] text-xs sm:text-sm italic">
                  &ldquo;A aprovação não é para os mais inteligentes. É para os que não desistem.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="bg-white/60 backdrop-blur-lg rounded-[2.5rem] p-6 sm:p-10 border border-white/60 shadow-2xl">
            <DashboardClient 
              initialMetas={metas} 
              totalTasks={totalTasks} 
              concursos={concursos}
            />
          </div>
        </main>

        {/* Footer / Bottom Spacing */}
        <footer className="py-8 text-center text-slate-500 text-xs font-medium uppercase tracking-widest">
          Projeto Ser GCM © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
