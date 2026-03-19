'use client';

import React, { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import MotivationalMentor, { MOTIVATIONAL_PHRASES } from '@/components/MotivationalMentor';

interface Task {
  id: string; // UUID from tarefas table
  meta_id: string;
  titulo: string;
  numero_tarefa: number;
  total_questions: number;
  correct_answers: number;
  completed: boolean;
  link_questoes?: string;
  link_material?: string;
}

export default function MetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: metaId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metaName, setMetaName] = useState<string>('');
  const [concursoId, setConcursoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, { total: string, correct: string }>>({});
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        setError(null);

        // 0. Try to load from cache first
        const cacheKey = `meta_tasks_${metaId}_${user.id}`;
        const cachedTasks = localStorage.getItem(cacheKey);
        const cachedName = localStorage.getItem(`meta_name_${metaId}`);
        if (cachedTasks) {
          setTasks(JSON.parse(cachedTasks));
          if (cachedName) setMetaName(cachedName);
          setLoading(false);
        }

        // 1. Fetch Meta Data (including concurso_id)
        const { data: metaData } = await supabase
          .from('metas')
          .select('nome_meta, concurso_id')
          .eq('id', metaId)
          .single();
        
        if (metaData) {
          setMetaName(metaData.nome_meta);
          setConcursoId(metaData.concurso_id);
          localStorage.setItem(`meta_name_${metaId}`, metaData.nome_meta);
        }

        // 2. ID Mapping: Extract number from URL (e.g., 'M01' -> 1)
        const metaNumber = parseInt(metaId.replace(/\D/g, ''), 10);
        
        // 3. Fetch all tasks for this meta
        const { data: dbTarefas, error: fetchError } = await supabase
          .from('tarefas')
          .select('*')
          .eq('meta_id', metaId)
          .order('numero_tarefa', { ascending: true });
        
        let finalTarefas = dbTarefas;

        // Fallback: If not found by string, try by number
        if (fetchError || !dbTarefas || dbTarefas.length === 0) {
          const { data: retryData, error: retryError } = await supabase
            .from('tarefas')
            .select('*')
            .eq('meta_id', metaNumber)
            .order('numero_tarefa', { ascending: true });
          
          if (retryError || !retryData || retryData.length === 0) {
            const start = (metaNumber - 1) * 9 + 1;
            const end = metaNumber * 9;
            const { data: rangeData, error: rangeError } = await supabase
              .from('tarefas')
              .select('*')
              .gte('numero_tarefa', start)
              .lte('numero_tarefa', end)
              .order('numero_tarefa', { ascending: true });
            
            if (rangeError || !rangeData || rangeData.length === 0) {
              throw new Error('Nenhuma tarefa encontrada para esta Meta.');
            }
            finalTarefas = rangeData;
          } else {
            finalTarefas = retryData;
          }
        }

        // 4. Fetch Latest Progress for all tasks using 'user_progress' table for THIS user and concurso
        const taskIds = finalTarefas!.map(t => t.id);
        let progressData = null;
        let progressError = null;

        if (metaData?.concurso_id) {
          const { data, error } = await supabase
            .from('user_progress')
            .select('*')
            .in('tarefa_id', taskIds)
            .eq('user_id', user.id)
            .eq('concurso_id', metaData.concurso_id)
            .order('data_estudo', { ascending: false });
          progressData = data;
          progressError = error;
        }

        // Fallback to 'progresso' if no data in 'user_progress' or error
        if (!progressData || progressData.length === 0) {
          const { data, error } = await supabase
            .from('progresso')
            .select('*')
            .in('tarefa_id', taskIds)
            .eq('user_id', user.id)
            .order('data_estudo', { ascending: false });
          progressData = data;
          progressError = error;
        }
        
        if (progressError) throw progressError;

        const taskList: Task[] = finalTarefas!.map(t => {
          // Since we ordered by data_estudo desc, the first match for a tarefa_id is the latest
          const p = progressData?.find(item => item.tarefa_id === t.id);
          return {
            id: t.id,
            meta_id: t.meta_id,
            titulo: t.titulo,
            numero_tarefa: t.numero_tarefa,
            total_questions: p?.total_questoes || 0,
            correct_answers: p?.acertos || 0,
            completed: !!p,
            link_questoes: t.link_questoes,
            link_material: t.link_material
          };
        });

        setTasks(taskList);
        localStorage.setItem(cacheKey, JSON.stringify(taskList));

        // Set initial inputs
        const initialInputs: Record<string, { total: string, correct: string }> = {};
        taskList.forEach(t => {
          initialInputs[t.id] = {
            total: t.total_questions > 0 ? t.total_questions.toString() : '',
            correct: t.correct_answers > 0 ? t.correct_answers.toString() : ''
          };
        });
        setInputs(initialInputs);
      } catch (err: any) {
        console.error('Erro detalhado:', err.message || err);
        setError('Erro ao carregar dados do ciclo.');
      } finally {
        setLoading(false);
      }
    };
    
    if (!authLoading) {
      init();
    }
  }, [metaId, router, user, authLoading]);

  const fetchHistory = React.useCallback(async (taskId: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('progresso')
        .select('*')
        .eq('tarefa_id', taskId)
        .eq('user_id', user.id)
        .order('data_estudo', { ascending: false });
      
      if (error) throw error;
      setHistory(prev => ({ ...prev, [taskId]: data || [] }));
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }
  }, [user]);

  useEffect(() => {
    if (expandedTaskId) {
      fetchHistory(expandedTaskId);
    }
  }, [expandedTaskId, fetchHistory]);

  const handleSave = async (taskId: string) => {
    if (!user) return;
    setSaving(taskId);

    const taskInput = inputs[taskId] || { total: '', correct: '' };
    const total = parseInt(taskInput.total);
    const correct = parseInt(taskInput.correct);

    if (isNaN(total) || isNaN(correct) || correct > total) {
      alert('Valores inválidos. Acertos não podem superar o total.');
      setSaving(null);
      return;
    }

    try {
      // 1. Insert into 'progresso' (Legacy/Compatibility)
      await supabase.from('progresso').insert({
        tarefa_id: taskId, 
        user_id: user.id,
        total_questoes: Number(total),
        acertos: Number(correct),
      });

      // 2. Insert into 'user_progress' (New Multi-Concurso Table)
      if (concursoId) {
        try {
          const { error: upError } = await supabase.from('user_progress').insert({
            tarefa_id: taskId,
            user_id: user.id,
            concurso_id: concursoId,
            total_questoes: Number(total),
            acertos: Number(correct),
          });
          if (upError) console.warn("user_progress insert error:", upError);
        } catch (err) {
          console.warn("user_progress table might not exist yet:", err);
        }
      }

      // Clear the inputs for this task after successful save
      setInputs(prev => ({ ...prev, [taskId]: { total: '', correct: '' } }));

      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        completed: true, 
        total_questions: total, 
        correct_answers: correct 
      } : t));
      
      // Success Feedback: Toast notification with a random motivational phrase
      const randomPhrase = MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];
      toast.success('Desempenho salvo!', {
        description: randomPhrase,
        duration: 4000,
      });

      setShowSuccess(taskId);
      fetchHistory(taskId);
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (err: any) {
      console.error("Erro detalhado:", JSON.stringify(err, null, 2));
      alert(`Erro ao salvar progresso: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(null);
    }
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-900 mb-4" />
        <h2 className="text-blue-900 font-medium uppercase tracking-widest text-lg">Sincronizando Ciclo...</h2>
      </div>
    );
  }

  if (error || (tasks.length === 0 && !loading)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-blue-900 font-medium uppercase tracking-widest text-sm mb-6">
          {error || 'Nenhuma tarefa encontrada para esta Meta.'}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-900 text-white px-8 py-3 rounded-2xl font-medium uppercase text-xs tracking-widest hover:bg-blue-800 transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center text-blue-900 font-medium uppercase text-[10px] tracking-widest mb-6 hover:opacity-70 transition-opacity">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Ciclo
        </Link>

        <div className="mb-12">
          <h1 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none mb-2">
            {metaName || `META ${metaId.replace(/\D/g, '') || '...'}`} - Cronograma de Hoje
          </h1>
          <div className="mb-2">
            <p className="text-blue-600 font-bold uppercase tracking-widest text-xs">
              Sua farda está sendo tecida hoje.
            </p>
          </div>
          <p className="text-slate-500 font-normal uppercase text-[10px] tracking-widest">
            Complete as 9 tarefas para bater sua meta diária
          </p>
        </div>

        <div className="space-y-8">
          {tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const latestHistory = history[task.id]?.[0];
            const displayTotal = latestHistory ? latestHistory.total_questoes : task.total_questions;
            const displayCorrect = latestHistory ? latestHistory.acertos : task.correct_answers;
            const displayPercent = displayTotal > 0 ? (displayCorrect / displayTotal) * 100 : 0;
            const displayIncorrect = Math.max(0, displayTotal - displayCorrect);

            const getMotivationalPhrase = (p: number) => {
              if (p === 100) return 'Excelente! Parabéns pelo desempenho impecável! Você está no caminho da aprovação.';
              if (p > 75) return 'Parabéns, você está em um bom desenvolvimento, mas ainda pode alcançar excelência.';
              if (p >= 50) return 'Bem, você está quase lá!';
              return 'Você precisa melhorar e se esforçar mais nessa tarefa.';
            };
            
            const getBarColor = (p: number) => {
              if (p > 75) return 'bg-emerald-500';
              if (p >= 50) return 'bg-amber-500';
              return 'bg-red-500';
            };

            const getTextColor = (p: number) => {
              if (p > 75) return 'text-emerald-600';
              if (p >= 50) return 'text-amber-600';
              return 'text-red-600';
            };

            const currentPercent = (inputs[task.id]?.total && parseInt(inputs[task.id].total) > 0) 
              ? (parseInt(inputs[task.id].correct) / parseInt(inputs[task.id].total) * 100) 
              : displayPercent;

            const currentCorrect = (inputs[task.id]?.correct) ? parseInt(inputs[task.id].correct) : displayCorrect;
            const currentTotal = (inputs[task.id]?.total) ? parseInt(inputs[task.id].total) : displayTotal;
            const currentIncorrect = Math.max(0, currentTotal - currentCorrect);

            return (
              <div 
                key={task.id} 
                className={`bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 ring-2 ring-blue-50' : 'border-slate-100'}`}
              >
                <button 
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className={`w-full text-left p-6 sm:p-8 flex items-center justify-between group ${isExpanded ? 'pb-3 sm:pb-3' : ''}`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-medium text-lg transition-colors ${task.completed ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                      {task.numero_tarefa}
                    </div>
                    <div>
                      <span className="block text-[9px] font-medium text-blue-400 uppercase tracking-widest mb-1">
                        TAREFA {task.numero_tarefa}
                      </span>
                      <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900">
                        {task.titulo}
                      </h3>
                      
                      {(task.completed || (inputs[task.id]?.total && inputs[task.id]?.correct)) && (
                        <div className="mt-2 w-32 sm:w-48">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-[7px] font-extrabold uppercase ${getTextColor(currentPercent)}`}>
                              {currentPercent.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${getBarColor(currentPercent)}`}
                              style={{ width: `${Math.min(100, currentPercent)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {task.completed && !isExpanded && (
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest mb-1">Aproveitamento</span>
                        <span className={`text-sm font-extrabold ${getTextColor(displayPercent)}`}>{displayPercent.toFixed(0)}%</span>
                      </div>
                    )}
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isExpanded ? 'rotate-180 border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-400'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-6 sm:p-8 pt-0 border-t border-slate-50 animate-in slide-in-from-top-4 duration-300">
                    <div className="relative mt-2">
                      {showSuccess === task.id && (
                        <div className="absolute -top-12 left-0 right-0 bg-emerald-500 text-white py-2 text-center text-[10px] font-medium uppercase tracking-widest rounded-xl animate-in fade-in slide-in-from-bottom-2 z-10">
                          ✅ Desempenho salvo com sucesso!
                        </div>
                      )}

                      <div className="flex flex-col lg:flex-row gap-8 items-start">
                        {/* Coluna Esquerda: Ações e Histórico */}
                        <div className="flex-1 w-full space-y-8">
                          {/* Botões de Ação */}
                          <div className="flex flex-col gap-3 w-full">
                            {task.link_questoes && (
                              <a 
                                href={task.link_questoes} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center text-white bg-blue-600 px-6 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all w-full shadow-md whitespace-nowrap gap-2"
                              >
                                <ExternalLink className="w-5 h-5" /> Praticar no TEC Concursos
                              </a>
                            )}

                            {task.link_material && (
                              <a 
                                href={supabase.storage.from('materiais-estudo').getPublicUrl(task.link_material).data.publicUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center text-blue-900 bg-white border-2 border-blue-900 px-6 py-4 rounded-2xl text-[13px] font-bold uppercase tracking-widest hover:bg-blue-50 transition-all w-full shadow-md whitespace-nowrap gap-2"
                              >
                                📖 Ver Resumo
                              </a>
                            )}
                          </div>

                          {/* Inputs e Botão Salvar */}
                          <div className="bg-slate-50 rounded-[1.5rem] p-6 border border-slate-100 shadow-inner">
                            <div className="flex flex-col gap-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Questões</label>
                                  <input 
                                    type="number"
                                    value={inputs[task.id]?.total || ''}
                                    onChange={(e) => setInputs({ ...inputs, [task.id]: { ...inputs[task.id], total: e.target.value } })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-blue-900 focus:border-blue-400 outline-none text-sm transition-all"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Acertos</label>
                                  <input 
                                    type="number"
                                    value={inputs[task.id]?.correct || ''}
                                    onChange={(e) => setInputs({ ...inputs, [task.id]: { ...inputs[task.id], correct: e.target.value } })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-blue-900 focus:border-blue-400 outline-none text-sm transition-all"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                              
                              <div className="flex justify-center">
                                <button 
                                  onClick={() => handleSave(task.id)}
                                  disabled={saving === task.id}
                                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 min-w-[180px] flex items-center justify-center shadow-md"
                                >
                                  {saving === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Desempenho'}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Histórico Section */}
                          <div>
                            <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-4">Seu Histórico nesta Tarefa</h4>
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                  <tr>
                                    <th className="px-4 py-3 font-medium text-slate-500 uppercase tracking-wider">Data</th>
                                    <th className="px-4 py-3 font-medium text-slate-500 uppercase tracking-wider text-center">Questões</th>
                                    <th className="px-4 py-3 font-medium text-slate-500 uppercase tracking-wider text-center">Acertos</th>
                                    <th className="px-4 py-3 font-medium text-slate-500 uppercase tracking-wider text-right">%</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {history[task.id]?.length > 0 ? (
                                    history[task.id].map((item, idx) => {
                                      const p = (item.acertos / item.total_questoes) * 100;
                                      return (
                                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="px-4 py-3 text-slate-600 font-medium">
                                            {new Date(item.data_estudo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                          </td>
                                          <td className="px-4 py-3 text-slate-600 font-medium text-center">{item.total_questoes}</td>
                                          <td className="px-4 py-3 text-slate-600 font-medium text-center">{item.acertos}</td>
                                          <td className={`px-4 py-3 font-medium flex items-center justify-end gap-2 ${getTextColor(p)}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${getBarColor(p)}`} />
                                            {p.toFixed(0)}%
                                          </td>
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic font-medium">
                                        Nenhum registro encontrado.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Coluna Direita: Gráfico e Frases */}
                        <div className="flex-1 w-full">
                          {(task.completed || (inputs[task.id]?.total && inputs[task.id]?.correct)) && (
                            <div className="flex flex-col gap-8 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm animate-in fade-in zoom-in-95 duration-500 min-h-[400px] justify-between">
                              <div className="text-center">
                                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-widest">
                                  Desempenho da última tarefa realizada
                                </span>
                              </div>

                              <div className="flex flex-col items-center gap-8">
                                {/* Gráfico Circular */}
                                <div className="relative w-32 h-32">
                                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="3.5" />
                                    <circle
                                      cx="18" cy="18" r="15.915" fill="transparent" stroke={currentPercent > 75 ? '#10b981' : currentPercent >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="3.5"
                                      strokeDasharray={`${currentPercent} ${100 - currentPercent}`}
                                      strokeLinecap="round"
                                      className="transition-all duration-1000 ease-out"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-extrabold text-slate-900 tracking-tighter">{currentPercent.toFixed(0)}%</span>
                                  </div>
                                </div>

                                {/* Caixas de Acertos e Erros */}
                                <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
                                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                                    <span className="block text-[8px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Acertos</span>
                                    <span className="text-xl font-bold text-emerald-700">{currentCorrect}</span>
                                  </div>
                                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex flex-col items-center justify-center text-center">
                                    <span className="block text-[8px] font-bold text-red-600 uppercase tracking-widest mb-1">Erros</span>
                                    <span className="text-xl font-bold text-red-700">{currentIncorrect}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Progresso</span>
                                  <span className={`text-[10px] font-extrabold uppercase ${getTextColor(currentPercent)}`}>
                                    {currentPercent.toFixed(1)}% de aproveitamento
                                  </span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-white">
                                  <div 
                                    className={`h-full transition-all duration-1000 ease-out ${getBarColor(currentPercent)}`} 
                                    style={{ width: `${currentPercent}%` }} 
                                  />
                                </div>
                                <p className={`text-[11px] font-medium leading-relaxed text-center px-2 ${getTextColor(currentPercent)}`}>
                                  {getMotivationalPhrase(currentPercent)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
