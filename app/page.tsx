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

  // Espaço reservado para o futuro botão de Suporte via WhatsApp

  return (
    <div className="min-h-screen relative bg-white">
      {/* Camada de Fundo Fixa Operacional */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'url(https://raw.githubusercontent.com/legisquestoesconcurso-ui/cronograma-gcm/main/public/bg-patrulha.png)',
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
          background: 'linear-gradient(to bottom, transparent 0%, transparent 25%, white 70%, white 100%)'
        }}
      />

      <div className="relative z-10">
        <Navbar />
        
        <main className="max-w-[1600px] mx-auto px-6 sm:px-12 py-20">
        <div className="mb-24 flex flex-col items-center text-center">
          <div className="mb-6 relative bg-transparent p-0 border-none shadow-none">
            <div className="mix-blend-multiply bg-transparent">
              <img 
                src="https://raw.githubusercontent.com/legisquestoesconcurso-ui/cronograma-gcm/main/public/logo-projeto.png" 
                alt="Logo Projeto Ser GCM" 
                className="w-[250px] h-auto mx-auto mb-4" 
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
              &ldquo;A aprovação não é para os mais inteligentes. É para os que não desistem.&rdquo;
            </p>
          </div>
        </div>

        {/* Espaço reservado para o futuro botão de Suporte via WhatsApp */}

        {/* Componente de Cliente que gerencia o progresso individual */}
        <DashboardClient 
          initialMetas={metas} 
          totalTasks={totalTasks} 
          concursos={concursos}
        />
      </main>
    </div>
  </div>
  );
}
