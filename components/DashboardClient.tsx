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
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUserProgress = async () => {
      const { data: allProgress } = await supabase
        .from('progresso')
        .select('tarefa_id')
        .eq('user_id', user.id);

      if (allProgress) {
        const completedIds = new Set(allProgress.map(p => p.tarefa_id));
        setCompletedCount(completedIds.size);

        // Buscar todas as tarefas para mapear progresso por meta
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
        }
      }
    };

    fetchUserProgress();
  }, [user]);

  const overallPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 flex items-center space-x-6">
          <div className="bg-blue-50 p-4 rounded-2xl">
            <Target className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-[11px] text-gray-800 font-semibold uppercase tracking-widest mb-1">Progresso Geral</p>
            <p className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tighter">
              {overallPercent.toFixed(1)}%
            </p>
            <div className="mt-2 w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-1000"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 flex items-center space-x-6">
          <div className="bg-emerald-50 p-4 rounded-2xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] text-gray-800 font-semibold uppercase tracking-widest mb-1">Tarefas Concluídas</p>
            <p className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tighter">
              {completedCount} <span className="text-slate-300 text-2xl">/ {totalTasks}</span>
            </p>
            <p className="text-[9px] text-emerald-500 font-bold uppercase mt-1">
              {completedCount >= totalTasks && totalTasks > 0 ? 'MISSÃO CUMPRIDA!' : 'CONTINUE ASSIM!'}
            </p>
          </div>
        </div>
      </div>

      {/* Metas Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {initialMetas.map((meta, index) => {
          const metaProg = progress[meta.id] || { completed: 0, total: 0 };
          const percent = metaProg.total > 0 ? (metaProg.completed / metaProg.total) * 100 : 0;
          const isCompleted = percent === 100 && metaProg.total > 0;

          return (
            <motion.div
              key={meta.id}
              whileHover={{ y: -4 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-300 hover:border-blue-400 transition-all duration-200 overflow-hidden group">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-blue-900 font-medium text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {meta.ordem || index + 1}
                    </div>
                    {isCompleted && (
                      <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg shadow-emerald-200">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight mb-4 min-h-[3rem]">
                    {meta.nome_meta}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-widest mb-2">
                        <span className="text-slate-900">{metaProg.completed}/{metaProg.total || '--'} Tarefas</span>
                        <span className="text-slate-900">{percent.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-1000"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <Link
                      href={`/meta/${meta.id}`}
                      className="block w-full text-center bg-blue-600 text-white py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all shadow-md"
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
