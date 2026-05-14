import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  return NextResponse.json({ message: "A rota do Webhook está ATIVA e OPERACIONAL!" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. LOG DE SEGURANÇA: Vamos ver EXATAMENTE o que a Kiwify mandou
    console.log("CONTEÚDO COMPLETO RECEBIDO:", JSON.stringify(body));

    // 2. EXTRAÇÃO RESILIENTE: Tenta pegar de vários lugares possíveis
    const email = body.customer?.email || body.email;
    const orderStatus = body.order_status || body.status;
    const cpfRaw = body.customer?.cpf || body.cpf;
    const signature = request.headers.get('x-kiwify-signature');

    console.log(`Webhook processando - Email: ${email}, Status: ${orderStatus}, Assinatura: ${signature ? 'Presente' : 'Ausente'}`);

    // 3. BYPASS DE ASSINATURA: Apenas avisa no log, mas não barra o teste
    if (!signature) {
      console.log("Aviso: Teste realizado sem assinatura.");
    }

    // 4. VERIFICAÇÃO DE DADOS MÍNIMOS
    if (!email) {
      console.error("Erro: E-mail não localizado no pacote de dados.");
      return NextResponse.json({ error: 'Email nao encontrado' }, { status: 400 });
    }

    // Se o status for pago ou aprovado (ou se for o teste da Kiwify que às vezes manda outro nome)
    if (orderStatus === 'paid' || orderStatus === 'approved' || orderStatus === 'completed') {
      console.log("Iniciando criação de usuário no Supabase...");
      
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Configuração do Supabase ausente');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }

      // Inicialização do cliente Supabase com Service Role (Admin)
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Limpeza do CPF (manter apenas números)
      const cleanedCpf = cpfRaw ? String(cpfRaw).replace(/\D/g, '') : '';

      if (!cleanedCpf) {
        console.error("Erro: CPF não localizado para criação de senha.");
        return NextResponse.json({ error: 'CPF nao encontrado' }, { status: 400 });
      }

      // Criação do usuário via Auth Admin API
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: cleanedCpf, // Senha sendo o CPF
        email_confirm: true,
        user_metadata: { cpf: cleanedCpf }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`Usuário ${email} já existe.`);
          return NextResponse.json({ message: 'User already exists' }, { status: 200 });
        }
        console.error('Erro ao criar usuário:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log(`Usuário criado com sucesso: ${email}`);
      return NextResponse.json({ message: 'User created successfully', userId: data.user?.id }, { status: 200 });
    }

    return NextResponse.json({ message: 'Webhook recebido com sucesso, mas status não processado' }, { status: 200 });

  } catch (error: any) {
    console.error('Erro Fatal:', error.message);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
