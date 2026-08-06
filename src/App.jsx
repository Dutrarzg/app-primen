import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import logoPrimen from './assets/logo-primen.png';
import videoAbertura from './assets/abertura.mp4';

const gradeSemana = {
  periodos: [
    ['09:00','09:15','09:30','09:45','10:00','10:15','10:30','10:45','11:00','11:15','11:30','11:45'],
    ['12:00','12:15','12:30','14:20','14:35','14:50','15:05','15:20','15:35','15:50','16:05','16:20','16:35','16:50'],
    ['17:05','17:20','17:35','17:50','18:05','18:20','18:35','18:50'],
  ],
  nomes: ['Manhã', 'Tarde', 'Noite'],
};
const gradeSabado = {
  periodos: [
    ['07:00','07:15','07:30','07:45','08:00','08:15','08:30','08:45','09:00','09:15','09:30','09:45','10:00','10:15','10:30','10:45','11:00','11:15','11:30','11:45'],
    ['12:00','12:15','12:30','14:20','14:35','14:50','15:05','15:20','15:35','15:50','16:05','16:20'],
  ],
  nomes: ['Manhã', 'Tarde'],
};

function gerarHorarios(inicioH, inicioM, fimH, fimM) {
  const lista = [];
  let h = inicioH, m = inicioM;
  while (h < fimH || (h === fimH && m <= fimM)) {
    lista.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 15;
    if (m >= 60) { m = 0; h += 1; }
  }
  return lista;
}

const gradeSegundaPorBarbeiro = {
  'Luiz Guilherme': { periodos: [gerarHorarios(15, 0, 18, 0)], nomes: ['Tarde'] },
  'Rennan Martins': { periodos: [gerarHorarios(12, 0, 20, 0)], nomes: ['Dia todo'] },
};

const OURO = '#C9A227';
const WHATSAPP_BARBEARIA = '5532984079998';

const CLUB = {
  chamada: 'Primeira barbearia por assinatura em São Geraldo!',
  planos: [
    { id: 'corte', nome: 'Corte Club', preco: '99,99', vantagens: ['Acesso à agenda mensal de seg a qui', 'Corte ilimitado', 'Desconto de 10% em produtos'] },
    { id: 'corte_barba', nome: 'Corte e Barba Club', preco: '149,99', vantagens: ['Acesso à agenda mensal de seg a qui', 'Corte ilimitado', 'Barba ilimitada', 'Desconto de 10% em produtos'] },
  ],
  dias: ['SEG', 'TER', 'QUA', 'QUI'],
};

function dataParaISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarTelefone(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums.length ? `(${nums}` : '';
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function formatarReal(valor) {
  return Number(valor).toFixed(2).replace('.', ',');
}

function AvatarBarbeiro({ barbeiro, tamanho = 34 }) {
  const iniciais = barbeiro.nome.split(' ').map(w => w[0]).slice(0, 2).join('');
  if (barbeiro.foto_url) {
    return (<img src={barbeiro.foto_url} alt={barbeiro.nome} style={{ width: tamanho, height: tamanho, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />);
  }
  return (
    <div style={{ width: tamanho, height: tamanho, borderRadius: '50%', background: '#C9A227', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d0d0d', fontWeight: 600, fontSize: tamanho * 0.4, flexShrink: 0 }}>
      {iniciais}
    </div>
  );
}

function App() {
  const [modo, setModo] = useState('cliente');
  const [mostrarAbertura, setMostrarAbertura] = useState(true);

  const [tela, setTela] = useState('login');
  const [clienteLogado, setClienteLogado] = useState(null);
  const [loginTel, setLoginTel] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [cadastroNome, setCadastroNome] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [processandoLogin, setProcessandoLogin] = useState(false);

  const [servicos, setServicos] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [etapa, setEtapa] = useState('servico');
  const [servicoEscolhido, setServicoEscolhido] = useState(null);
  const [barbeiroEscolhido, setBarbeiroEscolhido] = useState(null);

  const hoje = new Date();
  const [mesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [dataEscolhida, setDataEscolhida] = useState(null);
  const [periodoEscolhido, setPeriodoEscolhido] = useState(0);
  const [horarioEscolhido, setHorarioEscolhido] = useState(null);
  const [horariosOcupados, setHorariosOcupados] = useState([]);
  const [diaFechadoCliente, setDiaFechadoCliente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');

  const [clubPlano, setClubPlano] = useState(null);
  const [clubBarbeiro, setClubBarbeiro] = useState(null);
  const [vagasUsadas, setVagasUsadas] = useState({});
  const [processandoClub, setProcessandoClub] = useState(false);

  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [dataDono, setDataDono] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  const [agendaDoDia, setAgendaDoDia] = useState([]);
  const [bloqueiosDoDia, setBloqueiosDoDia] = useState([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);
  const [membrosClub, setMembrosClub] = useState([]);
  const [mostrarMembros, setMostrarMembros] = useState(false);

  const [mostrarFormManual, setMostrarFormManual] = useState(false);
  const [manualNome, setManualNome] = useState('');
  const [manualTel, setManualTel] = useState('');
  const [manualServico, setManualServico] = useState('');
  const [manualBarbeiro, setManualBarbeiro] = useState('');
  const [manualHorario, setManualHorario] = useState('');
  const [erroManual, setErroManual] = useState('');

  const [mostrarFormBloqueio, setMostrarFormBloqueio] = useState(false);
  const [bloqueioBarbeiro, setBloqueioBarbeiro] = useState('todos');
  const [bloqueioMotivo, setBloqueioMotivo] = useState('');

  // ===== PRODUTOS =====
  const [produtos, setProdutos] = useState([]);
  const [mostrarProdutos, setMostrarProdutos] = useState(false);
  const [mostrarFormProduto, setMostrarFormProduto] = useState(false);
  const [prodNome, setProdNome] = useState('');
  const [prodPreco, setProdPreco] = useState('');
  const [prodEstoque, setProdEstoque] = useState('');
  const [prodEditandoId, setProdEditandoId] = useState(null);
  const [erroProduto, setErroProduto] = useState('');
  // Venda de produto
  const [vendaProduto, setVendaProduto] = useState(null); // produto sendo vendido
  const [vendaQtd, setVendaQtd] = useState('1');
  const [erroVenda, setErroVenda] = useState('');

  // ===== FECHAR CAIXA (atendimentos) =====
  const [pagamentoAg, setPagamentoAg] = useState(null); // agendamento sendo pago
  const [pagamentoValor, setPagamentoValor] = useState('');
  const [agsPagos, setAgsPagos] = useState([]); // ids de agendamentos já pagos hoje

  // ===== FINANCEIRO =====
  const [mostrarFinanceiro, setMostrarFinanceiro] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [finAba, setFinAba] = useState('geral'); // geral | barbeiro | club | produtos
  const [finPeriodo, setFinPeriodo] = useState('dia'); // dia | mes
  // Lançamento manual do Club
  const [mostrarFormClubPag, setMostrarFormClubPag] = useState(false);
  const [clubPagValor, setClubPagValor] = useState('');
  const [clubPagDesc, setClubPagDesc] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setMostrarAbertura(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function buscarDados() {
      const { data: servicosData } = await supabase.from('servicos').select('*').order('preco', { ascending: true });
      const { data: barbeirosData } = await supabase.from('barbeiros').select('*').eq('ativo', true);
      setServicos(servicosData || []);
      setBarbeiros(barbeirosData || []);
      setCarregando(false);
    }
    buscarDados();
    const telSalvo = localStorage.getItem('primen_tel');
    if (telSalvo) setLoginTel(telSalvo);
  }, []);

  const servicosAgendaveis = servicos.filter((s) => !s.nome.toLowerCase().includes('club'));

  function gradeDoDia(data) {
    const dow = data.getDay();
    if (dow === 6) return gradeSabado;
    if (dow === 1) {
      if (!barbeiroEscolhido || barbeiroEscolhido.semPref) return { precisaBarbeiro: true };
      const g = gradeSegundaPorBarbeiro[barbeiroEscolhido.nome];
      return g || { naoAtende: true };
    }
    return gradeSemana;
  }

  function diasDoMes() {
    const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const celulas = [];
    for (let i = 0; i < primeiroDia; i++) celulas.push(null);
    for (let d = 1; d <= totalDias; d++) celulas.push(new Date(ano, mes, d));
    return celulas;
  }
  function ehPassado(data) {
    const zero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return data < zero;
  }

  async function tentarEntrar() {
    setErroLogin('');
    if (!loginTel.trim() || !loginSenha.trim()) { setErroLogin('Preencha telefone e senha.'); return; }
    setProcessandoLogin(true);
    const { data: cliente } = await supabase.from('clientes').select('*').eq('telefone', loginTel.trim()).maybeSingle();
    setProcessandoLogin(false);
    if (!cliente) { setTela('cadastro'); return; }
    if (cliente.senha !== loginSenha.trim()) { setErroLogin('Senha incorreta.'); return; }
    localStorage.setItem('primen_tel', loginTel.trim());
    setClienteLogado(cliente);
    setTela('menu');
  }

  async function cadastrar() {
    setErroLogin('');
    if (!cadastroNome.trim()) { setErroLogin('Digite seu nome.'); return; }
    setProcessandoLogin(true);
    const { data: novo, error } = await supabase.from('clientes')
      .insert({ nome: cadastroNome.trim(), telefone: loginTel.trim(), senha: loginSenha.trim() }).select().single();
    setProcessandoLogin(false);
    if (error) { setErroLogin('Erro ao cadastrar. Tente outro número.'); return; }
    localStorage.setItem('primen_tel', loginTel.trim());
    setClienteLogado(novo);
    setCadastroNome('');
    setTela('menu');
  }

  function sairDaConta() {
    setClienteLogado(null);
    setLoginSenha('');
    setTela('login');
  }

  async function abrirClub() {
    setClubPlano(null);
    setClubBarbeiro(null);
    setTela('club');
    const { data: membros } = await supabase.from('clientes').select('club_barbeiro_id').eq('membro_club', true);
    const contagem = {};
    (membros || []).forEach((m) => {
      if (m.club_barbeiro_id) contagem[m.club_barbeiro_id] = (contagem[m.club_barbeiro_id] || 0) + 1;
    });
    setVagasUsadas(contagem);
  }

  async function confirmarAssinaturaClub() {
    if (!clubPlano || !clubBarbeiro) return;
    setProcessandoClub(true);
    const planoNome = CLUB.planos.find((p) => p.id === clubPlano)?.nome;
    await supabase.from('clientes').update({
      membro_club: true, club_plano: planoNome, club_barbeiro_id: clubBarbeiro.id,
    }).eq('id', clienteLogado.id);
    setProcessandoClub(false);
    setClienteLogado({ ...clienteLogado, membro_club: true, club_plano: planoNome, club_barbeiro_id: clubBarbeiro.id });
  }

  function whatsClub() {
    window.open(`https://wa.me/${WHATSAPP_BARBEARIA}?text=Ol%C3%A1! Tenho interesse no Club Primen. Pode me passar os detalhes?`, '_blank');
  }

  async function escolherData(data) {
    setDataEscolhida(data);
    setPeriodoEscolhido(0);
    setHorarioEscolhido(null);
    setHorariosOcupados([]);
    setDiaFechadoCliente(false);
    const dataISO = dataParaISO(data);
    const { data: bloqueios } = await supabase.from('dias_bloqueados').select('barbeiro_id').eq('data', dataISO);
    if (bloqueios && bloqueios.length > 0) {
      const barbeiroId = barbeiroEscolhido && !barbeiroEscolhido.semPref ? barbeiroEscolhido.id : null;
      const fechadoGeral = bloqueios.some((b) => b.barbeiro_id === null);
      const fechadoDele = barbeiroId && bloqueios.some((b) => b.barbeiro_id === barbeiroId);
      if (fechadoGeral || fechadoDele) { setDiaFechadoCliente(true); return; }
    }
    let query = supabase.from('agendamentos').select('horario, barbeiro_id').eq('data', dataISO).neq('status', 'cancelado');
    if (barbeiroEscolhido && !barbeiroEscolhido.semPref) query = query.eq('barbeiro_id', barbeiroEscolhido.id);
    const { data: ocupados } = await query;
    if (ocupados) setHorariosOcupados(ocupados.map((o) => o.horario.slice(0, 5)));
  }

  async function confirmarAgendamento() {
    setErroSalvar('');
    setSalvando(true);
    const { error: erroAg } = await supabase.from('agendamentos').insert({
      cliente_id: clienteLogado.id, barbeiro_id: barbeiroEscolhido?.id || null, servico_id: servicoEscolhido.id,
      data: dataParaISO(dataEscolhida), horario: horarioEscolhido, status: 'confirmado', origem: 'cliente',
    });
    setSalvando(false);
    if (erroAg) { setErroSalvar('Esse horário já foi reservado. Escolha outro.'); return; }
    setEtapa('sucesso');
  }

  function recomecarAgendamento() {
    setEtapa('servico'); setServicoEscolhido(null); setBarbeiroEscolhido(null);
    setDataEscolhida(null); setHorarioEscolhido(null); setPeriodoEscolhido(0);
    setHorariosOcupados([]); setErroSalvar(''); setDiaFechadoCliente(false);
  }

  function abrirWhatsApp() {
    const dataTexto = dataEscolhida?.toLocaleDateString('pt-BR');
    const msg = `Olá! Acabei de agendar pelo app:%0A%0A*${servicoEscolhido?.nome}*%0Acom ${barbeiroEscolhido?.nome}%0A${dataTexto} às ${horarioEscolhido}%0A%0AMeu nome: ${clienteLogado?.nome}%0AConfirmo minha presença!`;
    window.open(`https://wa.me/${WHATSAPP_BARBEARIA}?text=${msg}`, '_blank');
  }

  async function entrarComoDono() {
    setErroSenha('');
    const { data } = await supabase.from('config').select('valor').eq('chave', 'senha_dono').single();
    if (data && data.valor === senhaDigitada) {
      setModo('dono');
      carregarAgenda(dataDono);
    } else {
      setErroSenha('Senha incorreta.');
    }
  }

  async function carregarAgenda(data) {
    setCarregandoAgenda(true);
    const dataISO = dataParaISO(data);
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('id, horario, status, origem, servico_id, barbeiro_id, clientes(nome, telefone), servicos(nome, preco), barbeiros(nome)')
      .eq('data', dataISO).neq('status', 'cancelado').order('horario', { ascending: true });
    const { data: bloqs } = await supabase.from('dias_bloqueados').select('id, barbeiro_id, motivo').eq('data', dataISO);
    // Quais agendamentos desse dia já foram pagos (têm movimentação de serviço)
    const { data: movs } = await supabase.from('movimentacoes').select('agendamento_id').eq('data', dataISO).eq('categoria', 'servico');
    setAgsPagos((movs || []).map((m) => m.agendamento_id).filter(Boolean));
    setAgendaDoDia(ags || []);
    setBloqueiosDoDia(bloqs || []);
    setCarregandoAgenda(false);
    setPagamentoAg(null);
  }

  async function carregarMembros() {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, telefone, club_plano, club_barbeiro_id')
      .eq('membro_club', true)
      .order('nome', { ascending: true });
    setMembrosClub(data || []);
  }

  async function removerMembro(id) {
    await supabase.from('clientes')
      .update({ membro_club: false, club_plano: null, club_barbeiro_id: null })
      .eq('id', id);
    carregarMembros();
  }

  // ===== PRODUTOS =====
  async function carregarProdutos() {
    const { data } = await supabase.from('produtos').select('*').order('nome', { ascending: true });
    setProdutos(data || []);
  }

  function abrirFormNovoProduto() {
    setProdEditandoId(null);
    setProdNome(''); setProdPreco(''); setProdEstoque('');
    setErroProduto('');
    setMostrarFormProduto(true);
  }

  function abrirFormEditarProduto(p) {
    setProdEditandoId(p.id);
    setProdNome(p.nome);
    setProdPreco(String(p.preco).replace('.', ','));
    setProdEstoque(String(p.estoque));
    setErroProduto('');
    setMostrarFormProduto(true);
  }

  async function salvarProduto() {
    setErroProduto('');
    if (!prodNome.trim()) { setErroProduto('Digite o nome do produto.'); return; }
    const precoNum = parseFloat(prodPreco.replace(',', '.')) || 0;
    const estoqueNum = parseInt(prodEstoque) || 0;
    if (prodEditandoId) {
      await supabase.from('produtos').update({ nome: prodNome.trim(), preco: precoNum, estoque: estoqueNum }).eq('id', prodEditandoId);
    } else {
      await supabase.from('produtos').insert({ nome: prodNome.trim(), preco: precoNum, estoque: estoqueNum });
    }
    setMostrarFormProduto(false);
    setProdNome(''); setProdPreco(''); setProdEstoque(''); setProdEditandoId(null);
    carregarProdutos();
  }

  async function removerProduto(id) {
    await supabase.from('produtos').delete().eq('id', id);
    carregarProdutos();
  }

  // Abrir venda de um produto
  function abrirVenda(p) {
    setVendaProduto(p);
    setVendaQtd('1');
    setErroVenda('');
  }

  // Confirmar venda: baixa estoque + grava no livro caixa
  async function confirmarVenda() {
    setErroVenda('');
    const qtd = parseInt(vendaQtd) || 0;
    if (qtd <= 0) { setErroVenda('Quantidade inválida.'); return; }
    if (qtd > vendaProduto.estoque) { setErroVenda('Estoque insuficiente (' + vendaProduto.estoque + ' disponível).'); return; }
    const valorTotal = qtd * Number(vendaProduto.preco);
    // Baixa no estoque
    await supabase.from('produtos').update({ estoque: vendaProduto.estoque - qtd }).eq('id', vendaProduto.id);
    // Grava no livro caixa
    await supabase.from('movimentacoes').insert({
      descricao: `Venda: ${vendaProduto.nome} x${qtd}`,
      valor: valorTotal, categoria: 'produto', produto_id: vendaProduto.id, quantidade: qtd,
      data: dataParaISO(new Date()),
    });
    setVendaProduto(null);
    carregarProdutos();
  }

  // ===== FECHAR CAIXA (atendimentos) =====
  function abrirPagamento(ag) {
    setPagamentoAg(ag);
    setPagamentoValor(ag.servicos?.preco ? String(ag.servicos.preco).replace('.', ',') : '');
  }

  async function confirmarPagamento() {
    const valorNum = parseFloat(pagamentoValor.replace(',', '.')) || 0;
    await supabase.from('movimentacoes').insert({
      descricao: `Atendimento: ${pagamentoAg.servicos?.nome || 'serviço'} (${pagamentoAg.clientes?.nome || 'cliente'})`,
      valor: valorNum, categoria: 'servico', barbeiro_id: pagamentoAg.barbeiro_id || null,
      agendamento_id: pagamentoAg.id, data: dataParaISO(dataDono),
    });
    setPagamentoAg(null);
    carregarAgenda(dataDono);
  }

  // ===== FINANCEIRO =====
  async function carregarFinanceiro() {
    // Carrega movimentações do mês atual (filtra por dia/mês na tela)
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const { data } = await supabase.from('movimentacoes')
      .select('*, barbeiros(nome)')
      .gte('data', dataParaISO(ini)).lte('data', dataParaISO(fim))
      .order('criado_em', { ascending: false });
    setMovimentacoes(data || []);
  }

  async function lancarPagamentoClub() {
    const valorNum = parseFloat(clubPagValor.replace(',', '.')) || 0;
    if (valorNum <= 0) return;
    await supabase.from('movimentacoes').insert({
      descricao: clubPagDesc.trim() || 'Assinatura Club Primen',
      valor: valorNum, categoria: 'club', data: dataParaISO(new Date()),
    });
    setClubPagValor(''); setClubPagDesc(''); setMostrarFormClubPag(false);
    carregarFinanceiro();
  }

  async function removerMovimentacao(id) {
    await supabase.from('movimentacoes').delete().eq('id', id);
    carregarFinanceiro();
  }

  // Filtra as movimentações conforme o período escolhido (dia = hoje, mes = mês todo)
  function movsFiltradas() {
    if (finPeriodo === 'dia') {
      const hojeISO = dataParaISO(new Date());
      return movimentacoes.filter((m) => m.data === hojeISO);
    }
    return movimentacoes; // já vem do mês
  }

  function mudarDiaDono(delta) {
    const nova = new Date(dataDono);
    nova.setDate(nova.getDate() + delta);
    setDataDono(nova);
    setMostrarFormManual(false); setMostrarFormBloqueio(false);
    carregarAgenda(nova);
  }

  async function salvarBloqueio() {
    const barbeiroId = bloqueioBarbeiro === 'todos' ? null : bloqueioBarbeiro;
    await supabase.from('dias_bloqueados').insert({
      barbeiro_id: barbeiroId, data: dataParaISO(dataDono), motivo: bloqueioMotivo.trim() || null,
    });
    setBloqueioMotivo(''); setBloqueioBarbeiro('todos'); setMostrarFormBloqueio(false);
    carregarAgenda(dataDono);
  }

  async function removerBloqueio(id) {
    await supabase.from('dias_bloqueados').delete().eq('id', id);
    carregarAgenda(dataDono);
  }

  async function salvarAgendamentoManual() {
    setErroManual('');
    if (!manualNome.trim() || !manualServico || !manualHorario.trim()) {
      setErroManual('Preencha nome, serviço e horário.'); return;
    }
    const { data: cliente, error: erroCli } = await supabase.from('clientes')
      .insert({ nome: manualNome.trim(), telefone: manualTel.trim() || ('manual-' + Date.now()) }).select().single();
    if (erroCli) { setErroManual('Erro ao cadastrar cliente.'); return; }
    const { error: erroAg } = await supabase.from('agendamentos').insert({
      cliente_id: cliente.id, barbeiro_id: manualBarbeiro || null, servico_id: manualServico,
      data: dataParaISO(dataDono), horario: manualHorario.trim(), status: 'confirmado', origem: 'dono',
    });
    if (erroAg) { setErroManual('Esse horário já está ocupado.'); return; }
    setManualNome(''); setManualTel(''); setManualServico(''); setManualBarbeiro(''); setManualHorario('');
    setMostrarFormManual(false);
    carregarAgenda(dataDono);
  }

  const estilos = {
    tela: { background: '#0d0d0d', color: '#f2f2f2', minHeight: '100vh', fontFamily: 'sans-serif', padding: '24px' },
    conteudo: { maxWidth: '400px', margin: '0 auto' },
    titulo: { color: '#8a8a8a', fontSize: '13px', letterSpacing: '1px', marginBottom: '12px' },
    voltar: { display: 'flex', alignItems: 'center', gap: '8px', color: OURO, fontSize: '13px', cursor: 'pointer', marginBottom: '16px' },
    botao: (ativo) => ({ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '14px', fontWeight: 500, cursor: ativo ? 'pointer' : 'default', opacity: ativo ? 1 : 0.4 }),
    input: { width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid #333', borderRadius: '6px', padding: '10px', fontSize: '14px', color: '#f2f2f2', marginBottom: '10px' },
    label: { fontSize: '12px', color: '#8a8a8a', marginBottom: '6px' },
    link: { fontSize: '11px', color: '#6b6b6b', cursor: 'pointer', textAlign: 'center', marginTop: '20px' },
    botaoSec: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #C9A227', background: 'transparent', color: OURO, fontSize: '12px', fontWeight: 500, cursor: 'pointer', marginBottom: '8px' },
  };

  // ---- Cálculos do financeiro (usados na tela) ----
  const movs = movsFiltradas();
  const totalGeral = movs.reduce((s, m) => s + Number(m.valor), 0);
  const totalProdutos = movs.filter((m) => m.categoria === 'produto').reduce((s, m) => s + Number(m.valor), 0);
  const totalServicos = movs.filter((m) => m.categoria === 'servico').reduce((s, m) => s + Number(m.valor), 0);
  const totalClub = movs.filter((m) => m.categoria === 'club').reduce((s, m) => s + Number(m.valor), 0);
  // Por barbeiro (só serviços)
  const porBarbeiro = {};
  movs.filter((m) => m.categoria === 'servico').forEach((m) => {
    const nome = m.barbeiros?.nome || 'Sem barbeiro';
    porBarbeiro[nome] = (porBarbeiro[nome] || 0) + Number(m.valor);
  });

  return (
    <>
      {mostrarAbertura && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#0d0d0d', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video src={videoAbertura} autoPlay muted playsInline onEnded={() => setMostrarAbertura(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <div style={estilos.tela}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src={logoPrimen} alt="Primen Barbershop" style={{ width: '150px', height: 'auto' }} />
        </div>

        {carregando ? (
          <p style={{ color: '#8a8a8a', textAlign: 'center' }}>Carregando...</p>
        ) : (
          <div style={estilos.conteudo}>

            {modo === 'cliente' && (
              <>
                {tela === 'login' && (
                  <>
                    <p style={estilos.titulo}>ENTRAR</p>
                    <div style={estilos.label}>Celular</div>
                    <input style={estilos.input} value={loginTel} onChange={(e) => setLoginTel(formatarTelefone(e.target.value))} placeholder="(32) 99999-9999" inputMode="numeric" />
                    <div style={estilos.label}>Senha</div>
                    <input style={estilos.input} type="password" value={loginSenha} onChange={(e) => setLoginSenha(e.target.value)} placeholder="Sua senha" />
                    {erroLogin && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroLogin}</p>}
                    <button onClick={tentarEntrar} disabled={processandoLogin} style={estilos.botao(!processandoLogin)}>{processandoLogin ? 'Entrando...' : 'Entrar'}</button>
                    <p style={{ fontSize: '11px', color: '#6b6b6b', textAlign: 'center', marginTop: '14px' }}>Primeira vez? É só digitar seu celular e uma senha nova que criamos sua conta.</p>
                    <p style={estilos.link} onClick={() => setModo('login-dono')}>Acesso do dono</p>
                  </>
                )}

                {tela === 'cadastro' && (
                  <>
                    <div style={estilos.voltar} onClick={() => setTela('login')}>← Voltar</div>
                    <p style={estilos.titulo}>CRIAR CONTA</p>
                    <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '14px' }}>Esse número ainda não tem conta. Como é seu nome?</p>
                    <div style={estilos.label}>Nome</div>
                    <input style={estilos.input} value={cadastroNome} onChange={(e) => setCadastroNome(e.target.value)} placeholder="Seu nome" />
                    {erroLogin && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroLogin}</p>}
                    <button onClick={cadastrar} disabled={processandoLogin} style={estilos.botao(!processandoLogin)}>{processandoLogin ? 'Criando...' : 'Criar conta e entrar'}</button>
                  </>
                )}

                {tela === 'menu' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <span style={{ fontSize: '13px', color: '#f2f2f2' }}>Olá, {clienteLogado?.nome?.split(' ')[0]} 👋</span>
                      <span style={{ fontSize: '11px', color: '#6b6b6b', cursor: 'pointer' }} onClick={sairDaConta}>Sair</span>
                    </div>
                    <div onClick={() => { recomecarAgendamento(); setTela('agendar'); }}
                      style={{ border: '1px solid #C9A227', borderRadius: '12px', padding: '24px', marginBottom: '14px', cursor: 'pointer', textAlign: 'center', background: 'rgba(201,162,39,0.05)' }}>
                      <div style={{ fontSize: '30px', marginBottom: '6px' }}>✂️</div>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '16px', color: OURO }}>Agendar horário</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8a8a8a' }}>Escolha serviço, profissional e horário</p>
                    </div>
                    <div onClick={abrirClub}
                      style={{ border: '1px solid #333', borderRadius: '12px', padding: '24px', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '30px', marginBottom: '6px' }}>👑</div>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '16px' }}>Club Primen</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8a8a8a' }}>{clienteLogado?.membro_club ? 'Você é membro ✓' : 'Assinatura de vantagens'}</p>
                    </div>
                  </>
                )}

                {tela === 'club' && (
                  <>
                    <div style={estilos.voltar} onClick={() => setTela('menu')}>← Menu</div>
                    <div style={{ textAlign: 'center', border: '1px solid #C9A227', borderRadius: '16px', padding: '28px 20px', background: 'linear-gradient(180deg, rgba(201,162,39,0.10), rgba(201,162,39,0.02))', marginBottom: '18px' }}>
                      <div style={{ fontSize: '44px', lineHeight: 1 }}>👑</div>
                      <p style={{ fontSize: '22px', fontWeight: 700, color: OURO, margin: '8px 0 2px', letterSpacing: '0.5px' }}>CLUB PRIMEN</p>
                      <p style={{ fontSize: '13px', color: '#d6d6d6', margin: 0 }}>{CLUB.chamada}</p>
                    </div>
                    {clienteLogado?.membro_club ? (
                      <div style={{ textAlign: 'center', border: '1px dashed #C9A227', borderRadius: '12px', padding: '24px', marginBottom: '18px' }}>
                        <p style={{ fontSize: '15px', color: '#f2f2f2', margin: 0 }}>Você já é membro! 🎉</p>
                        <p style={{ fontSize: '12px', color: '#C9A227', margin: '8px 0 0' }}>{clienteLogado.club_plano}</p>
                        <p style={{ fontSize: '12px', color: '#8a8a8a', margin: '4px 0 0' }}>com {barbeiros.find((b) => b.id === clienteLogado.club_barbeiro_id)?.nome || 'seu barbeiro'}</p>
                      </div>
                    ) : (
                      <>
                        <p style={estilos.titulo}>ESCOLHA SEU PLANO</p>
                        {CLUB.planos.map((p) => {
                          const sel = clubPlano === p.id;
                          return (
                            <div key={p.id} onClick={() => setClubPlano(p.id)}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: sel ? '1px solid #C9A227' : '1px solid #262626', background: sel ? 'rgba(201,162,39,0.08)' : '#111', borderRadius: '12px', padding: '16px', marginBottom: '10px', cursor: 'pointer' }}>
                              <span style={{ fontSize: '14px', fontWeight: 500 }}>{p.nome}</span>
                              <span><span style={{ fontSize: '12px', color: OURO }}>R$ </span><span style={{ fontSize: '20px', fontWeight: 700, color: OURO }}>{p.preco}</span><span style={{ fontSize: '11px', color: '#8a8a8a' }}>/mês</span></span>
                            </div>
                          );
                        })}
                        {clubPlano && (
                          <>
                            <p style={{ ...estilos.titulo, marginTop: '18px' }}>ESCOLHA SEU BARBEIRO</p>
                            {barbeiros.map((b) => {
                              const usadas = vagasUsadas[b.id] || 0;
                              const restantes = (b.vagas_club || 0) - usadas;
                              const esgotado = restantes <= 0;
                              const sel = clubBarbeiro?.id === b.id;
                              return (
                                <div key={b.id} onClick={() => { if (!esgotado) setClubBarbeiro(b); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '10px', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: esgotado ? 'default' : 'pointer', opacity: esgotado ? 0.5 : 1 }}>
                                  <AvatarBarbeiro barbeiro={b} tamanho={38} />
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontSize: '14px' }}>{b.nome}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: esgotado ? '#e07a7a' : '#8a8a8a' }}>
                                      {esgotado ? 'Esgotado' : `${restantes} vaga${restantes > 1 ? 's' : ''} disponível${restantes > 1 ? 'is' : ''}`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                        {clubPlano && (
                          <>
                            <p style={{ ...estilos.titulo, marginTop: '18px' }}>O QUE VOCÊ GANHA</p>
                            <div style={{ marginBottom: '14px' }}>
                              {CLUB.planos.find((p) => p.id === clubPlano)?.vantagens.map((v, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(201,162,39,0.15)', color: OURO, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>✓</span>
                                  <span style={{ fontSize: '13px', color: '#e6e6e6' }}>{v}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                          {CLUB.dias.map((d) => (
                            <div key={d} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: '8px', border: '1px solid #C9A227', background: 'rgba(201,162,39,0.08)', color: OURO, fontSize: '12px', fontWeight: 600 }}>{d}</div>
                          ))}
                        </div>
                        <button onClick={confirmarAssinaturaClub} disabled={!clubPlano || !clubBarbeiro || processandoClub} style={estilos.botao(!!clubPlano && !!clubBarbeiro && !processandoClub)}>
                          {processandoClub ? 'Confirmando...' : 'Quero ser membro'}
                        </button>
                        <button onClick={whatsClub} style={{ width: '100%', marginTop: '10px', padding: '12px', borderRadius: '8px', border: 'none', background: '#25D366', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Tirar dúvidas no WhatsApp</button>
                      </>
                    )}
                  </>
                )}

                {tela === 'agendar' && (
                  <>
                    {etapa === 'servico' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setTela('menu')}>← Menu</div>
                        <p style={estilos.titulo}>ESCOLHA O SERVIÇO</p>
                        {servicosAgendaveis.map((s) => (
                          <div key={s.id} onClick={() => { setServicoEscolhido(s); setEtapa('equipe'); }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '8px', cursor: 'pointer' }}>
                            <div>
                              <p style={{ margin: 0, fontWeight: 500 }}>{s.nome}</p>
                              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7a7a7a' }}>{s.duracao_min} min</p>
                            </div>
                            <p style={{ margin: 0, color: OURO, fontWeight: 500 }}>R$ {formatarReal(s.preco)}</p>
                          </div>
                        ))}
                      </>
                    )}

                    {etapa === 'equipe' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setEtapa('servico')}>← {servicoEscolhido?.nome}</div>
                        <p style={estilos.titulo}>EQUIPE DISPONÍVEL</p>
                        <div onClick={() => setBarbeiroEscolhido({ id: null, nome: 'Sem preferência', semPref: true })}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', border: barbeiroEscolhido?.semPref ? '1px solid #C9A227' : '1px solid #333', background: barbeiroEscolhido?.semPref ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#1f1f1f', border: '1px solid #444' }}></div>
                          <div>
                            <p style={{ margin: 0 }}>Sem preferência</p>
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#7a7a7a' }}>Exceto segunda-feira</p>
                          </div>
                        </div>
                        {barbeiros.map((b) => {
                          const sel = barbeiroEscolhido?.id === b.id && !barbeiroEscolhido?.semPref;
                          return (
                            <div key={b.id} onClick={() => setBarbeiroEscolhido(b)}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}>
                              <AvatarBarbeiro barbeiro={b} tamanho={34} />
                              <div>
                                <p style={{ margin: 0 }}>{b.nome}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '10px', color: OURO }}>★ {Number(b.nota).toFixed(1)}</p>
                              </div>
                            </div>
                          );
                        })}
                        <button disabled={!barbeiroEscolhido} onClick={() => setEtapa('dataHora')} style={estilos.botao(!!barbeiroEscolhido)}>Continuar</button>
                      </>
                    )}

                    {etapa === 'dataHora' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setEtapa('equipe')}>← {servicoEscolhido?.nome} · {barbeiroEscolhido?.nome}</div>
                        <p style={estilos.titulo}>ESCOLHA A DATA</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                          <span style={{ fontSize: '10px', color: '#6b6b6b' }}>dom fechado</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
                          {['D','S','T','Q','Q','S','S'].map((d, i) => (<div key={i} style={{ textAlign: 'center', fontSize: '10px', color: '#6b6b6b' }}>{d}</div>))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '16px' }}>
                          {diasDoMes().map((data, i) => {
                            if (!data) return <div key={i}></div>;
                            const bloqueado = data.getDay() === 0 || ehPassado(data);
                            const selecionada = dataEscolhida && data.getTime() === dataEscolhida.getTime();
                            return (
                              <div key={i} onClick={() => { if (!bloqueado) escolherData(data); }}
                                style={{ textAlign: 'center', fontSize: '11px', padding: '6px 0', borderRadius: '8px', cursor: bloqueado ? 'default' : 'pointer', color: bloqueado ? '#4a4a4a' : '#f2f2f2', border: selecionada ? '1px solid #C9A227' : '1px solid #333', background: selecionada ? 'rgba(201,162,39,0.15)' : 'transparent' }}>
                                {data.getDate()}
                              </div>
                            );
                          })}
                        </div>
                        {dataEscolhida && diaFechadoCliente && (
                          <div style={{ textAlign: 'center', border: '1px dashed #444', borderRadius: '8px', padding: '16px', color: '#8a8a8a', fontSize: '13px' }}>
                            Agenda fechada nesse dia. Escolha outra data.
                          </div>
                        )}
                        {dataEscolhida && !diaFechadoCliente && (() => {
                          const grade = gradeDoDia(dataEscolhida);
                          if (grade.precisaBarbeiro) {
                            return (
                              <div style={{ textAlign: 'center', border: '1px dashed #C9A227', borderRadius: '8px', padding: '16px', color: '#d6d6d6', fontSize: '13px' }}>
                                Na segunda-feira, cada barbeiro tem horário próprio.<br />Volte e escolha um barbeiro específico.
                              </div>
                            );
                          }
                          if (grade.naoAtende) {
                            return (
                              <div style={{ textAlign: 'center', border: '1px dashed #444', borderRadius: '8px', padding: '16px', color: '#8a8a8a', fontSize: '13px' }}>
                                {barbeiroEscolhido?.nome} não atende na segunda-feira. Escolha outra data.
                              </div>
                            );
                          }
                          return (
                            <>
                              <p style={estilos.titulo}>HORÁRIO · <span style={{ color: OURO, textTransform: 'capitalize' }}>{dataEscolhida.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span></p>
                              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                {grade.nomes.map((nome, i) => {
                                  const ativo = periodoEscolhido === i;
                                  return (
                                    <div key={i} onClick={() => { setPeriodoEscolhido(i); setHorarioEscolhido(null); }}
                                      style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', border: ativo ? '1px solid #C9A227' : '1px solid #333', background: ativo ? 'rgba(201,162,39,0.08)' : 'transparent' }}>
                                      {nome} <span style={{ color: '#7a7a7a' }}>({grade.periodos[i].length})</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                                {grade.periodos[periodoEscolhido].map((h) => {
                                  const ocupado = horariosOcupados.includes(h);
                                  const sel = horarioEscolhido === h;
                                  if (ocupado) return (<div key={h} style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', color: '#4a4a4a', border: '1px solid #1f1f1f', textDecoration: 'line-through', cursor: 'default' }}>{h}</div>);
                                  return (
                                    <div key={h} onClick={() => setHorarioEscolhido(h)}
                                      style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', cursor: 'pointer', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent' }}>{h}</div>
                                  );
                                })}
                              </div>
                              <button disabled={!horarioEscolhido} onClick={confirmarAgendamento} style={estilos.botao(!!horarioEscolhido && !salvando)}>{salvando ? 'Salvando...' : 'Confirmar agendamento'}</button>
                              {erroSalvar && <p style={{ color: '#e07a7a', fontSize: '12px', marginTop: '10px' }}>{erroSalvar}</p>}
                            </>
                          );
                        })()}
                      </>
                    )}

                    {etapa === 'sucesso' && (
                      <div style={{ textAlign: 'center', border: '1px dashed #C9A227', borderRadius: '12px', padding: '28px 20px' }}>
                        <div style={{ fontSize: '32px', color: OURO }}>✓</div>
                        <p style={{ fontWeight: 500, fontSize: '16px', margin: '10px 0 4px' }}>Horário reservado!</p>
                        <p style={{ fontSize: '13px', color: '#a3a3a3', margin: '0 0 4px' }}>{servicoEscolhido?.nome} · {dataEscolhida?.toLocaleDateString('pt-BR')} às {horarioEscolhido}</p>
                        <p style={{ fontSize: '12px', color: '#7a7a7a', margin: 0 }}>com {barbeiroEscolhido?.nome}</p>
                        <button onClick={abrirWhatsApp} style={{ width: '100%', marginTop: '18px', padding: '12px', borderRadius: '8px', border: 'none', background: '#25D366', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Falar com a barbearia</button>
                        <button onClick={() => setTela('menu')} style={{ width: '100%', marginTop: '10px', padding: '10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#f2f2f2', fontSize: '13px', cursor: 'pointer' }}>Voltar ao menu</button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {modo === 'login-dono' && (
              <>
                <div style={estilos.voltar} onClick={() => { setModo('cliente'); setSenhaDigitada(''); setErroSenha(''); }}>← Voltar</div>
                <p style={estilos.titulo}>ACESSO DO DONO</p>
                <div style={estilos.label}>Senha</div>
                <input style={estilos.input} type="password" value={senhaDigitada} onChange={(e) => setSenhaDigitada(e.target.value)} placeholder="Digite a senha" />
                {erroSenha && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroSenha}</p>}
                <button onClick={entrarComoDono} style={estilos.botao(true)}>Entrar</button>
              </>
            )}

            {modo === 'dono' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ ...estilos.titulo, margin: 0 }}>PAINEL DO DONO</p>
                  <span style={{ fontSize: '11px', color: '#6b6b6b', cursor: 'pointer' }} onClick={() => { setModo('cliente'); setSenhaDigitada(''); setMostrarFinanceiro(false); }}>Sair</span>
                </div>

                {/* ===== BOTÃO FINANCEIRO ===== */}
                <button style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}
                  onClick={() => { if (!mostrarFinanceiro) carregarFinanceiro(); setMostrarFinanceiro(!mostrarFinanceiro); }}>
                  {mostrarFinanceiro ? '← Voltar à agenda' : '💰 Financeiro'}
                </button>

                {mostrarFinanceiro ? (
                  <>
                    {/* Seletor de período */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                      {[['dia', 'Hoje'], ['mes', 'Mês']].map(([id, label]) => (
                        <div key={id} onClick={() => setFinPeriodo(id)}
                          style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: finPeriodo === id ? '1px solid #C9A227' : '1px solid #333', background: finPeriodo === id ? 'rgba(201,162,39,0.08)' : 'transparent', color: finPeriodo === id ? OURO : '#8a8a8a' }}>{label}</div>
                      ))}
                    </div>

                    {/* Total geral */}
                    <div style={{ textAlign: 'center', border: '1px solid #C9A227', borderRadius: '12px', padding: '18px', marginBottom: '14px', background: 'rgba(201,162,39,0.05)' }}>
                      <p style={{ fontSize: '11px', color: '#8a8a8a', margin: 0, letterSpacing: '1px' }}>ENTRADAS {finPeriodo === 'dia' ? 'DE HOJE' : 'DO MÊS'}</p>
                      <p style={{ fontSize: '32px', fontWeight: 700, color: OURO, margin: '6px 0 0' }}>R$ {formatarReal(totalGeral)}</p>
                    </div>

                    {/* Abas */}
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                      {[['geral', 'Geral'], ['barbeiro', 'Barbeiros'], ['club', 'Club'], ['produtos', 'Produtos']].map(([id, label]) => (
                        <div key={id} onClick={() => setFinAba(id)}
                          style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: finAba === id ? '1px solid #C9A227' : '1px solid #333', background: finAba === id ? 'rgba(201,162,39,0.08)' : 'transparent', color: finAba === id ? OURO : '#8a8a8a' }}>{label}</div>
                      ))}
                    </div>

                    {/* Conteúdo das abas */}
                    {finAba === 'geral' && (
                      <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                          <div style={{ flex: 1, border: '1px solid #262626', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: '#8a8a8a', margin: 0 }}>Serviços</p>
                            <p style={{ fontSize: '14px', color: '#f2f2f2', margin: '4px 0 0', fontWeight: 500 }}>R$ {formatarReal(totalServicos)}</p>
                          </div>
                          <div style={{ flex: 1, border: '1px solid #262626', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: '#8a8a8a', margin: 0 }}>Produtos</p>
                            <p style={{ fontSize: '14px', color: '#f2f2f2', margin: '4px 0 0', fontWeight: 500 }}>R$ {formatarReal(totalProdutos)}</p>
                          </div>
                          <div style={{ flex: 1, border: '1px solid #262626', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                            <p style={{ fontSize: '10px', color: '#8a8a8a', margin: 0 }}>Club</p>
                            <p style={{ fontSize: '14px', color: '#f2f2f2', margin: '4px 0 0', fontWeight: 500 }}>R$ {formatarReal(totalClub)}</p>
                          </div>
                        </div>
                        <p style={estilos.titulo}>ÚLTIMAS MOVIMENTAÇÕES</p>
                        {movs.length === 0 ? (
                          <div style={{ textAlign: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '20px', color: '#6b6b6b', fontSize: '13px' }}>Nenhuma entrada nesse período.</div>
                        ) : (
                          movs.map((m) => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #262626', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: '13px' }}>{m.descricao}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#6b6b6b' }}>{new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')} · {m.categoria}</p>
                              </div>
                              <span style={{ color: OURO, fontWeight: 500, fontSize: '13px', marginRight: '8px' }}>R$ {formatarReal(m.valor)}</span>
                              <span onClick={() => { if (confirm('Apagar esta movimentação?')) removerMovimentacao(m.id); }} style={{ fontSize: '10px', color: '#e07a7a', cursor: 'pointer' }}>×</span>
                            </div>
                          ))
                        )}
                      </>
                    )}

                    {finAba === 'barbeiro' && (
                      <>
                        <p style={estilos.titulo}>FATURAMENTO POR BARBEIRO (SERVIÇOS)</p>
                        {Object.keys(porBarbeiro).length === 0 ? (
                          <div style={{ textAlign: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '20px', color: '#6b6b6b', fontSize: '13px' }}>Nenhum atendimento pago nesse período.</div>
                        ) : (
                          Object.entries(porBarbeiro).map(([nome, total]) => (
                            <div key={nome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '14px' }}>{nome}</span>
                              <span style={{ color: OURO, fontWeight: 600, fontSize: '15px' }}>R$ {formatarReal(total)}</span>
                            </div>
                          ))
                        )}
                      </>
                    )}

                    {finAba === 'club' && (
                      <>
                        <div style={{ textAlign: 'center', border: '1px solid #262626', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
                          <p style={{ fontSize: '11px', color: '#8a8a8a', margin: 0 }}>RECEITA DO CLUB {finPeriodo === 'dia' ? '(HOJE)' : '(MÊS)'}</p>
                          <p style={{ fontSize: '24px', fontWeight: 700, color: OURO, margin: '6px 0 0' }}>R$ {formatarReal(totalClub)}</p>
                        </div>
                        <button style={estilos.botaoSec} onClick={() => setMostrarFormClubPag(!mostrarFormClubPag)}>
                          {mostrarFormClubPag ? 'Cancelar' : '+ Lançar pagamento do Club'}
                        </button>
                        {mostrarFormClubPag && (
                          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                            <div style={estilos.label}>Descrição (opcional)</div>
                            <input style={estilos.input} value={clubPagDesc} onChange={(e) => setClubPagDesc(e.target.value)} placeholder="Ex: Assinatura João - Corte Club" />
                            <div style={estilos.label}>Valor recebido (R$)</div>
                            <input style={estilos.input} value={clubPagValor} onChange={(e) => setClubPagValor(e.target.value)} placeholder="Ex: 99,99" inputMode="decimal" />
                            <button style={estilos.botao(true)} onClick={lancarPagamentoClub}>Lançar</button>
                          </div>
                        )}
                        {movs.filter((m) => m.categoria === 'club').map((m) => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #262626', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: '13px' }}>{m.descricao}</p>
                              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#6b6b6b' }}>{new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                            <span style={{ color: OURO, fontWeight: 500, fontSize: '13px', marginRight: '8px' }}>R$ {formatarReal(m.valor)}</span>
                            <span onClick={() => { if (confirm('Apagar?')) removerMovimentacao(m.id); }} style={{ fontSize: '10px', color: '#e07a7a', cursor: 'pointer' }}>×</span>
                          </div>
                        ))}
                      </>
                    )}

                    {finAba === 'produtos' && (
                      <>
                        <div style={{ textAlign: 'center', border: '1px solid #262626', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
                          <p style={{ fontSize: '11px', color: '#8a8a8a', margin: 0 }}>VENDAS DE PRODUTOS {finPeriodo === 'dia' ? '(HOJE)' : '(MÊS)'}</p>
                          <p style={{ fontSize: '24px', fontWeight: 700, color: OURO, margin: '6px 0 0' }}>R$ {formatarReal(totalProdutos)}</p>
                        </div>
                        {movs.filter((m) => m.categoria === 'produto').length === 0 ? (
                          <div style={{ textAlign: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '20px', color: '#6b6b6b', fontSize: '13px' }}>Nenhuma venda nesse período.</div>
                        ) : (
                          movs.filter((m) => m.categoria === 'produto').map((m) => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #262626', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: '13px' }}>{m.descricao}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#6b6b6b' }}>{new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                              </div>
                              <span style={{ color: OURO, fontWeight: 500, fontSize: '13px', marginRight: '8px' }}>R$ {formatarReal(m.valor)}</span>
                              <span onClick={() => { if (confirm('Apagar?')) removerMovimentacao(m.id); }} style={{ fontSize: '10px', color: '#e07a7a', cursor: 'pointer' }}>×</span>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span onClick={() => mudarDiaDono(-1)} style={{ cursor: 'pointer', color: OURO, fontSize: '18px', padding: '0 10px' }}>‹</span>
                      <span style={{ fontSize: '14px', textTransform: 'capitalize', textAlign: 'center' }}>
                        {dataDono.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </span>
                      <span onClick={() => mudarDiaDono(1)} style={{ cursor: 'pointer', color: OURO, fontSize: '18px', padding: '0 10px' }}>›</span>
                    </div>

                    {bloqueiosDoDia.map((b) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(163,61,61,0.12)', border: '1px solid #a33d3d', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#e07a7a' }}>
                          {b.barbeiro_id === null ? 'Barbearia fechada' : 'Fechado: ' + (barbeiros.find((x) => x.id === b.barbeiro_id)?.nome || 'barbeiro')}
                          {b.motivo ? ' · ' + b.motivo : ''}
                        </span>
                        <span onClick={() => removerBloqueio(b.id)} style={{ fontSize: '11px', color: '#C9A227', cursor: 'pointer' }}>reabrir</span>
                      </div>
                    ))}

                    <button style={estilos.botaoSec} onClick={() => { setMostrarFormBloqueio(!mostrarFormBloqueio); setMostrarFormManual(false); }}>
                      {mostrarFormBloqueio ? 'Cancelar' : 'Fechar / bloquear este dia'}
                    </button>

                    {mostrarFormBloqueio && (
                      <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                        <div style={estilos.label}>Fechar para</div>
                        <select style={estilos.input} value={bloqueioBarbeiro} onChange={(e) => setBloqueioBarbeiro(e.target.value)}>
                          <option value="todos">Barbearia toda</option>
                          {barbeiros.map((b) => (<option key={b.id} value={b.id}>Só {b.nome}</option>))}
                        </select>
                        <div style={estilos.label}>Motivo (opcional)</div>
                        <input style={estilos.input} value={bloqueioMotivo} onChange={(e) => setBloqueioMotivo(e.target.value)} placeholder="Ex: folga, feriado" />
                        <button style={estilos.botao(true)} onClick={salvarBloqueio}>Confirmar bloqueio</button>
                      </div>
                    )}

                    <button style={estilos.botaoSec} onClick={() => { setMostrarFormManual(!mostrarFormManual); setMostrarFormBloqueio(false); }}>
                      {mostrarFormManual ? 'Cancelar' : '+ Agendar para cliente'}
                    </button>

                    {mostrarFormManual && (
                      <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                        <div style={estilos.label}>Nome do cliente</div>
                        <input style={estilos.input} value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Nome" />
                        <div style={estilos.label}>WhatsApp (opcional)</div>
                        <input style={estilos.input} value={manualTel} onChange={(e) => setManualTel(formatarTelefone(e.target.value))} placeholder="(32) 99999-9999" inputMode="numeric" />
                        <div style={estilos.label}>Serviço</div>
                        <select style={estilos.input} value={manualServico} onChange={(e) => setManualServico(e.target.value)}>
                          <option value="">Escolha</option>
                          {servicos.map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
                        </select>
                        <div style={estilos.label}>Barbeiro (opcional)</div>
                        <select style={estilos.input} value={manualBarbeiro} onChange={(e) => setManualBarbeiro(e.target.value)}>
                          <option value="">Sem preferência</option>
                          {barbeiros.map((b) => (<option key={b.id} value={b.id}>{b.nome}</option>))}
                        </select>
                        <div style={estilos.label}>Horário (ex: 15:20)</div>
                        <input style={estilos.input} value={manualHorario} onChange={(e) => setManualHorario(e.target.value)} placeholder="HH:MM" />
                        {erroManual && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroManual}</p>}
                        <button style={estilos.botao(true)} onClick={salvarAgendamentoManual}>Salvar agendamento</button>
                      </div>
                    )}

                    <p style={{ ...estilos.titulo, marginTop: '20px' }}>AGENDA DO DIA</p>
                    {carregandoAgenda ? (
                      <p style={{ color: '#8a8a8a', textAlign: 'center' }}>Carregando...</p>
                    ) : agendaDoDia.length === 0 ? (
                      <div style={{ textAlign: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '24px', color: '#6b6b6b', fontSize: '13px' }}>
                        Nenhum agendamento neste dia.
                      </div>
                    ) : (
                      agendaDoDia.map((a) => {
                        const pago = agsPagos.includes(a.id);
                        return (
                          <div key={a.id} style={{ border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <p style={{ margin: 0, fontWeight: 500, color: OURO }}>{a.horario.slice(0, 5)}</p>
                              {a.origem === 'dono' && <span style={{ fontSize: '10px', color: '#6b6b6b' }}>manual</span>}
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{a.clientes?.nome || 'Cliente'}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8a8a8a' }}>{a.servicos?.nome} · {a.barbeiros?.nome || 'Sem preferência'}</p>
                            {a.clientes?.telefone && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b6b6b' }}>{a.clientes.telefone}</p>}
                            {pago ? (
                              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#5cb67a', fontWeight: 500 }}>✓ Pago</p>
                            ) : pagamentoAg?.id === a.id ? (
                              <div style={{ marginTop: '10px', borderTop: '1px solid #262626', paddingTop: '10px' }}>
                                <div style={estilos.label}>Valor pago (R$)</div>
                                <input style={estilos.input} value={pagamentoValor} onChange={(e) => setPagamentoValor(e.target.value)} inputMode="decimal" />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }} onClick={confirmarPagamento}>Confirmar</button>
                                  <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#f2f2f2', fontSize: '13px', cursor: 'pointer' }} onClick={() => setPagamentoAg(null)}>Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <button style={{ ...estilos.botaoSec, marginTop: '10px', marginBottom: 0 }} onClick={() => abrirPagamento(a)}>Marcar como pago</button>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* ===== MEMBROS DO CLUB ===== */}
                    <button style={{ ...estilos.botaoSec, marginTop: '20px' }} onClick={() => { if (!mostrarMembros) carregarMembros(); setMostrarMembros(!mostrarMembros); }}>
                      {mostrarMembros ? 'Esconder membros do Club' : '👑 Ver membros do Club'}
                    </button>

                    {mostrarMembros && (
                      <div style={{ marginTop: '8px' }}>
                        {membrosClub.length === 0 ? (
                          <div style={{ textAlign: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '20px', color: '#6b6b6b', fontSize: '13px' }}>
                            Nenhum membro no Club ainda.
                          </div>
                        ) : (
                          <>
                            <p style={{ fontSize: '11px', color: '#8a8a8a', margin: '0 0 10px' }}>{membrosClub.length} membro(s)</p>
                            {membrosClub.map((m) => (
                              <div key={m.id} style={{ border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{m.nome}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#C9A227' }}>{m.club_plano || 'Club'}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#8a8a8a' }}>
                                      {barbeiros.find((b) => b.id === m.club_barbeiro_id)?.nome || 'Sem barbeiro'}
                                    </p>
                                    {m.telefone && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b6b6b' }}>{m.telefone}</p>}
                                  </div>
                                  <span onClick={() => { if (confirm('Remover ' + m.nome + ' do Club?')) removerMembro(m.id); }}
                                    style={{ fontSize: '11px', color: '#e07a7a', cursor: 'pointer', whiteSpace: 'nowrap' }}>remover</span>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    {/* ===== PRODUTOS ===== */}
                    <button style={{ ...estilos.botaoSec, marginTop: '20px' }} onClick={() => { if (!mostrarProdutos) carregarProdutos(); setMostrarProdutos(!mostrarProdutos); setMostrarFormProduto(false); setVendaProduto(null); }}>
                      {mostrarProdutos ? 'Esconder produtos' : '📦 Produtos / Estoque'}
                    </button>

                    {mostrarProdutos && (
                      <div style={{ marginTop: '8px' }}>
                        <button style={estilos.botaoSec} onClick={() => { if (mostrarFormProduto) { setMostrarFormProduto(false); } else { abrirFormNovoProduto(); } }}>
                          {mostrarFormProduto ? 'Cancelar' : '+ Novo produto'}
                        </button>

                        {mostrarFormProduto && (
                          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                            <div style={estilos.label}>Nome do produto</div>
                            <input style={estilos.input} value={prodNome} onChange={(e) => setProdNome(e.target.value)} placeholder="Ex: Pomada modeladora" />
                            <div style={estilos.label}>Preço (R$)</div>
                            <input style={estilos.input} value={prodPreco} onChange={(e) => setProdPreco(e.target.value)} placeholder="Ex: 35,00" inputMode="decimal" />
                            <div style={estilos.label}>Quantidade em estoque</div>
                            <input style={estilos.input} value={prodEstoque} onChange={(e) => setProdEstoque(e.target.value)} placeholder="Ex: 10" inputMode="numeric" />
                            {erroProduto && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroProduto}</p>}
                            <button style={estilos.botao(true)} onClick={salvarProduto}>{prodEditandoId ? 'Salvar alterações' : 'Adicionar produto'}</button>
                          </div>
                        )}

                        {produtos.length === 0 ? (
                          <div style={{ textAlign: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '20px', color: '#6b6b6b', fontSize: '13px' }}>
                            Nenhum produto cadastrado ainda.
                          </div>
                        ) : (
                          produtos.map((p) => (
                            <div key={p.id} style={{ border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{p.nome}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: OURO }}>R$ {formatarReal(p.preco)}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: p.estoque <= 0 ? '#e07a7a' : '#8a8a8a' }}>
                                    {p.estoque <= 0 ? 'Sem estoque' : `${p.estoque} em estoque`}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                                  <span onClick={() => abrirFormEditarProduto(p)} style={{ fontSize: '11px', color: '#C9A227', cursor: 'pointer' }}>editar</span>
                                  <span onClick={() => { if (confirm('Remover ' + p.nome + '?')) removerProduto(p.id); }} style={{ fontSize: '11px', color: '#e07a7a', cursor: 'pointer' }}>remover</span>
                                </div>
                              </div>
                              {vendaProduto?.id === p.id ? (
                                <div style={{ marginTop: '10px', borderTop: '1px solid #262626', paddingTop: '10px' }}>
                                  <div style={estilos.label}>Quantidade vendida</div>
                                  <input style={estilos.input} value={vendaQtd} onChange={(e) => setVendaQtd(e.target.value)} inputMode="numeric" />
                                  <p style={{ fontSize: '12px', color: '#8a8a8a', margin: '0 0 10px' }}>Total: R$ {formatarReal((parseInt(vendaQtd) || 0) * Number(p.preco))}</p>
                                  {erroVenda && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroVenda}</p>}
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }} onClick={confirmarVenda}>Confirmar venda</button>
                                    <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#f2f2f2', fontSize: '13px', cursor: 'pointer' }} onClick={() => setVendaProduto(null)}>Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                p.estoque > 0 && <button style={{ ...estilos.botaoSec, marginTop: '10px', marginBottom: 0 }} onClick={() => abrirVenda(p)}>Vender / dar baixa</button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

          </div>
        )}
      </div>
    </>
  );
}

export default App;