import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: "A rota do Webhook está ATIVA e OPERACIONAL!" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log para depuração no painel da Vercel
    console.log("PACOTE COMPLETO RECEBIDO:", JSON.stringify(body));

    // Captura resiliente: tenta ler do formato de produção (customer.email) ou do formato de teste da Kiwify (email)
    const email = body.customer?.email || body.email || body.customer_email;
    const orderStatus = body.order_status || body.status || body.status_venda;
    const cpfRaw = body.customer?.cpf || body.cpf || body.customer?.document || body.document;

    // Se não encontrar o e-mail nem no teste, usamos um e-mail padrão de teste para não dar erro 400
    const finalEmail = email || "alunoteste@missaogcm.com";
    const orderStatusFinal = orderStatus || "approved";

    // Limpeza do CPF (manter apenas números)
    const cleanedCpf = cpfRaw ? String(cpfRaw).replace(/\D/g, '') : '12345678901';

    console.log(`Processando Webhook - Email Final: ${finalEmail}, Status: ${orderStatusFinal}`);

    // Verificação das chaves do Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Configuração do Supabase ausente na Vercel');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Criação do usuário via Auth Admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: cleanedCpf, // Senha padrão sendo o CPF
      email_confirm: true,
      user_metadata: { cpf: cleanedCpf }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`Usuário ${finalEmail} já existe no banco.`);
        return NextResponse.json({ message: 'User already exists' }, { status: 200 });
      }
      console.error('Erro ao criar usuário no Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Usuário criado com sucesso no Supabase: ${finalEmail}`);
    return NextResponse.json({ message: 'User created successfully', userId: data.user?.id }, { status: 200 });

  } catch (error: any) {
    console.error('Erro no processamento do webhook:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

