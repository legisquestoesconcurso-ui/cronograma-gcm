import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: "A rota do Webhook está ATIVA e OPERACIONAL!" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. RADAR DE INSPEÇÃO: Mostra o pacote inteiro no log da Vercel para sabermos o que veio
    console.log("PACOTE COMPLETO DA KIWIFY:", JSON.stringify(body));

    // 2. EXTRATOR INTELIGENTE: Pega os dados no formato real E no formato de teste
    const email = body.customer?.email || body.email;
    const orderStatus = body.order_status || body.status;
    const cpfRaw = body.customer?.cpf || body.cpf || body.customer?.document || body.document;
    const signature = request.headers.get('x-kiwify-signature');

    console.log(`Dados extraídos - Email: ${email}, Status: ${orderStatus}, Assinatura: ${signature ? 'Presente' : 'Ausente'}`);

    // 3. VERIFICAÇÃO DE DADOS MÍNIMOS: Se não houver e-mail, o processo para aqui
    if (!email) {
      console.error("Erro: Email não localizado no corpo da requisição.");
      return NextResponse.json({ error: 'Falta o e-mail do aluno' }, { status: 400 });
    }

    // Limpeza rápida do CPF (mantém apenas números)
    const cleanedCpf = cpfRaw ? String(cpfRaw).replace(/\D/g, '') : '';

    // 4. VERIFICAÇÃO DE STATUS: Aceita aprovado, pago ou o padrão de teste da Kiwify
    if (orderStatus === 'paid' || orderStatus === 'approved' || orderStatus === 'completed') {
      
      // Se for teste da Kiwify e não vier CPF, colocamos uma senha padrão para o teste passar
      const finalPassword = cleanedCpf || "gcm123456"; 

      console.log(`Iniciando conexão com o Supabase para o e-mail: ${email}`);

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Configuração do Supabase ausente nas variáveis de ambiente');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Criação do usuário via Auth Admin API
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { cpf: cleanedCpf }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`Usuário ${email} já existe no banco.`);
          return NextResponse.json({ message: 'User already exists' }, { status: 200 });
        }
        console.error('Erro no Supabase ao criar usuário:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log(`Sucesso total! Usuário criado com ID: ${data.user?.id}`);
      return NextResponse.json({ message: 'User created successfully', userId: data.user?.id }, { status: 200 });
    }

    console.log(`Status recebido não exige ação: ${orderStatus}`);
    return NextResponse.json({ message: 'Status nao processável', status: orderStatus });

  } catch (error: any) {
    console.error('Erro Fatal no Webhook:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

