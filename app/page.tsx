'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { CheckCircle2, Circle, ArrowRight, Trophy, Target, BarChart3, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import MotivationalMentor from '@/components/MotivationalMentor';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [metas, setMetas] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`metas_${user?.id || 'guest'}`);
      return cached ? JSON.parse(cached) : [];
    }
    return [];
  });
  const [progress, setProgress] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`progress_${user?.id || 'guest'}`);
      return cached ? JSON.parse(cached) : {};
    }
    return {};
  });
  const [configError] = useState(() => !isSupabaseConfigured());
  const [loading, setLoading] = useState(true);
  const [totalTasks, setTotalTasks] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem(`totalTasks_${user?.id || 'guest'}`)) || 0;
    }
    return 0;
  });
  const [completedTasksCount, setCompletedTasksCount] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem(`completedTasksCount_${user?.id || 'guest'}`)) || 0;
    }
    return 0;
  });
  const [selectedMeta, setSelectedMeta] = useState<string | null>(null);
  const hasDataRef = React.useRef(false);

  // Update hasDataRef whenever progress changes
  useEffect(() => {
    hasDataRef.current = Object.keys(progress).length > 0 && metas.length > 0;
  }, [progress, metas]);

  // Load from localStorage on mount or user change
  useEffect(() => {
    if (user?.id) {
      const cachedMetas = localStorage.getItem(`metas_${user.id}`);
      const cachedProgress = localStorage.getItem(`progress_${user.id}`);
      const cachedTotal = localStorage.getItem(`totalTasks_${user.id}`);
      const cachedCompleted = localStorage.getItem(`completedTasksCount_${user.id}`);
      
      if (cachedMetas) setMetas(JSON.parse(cachedMetas));
      if (cachedProgress) setProgress(JSON.parse(cachedProgress));
      if (cachedTotal) setTotalTasks(Number(cachedTotal));
      if (cachedCompleted) setCompletedTasksCount(Number(cachedCompleted));
    }
  }, [user?.id]);

  const fetchProgress = React.useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      // Only show loading spinner if we have no data at all
      if (!hasDataRef.current) setLoading(true);
      
      // Timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      // Data fetch promise
      const fetchDataPromise = (async () => {
        // 1. Fetch all metas ordered by ordem
        const { data: dbMetas, error: metasError } = await supabase
          .from('metas')
          .select('*')
          .order('ordem', { ascending: true });
        
        if (metasError) throw metasError;

        // 2. Fetch all tasks to know their meta_id
        const { data: allTasks, error: tasksError } = await supabase
          .from('tarefas')
          .select('id, meta_id');
        
        if (tasksError) throw tasksError;

        // 3. Fetch progress entries for THIS user only
        const { data: allProgress, error: progressError } = await supabase
          .from('progresso')
          .select('tarefa_id, acertos, total_questoes')
          .eq('user_id', user.id);
        
        if (progressError) throw progressError;

        return { dbMetas, allTasks, allProgress };
      })();

      // Race against timeout
      const result = await Promise.race([fetchDataPromise, timeoutPromise]) as any;
      const { dbMetas, allTasks, allProgress } = result;

      // 4. Calculate progress per meta
      const completedTaskIds = new Set(allProgress?.map((p: any) => p.tarefa_id));
      
      const metaMap: Record<string, { completed: number, total: number }> = {};
      
      allTasks?.forEach((task: any) => {
        const mId = task.meta_id;
        if (!metaMap[mId]) metaMap[mId] = { completed: 0, total: 0 };
        metaMap[mId].total += 1;
        if (completedTaskIds.has(task.id)) {
          metaMap[mId].completed += 1;
        }
      });

      // Update state and cache
      setMetas(dbMetas || []);
      setProgress(metaMap);
      setTotalTasks(allTasks?.length || 0);
      setCompletedTasksCount(completedTaskIds.size);

      localStorage.setItem(`metas_${user.id}`, JSON.stringify(dbMetas || []));
      localStorage.setItem(`progress_${user.id}`, JSON.stringify(metaMap));
      localStorage.setItem(`totalTasks_${user.id}`, String(allTasks?.length || 0));
      localStorage.setItem(`completedTasksCount_${user.id}`, String(completedTaskIds.size));

    } catch (err) {
      // On timeout or error, we just keep using what's in state/localStorage
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // Only depend on user.id to avoid loops

  useEffect(() => {
    if (!authLoading && user?.id) {
      fetchProgress();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, user?.id, authLoading, fetchProgress]);

  // Priority Rendering: If we have a user and some progress data (from cache), 
  // show the dashboard even if background loading is still happening.
  const showDashboard = user && (metas.length > 0 || !loading);

  if (authLoading || (loading && !showDashboard)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
          <p className="text-[10px] text-slate-400 uppercase tracking-widest animate-pulse">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  const overallPercent = totalTasks > 0 ? (completedTasksCount / totalTasks) * 100 : 0;

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 flex items-center space-x-6">
            <div className="bg-blue-50 p-4 rounded-2xl">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-800 font-semibold uppercase tracking-widest mb-1">Progresso Geral</p>
              <p className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tighter">{overallPercent.toFixed(1)}%</p>
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
              <p className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tighter">{completedTasksCount} <span className="text-slate-300 text-2xl">/ {totalTasks}</span></p>
              <p className="text-[9px] text-emerald-500 font-bold uppercase mt-1">
                {completedTasksCount === 0 
                  ? 'Sua jornada começa agora!' 
                  : completedTasksCount >= totalTasks && totalTasks > 0
                    ? 'MISSÃO CUMPRIDA! VOCÊ ESTÁ PRONTO.' 
                    : 'CONTINUE ASSIM!'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-blue-900 uppercase tracking-tight">Ciclo de Estudos</h2>
            <p className="text-[11px] text-gray-800 font-semibold uppercase tracking-widest">Selecione sua meta diária</p>
          </div>
          <div className="bg-blue-900 text-white px-4 py-2 rounded-full text-[9px] font-medium uppercase tracking-widest">
            {Object.keys(progress).filter(k => progress[k].completed === progress[k].total && progress[k].total > 0).length} Metas Batidas
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {metas.map((meta, index) => {
            const metaProgress = progress[meta.id] || { completed: 0, total: 0 };
            const isCompleted = metaProgress.completed >= metaProgress.total && metaProgress.total > 0;
            const percent = metaProgress.total > 0 ? (metaProgress.completed / metaProgress.total) * 100 : 0;

            return (
              <motion.div
                key={meta.id}
                whileHover={{ y: -4 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div 
                  className={`bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border transition-all duration-200 overflow-hidden group ${
                    selectedMeta === meta.id 
                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400/20' 
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                  onClick={() => setSelectedMeta(meta.id)}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-blue-900 font-medium text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {meta.ordem || index + 1}
                      </div>
                      {isCompleted ? (
                        <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg shadow-emerald-200">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-slate-100 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-slate-200" />
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-tight mb-4">
                      {meta.nome_meta || meta.title}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-widest mb-2">
                          <span className="text-slate-900">{metaProgress.completed}/{metaProgress.total} Tarefas</span>
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
                        className="block w-full text-center bg-blue-600 text-white py-4 sm:py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
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
      </main>
    </div>
  );
}

