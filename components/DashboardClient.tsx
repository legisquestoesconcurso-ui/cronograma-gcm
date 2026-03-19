'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Target, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ADMIN_EMAIL = 'legisquestoesconcurso@gmail.com';

interface DashboardClientProps {
  initialMetas: any[];
  totalTasks: number;
  concursos: any[];
}

export default function DashboardClient({ initialMetas, totalTasks: initialTotalTasks, concursos }: DashboardClientProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubscriptionActive, setIsSubscriptionActive] = useState<boolean | null>(null);
  const [selectedConcursoId, setSelectedConcursoId] = useState<string | null>(null);
  const [metas, setMetas] = useState<any[]>(initialMetas);
  const [totalTasks, setTotalTasks] = useState<number>(initialTotalTasks);
  const [loadingMetas, setLoadingMetas] = useState(false);
  
  // Inicializa o estado a partir do LocalStorage para evitar "loading" ao alternar abas
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [completedCount, setCompletedCount] = useState(0);

  const isAdmin = user?.email === ADMIN_EMAIL;
  const visibleConcursos = concursos.filter(c => isAdmin || c.ativo);

  // 1. Determinar concurso inicial e carregar cache
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const cachedProgress = localStorage.getItem(`dashboard_progress_${user.id}_${selectedConcursoId || 'default'}`);
      const cachedCompleted = localStorage.getItem(`dashboard_completed_${user.id}_${selectedConcursoId || 'default'}`);
      if (cachedProgress) setProgress(JSON.parse(cachedProgress));
      if (cachedCompleted) setCompletedCount(Number(cachedCompleted));
    }
  }, [user, selectedConcursoId]);

  // 1. Determinar concurso inicial
  useEffect(() => {
    if (!user || !visibleConcursos.length) return;

    const determineInitialConcurso = async () => {
      // Buscar concurso_id no perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('concurso_id')
        .eq('id', user.id)
        .single();

      if (profile?.concurso_id) {
        // Verifica se o concurso do perfil está na lista de visíveis
        const isVisible = visibleConcursos.some(c => c.id === profile.concurso_id);
        if (isVisible) {
          setSelectedConcursoId(profile.concurso_id);
          return;
        }
      }

      // Se não tiver ou não for visível, busca o "Pré-Edital Geral" entre os visíveis
      const preEdital = visibleConcursos.find(c => c.nome.toLowerCase().includes('pré-edital geral')) || visibleConcursos[0];
      if (preEdital) {
        setSelectedConcursoId(preEdital.id);
        // Salva no perfil para as próximas vezes
        await supabase.from('profiles').update({ concurso_id: preEdital.id }).eq('id', user.id);
      }
    };

    determineInitialConcurso();
  }, [user, visibleConcursos]);

  // 2. Carregar Metas e Progresso quando o concurso mudar
  useEffect(() => {
    if (!user || !selectedConcursoId) return;

    const fetchConcursoData = async () => {
      setLoadingMetas(true);
      try {
        // 1. Buscar Metas do Concurso
        const { data: concursoMetas } = await supabase
          .from('metas')
          .select('id, nome_meta, ordem')
          .eq('concurso_id', selectedConcursoId)
          .order('ordem', { ascending: true });

        if (concursoMetas) {
          setMetas(concursoMetas);
        }

        // 2. Buscar Total de Tarefas do Concurso (usando concurso_id na tabela tarefas)
        const { count: concursoTotalTasks } = await supabase
          .from('tarefas')
          .select('*', { count: 'exact', head: true })
          .eq('concurso_id', selectedConcursoId);

        setTotalTasks(concursoTotalTasks || 0);

        // 3. Buscar Progresso (tabela user_progress filtrando por user_id e concurso_id)
        const { data: allProgress } = await supabase
          .from('user_progress')
          .select('tarefa_id')
          .eq('user_id', user.id)
          .eq('concurso_id', selectedConcursoId);

        if (allProgress) {
          const completedIds = new Set(allProgress.map(p => p.tarefa_id));
          const newCompletedCount = completedIds.size;
          setCompletedCount(newCompletedCount);

          // Buscar tarefas para mapear progresso por meta
          const { data: allTasks } = await supabase
            .from('tarefas')
            .select('id, meta_id')
            .eq('concurso_id', selectedConcursoId);
          
          if (allTasks) {
            const metaMap: Record<string, { completed: number, total: number }> = {};
            allTasks.forEach(task => {
              if (!metaMap[task.meta_id]) metaMap[task.meta_id] = { completed: 0, total: 0 };
              metaMap[task.meta_id].total += 1;
              if (completedIds.has(task.id)) {
                metaMap[task.meta_id].completed += 1;
              }
            });
            
            setProgress(metaMap);
            
            localStorage.setItem(`dashboard_progress_${user.id}_${selectedConcursoId}`, JSON.stringify(metaMap));
            localStorage.setItem(`dashboard_completed_${user.id}_${selectedConcursoId}`, String(newCompletedCount));
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do concurso:', error);
      } finally {
        setLoadingMetas(false);
      }
    };

    fetchConcursoData();
  }, [user, selectedConcursoId]);

  // 3. Verificar Acesso (Assinatura e Perfil)
  useEffect(() => {
    if (!user) return;

    const checkAccess = async () => {
      try {
        const isAdmin = user.email === ADMIN_EMAIL;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('subscription_status, whatsapp')
          .eq('id', user.id)
          .single();

        if (isAdmin) {
          setIsSubscriptionActive(true);
          return;
        }

        if (!profileData || profileData.subscription_status !== 'active') {
          setIsSubscriptionActive(false);
          return;
        }
        
        setIsSubscriptionActive(true);

        if (!profileData.whatsapp) {
          router.push('/perfil');
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar acesso:', error);
      }
    };

    checkAccess();
  }, [user, router]);

  const handleConcursoChange = async (concursoId: string) => {
    setSelectedConcursoId(concursoId);
    // Atualiza no perfil
    if (user) {
      await supabase.from('profiles').update({ concurso_id: concursoId }).eq('id', user.id);
    }
  };

  const overallPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  if (authLoading || isSubscriptionActive === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isSubscriptionActive === false) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-white rounded-[3rem] p-12 shadow-2xl border-2 border-red-50 text-center">
          <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-4">
            Assinatura Suspensa
          </h2>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            Identificamos um problema com sua assinatura. Para continuar acessando seu cronograma de elite e todos os materiais, regularize seu acesso agora.
          </p>
          <div className="space-y-4">
            <a 
              href="https://pay.kiwify.com.br/SUA_URL_AQUI" 
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3"
            >
              <CreditCard className="w-5 h-5" />
              REGULARIZAR ACESSO
            </a>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Dúvidas? Entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Seletor de Concurso */}
      <div className="flex justify-center mb-12">
        <div className="bg-white p-2 rounded-2xl shadow-lg border border-slate-100 flex items-center space-x-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Estudando para:</span>
          <select 
            value={selectedConcursoId || ''} 
            onChange={(e) => handleConcursoChange(e.target.value)}
            className="bg-slate-50 border-none text-slate-900 font-black uppercase tracking-tight text-sm px-6 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer outline-none min-w-[250px]"
          >
            {visibleConcursos.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {loadingMetas ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards - Layout Original Restaurado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        {/* Desempenho Global */}
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-blue-900/5 border border-slate-100 flex items-center space-x-10 hover:scale-[1.01] transition-transform">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="transparent" stroke="#f1f5f9" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="16" fill="transparent" stroke="#2563eb" strokeWidth="3"
                strokeDasharray={`${overallPercent} ${100 - overallPercent}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[14px] text-slate-500 font-bold uppercase tracking-[0.25em] mb-3">🎯 Desempenho Global</p>
            <div className="flex items-baseline space-x-4">
              <p className="text-7xl font-black text-slate-900 tracking-tighter">
                {overallPercent.toFixed(1)}%
              </p>
              <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Concluído</span>
            </div>
            <p className="text-[11px] text-blue-600 font-black uppercase mt-4 tracking-widest">
              {overallPercent >= 100 ? '🏁 CICLO FINALIZADO!' : '📈 EVOLUINDO CONSTANTEMENTE'}
            </p>
          </div>
        </div>
        
        {/* Metas Batidas */}
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-blue-900/5 border border-slate-100 flex items-center space-x-10 hover:scale-[1.01] transition-transform">
          <div className="bg-emerald-50 p-8 rounded-[2rem] flex-shrink-0">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] text-slate-500 font-bold uppercase tracking-[0.25em] mb-3">✅ Metas Batidas</p>
            <div className="flex items-baseline space-x-4">
              <p className="text-7xl font-black text-slate-900 tracking-tighter">
                {completedCount}
              </p>
              <span className="text-slate-400 font-bold text-3xl">/ {totalTasks}</span>
            </div>
            <p className="text-[11px] text-emerald-600 font-black uppercase mt-4 tracking-widest">
              {completedCount >= totalTasks && totalTasks > 0 ? '🏆 OBJETIVO ALCANÇADO!' : '🚀 MANTENHA O RITMO!'}
            </p>
          </div>
        </div>
      </div>

      {/* Metas Grid - Expandido para Desktop (até 6 colunas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-8">
        {metas.map((meta, index) => {
          const metaProg = progress[meta.id] || { completed: 0, total: 0 };
          const percent = metaProg.total > 0 ? (metaProg.completed / metaProg.total) * 100 : 0;
          const isCompleted = percent === 100 && metaProg.total > 0;

          return (
            <motion.div
              key={meta.id}
              whileHover={{ y: -8, scale: 1.02 }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.01 }}
            >
              <div className={`bg-white rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 border-2 overflow-hidden group ${isCompleted ? 'border-emerald-100' : 'border-slate-100 hover:border-blue-400'}`}>
                <div className="p-8">
                  <div className="flex justify-end items-start mb-4 min-h-[1.5rem]">
                    {isCompleted && (
                      <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg shadow-emerald-200">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6 leading-tight min-h-[3.5rem]">
                    {meta.nome_meta}
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400">{metaProg.completed}/{metaProg.total || '--'} Tarefas</span>
                        <span className={isCompleted ? 'text-emerald-600' : 'text-blue-600'}>{percent.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <Link
                      href={`/meta/${meta.id}`}
                      className={`block w-full text-center py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.15em] transition-all shadow-lg ${isCompleted ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-900 text-white hover:bg-blue-600'}`}
                    >
                      Estudar Agora
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  )}
</>
);
}
