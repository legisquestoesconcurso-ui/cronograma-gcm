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

    const finalEmail = email ? email.trim() : null;
    const finalName = name ? name.trim() : null;

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

    // Tentar criar a conta de Autenticação com o e-mail do aluno
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: password,
      email_confirm: true,
      user_metadata: { cpf: cleanedCpf, nome: finalName }
    });

    if (authError) {
      // Se já houver cadastro, recuperamos o Id dele para ativar ou atualizar seu perfil
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log(`Aluno ${finalEmail} já possui cadastro no Auth. Buscando ID...`);
        const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (!listError && userList?.users) {
          const existingUser = userList.users.find(u => u.email?.toLowerCase() === finalEmail.toLowerCase());
          if (existingUser) {
            userId = existingUser.id;
          }
        }
      } else {
        console.error("Erro ao registrar novo aluno no Supabase Auth:", authError.message);
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
    } else {
      userId = authData.user?.id || "";
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

    // Insere ou atualiza o perfil (tabela "profiles") do aluno marcando-o como ativo
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: finalEmail,
        nome_completo: finalName || finalEmail.split('@')[0],
        status_assinatura: true,
        subscription_status: 'active',
        // Data limite em formato string válido (ex: 1 ano de acesso estipulado)
        data_limite: '2027-12-31', 
        concurso_id: defaultConcursoId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      console.error("Erro ao salvar cadastro do aluno na tabela 'profiles':", profileError.message);
      return NextResponse.json({ error: "Erro ao gerar perfil de aluno: " + profileError.message }, { status: 500 });
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
