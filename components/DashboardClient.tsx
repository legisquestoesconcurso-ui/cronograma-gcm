'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Target, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

interface DashboardClientProps {
  initialMetas: any[];
  totalTasks: number;
}

export default function DashboardClient({ initialMetas, totalTasks }: DashboardClientProps) {
  const { user, loading: authLoading } = useAuth();
  
  // Inicializa o estado a partir do LocalStorage para evitar "loading" ao alternar abas
  const [progress, setProgress] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`dashboard_progress_${user?.id || 'guest'}`);
      return cached ? JSON.parse(cached) : {};
    }
    return {};
  });
  
  const [completedCount, setCompletedCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`dashboard_completed_${user?.id || 'guest'}`);
      return cached ? Number(cached) : 0;
    }
    return 0;
  });

  useEffect(() => {
    if (!user) return;

    const fetchUserProgress = async () => {
      const { data: allProgress } = await supabase
        .from('progresso')
        .select('tarefa_id')
        .eq('user_id', user.id);

      if (allProgress) {
        const completedIds = new Set(allProgress.map(p => p.tarefa_id));
        const newCompletedCount = completedIds.size;
        setCompletedCount(newCompletedCount);

        const { data: allTasks } = await supabase.from('tarefas').select('id, meta_id');
        
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
          
          // Salva no cache para persistência instantânea
          localStorage.setItem(`dashboard_progress_${user.id}`, JSON.stringify(metaMap));
          localStorage.setItem(`dashboard_completed_${user.id}`, String(newCompletedCount));
        }
      }
    };

    fetchUserProgress();
  }, [user]);

  const overallPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  return (
    <>
      {/* Stats Cards - Layout Desktop Otimizado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 flex items-center space-x-8 hover:scale-[1.01] transition-transform">
          <div className="bg-blue-50 p-6 rounded-3xl">
            <Target className="w-10 h-10 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-2">Desempenho Global</p>
            <div className="flex items-baseline space-x-3">
              <p className="text-6xl font-black text-slate-900 tracking-tighter">
                {overallPercent.toFixed(1)}%
              </p>
              <span className="text-slate-400 font-medium uppercase text-[10px] tracking-widest">Concluído</span>
            </div>
            <div className="mt-4 w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-1000 ease-out"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 flex items-center space-x-8 hover:scale-[1.01] transition-transform">
          <div className="bg-emerald-50 p-6 rounded-3xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-2">Metas Batidas</p>
            <div className="flex items-baseline space-x-3">
              <p className="text-6xl font-black text-slate-900 tracking-tighter">
                {completedCount}
              </p>
              <span className="text-slate-400 font-medium text-2xl">/ {totalTasks}</span>
            </div>
            <p className="text-[10px] text-emerald-600 font-black uppercase mt-3 tracking-widest">
              {completedCount >= totalTasks && totalTasks > 0 ? '🏆 OBJETIVO ALCANÇADO!' : '🚀 MANTENHA O RITMO!'}
            </p>
          </div>
        </div>
      </div>

      {/* Metas Grid - Expandido para Desktop (até 6 colunas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-8">
        {initialMetas.map((meta, index) => {
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
                  <div className="flex justify-between items-start mb-8">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold transition-colors ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}>
                      {meta.ordem || index + 1}
                    </div>
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
  );
}
