import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  return NextResponse.json({ message: "A rota do Webhook está ATIVA e OPERACIONAL!" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log detalhado para depuração no painel da Vercel
    console.log("PACOTE COMPLETO RECEBIDO DO WEBHOOK KIWIFY:", JSON.stringify(body));

    // 1. MAPEAMENTO DE STATUS:
    // Aceita se webhook_event_type === "order_approved" OU se order_status === "paid"
    const webhookEventType = body.webhook_event_type;
    const orderStatus = 
      body.order_status || 
      body.status || 
      body.status_venda || 
      body.order?.order_status;

    const isApproved = 
      webhookEventType === "order_approved" || 
      orderStatus === "paid" || 
      orderStatus === "approved";

    console.log(`Validação de Status - Evento: "${webhookEventType}", Status: "${orderStatus}" -> Aprovado? ${isApproved}`);

    if (!isApproved) {
      console.log("Evento ignorado: Não é de compra aprovada ou paga.");
      return NextResponse.json({ 
        message: 'Evento recebido, mas ignorado por não possuir status pago/aprovado.',
        event: webhookEventType,
        status: orderStatus
      }, { status: 200 });
    }

    // 2. DADOS DO CLIENTE (FALLBACK COMPLETO E RESILIENTE):
    // Garante compatibilidade tanto com compras de assinatura (order.Customer.*) quanto normais (customer.*) ou raiz
    const email = 
      body.order?.Customer?.email || 
      body.customer?.email || 
      body.email || 
      body.customer_email || 
      body.order?.customer?.email ||
      body.Customer?.email;

    const cpfRaw = 
      body.order?.Customer?.CPF || 
      body.order?.Customer?.cpf || 
      body.customer?.cpf || 
      body.cpf || 
      body.customer?.document || 
      body.document || 
      body.order?.customer?.cpf ||
      body.Customer?.CPF ||
      body.Customer?.cpf;

    const name = 
      body.order?.Customer?.full_name || 
      body.customer?.full_name || 
      body.customer?.name || 
      body.name || 
      body.order?.customer?.full_name ||
      body.Customer?.full_name;

    const phone =
      body.order?.Customer?.mobile ||
      body.order?.Customer?.phone ||
      body.customer?.mobile ||
      body.customer?.phone ||
      body.whatsapp ||
      body.phone ||
      body.Customer?.mobile ||
      body.Customer?.phone;

    const finalEmail = email ? email.trim() : null;
    const finalName = name ? name.trim() : null;
    const finalPhone = phone ? String(phone).trim() : null;

    if (!finalEmail) {
      console.error("Erro: E-mail não encontrado no payload do webhook.");
      return NextResponse.json({ error: "E-mail do cliente não fornecido" }, { status: 400 });
    }

    // Limpeza de CPF para conter apenas números
    const cleanedCpf = cpfRaw ? String(cpfRaw).replace(/\D/g, '') : '';
    // Senha padrão é o CPF limpo ou fallback seguro
    const password = cleanedCpf || "gcm123456";

    console.log(`Processando cadastro - E-mail: ${finalEmail}, Nome: ${finalName}, CPF: ${cleanedCpf ? "Encontrado" : "Não Encontrado"}`);

    // Inicialização segura do cliente Admin do Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Configuração de credenciais do Supabase ausente na Vercel (.env)");
      return NextResponse.json({ error: "Internal server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 3. CRIAÇÃO / ATUALIZAÇÃO NO SUPABASE:
    let userId = "";

    // Primeiro, verifica de forma resiliente na tabela profiles se o email já existe
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', finalEmail)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
      console.log(`Aluno ${finalEmail} já existe na tabela de perfis (profiles) com o ID: ${userId}`);
    } else {
      // Tentar criar a conta de Autenticação com o e-mail do aluno
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: finalEmail,
          password: password,
          email_confirm: true,
          user_metadata: { cpf: cleanedCpf, nome: finalName }
        });

        if (authError) {
          throw authError;
        }
        userId = authData.user?.id || "";
      } catch (authErr: any) {
        console.log(`Criação direta falhou ou usuário já cadastrado: ${authErr?.message || authErr}. Buscando ID por e-mail...`);
        
        try {
          // Busca resiliente do usuário listando no Auth como fallback absoluto
          const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (!listError && userList?.users) {
            const existingUser = userList.users.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());
            if (existingUser) {
              userId = existingUser.id;
              console.log(`Usuário encontrado com ID resgatado: ${userId}`);
            }
          }
        } catch (listErr: any) {
          console.error("Falha ao tentar listar usuários do Auth como fallback:", listErr.message);
        }

        // Se após o fallback ainda não tivermos o ID, lançamos erro explicativo
        if (!userId) {
          console.error("Erro crítico: falha no Auth de cadastro e impossível recuperar ID existente.");
          return NextResponse.json({ error: authErr?.message || "Erro no Auth e usuário não retornado" }, { status: 500 });
        }
      }
    }

    if (!userId) {
      console.error("Não foi possível resolver o ID do usuário cadastrado.");
      return NextResponse.json({ error: "User ID resolution failed" }, { status: 500 });
    }

    // Busca dinâmica do edital/concurso padrão (Pré-Edital) na tabela "concursos"
    const { data: concursosData } = await supabaseAdmin
      .from('concursos')
      .select('id, nome');

    let defaultConcursoId = null;
    if (concursosData && concursosData.length > 0) {
      const found = concursosData.find(c => {
        const n = c.nome.toLowerCase();
        return n.includes('pré-edital') || n.includes('pre-edital') || n.includes('geral');
      });
      defaultConcursoId = found ? found.id : concursosData[0].id;
    }

    console.log(`Vinculando edital padrão de ID: ${defaultConcursoId}`);

    // 4. INSERÇÃO/ATUALIZAÇÃO DE PERFIL RESILIENTE (TOLERÂNCIA A FALHAS DE ESQUEMA/COLUNA):
    // Tentamos salvar o pacote de dados completo e regredimos sequencialmente até o básico em caso de erros de coluna (ex: concurso_id ausente)
    const payloads = [
      // Tentativa 1: Esquema completo com concurso_id e nome_completo
      {
        id: userId,
        email: finalEmail,
        nome_completo: finalName || finalEmail.split('@')[0],
        whatsapp: finalPhone,
        concurso_id: defaultConcursoId,
        updated_at: new Date().toISOString()
      },
      // Tentativa 2: Nome do campo "concurso" alternativo (concurso)
      {
        id: userId,
        email: finalEmail,
        nome_completo: finalName || finalEmail.split('@')[0],
        whatsapp: finalPhone,
        concurso: defaultConcursoId,
        updated_at: new Date().toISOString()
      },
      // Tentativa 3: Básico com nome_completo e whatsapp (Removendo colunas de concurso caso causem erro 500)
      {
        id: userId,
        email: finalEmail,
        nome_completo: finalName || finalEmail.split('@')[0],
        whatsapp: finalPhone,
        updated_at: new Date().toISOString()
      },
      // Tentativa 4: Básico com nome e whatsapp
      {
        id: userId,
        email: finalEmail,
        nome: finalName || finalEmail.split('@')[0],
        whatsapp: finalPhone,
        updated_at: new Date().toISOString()
      },
      // Tentativa 5: Mínimo Absoluto
      {
        id: userId,
        email: finalEmail
      }
    ];

    let upsertWorked = false;
    let lastUpsertError = null;

    for (let i = 0; i < payloads.length; i++) {
      const payload = payloads[i];
      console.log(`Tentativa de sincronização de perfil (Tentativa ${i + 1}/${payloads.length}) com chaves: ${Object.keys(payload).join(', ')}`);
      
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (!profileError) {
        console.log(`Sucesso absoluto na salvaguarda do perfil (Tentativa ${i + 1})!`);
        upsertWorked = true;
        break;
      } else {
        console.warn(`Tentativa ${i + 1} de upsert falhou: ${profileError.message}`);
        lastUpsertError = profileError;
      }
    }

    if (!upsertWorked) {
      console.error("Todas as tentativas de inserção no perfil profiles falharam:", lastUpsertError?.message);
      return NextResponse.json({ error: "Erro ao gerar perfil de aluno: " + (lastUpsertError?.message || "Falha nas chaves de banco de dados") }, { status: 500 });
    }

    console.log(`Webhook processado com absoluto sucesso para o aluno: ${finalEmail} (${userId})`);
    return NextResponse.json({ 
      message: 'Aluno criado e perfil ativado com sucesso!', 
      userId,
      email: finalEmail,
      nome: finalName
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro crítico processando webhook da Kiwify:", error.message);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
