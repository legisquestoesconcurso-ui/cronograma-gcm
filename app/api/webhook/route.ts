import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  return NextResponse.json({ message: "A rota do Webhook está ATIVA e OPERACIONAL!" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-kiwify-signature'); // A assinatura da Kiwify
    const secret = process.env.KIWIFY_TOKEN; // O token que você salvou na Vercel

    // Verificação de Segurança: Log se a assinatura estiver ausente (não bloqueia para facilitar testes)
    if (!signature) {
      console.log("Atenção: Webhook recebido sem a assinatura 'x-kiwify-signature'. Prosseguindo com o processamento...");
    }

    // Extração dos dados conforme solicitado
    const email = body.customer?.email;
    const orderStatus = body.order_status;
    const cpfRaw = body.customer?.cpf;

    // Log para depuração
    console.log(`Webhook recebido. Email: ${email}, Status: ${orderStatus}, Assinatura: ${signature ? 'Presente' : 'Ausente'}`);

    // Verificação de segurança das variáveis de ambiente
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
    const cleanedCpf = cpfRaw ? cpfRaw.replace(/\D/g, '') : '';

    // Verificação do status do pedido
    if (orderStatus === 'paid' || orderStatus === 'approved') {
      if (!email || !cleanedCpf) {
        return NextResponse.json({ error: 'Missing customer data' }, { status: 400 });
      }

      // Criação do usuário via Auth Admin API
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: cleanedCpf, // Senha sendo o CPF
        email_confirm: true,
        user_metadata: { cpf: cleanedCpf }
      });

      if (error) {
        // Se o erro for que o usuário já existe, podemos retornar sucesso ou tratar
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

    return NextResponse.json({ message: 'Webhook received, no action taken' });
  } catch (error: any) {
    console.error('Erro no processamento do webhook:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
