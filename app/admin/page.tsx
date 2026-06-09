'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { 
  Shield, 
  Loader2, 
  Plus, 
  Save, 
  BookOpen, 
  Award, 
  AlertTriangle, 
  ExternalLink, 
  Check, 
  ChevronDown, 
  Activity, 
  Sparkles,
  RefreshCw,
  FolderPlus
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// CONFIGURAÇÃO DE SEGURANÇA MÁXIMA
// E-mail autorizado para acesso ao painel admin
const ADMIN_EMAIL = 'legisquestoesconcurso@gmail.com';
// ==========================================

interface TaskState {
  titulo: string;
  link_material: string;
  link_questoes: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // States do Painel
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [concursos, setConcursos] = useState<any[]>([]);
  const [selectedConcursoId, setSelectedConcursoId] = useState<string>('');
  const [metas, setMetas] = useState<any[]>([]);
  const [tarefasByMeta, setTarefasByMeta] = useState<Record<string, any[]>>({});
  const [editableTasks, setEditableTasks] = useState<Record<string, TaskState>>({});
  
  // Loaders
  const [globalLoading, setGlobalLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  
  // Modal/Cadastro de Concurso
  const [showAddConcurso, setShowAddConcurso] = useState(false);
  const [newConcursoNome, setNewConcursoNome] = useState('');
  const [isCreatingConcurso, setIsCreatingConcurso] = useState(false);

  // 1. Verificação rígida de segurança
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      toast.error('Faça login como administrador para acessar esta página.');
      router.push('/login');
      return;
    }

    if (user.email !== ADMIN_EMAIL) {
      toast.error('Acesso negado: Você não tem permissões de administrador.');
      router.push('/');
      return;
    }

    setIsAuthorized(true);
    fetchConcursos();
  }, [user, authLoading, router]);

  // Busca lista de concursos
  const fetchConcursos = async () => {
    try {
      setGlobalLoading(true);
      const { data, error } = await supabase
        .from('concursos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setConcursos(data || []);

      // Seleciona o primeiro por padrão, se disponível
      if (data && data.length > 0) {
        setSelectedConcursoId(data[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao buscar concursos:', err.message);
      toast.error('Erro ao carregar lista de concursos.');
    } finally {
      setGlobalLoading(false);
    }
  };

  // Carrega metas e tarefas quando mudar o concurso selecionado
  useEffect(() => {
    if (!selectedConcursoId || !isAuthorized) return;
    loadMetasAndTasks(selectedConcursoId);
  }, [selectedConcursoId, isAuthorized]);

  const loadMetasAndTasks = async (concursoId: string) => {
    try {
      setLoadingTasks(true);
      
      // 1. Busca metas do Concurso
      const { data: metasData, error: metasError } = await supabase
        .from('metas')
        .select('id, nome_meta, ordem')
        .eq('concurso_id', concursoId)
        .order('ordem', { ascending: true });

      if (metasError) throw metasError;

      if (!metasData || metasData.length === 0) {
        setMetas([]);
        setTarefasByMeta({});
        setEditableTasks({});
        return;
      }

      setMetas(metasData);

      // 2. Busca todas as tarefas associadas a estas metas
      const metaIds = metasData.map(m => m.id);
      const { data: tarefasData, error: tarefasError } = await supabase
        .from('tarefas')
        .select('*')
        .in('meta_id', metaIds)
        .order('numero_tarefa', { ascending: true });

      if (tarefasError) throw tarefasError;

      // 3. Agrupa e inicializa o estado de edição
      const grouped: Record<string, any[]> = {};
      const initialEditable: Record<string, TaskState> = {};

      metasData.forEach(m => {
        grouped[m.id] = [];
      });

      if (tarefasData) {
        tarefasData.forEach(t => {
          if (!grouped[t.meta_id]) {
            grouped[t.meta_id] = [];
          }
          grouped[t.meta_id].push(t);
          
          initialEditable[t.id] = {
            titulo: t.titulo || `Tarefa ${t.numero_tarefa}`,
            link_material: t.link_material || '',
            link_questoes: t.link_questoes || ''
          };
        });
      }

      setTarefasByMeta(grouped);
      setEditableTasks(initialEditable);

    } catch (err: any) {
      console.error('Erro ao buscar dados das tarefas:', err.message);
      toast.error('Erro ao carregar tarefas do concurso.');
    } finally {
      setLoadingTasks(false);
    }
  };

  // Cria um novo concurso
  const handleCreateConcurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConcursoNome.trim()) {
      toast.error('Digite o nome do concurso.');
      return;
    }

    try {
      setIsCreatingConcurso(true);
      const { data, error } = await supabase
        .from('concursos')
        .insert({
          nome: newConcursoNome.trim(),
          ativo: true
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Concurso "${newConcursoNome}" cadastrado com sucesso!`);
      setNewConcursoNome('');
      setShowAddConcurso(false);
      
      // Recarrega lista e seleciona o novo
      const { data: updatedList } = await supabase
        .from('concursos')
        .select('*')
        .order('nome', { ascending: true });
        
      if (updatedList) {
        setConcursos(updatedList);
        if (data) {
          setSelectedConcursoId(data.id);
        }
      }
    } catch (err: any) {
      console.error('Erro ao cadastrar concurso:', err.message);
      toast.error('Erro ao salvar concurso no Supabase.');
    } finally {
      setIsCreatingConcurso(false);
    }
  };

  // Salva links e título de uma tarefa
  const handleSaveTask = async (taskId: string) => {
    const editState = editableTasks[taskId];
    if (!editState) return;

    try {
      setSavingTaskId(taskId);
      const { error } = await supabase
        .from('tarefas')
        .update({
          titulo: editState.titulo,
          link_material: editState.link_material,
          link_questoes: editState.link_questoes
        })
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Links salvos instantaneamente no Supabase!');
    } catch (err: any) {
      console.error('Erro ao salvar tarefa:', err.message);
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingTaskId(null);
    }
  };

  // Auxiliar de atualização de valores para o input reativo
  const handleInputChange = (taskId: string, field: keyof TaskState, value: string) => {
    setEditableTasks(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
  };

  if (authLoading || globalLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium tracking-widest text-xs uppercase animate-pulse">
          Validando Credenciais Administrativas...
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Redirecionando
  }

  const totalFilteredTasksCount = Object.values(tarefasByMeta).reduce((acc, list) => acc + list.length, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* Background Decorativo */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "url('https://github.com/legisquestoesconcurso-ui/cronograma-gcm/raw/main/public/bg-patrulha-v1.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-900 pointer-events-none z-0" />

      {/* Navbar do app para consistência de fluxo */}
      <div className="relative z-10 w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <Navbar />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        
        {/* Header do Admin */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-8 border-b border-slate-850">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] font-bold tracking-widest uppercase">
                Acesso de Professor
              </span>
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
              PAINEL DE ADMINISTRAÇÃO
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Gerenciamento dinâmico de materiais de estudo e cadernos de questões para alunos
            </p>
          </div>

          <button 
            onClick={() => setShowAddConcurso(true)}
            className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>➕ Cadastrar Novo Concurso</span>
          </button>
        </div>

        {/* Modal / Formulário Cadastro Concurso */}
        <AnimatePresence>
          {showAddConcurso && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-[2rem] p-6 sm:p-8 shadow-2xl relative"
              >
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl mb-3">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Criar Novo Concurso</h2>
                  <p className="text-slate-400 text-xs mt-1">Crie uma nova ramificação para armazenar metas e tarefas de estudos</p>
                </div>

                <form onSubmit={handleCreateConcurso} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      Nome Oficial do Edital/Concurso
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: GCM Niterói"
                      value={newConcursoNome}
                      onChange={(e) => setNewConcursoNome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white rounded-2xl px-4 py-3 placeholder-slate-600 text-sm focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      disabled={isCreatingConcurso}
                      onClick={() => setShowAddConcurso(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingConcurso}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {isCreatingConcurso ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Cadastrar</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Dashboard Control Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 mb-10 shadow-2xl relative overflow-hidden">
          {/* Luzes decorativas */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Seletor de Concurso e Resumo */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 w-full max-w-md">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">
                🏆 Selecionar Concurso/Edital em Edição
              </label>
              <div className="relative">
                <select 
                  value={selectedConcursoId}
                  onChange={(e) => setSelectedConcursoId(e.target.value)}
                  className="w-full appearance-none bg-slate-950 border border-slate-800 hover:border-slate-700 text-white font-semibold text-sm rounded-2xl pl-5 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                >
                  {concursos.length === 0 ? (
                    <option value="">Nenhum concurso localizado</option>
                  ) : (
                    concursos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.ativo ? '🟢 Ativo' : '🔴 Inativo'}
                      </option>
                    ))
                  )}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6 bg-slate-950/60 p-4 sm:p-6 rounded-3xl border border-slate-850 self-start md:self-center">
              <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Resumo Estatístico</p>
                <p className="text-xl sm:text-2xl font-black text-white mt-1">
                  {metas.length} Metas <span className="text-slate-500 text-sm">/ {totalFilteredTasksCount} Tarefas</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* State Indicators */}
        {loadingTasks ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-400 font-bold tracking-widest text-xs uppercase">
              Buscando metas e tarefas correspondentes...
            </p>
          </div>
        ) : metas.length === 0 ? (
          <div className="bg-slate-900 border border-slate-850 rounded-[2.5rem] p-12 text-center max-w-xl mx-auto shadow-xl">
            <AlertTriangle className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white uppercase mb-2">Concurso Vazio</h3>
            <p className="text-slate-400 text-sm mb-6">
              Este concurso ainda não possui metas ou tarefas associadas a ele no banco de dados do Supabase. Para começar, insira dados nas tabelas &apos;metas&apos; e &apos;tarefas&apos;.
            </p>
            <div className="text-slate-500 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-850">
              ID do concurso: {selectedConcursoId}
            </div>
          </div>
        ) : (
          /* Listagem das Tarefas Agrupadas por Meta */
          <div className="space-y-12">
            {metas.map((meta, mIdx) => {
              const taskList = tarefasByMeta[meta.id] || [];
              
              return (
                <div 
                  key={meta.id} 
                  className="bg-slate-900/50 border border-slate-850 rounded-[3rem] overflow-hidden shadow-xl"
                >
                  {/* Cabeçalho da Meta */}
                  <div className="bg-gradient-to-r from-slate-900 to-slate-850/50 px-6 sm:px-8 py-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                        {mIdx + 1}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-tight uppercase">
                          {meta.nome_meta}
                        </h2>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-widest mt-0.5">
                          Meta de estudos cadastrada
                        </p>
                      </div>
                    </div>
                    <span className="self-start sm:self-center px-4 py-1.5 bg-slate-850 text-slate-300 rounded-full text-xs font-bold font-mono">
                      {taskList.length} Tarefas
                    </span>
                  </div>

                  {/* Lista de tarefas dentro da meta */}
                  {taskList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      Nenhuma tarefa vinculada a esta meta.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-850">
                      {taskList.map((task) => {
                        const state = editableTasks[task.id] || { titulo: '', link_material: '', link_questoes: '' };
                        return (
                          <div 
                            key={task.id} 
                            className="p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hover:bg-slate-900/20 transition-colors"
                          >
                            
                            {/* Identificação da Tarefa */}
                            <div className="w-full lg:max-w-xs flex-shrink-0">
                              <div className="flex items-center space-x-2.5 mb-2">
                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg px-2 py-0.5 text-xs font-mono font-bold">
                                  T{task.numero_tarefa}
                                </span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                                  ID: {task.id.slice(0, 8)}...
                                </span>
                              </div>
                              <input 
                                type="text"
                                value={state.titulo}
                                onChange={(e) => handleInputChange(task.id, 'titulo', e.target.value)}
                                className="text-base font-black text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none w-full transition-colors pb-1"
                                placeholder="Título correspondente"
                              />
                            </div>

                            {/* Inputs dos Links (Ultra Responsivo) */}
                            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Link Material */}
                              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                  Link do Material em PDF
                                </label>
                                <input 
                                  type="text"
                                  value={state.link_material}
                                  onChange={(e) => handleInputChange(task.id, 'link_material', e.target.value)}
                                  className="w-full bg-transparent text-slate-200 text-xs focus:outline-none font-mono truncate"
                                  placeholder="Caminho ou URL absoluta do PDF"
                                />
                              </div>

                              {/* Link Questões */}
                              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                  Link Caderno do TEC Concursos
                                </label>
                                <input 
                                  type="text"
                                  value={state.link_questoes}
                                  onChange={(e) => handleInputChange(task.id, 'link_questoes', e.target.value)}
                                  className="w-full bg-transparent text-slate-200 text-xs focus:outline-none font-mono truncate"
                                  placeholder="Link completo do Tec Concursos"
                                />
                              </div>
                            </div>

                            {/* Botão Salvar Linha */}
                            <button
                              disabled={savingTaskId === task.id}
                              onClick={() => handleSaveTask(task.id)}
                              className="w-full lg:w-auto bg-slate-800 hover:bg-green-600/25 border border-slate-700 hover:border-green-500/40 text-slate-100 hover:text-green-400 py-3 px-5 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95"
                            >
                              {savingTaskId === task.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              <span>Salvar Alterações</span>
                            </button>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
