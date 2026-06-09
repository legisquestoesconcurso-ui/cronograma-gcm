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
  FolderPlus,
  Users,
  Search,
  X,
  ChevronRight,
  BarChart3
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

  // Importação CSV
  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Estados de Mentoria (Acompanhamento dos Alunos)
  const [activeTab, setActiveTab] = useState<'editais' | 'mentoria'>('editais');
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [selectedStudentPerformance, setSelectedStudentPerformance] = useState<any | null>(null);

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

  // Helper para split de CSV tratando aspas duplas corretamente
  const splitCSVLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  // Parsing nativo e robusto de arquivo CSV
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const metaIdx = headers.indexOf('meta_id');
    const numIdx = headers.indexOf('numero_tarefa');
    const titleIdx = headers.indexOf('titulo');
    const materialIdx = headers.indexOf('link_material');
    const questionsIdx = headers.indexOf('link_questoes');

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = splitCSVLine(line);
      if (values.length === 0) continue;
      rows.push({
        meta_id: metaIdx !== -1 ? (values[metaIdx] || '') : '',
        numero_tarefa: numIdx !== -1 ? (parseInt(values[numIdx]) || 1) : 1,
        titulo: titleIdx !== -1 ? (values[titleIdx] || '') : '',
        link_material: materialIdx !== -1 ? (values[materialIdx] || '') : '',
        link_questoes: questionsIdx !== -1 ? (values[questionsIdx] || '') : '',
      });
    }
    return rows;
  };

  // Executa o download de um arquivo CSV exemplo estruturado
  const downloadExampleCSV = () => {
    const csvContent = "meta_id,numero_tarefa,titulo,link_material,link_questoes\n1,1,\"Direitos Individuais e Coletivos (CF Art. 5)\",\"material/art5_cf.pdf\",\"https://www.tecconcursos.com.br/cadernos/1\"\nMeta 1,2,\"Poder Constitucional de Polícia\",\"\",\"https://www.tecconcursos.com.br/cadernos/2\"\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_tarefas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Carrega e inicia upload de arquivo selecionado manualmente ou arrastado
  const handleCSVFileProcess = async (file: File) => {
    if (!selectedConcursoId) {
      toast.error('Selecione um Concurso/Edital antes de importar tarefas.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error('Erro de leitura do arquivo carregado.');
        return;
      }
      await importCSVData(text);
    };
    reader.readAsText(file, 'utf-8');
  };

  // Efetua importação em lote e relacionamento automático de metas no Supabase
  const importCSVData = async (csvText: string) => {
    try {
      setIsImportingCSV(true);
      const parsedRows = parseCSV(csvText);

      if (parsedRows.length === 0) {
        toast.error('Arquivo vazio ou cabeçalhos inválidos. Baixe o modelo e verifique.');
        return;
      }

      toast.info(`Iniciando importação de ${parsedRows.length} tarefas...`);

      // Cópia local de metas para consultar e atualizar se criarmos metadados dinâmicos
      const currentMetas = [...metas];
      const tarefasToInsert = [];

      for (const row of parsedRows) {
        const csvMetaField = row.meta_id ? row.meta_id.trim() : '';
        if (!csvMetaField) {
          throw new Error('Campo "meta_id" ausente ou em branco no CSV.');
        }

        // 1. Tentar localizar nos registros carregados do banco
        let matchedMeta = currentMetas.find(m => m.id === csvMetaField);

        // 2. Se não achou, tentar parear pela ordem numérica da meta
        if (!matchedMeta) {
          const mOrder = parseInt(csvMetaField);
          if (!isNaN(mOrder)) {
            matchedMeta = currentMetas.find(m => m.ordem === mOrder);
          }
        }

        // 3. Se não achou, tentar parear pelo nome da meta de modo insensível à caixa
        if (!matchedMeta) {
          const sanitizedCsvMeta = csvMetaField.toLowerCase().replace(/^meta\s*/, '').trim();
          matchedMeta = currentMetas.find(m => {
            const sanitizedMetaName = m.nome_meta.toLowerCase().replace(/^meta\s*/, '').trim();
            return sanitizedMetaName === sanitizedCsvMeta || m.nome_meta.toLowerCase() === csvMetaField.toLowerCase();
          });
        }

        let resolvedMetaId = '';

        if (matchedMeta) {
          resolvedMetaId = matchedMeta.id;
        } else {
          // Criar meta dinamicamente para o Concurso/Edital atual
          const newMetaName = csvMetaField.toLowerCase().startsWith('meta') ? csvMetaField : `Meta ${csvMetaField}`;
          const newMetaOrdem = parseInt(csvMetaField) || (currentMetas.length + 1);

          const { data: newMeta, error: metaErr } = await supabase
            .from('metas')
            .insert({
              concurso_id: selectedConcursoId,
              nome_meta: newMetaName,
              ordem: newMetaOrdem
            })
            .select()
            .single();

          if (metaErr || !newMeta) {
            throw new Error(`Falha ao registrar nova Meta "${newMetaName}" de forma automática: ${metaErr?.message || 'Erro desconhecido'}`);
          }

          resolvedMetaId = newMeta.id;
          currentMetas.push(newMeta);
        }

        tarefasToInsert.push({
          meta_id: resolvedMetaId,
          numero_tarefa: row.numero_tarefa,
          titulo: row.titulo,
          link_material: row.link_material,
          link_questoes: row.link_questoes,
          concurso_id: selectedConcursoId
        });
      }

      // Bulk Insert no Supabase
      let finalInsertError = null;
      const { error: firstAttemptError } = await supabase
        .from('tarefas')
        .insert(tarefasToInsert);

      if (firstAttemptError) {
        // Fallback robusto se concurso_id não estiver presente na tabela do Supabase de tarefas (erro de coluna ausente)
        if (firstAttemptError.message?.includes('column') || firstAttemptError.code === '42703') {
          const fallbackPayload = tarefasToInsert.map(({ concurso_id, ...rest }) => rest);
          const { error: secondAttemptError } = await supabase
            .from('tarefas')
            .insert(fallbackPayload);
          finalInsertError = secondAttemptError;
        } else {
          finalInsertError = firstAttemptError;
        }
      }

      if (finalInsertError) {
        throw finalInsertError;
      }

      toast.success(`${tarefasToInsert.length} tarefas integradas com sucesso!`);
      // Recarrega listagem atualizada de forma fluida
      await loadMetasAndTasks(selectedConcursoId);

    } catch (err: any) {
      console.error('Falha na importação CSV:', err.message || err);
      toast.error(`Falha ao realizar a importação: ${err.message || err}`);
    } finally {
      setIsImportingCSV(false);
    }
  };

  // =============================================================
  // LÓGICA DE ACOMPANHAMENTO DE MENTORIA (PROFESSOR)
  // =============================================================

  // Executa o recarregamento automático dos alunos ao selecionar a aba correspondente
  useEffect(() => {
    if (isAuthorized && activeTab === 'mentoria') {
      fetchStudents();
    }
  }, [isAuthorized, activeTab]);

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) throw error;
      setStudents(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar alunos:', err);
      toast.error('Erro ao carregar lista de alunos do Supabase.');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Classificador dinâmico de disciplinas baseado no título da tarefa e nome da meta
  const matchDiscipline = (title: string, metaName: string = ''): string => {
    const t = (title + ' ' + metaName).toLowerCase();
    
    if (t.includes('português') || t.includes('portugues') || t.includes('língua') || t.includes('lingua') || t.includes('redação') || t.includes('sintaxe') || t.includes('crase') || t.includes('morfologia') || t.includes('ortografia') || t.includes('concordância')) {
      return 'Língua Portuguesa';
    }
    if (t.includes('constitucional') || t.includes('cf art') || t.includes('art. 5') || t.includes('direitos individuais') || t.includes('poder constituinte') || t.includes('direitos fundamentais')) {
      return 'Direito Constitucional';
    }
    if (t.includes('administrativo') || t.includes('licitação') || t.includes('agente público') || t.includes('improbidade') || t.includes('servidor') || t.includes('parcerias') || t.includes('atos administrativos') || t.includes('poder de polícia')) {
      return 'Direito Administrativo';
    }
    if (t.includes('penal') || t.includes('crime') || t.includes('punibilidade') || t.includes('legítima defesa') || t.includes('cpp')) {
      return 'Direito Penal / Processo Penal';
    }
    if (t.includes('civil') || t.includes('contratos') || t.includes('família') || t.includes('sucessões')) {
      return 'Direito Civil / Processo Civil';
    }
    if (t.includes('tributário') || t.includes('tributario') || t.includes('impostos') || t.includes('finanças')) {
      return 'Direito Tributário';
    }
    if (t.includes('informática') || t.includes('informatica') || t.includes('planilha') || t.includes('excel') || t.includes('windows') || t.includes('internet') || t.includes('segurança')) {
      return 'Informática';
    }
    if (t.includes('raciocínio') || t.includes('raciocinio') || t.includes('matemática') || t.includes('matematica') || t.includes('lógica') || t.includes('logica') || t.includes('estatística') || t.includes('estatistica')) {
      return 'Raciocínio Lógico / Matemática';
    }
    if (t.includes('arquivologia') || t.includes('arquivo') || t.includes('documentos')) {
      return 'Arquivologia';
    }
    
    if (title.includes(':')) {
      const prefix = title.split(':')[0].trim();
      if (prefix.length > 2 && prefix.length < 30) {
        return prefix;
      }
    }
    if (title.includes(' - ')) {
      const prefix = title.split(' - ')[0].trim();
      if (prefix.length > 2 && prefix.length < 30) {
        return prefix;
      }
    }
    
    if (metaName && metaName.length > 3) {
      if (metaName.toLowerCase().startsWith('meta ')) {
        const cleanMetaName = metaName.replace(/^meta\s+\d+\s*[-:]*\s*/i, '').trim();
        if (cleanMetaName) return cleanMetaName;
      }
      return metaName;
    }
    return 'Conhecimentos Gerais';
  };

  // Carrega desempenho e gera estatísticas calculadas em tempo real de forma blindada
  const loadStudentPerformance = async (student: any) => {
    setSelectedStudent(student);
    setLoadingPerformance(true);
    setSelectedStudentPerformance(null);
    
    try {
      const studentId = student.id;
      // 1. Busca do progresso do usuário no user_progress do Supabase
      let { data: upData, error: upErr } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', studentId);
        
      if (!upData || upData.length === 0) {
        const { data: pData } = await supabase
          .from('progresso')
          .select('*')
          .eq('user_id', studentId);
        upData = pData || [];
      }
      
      // Tenta achar o id do concurso no perfil do aluno. Fallback para o ativo ou o primeiro cadastrado
      const studentConcursoId = student.concurso_id || selectedConcursoId || (concursos.length > 0 ? concursos[0].id : null);
      
      if (!studentConcursoId) {
        throw new Error('Nenhum edital/concurso correspondente encontrado.');
      }
      
      // 2. Busca todas as metas e tarefas do Concurso aplicável ao aluno
      const { data: mData, error: mErr } = await supabase
        .from('metas')
        .select('id, nome_meta, ordem')
        .eq('concurso_id', studentConcursoId)
        .order('ordem', { ascending: true });
        
      if (mErr) throw mErr;
      const metasArr = mData || [];
      const metaIdsArr = metasArr.map(m => m.id);
      
      let tasksArr: any[] = [];
      if (metaIdsArr.length > 0) {
        const { data: tData, error: tErr } = await supabase
          .from('tarefas')
          .select('*')
          .in('meta_id', metaIdsArr)
          .order('numero_tarefa', { ascending: true });
        if (tErr) throw tErr;
        tasksArr = tData || [];
      }
      
      const completedTaskIds = new Set(upData.map(p => p.tarefa_id));
      
      // Calcula total de Metas completadas (todas as tarefas daquela meta cumpridas)
      let completedMetasCount = 0;
      metasArr.forEach(m => {
        const metaTasks = tasksArr.filter(t => t.meta_id === m.id);
        if (metaTasks.length > 0) {
          const allCompleted = metaTasks.every(t => completedTaskIds.has(t.id));
          if (allCompleted) {
            completedMetasCount++;
          }
        }
      });
      
      const totalMetas = metasArr.length;
      const progressPercent = totalMetas > 0 ? Math.round((completedMetasCount / totalMetas) * 100) : 0;
      
      // Filtra pela tentativa mais recente por tarefa para ser fiel ao status atual
      const latestAttemptByTask: Record<string, any> = {};
      upData.forEach(p => {
        const existing = latestAttemptByTask[p.tarefa_id];
        if (!existing || (p.data_estudo && new Date(p.data_estudo) > new Date(existing.data_estudo))) {
          latestAttemptByTask[p.tarefa_id] = p;
        }
      });
      
      let totalQuestions = 0;
      let totalCorrect = 0;
      
      Object.keys(latestAttemptByTask).forEach(taskId => {
        const isTaskInConcurso = tasksArr.some(t => t.id === taskId);
        if (isTaskInConcurso) {
          const p = latestAttemptByTask[taskId];
          totalQuestions += p.total_questoes || 0;
          totalCorrect += p.acertos || 0;
        }
      });
      
      const generalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
      
      // Resumo de desempenho agrupado por Disciplina
      const disciplineStats: Record<string, { totalQ: number, correctQ: number, tasksCount: number, completedCount: number }> = {};
      
      tasksArr.forEach(t => {
        const metaOfTask = metasArr.find(m => m.id === t.meta_id);
        const disc = matchDiscipline(t.titulo, metaOfTask?.nome_meta || '');
        
        if (!disciplineStats[disc]) {
          disciplineStats[disc] = { totalQ: 0, correctQ: 0, tasksCount: 0, completedCount: 0 };
        }
        
        disciplineStats[disc].tasksCount++;
        if (completedTaskIds.has(t.id)) {
          disciplineStats[disc].completedCount++;
          const p = latestAttemptByTask[t.id];
          if (p) {
            disciplineStats[disc].totalQ += p.total_questoes || 0;
            disciplineStats[disc].correctQ += p.acertos || 0;
          }
        }
      });
      
      const disciplineResumes = Object.entries(disciplineStats).map(([name, stats]) => {
        const accuracy = stats.totalQ > 0 ? Math.round((stats.correctQ / stats.totalQ) * 100) : 0;
        const taskProgress = stats.tasksCount > 0 ? Math.round((stats.completedCount / stats.tasksCount) * 100) : 0;
        return {
          name,
          accuracy,
          totalQuestions: stats.totalQ,
          correctAnswers: stats.correctQ,
          completedTasks: stats.completedCount,
          totalTasks: stats.tasksCount,
          taskProgress
        };
      }).sort((a, b) => b.totalTasks - a.totalTasks);
      
      setSelectedStudentPerformance({
        concursoName: concursos.find(c => c.id === studentConcursoId)?.nome || 'Outro / Não Definido',
        completedMetasCount,
        totalMetas,
        progressPercent,
        generalAccuracy,
        totalQuestions,
        totalCorrect,
        disciplineResumes
      });
    } catch (err: any) {
      console.error('Erro ao calcular desempenho:', err);
      toast.error('Erro ao carregar raio-x de progresso: ' + err.message);
    } finally {
      setLoadingPerformance(false);
    }
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 pb-8 border-b border-slate-850">
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

          <div className="flex flex-wrap items-center gap-4">
            <button 
              onClick={() => setShowAddConcurso(true)}
              className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>➕ Cadastrar Novo Concurso</span>
            </button>

            <div className="relative">
              <input 
                type="file"
                id="header_csv_import"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCSVFileProcess(file);
                }}
                disabled={!selectedConcursoId || isImportingCSV}
                className="hidden"
              />
              <label 
                htmlFor="header_csv_import"
                className={`inline-flex items-center justify-center space-x-2 border-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                  !selectedConcursoId 
                    ? 'border-dashed border-slate-800 text-slate-500 bg-slate-900/40 cursor-not-allowed' 
                    : isImportingCSV
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400 border-dashed animate-pulse'
                    : 'border-dashed border-emerald-500/50 hover:border-emerald-400 hover:bg-emerald-500/10 text-emerald-400 bg-emerald-500/5 shadow-lg shadow-emerald-900/10'
                }`}
              >
                {isImportingCSV ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                )}
                <span>📥 Importar CSV</span>
              </label>
            </div>
          </div>
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

        {/* Seletor de Abas Principais em Design Premium */}
        <div className="flex border-b border-slate-800 mb-10 gap-2 relative z-10 w-full overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('editais')}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 font-black uppercase text-xs tracking-widest transition-all shrink-0 cursor-pointer ${
              activeTab === 'editais'
                ? 'border-blue-500 text-white bg-slate-900/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            } rounded-t-2xl`}
          >
            📋 Gerenciar Editais
          </button>
          <button
            onClick={() => setActiveTab('mentoria')}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 font-black uppercase text-xs tracking-widest transition-all shrink-0 cursor-pointer ${
              activeTab === 'mentoria'
                ? 'border-amber-400 text-white bg-slate-900/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            } rounded-t-2xl`}
          >
            📊 Acompanhamento da Mentoria
          </button>
        </div>

        {activeTab === 'editais' ? (
          <>
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

        {/* Bloco de Importação CSV */}
        {selectedConcursoId && (
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 mb-10 shadow-2xl relative overflow-hidden">
            {/* Gradiente sutil interno */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <span>Importação em Massa via Planilha (CSV)</span>
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Cadastre dezenas de tarefas de uma só vez vinculadas às metas correspondentes do edital
                </p>
              </div>

              <button
                type="button"
                onClick={downloadExampleCSV}
                className="bg-slate-950 hover:bg-slate-850 hover:text-white border border-slate-800 text-slate-300 font-bold px-4 py-2.5 rounded-2xl text-xs transition-colors flex items-center gap-2"
              >
                📥 Baixar Modelo CSV Padrão
              </button>
            </div>

            <div 
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleCSVFileProcess(file);
              }}
              className={`border-2 border-dashed rounded-3xl p-8 text-center flex flex-col items-center justify-center transition-all ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
              }`}
            >
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                <RefreshCw className={`w-7 h-7 ${isImportingCSV ? 'animate-spin animate-infinite' : ''}`} />
              </div>

              {isImportingCSV ? (
                <div>
                  <p className="text-sm font-bold text-white uppercase tracking-widest animate-pulse">
                    Armazenando registros no banco de dados...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Não feche esta aba. Processando e relacionando tarefas com suas metas correspondentes.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-200">
                    Arraste sua planilha .csv ou clique no seletor abaixo
                  </p>
                  <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto">
                    Certifique-se de preencher as colunas <code className="text-emerald-400 font-bold font-mono">meta_id</code>, <code className="text-emerald-400 font-bold font-mono">numero_tarefa</code>, <code className="text-emerald-400 font-bold font-mono">titulo</code>, <code className="text-emerald-400 font-bold font-mono">link_material</code>, <code className="text-emerald-400 font-bold font-mono">link_questoes</code> no modelo.
                  </p>

                  <label className="mt-5 inline-flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-6 rounded-2xl text-xs shadow-lg shadow-emerald-950/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                    Selecionar Arquivo CSV
                    <input 
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCSVFileProcess(file);
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}

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
        </>
      ) : (
          /* Aba de Acompanhamento da Mentoria */
          <div className="space-y-8 relative z-10">
            {/* Barra de Pesquisa de Alunos */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-lg relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou e-mail..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
              <div className="text-xs text-slate-400">
                Total de alunos registrados: <span className="text-white font-bold">{students.length}</span>
              </div>
            </div>

            {/* Listagem de Alunos em Tabela / Cards Ultra Premium */}
            {loadingStudents ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
                <p className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">
                  Buscando perfis dos alunos...
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="bg-slate-900 border border-slate-850 rounded-[2.5rem] p-12 text-center max-w-xl mx-auto shadow-xl">
                <Users className="w-12 h-12 text-amber-400/50 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white uppercase mb-2">Nenhum Aluno</h3>
                <p className="text-slate-400 text-sm">
                  Não existem estudantes cadastrados no banco de dados do Supabase.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                        <th className="px-6 py-5">Foto / Aluno</th>
                        <th className="px-6 py-5">Contato</th>
                        <th className="px-6 py-5">Edital Vinculado</th>
                        <th className="px-6 py-5 text-right font-bold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {students
                        .filter(s => {
                          const query = studentSearch.toLowerCase();
                          const name = (s.nome_completo || '').toLowerCase();
                          const email = (s.email || '').toLowerCase();
                          return name.includes(query) || email.includes(query);
                        })
                        .map((student) => {
                          const linkedConcurso = concursos.find(c => c.id === student.concurso_id);
                          return (
                            <tr key={student.id} className="hover:bg-slate-950/40 transition-colors">
                              <td className="px-6 py-6">
                                <div className="flex items-center space-x-4">
                                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/10 text-amber-400 flex items-center justify-center font-black text-sm uppercase">
                                    {student.nome_completo ? student.nome_completo.substring(0, 2) : 'A'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white text-sm">
                                      {student.nome_completo || 'Aluno Sem Nome'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      ID: {student.id.slice(0, 8)}...
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="text-slate-300 text-xs font-medium">{student.email}</div>
                                {student.whatsapp && (
                                  <div className="text-emerald-400 text-[10px] font-bold mt-1 tracking-wider">
                                    📞 {student.whatsapp}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-6">
                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  linkedConcurso 
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                    : 'bg-slate-950 text-slate-500 border border-slate-850'
                                }`}>
                                  {linkedConcurso ? linkedConcurso.nome : 'Nenhum Selecionado'}
                                </span>
                              </td>
                              <td className="px-6 py-6 text-right">
                                <button
                                  onClick={() => loadStudentPerformance(student)}
                                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
                                >
                                  <BarChart3 className="w-3.5 h-3.5" />
                                  <span>Visualizar Desempenho</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de Raio-X de Desempenho do Aluno (Performance Pop-up) */}
        <AnimatePresence>
          {selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedStudent(null)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8 relative z-10 scrollbar-none"
              >
                {/* Botão Fechar */}
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-850 rounded-full border border-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Cabeçalho do Raio-X */}
                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-xl uppercase border border-amber-500/20 shadow-lg">
                    {selectedStudent.nome_completo ? selectedStudent.nome_completo.substring(0, 2) : 'A'}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <span>Desempenho de {selectedStudent.nome_completo || 'Aluno'}</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">
                      {selectedStudent.email} • {selectedStudent.whatsapp || 'Sem WhatsApp informado'}
                    </p>
                  </div>
                </div>

                {loadingPerformance ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
                    <p className="text-slate-400 font-bold tracking-widest text-xs uppercase">
                      Compilando métricas e histórico detalhado...
                    </p>
                  </div>
                ) : selectedStudentPerformance ? (
                  <div className="space-y-8">
                    {/* Widgets de Métricas Rápidas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-950 border border-slate-850 p-6 rounded-3xl relative overflow-hidden">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Edital Configurado</p>
                        <p className="text-base font-black text-white mt-2 truncate">
                          {selectedStudentPerformance.concursoName}
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-6 rounded-3xl relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Metas Cumpridas no Edital</p>
                          <span className="text-xs text-slate-500 font-bold font-mono">
                            {selectedStudentPerformance.completedMetasCount}/{selectedStudentPerformance.totalMetas} metas
                          </span>
                        </div>
                        <div className="flex items-end justify-between mt-2">
                          <p className="text-3xl font-black text-amber-400">
                            {selectedStudentPerformance.progressPercent}%
                          </p>
                        </div>
                        {/* Linha de progresso */}
                        <div className="w-full bg-slate-900 rounded-full h-1.5 mt-3 overflow-hidden">
                          <div 
                            className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${selectedStudentPerformance.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-6 rounded-3xl relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Taxa Geral de Acertos</p>
                          <span className="text-xs text-slate-500 font-bold font-mono">
                            {selectedStudentPerformance.totalCorrect}/{selectedStudentPerformance.totalQuestions} questões
                          </span>
                        </div>
                        <div className="flex items-end justify-between mt-2">
                          <p className="text-3xl font-black text-emerald-400">
                            {selectedStudentPerformance.generalAccuracy}%
                          </p>
                        </div>
                        {/* Linha de acertos */}
                        <div className="w-full bg-slate-900 rounded-full h-1.5 mt-3 overflow-hidden">
                          <div 
                            className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${selectedStudentPerformance.generalAccuracy}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Desempenho por Disciplina */}
                    <div>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">
                        Resumo de Desempenho de Disciplinas
                      </h4>
                      {selectedStudentPerformance.disciplineResumes.length === 0 ? (
                        <div className="bg-slate-950/60 rounded-3xl border border-slate-850 p-8 text-center text-slate-500 text-sm">
                          Não há histórico de estudo ou questões resolvidas por este aluno.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedStudentPerformance.disciplineResumes.map((disc: any) => (
                            <div 
                              key={disc.name}
                              className="bg-slate-950/40 hover:bg-slate-950/70 transition-all border border-slate-850 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="flex-1 min-w-[200px]">
                                <div className="font-bold text-white text-sm uppercase tracking-tight truncate">
                                  {disc.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold mt-1">
                                  {disc.completedTasks} de {disc.totalTasks} tarefas concluídas ({disc.taskProgress}%)
                                </div>
                              </div>

                              {/* Barra de Progresso de Tarefas da Disciplina */}
                              <div className="w-full md:w-32">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Metas Concluídas</p>
                                <div className="w-full bg-slate-900 rounded-full h-1.5">
                                  <div 
                                    className="bg-blue-500 h-full rounded-full transition-all" 
                                    style={{ width: `${disc.taskProgress}%` }}
                                  />
                                </div>
                              </div>

                              {/* Estatística de Acertos da Disciplina */}
                              <div className="w-full md:max-w-[170px] bg-slate-950 px-4 py-2 rounded-xl flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Aproveitamento</p>
                                  <p className="text-xs text-slate-400 font-bold mt-0.5 font-mono">
                                    {disc.correctAnswers}/{disc.totalQuestions} acertos
                                  </p>
                                </div>
                                <span className={`text-base font-black ${
                                  disc.accuracy >= 80 
                                    ? 'text-emerald-400' 
                                    : disc.accuracy >= 65 
                                    ? 'text-amber-400' 
                                    : 'text-red-400'
                                }`}>
                                  {disc.accuracy}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    Ocorreu um erro ao carregar as informações estatísticas do aluno.
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
