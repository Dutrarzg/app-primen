import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import logoPrimen from './assets/logo-primen.png';
import videoAbertura from './assets/abertura.mp4';

// Expediente por barbeiro e dia da semana (0=dom, 1=seg ... 6=sáb).
// Cada valor é [horaInicio, minInicio, horaFim, minFim]. Ausente = fechado.
const EXPEDIENTE = {
  'Rennan Martins': {
    1: [13, 30, 20, 0],
    2: [13, 30, 20, 0],
    3: [9, 0, 20, 0],
    4: [9, 0, 20, 0],
    5: [8, 0, 20, 0],
    6: [7, 0, 18, 0],
  },
  'Luiz Guilherme': {
    1: [15, 0, 18, 0],
    2: [9, 0, 20, 0],
    3: [9, 0, 20, 0],
    4: [9, 0, 20, 0],
    5: [8, 0, 20, 0],
    6: [7, 0, 18, 0],
  },
};

// Gera {periodos, nomes} corridos de 15 em 15, agrupando em Manhã/Tarde/Noite.
function gerarGradeExpediente(iH, iM, fH, fM) {
  const todos = gerarHorarios(iH, iM, fH, fM).filter((h) => h !== `${String(fH).padStart(2, '0')}:${String(fM).padStart(2, '0')}`);
  const manha = todos.filter((h) => h < '12:00');
  const tarde = todos.filter((h) => h >= '12:00' && h < '18:00');
  const noite = todos.filter((h) => h >= '18:00');
  const periodos = [];
  const nomes = [];
  if (manha.length) { periodos.push(manha); nomes.push('Manhã'); }
  if (tarde.length) { periodos.push(tarde); nomes.push('Tarde'); }
  if (noite.length) { periodos.push(noite); nomes.push('Noite'); }
  return { periodos, nomes };
}

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

function horarioFim(horarioInicio, duracaoMin) {
  const [h, m] = horarioInicio.slice(0, 5).split(':').map(Number);
  const total = h * 60 + m + (duracaoMin || 15);
  const fh = Math.floor(total / 60) % 24;
  const fm = total % 60;
  return `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
}

const OURO = '#C9A227';
const WHATSAPP_BARBEARIA = '5532984079998';
const VAPID_PUBLIC_KEY = 'BJlutoQld4dExJJ0AmlGeKv6rgb4D5uUwd6OQrtBrm50S6165snLmmFnG93D4i1xmJWQmMCT8HsS4WbqV4xujXE';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function telParaEmail(tel) {
  const nums = tel.replace(/\D/g, '');
  return `${nums}@primen.app`;
}

function dataParaISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somarDias(dataISO, dias) {
  const d = new Date(dataISO + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return dataParaISO(d);
}

function diasAte(vencimentoISO) {
  if (!vencimentoISO) return null;
  const venc = new Date(vencimentoISO + 'T12:00:00');
  const hoje0 = new Date();
  hoje0.setHours(12, 0, 0, 0);
  return Math.round((venc - hoje0) / (1000 * 60 * 60 * 24));
}

function formatarTelefone(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums.length ? `(${nums}` : '';
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function formatarCPF(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
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

  const [ehTelaGrande, setEhTelaGrande] = useState(typeof window !== 'undefined' && window.innerWidth >= 900);
  useEffect(() => {
    function aoRedimensionar() { setEhTelaGrande(window.innerWidth >= 900); }
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  const [tela, setTela] = useState('login');
  const [clienteLogado, setClienteLogado] = useState(null);
  const [loginTel, setLoginTel] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [cadastroNome, setCadastroNome] = useState('');
  const [cadastroSenha, setCadastroSenha] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [processandoLogin, setProcessandoLogin] = useState(false);

  const [servicos, setServicos] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [etapa, setEtapa] = useState('inicio');
  const [servicoEscolhido, setServicoEscolhido] = useState(null);
  const [servicosEscolhidos, setServicosEscolhidos] = useState([]);
  const [barbeiroEscolhido, setBarbeiroEscolhido] = useState(null);
  const [temAcompanhante, setTemAcompanhante] = useState(false);
  const [nomeFilho, setNomeFilho] = useState('');
  const [modoAcompanhante, setModoAcompanhante] = useState('mesmo');
  const [servicosFilho, setServicosFilho] = useState([]);
  const [barbeiroFilho, setBarbeiroFilho] = useState(null);

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [dataEscolhida, setDataEscolhida] = useState(null);
  const [periodoEscolhido, setPeriodoEscolhido] = useState(0);
  const [horarioEscolhido, setHorarioEscolhido] = useState(null);
  const [horariosOcupados, setHorariosOcupados] = useState([]);
  const [ocupadosPorBarbeiro, setOcupadosPorBarbeiro] = useState({});
  const [faixaHorariosDia, setFaixaHorariosDia] = useState([]);
  const [mostrarAlmoco, setMostrarAlmoco] = useState(false);
  const [almocoIni, setAlmocoIni] = useState('');
  const [almocoFim, setAlmocoFim] = useState('');
  const [mostrarHorarioDia, setMostrarHorarioDia] = useState(false);
  const [hdData, setHdData] = useState('');
  const [hdIni, setHdIni] = useState('');
  const [hdFim, setHdFim] = useState('');
  const [hdBarbeiro, setHdBarbeiro] = useState('');
  const [diaFechadoCliente, setDiaFechadoCliente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');



  const [equipeUsuario, setEquipeUsuario] = useState('');
  const [equipeSenha, setEquipeSenha] = useState('');
  const [erroEquipe, setErroEquipe] = useState('');
  const [barbeiroLogado, setBarbeiroLogado] = useState(null);
  const ehAdmin = barbeiroLogado?.nivel === 'admin';
  const [avisoNovo, setAvisoNovo] = useState(null);
  const [pushStatus, setPushStatus] = useState('desconhecido');

  const [dataDono, setDataDono] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  const [agendaDoDia, setAgendaDoDia] = useState([]);
  const [bloqueiosDoDia, setBloqueiosDoDia] = useState([]);
  const [horariosDiaAgenda, setHorariosDiaAgenda] = useState([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);


  const [mostrarFormManual, setMostrarFormManual] = useState(false);
  const [manualNome, setManualNome] = useState('');
  const [manualTel, setManualTel] = useState('');
  const [manualModoCliente, setManualModoCliente] = useState('cadastrado');
  const [manualClienteId, setManualClienteId] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [listaClientes, setListaClientes] = useState([]);
  const [manualServico, setManualServico] = useState('');
  const [manualBarbeiro, setManualBarbeiro] = useState('');
  const [manualHorario, setManualHorario] = useState('');
  const [erroManual, setErroManual] = useState('');

  const [mostrarFormBloqueio, setMostrarFormBloqueio] = useState(false);
  const [bloqueioBarbeiro, setBloqueioBarbeiro] = useState('todos');
  const [bloqueioMotivo, setBloqueioMotivo] = useState('');
  const [bloqueioInicio, setBloqueioInicio] = useState('');
  const [bloqueioFim, setBloqueioFim] = useState('');
  const [bloqueioData, setBloqueioData] = useState('');

  const [produtos, setProdutos] = useState([]);
  const [mostrarProdutos, setMostrarProdutos] = useState(false);
  const [mostrarFormProduto, setMostrarFormProduto] = useState(false);
  const [prodNome, setProdNome] = useState('');
  const [prodPreco, setProdPreco] = useState('');
  const [prodEstoque, setProdEstoque] = useState('');
  const [prodEditandoId, setProdEditandoId] = useState(null);
  const [erroProduto, setErroProduto] = useState('');
  const [vendaProduto, setVendaProduto] = useState(null);
  const [vendaQtd, setVendaQtd] = useState('1');
  const [erroVenda, setErroVenda] = useState('');

  const [pagamentoAg, setPagamentoAg] = useState(null);
  const [pagamentoValor, setPagamentoValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [extrasPagamento, setExtrasPagamento] = useState([]);
  const [vistaAgenda, setVistaAgenda] = useState('lista');
  const [mostrarCalendarioDono, setMostrarCalendarioDono] = useState(false);
  const [modalAg, setModalAg] = useState(null);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEditado, setNomeEditado] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [remarcandoDonoId, setRemarcandoDonoId] = useState(null);
  const [remarcarAg, setRemarcarAg] = useState(null);
  const [remarcarData, setRemarcarData] = useState('');
  const [remarcarHorario, setRemarcarHorario] = useState('');
  const [remarcarOcupados, setRemarcarOcupados] = useState([]);
  const [remarcarSalvando, setRemarcarSalvando] = useState(false);
  const [agsPagos, setAgsPagos] = useState([]);

  const [mostrarFinanceiro, setMostrarFinanceiro] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [finAba, setFinAba] = useState('geral');
  const [finPeriodo, setFinPeriodo] = useState('dia');
  const [meusHorarios, setMeusHorarios] = useState([]);
  const [carregandoMeus, setCarregandoMeus] = useState(false);
  const [agRemarcando, setAgRemarcando] = useState(null);
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos');

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

    async function checarSessao() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: barb } = await supabase.from('barbeiros').select('*').eq('auth_id', session.user.id).maybeSingle();
        if (barb) { setBarbeiroLogado(barb); setModo('dono'); carregarAgenda(new Date(), barb); return; }
        let { data: cli } = await supabase.from('clientes').select('*').eq('auth_id', session.user.id).maybeSingle();
        if (!cli) {
          const telSalvo = localStorage.getItem('primen_tel');
          if (telSalvo) {
            const { data: cliTel } = await supabase.from('clientes').select('*').eq('telefone', telSalvo).maybeSingle();
            if (cliTel) {
              await supabase.from('clientes').update({ auth_id: session.user.id }).eq('id', cliTel.id);
              cli = { ...cliTel, auth_id: session.user.id };
            }
          }
        }
        if (cli) { setClienteLogado(cli); setTela('menu'); }
      }
    }
    checarSessao();
  }, []);

  function tocarSino() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notas = [880, 1174.66];
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch (e) { /* som é opcional */ }
  }

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (!('Notification' in window)) { setPushStatus('sem-suporte'); return; }
    if (Notification.permission === 'granted') setPushStatus('ativo');
    else if (Notification.permission === 'denied') setPushStatus('bloqueado');
    else setPushStatus('inativo');
  }, []);

  async function ativarNotificacoes() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Este navegador não suporta notificações. No iPhone, adicione o site à tela inicial e abra por lá.');
        return;
      }
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setPushStatus(permissao === 'denied' ? 'bloqueado' : 'inativo');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const j = sub.toJSON();
      await supabase.from('push_subs').upsert({
        barbeiro_id: barbeiroLogado.id,
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
      }, { onConflict: 'endpoint' });
      setPushStatus('ativo');
    } catch (e) {
      alert('Não consegui ativar as notificações. Tente novamente.');
    }
  }

  useEffect(() => {
    if (!barbeiroLogado) return;
    const canal = supabase
      .channel('novos-agendamentos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agendamentos' }, async (payload) => {
        const ag = payload.new;
        if (!ag || ag.origem !== 'cliente' || ag.status !== 'confirmado') return;
        if (!ehAdmin && ag.barbeiro_id !== barbeiroLogado.id) return;
        let nomeCli = 'Cliente';
        try {
          const { data: c } = await supabase.from('clientes').select('nome').eq('id', ag.cliente_id).maybeSingle();
          if (c?.nome) nomeCli = c.nome.split(' ')[0];
        } catch (e) { /* usa fallback */ }
        const [ah, am, ad] = (ag.data || '').split('-');
        const dataFmt = ah ? `${ad}/${am}` : '';
        tocarSino();
        setAvisoNovo({ nome: nomeCli, horario: (ag.horario || '').slice(0, 5), data: dataFmt, dataISO: ag.data });
        if (ag.data === dataParaISO(dataDono)) carregarAgenda(dataDono);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [barbeiroLogado, ehAdmin, dataDono]);

  function gradeDoDia(data, nomeBarbeiro) {
    const dow = data.getDay();
    // resolve o barbeiro: parâmetro explícito ou o escolhido no fluxo do cliente
    let nome = nomeBarbeiro;
    if (!nome) {
      if (!barbeiroEscolhido) return { precisaBarbeiro: true };
      // "sem preferência": une os horários de todos os barbeiros que atendem nesse dia
      if (barbeiroEscolhido.semPref) return gradeUniao(dow);
      nome = barbeiroEscolhido.nome;
    }
    const exp = EXPEDIENTE[nome];
    if (!exp || !exp[dow]) return { naoAtende: true };
    const [iH, iM, fH, fM] = exp[dow];
    return gerarGradeExpediente(iH, iM, fH, fM);
  }

  // União dos slots de todos os barbeiros que atendem nesse dia da semana.
  function gradeUniao(dow) {
    const set = new Set();
    Object.values(EXPEDIENTE).forEach((exp) => {
      if (exp[dow]) {
        const [iH, iM, fH, fM] = exp[dow];
        gerarGradeExpediente(iH, iM, fH, fM).periodos.flat().forEach((h) => set.add(h));
      }
    });
    const todos = [...set].sort();
    if (todos.length === 0) return { naoAtende: true };
    const manha = todos.filter((h) => h < '12:00');
    const tarde = todos.filter((h) => h >= '12:00' && h < '18:00');
    const noite = todos.filter((h) => h >= '18:00');
    const periodos = [], nomes = [];
    if (manha.length) { periodos.push(manha); nomes.push('Manhã'); }
    if (tarde.length) { periodos.push(tarde); nomes.push('Tarde'); }
    if (noite.length) { periodos.push(noite); nomes.push('Noite'); }
    return { periodos, nomes };
  }

  function nomeDoBarbeiro(id) {
    return barbeiros.find((b) => b.id === id)?.nome || null;
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

  function foraDaJanela(data) {
    const zero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const limite = new Date(zero);
    limite.setDate(limite.getDate() + 30);
    return data > limite;
  }

  function mudarMes(delta) {
    const nova = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1);
    const mesMin = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    limite.setDate(limite.getDate() + 30);
    const mesMax = new Date(limite.getFullYear(), limite.getMonth(), 1);
    if (nova < mesMin || nova > mesMax) return; // não sai da janela permitida
    setMesAtual(nova);
  }

  async function tentarEntrar() {
    setErroLogin('');
    if (!loginTel.trim() || !loginSenha.trim()) { setErroLogin('Preencha celular e senha.'); return; }
    setProcessandoLogin(true);
    const email = telParaEmail(loginTel);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: loginSenha.trim() });
    if (error) {
      if (error.message.toLowerCase().includes('invalid')) {
        const { data: existe } = await supabase.from('clientes').select('id').eq('telefone', loginTel.trim()).maybeSingle();
        if (existe) {
          // Cliente existe em clientes mas o login falhou. Pode ser conta de Auth perdida
          // (cadastro antigo). Tenta recriar a conta de Auth com a senha digitada.
          const { data: signData, error: signErr } = await supabase.auth.signUp({ email, password: loginSenha.trim() });
          if (!signErr && signData?.user) {
            // conta de Auth não existia mesmo: recriada. Realinha o cliente e entra.
            await supabase.from('clientes').update({ auth_id: signData.user.id }).eq('id', existe.id);
            const { data: cliRec } = await supabase.from('clientes').select('*').eq('id', existe.id).maybeSingle();
            setProcessandoLogin(false);
            localStorage.setItem('primen_tel', loginTel.trim());
            setClienteLogado(cliRec);
            setTela('menu');
            return;
          }
          // signUp falhou porque a conta de Auth existe → senha estava errada mesmo.
          setProcessandoLogin(false);
          setErroLogin('Senha incorreta.');
        } else {
          setProcessandoLogin(false);
          setTela('cadastro');
        }
      } else {
        setProcessandoLogin(false);
        setErroLogin('Erro ao entrar. Tente novamente.');
      }
      return;
    }
    let { data: cli } = await supabase.from('clientes').select('*').eq('auth_id', data.user.id).maybeSingle();
    // Cadastros antigos podem ter auth_id desalinhado: acha por telefone e realinha.
    if (!cli) {
      const { data: cliTel } = await supabase.from('clientes').select('*').eq('telefone', loginTel.trim()).maybeSingle();
      if (cliTel) {
        await supabase.from('clientes').update({ auth_id: data.user.id }).eq('id', cliTel.id);
        cli = { ...cliTel, auth_id: data.user.id };
      }
    }
    setProcessandoLogin(false);
    if (!cli) { setErroLogin('Não encontrei seu cadastro. Tente novamente ou refaça o cadastro.'); return; }
    localStorage.setItem('primen_tel', loginTel.trim());
    setClienteLogado(cli);
    setTela('menu');
  }

  async function cadastrar() {
    setErroLogin('');
    if (!cadastroNome.trim()) { setErroLogin('Digite seu nome.'); return; }
    if (cadastroSenha.length < 6) { setErroLogin('A senha precisa ter pelo menos 6 caracteres.'); return; }
    setProcessandoLogin(true);
    const email = telParaEmail(loginTel);
    const { data: signData, error: signError } = await supabase.auth.signUp({ email, password: cadastroSenha });
    if (signError) {
      setProcessandoLogin(false);
      if (signError.message.toLowerCase().includes('already')) { setErroLogin('Esse número já tem conta. Volte e faça login.'); }
      else { setErroLogin('Erro ao criar conta. Tente novamente.'); }
      return;
    }
    const { data: novo, error: erroCli } = await supabase.from('clientes')
      .insert({ nome: cadastroNome.trim(), telefone: loginTel.trim(), auth_id: signData.user.id })
      .select().single();
    setProcessandoLogin(false);
    if (erroCli) { setErroLogin('Erro ao salvar seus dados. Tente novamente.'); return; }
    localStorage.setItem('primen_tel', loginTel.trim());
    setClienteLogado(novo);
    setCadastroNome(''); setCadastroSenha('');
    setTela('menu');
  }

  async function sairDaConta() {
    await supabase.auth.signOut();
    setClienteLogado(null);
    setLoginSenha('');
    setTela('login');
  }

  async function entrarComoEquipe() {
    setErroEquipe('');
    if (!equipeUsuario.trim() || !equipeSenha.trim()) { setErroEquipe('Preencha usuário e senha.'); return; }
    const email = `${equipeUsuario.trim().toLowerCase()}@primen.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: equipeSenha.trim() });
    if (error) { setErroEquipe('Usuário ou senha incorretos.'); return; }
    const { data: barb } = await supabase.from('barbeiros').select('*').eq('auth_id', data.user.id).maybeSingle();
    if (!barb) { setErroEquipe('Este login não está ligado a um barbeiro.'); await supabase.auth.signOut(); return; }
    setBarbeiroLogado(barb);
    setEquipeUsuario(''); setEquipeSenha('');
    setModo('dono');
    carregarAgenda(dataDono, barb);
    carregarFinanceiro(barb);
  }

  async function sairDaEquipe() {
    await supabase.auth.signOut();
    setBarbeiroLogado(null);
    setModo('cliente');
    setMostrarFinanceiro(false);
  }

  async function escolherData(data) {
    setDataEscolhida(data);
    setPeriodoEscolhido(0);
    setHorarioEscolhido(null);
    setHorariosOcupados([]);
    setDiaFechadoCliente(false);
    const dataISO = dataParaISO(data);
    const { data: bloqueios } = await supabase.from('dias_bloqueados').select('barbeiro_id, hora_inicio, hora_fim').eq('data', dataISO);
    const barbeiroId = barbeiroEscolhido && !barbeiroEscolhido.semPref ? barbeiroEscolhido.id : null;
    const bloqueiosDia = (bloqueios || []).filter((b) => !b.hora_inicio);
    const bloqueiosFaixa = (bloqueios || []).filter((b) => b.hora_inicio);
    if (bloqueiosDia.length > 0) {
      const fechadoGeral = bloqueiosDia.some((b) => b.barbeiro_id === null);
      const fechadoDele = barbeiroId && bloqueiosDia.some((b) => b.barbeiro_id === barbeiroId);
      if (fechadoGeral || fechadoDele) { setDiaFechadoCliente(true); return; }
    }
    const faixasBloqueadas = bloqueiosFaixa.filter((b) => b.barbeiro_id === null || b.barbeiro_id === barbeiroId);
    // busca TODOS os agendamentos do dia (todos os barbeiros) — o cálculo por barbeiro é feito depois
    const { data: ocupados } = await supabase.from('agendamentos').select('horario, barbeiro_id, duracao_min').eq('data', dataISO).neq('status', 'cancelado');
    const gradeDia = gradeDoDia(data, barbeiroEscolhido?.nome);
    const listaDia = (gradeDia.periodos || []).flat();
    // expande cada agendamento nos slots que ocupa, agrupado por barbeiro_id
    const porBarbeiro = {};
    (ocupados || []).forEach((o) => {
      const ini = o.horario.slice(0, 5);
      const slots = Math.max(1, Math.ceil((o.duracao_min || 15) / 15));
      const idx = listaDia.indexOf(ini);
      const bid = o.barbeiro_id || 'sem';
      if (!porBarbeiro[bid]) porBarbeiro[bid] = [];
      if (idx === -1) { porBarbeiro[bid].push(ini); return; }
      for (let k = 0; k < slots; k++) {
        if (listaDia[idx + k]) porBarbeiro[bid].push(listaDia[idx + k]);
      }
    });
    // faixas bloqueadas viram horários indisponíveis pra todos
    let faixaHorarios = [];
    if (faixasBloqueadas.length > 0) {
      faixasBloqueadas.forEach((b) => {
        const ini = b.hora_inicio.slice(0, 5);
        const fim = b.hora_fim ? b.hora_fim.slice(0, 5) : ini;
        faixaHorarios = faixaHorarios.concat(listaDia.filter((h) => h >= ini && h < fim));
      });
    }
    // almoço fixo de cada barbeiro vira horário ocupado dele (todo dia)
    barbeiros.forEach((b) => {
      if (!b.almoco_inicio) return;
      const ini = b.almoco_inicio.slice(0, 5);
      const fim = b.almoco_fim ? b.almoco_fim.slice(0, 5) : ini;
      if (!porBarbeiro[b.id]) porBarbeiro[b.id] = [];
      porBarbeiro[b.id] = porBarbeiro[b.id].concat(listaDia.filter((h) => h >= ini && h < fim));
    });
    // horário de trabalho do dia (exceção pontual): corta o que está fora do intervalo definido
    const { data: horariosDia } = await supabase.from('horarios_dia').select('barbeiro_id, hora_inicio, hora_fim').eq('data', dataISO);
    (horariosDia || []).forEach((hd) => {
      const ini = hd.hora_inicio.slice(0, 5);
      const fim = hd.hora_fim.slice(0, 5);
      if (!porBarbeiro[hd.barbeiro_id]) porBarbeiro[hd.barbeiro_id] = [];
      // tudo antes do início OU no fim/depois vira indisponível
      porBarbeiro[hd.barbeiro_id] = porBarbeiro[hd.barbeiro_id].concat(listaDia.filter((h) => h < ini || h >= fim));
    });
    setOcupadosPorBarbeiro(porBarbeiro);
    setFaixaHorariosDia(faixaHorarios);
    // compat: horariosOcupados = ocupados do barbeiro do pai + faixas (usado quando não há acompanhante)
    const doBarbeiroPai = barbeiroId ? (porBarbeiro[barbeiroId] || []) : Object.values(porBarbeiro).flat();
    setHorariosOcupados([...doBarbeiroPai, ...faixaHorarios]);
  }

  async function confirmarAgendamento() {
    setErroSalvar('');
    if (servicosEscolhidos.length === 0) { setErroSalvar('Escolha ao menos um serviço.'); return; }
    if (temAcompanhante && servicosFilho.length === 0) { setErroSalvar('Escolha ao menos um serviço para o acompanhante.'); return; }
    if (!clienteLogado?.id) { setErroSalvar('Sua sessão expirou. Saia e entre de novo para confirmar.'); return; }
    setSalvando(true);

    // Nunca deixa o botão preso em "Salvando..." — corta em 12s se algo não responder.
    const comTimeout = (promise, ms = 12000) => Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), ms)),
    ]);

    try {
      // Garante que a sessão está válida antes de gravar (RLS exige auth.uid()).
      let sessRes = await comTimeout(supabase.auth.getSession(), 8000);
      let sessaoAtual = sessRes?.data?.session || null;
      if (!sessaoAtual && !sessRes?.__timeout) {
        const refr = await comTimeout(supabase.auth.refreshSession(), 8000);
        sessaoAtual = refr?.data?.session || null;
      }
      if (!sessaoAtual) {
        setSalvando(false);
        setErroSalvar('Sua sessão expirou. Saia e entre de novo para confirmar o agendamento.');
        return;
      }

      const dataISO = dataParaISO(dataEscolhida);
      const duracaoPai = Math.max(1, Math.ceil(duracaoTotal / 15)) * 15;
      const grupoId = temAcompanhante ? (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) : null;

      // agendamento do PAI
      const resPai = await comTimeout(supabase.from('agendamentos').insert({
        cliente_id: clienteLogado.id, barbeiro_id: barbeiroEscolhido?.id || null, servico_id: servicoEscolhido.id,
        data: dataISO, horario: horarioEscolhido, status: 'confirmado', origem: 'cliente',
        duracao_min: duracaoPai, grupo_id: grupoId,
      }).select().maybeSingle());

      if (resPai?.__timeout) {
        setSalvando(false);
        setErroSalvar('A conexão demorou demais. Confira sua internet e tente de novo.');
        return;
      }
      const agPai = resPai?.data;
      const erroPai = resPai?.error;
      if (erroPai || !agPai) {
        setSalvando(false);
        const cod = erroPai?.code || '';
        if (cod === '23505') { setErroSalvar('Esse horário já foi reservado. Escolha outro.'); }
        else if (cod === '42501' || (erroPai?.message || '').toLowerCase().includes('row-level security')) { setErroSalvar('Sua sessão expirou. Saia e entre de novo para confirmar.'); }
        else if (!agPai && !erroPai) { setErroSalvar('Não consegui confirmar. Saia, entre de novo e tente mais uma vez.'); }
        else { setErroSalvar('Não consegui confirmar agora. Tente de novo em instantes.'); }
        return;
      }
      await supabase.from('agendamento_servicos').insert(servicosEscolhidos.map((s) => ({ agendamento_id: agPai.id, servico_id: s.id })));

    // agendamento do FILHO (se houver)
    if (temAcompanhante) {
      const duracaoFilhoReserva = Math.max(1, Math.ceil(duracaoFilho / 15)) * 15;
      // sequencial (mesmo barbeiro): filho começa quando o pai termina; paralelo: mesmo horário
      const horarioFilhoInicio = modoAcompanhante === 'mesmo' ? horarioFim(horarioEscolhido, duracaoPai) : horarioEscolhido;
      const barbeiroFilhoId = modoAcompanhante === 'mesmo' ? (barbeiroEscolhido?.id || null) : (barbeiroFilho?.id || null);
      const { data: agFilho, error: erroFilho } = await supabase.from('agendamentos').insert({
        cliente_id: clienteLogado.id, barbeiro_id: barbeiroFilhoId, servico_id: servicosFilho[0].id,
        data: dataISO, horario: horarioFilhoInicio, status: 'confirmado', origem: 'cliente',
        duracao_min: duracaoFilhoReserva, grupo_id: grupoId, nome_acompanhante: nomeFilho.trim(),
      }).select().single();
      if (!erroFilho && agFilho) {
        await supabase.from('agendamento_servicos').insert(servicosFilho.map((s) => ({ agendamento_id: agFilho.id, servico_id: s.id })));
      }
    }

    setSalvando(false);
    if (agRemarcando) {
      await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', agRemarcando.id);
      setAgRemarcando(null);
    }
    setEtapa('sucesso');
    } catch (e) {
      setSalvando(false);
      setErroSalvar('Algo deu errado ao confirmar. Tente de novo; se persistir, saia e entre de novo.');
    }
  }

  function recomecarAgendamento() {
    setEtapa('inicio'); setServicoEscolhido(null); setServicosEscolhidos([]); setBarbeiroEscolhido(null);
    setDataEscolhida(null); setHorarioEscolhido(null); setPeriodoEscolhido(0);
    setHorariosOcupados([]); setErroSalvar(''); setDiaFechadoCliente(false); setAgRemarcando(null);
    setTemAcompanhante(false); setNomeFilho(''); setModoAcompanhante('mesmo'); setServicosFilho([]); setBarbeiroFilho(null);
  }

  function abrirWhatsApp() {
    const dataTexto = dataEscolhida?.toLocaleDateString('pt-BR');
    const msg = `Olá! Acabei de agendar pelo app:%0A%0A*${servicosEscolhidos.map((s) => s.nome).join(' + ')}*%0Acom ${barbeiroEscolhido?.nome}%0A${dataTexto} às ${horarioEscolhido}%0A%0AMeu nome: ${clienteLogado?.nome}%0AConfirmo minha presença!`;
    window.open(`https://wa.me/${WHATSAPP_BARBEARIA}?text=${msg}`, '_blank');
  }

  async function carregarMeusHorarios() {
    if (!clienteLogado) return;
    setCarregandoMeus(true);
    const hojeISO = dataParaISO(new Date());
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('id, data, horario, servico_id, barbeiro_id, servicos(nome), barbeiros(nome)')
      .eq('cliente_id', clienteLogado.id)
      .eq('status', 'confirmado')
      .gte('data', hojeISO)
      .order('data', { ascending: true })
      .order('horario', { ascending: true });
    setMeusHorarios(ags || []);
    setCarregandoMeus(false);
  }
  async function cancelarMeuHorario(ag) {
    const ok = window.confirm('Cancelar este horário? Essa ação libera a vaga.');
    if (!ok) return;
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado' })
      .eq('id', ag.id);
    if (error) { alert('Não consegui cancelar. Tenta de novo.'); return; }
    carregarMeusHorarios();
  }
  function remarcarMeuHorario(ag) {
    const svc = { id: ag.servico_id, nome: ag.servicos?.nome, preco: ag.servicos?.preco, duracao_min: ag.servicos?.duracao_min };
    setServicoEscolhido(svc);
    setServicosEscolhidos([svc]);
    setBarbeiroEscolhido({ id: ag.barbeiro_id, nome: ag.barbeiros?.nome });
    setTemAcompanhante(false); setNomeFilho(''); setServicosFilho([]); setBarbeiroFilho(null);
    setAgRemarcando(ag);
    setEtapa('dataHora');
    setTela('agendar');
  }
  async function carregarAgenda(data, barbRef, filtroOverride) {
    const barb = barbRef || barbeiroLogado;
    const filtro = filtroOverride !== undefined ? filtroOverride : filtroBarbeiro;
    setCarregandoAgenda(true);
    const dataISO = dataParaISO(data);
    let query = supabase
      .from('agendamentos')
      .select('id, horario, status, origem, servico_id, barbeiro_id, duracao_min, nome_acompanhante, grupo_id, clientes(id, nome, telefone), servicos(nome, preco), barbeiros(nome), agendamento_servicos(servicos(nome, preco))')
      .eq('data', dataISO).neq('status', 'cancelado');
    if (barb && barb.nivel !== 'admin') query = query.eq('barbeiro_id', barb.id);
    else if (filtro !== 'todos') query = query.eq('barbeiro_id', filtro);
    const { data: ags } = await query.order('horario', { ascending: true });
    const agsComTotais = (ags || []).map((a) => {
      const lista = (a.agendamento_servicos || []).map((r) => r.servicos).filter(Boolean);
      const nomes = lista.length > 0 ? lista.map((s) => s.nome).join(' + ') : a.servicos?.nome;
      const total = lista.length > 0 ? lista.reduce((soma, s) => soma + Number(s.preco || 0), 0) : Number(a.servicos?.preco || 0);
      return { ...a, servicosNomes: nomes, servicosTotal: total };
    });
    const { data: bloqs } = await supabase.from('dias_bloqueados').select('id, barbeiro_id, motivo').eq('data', dataISO);
    const { data: hdia } = await supabase.from('horarios_dia').select('barbeiro_id, hora_inicio, hora_fim').eq('data', dataISO);
    const { data: movs } = await supabase.from('movimentacoes').select('agendamento_id').eq('data', dataISO).eq('categoria', 'servico');
    setAgsPagos((movs || []).map((m) => m.agendamento_id).filter(Boolean));
    setAgendaDoDia(agsComTotais);
    setBloqueiosDoDia(bloqs || []);
    setHorariosDiaAgenda(hdia || []);
    setCarregandoAgenda(false);
    setPagamentoAg(null);
  }

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

  function abrirVenda(p) {
    setVendaProduto(p);
    setVendaQtd('1');
    setErroVenda('');
  }

  async function confirmarVenda() {
    setErroVenda('');
    const qtd = parseInt(vendaQtd) || 0;
    if (qtd <= 0) { setErroVenda('Quantidade inválida.'); return; }
    if (qtd > vendaProduto.estoque) { setErroVenda('Estoque insuficiente (' + vendaProduto.estoque + ' disponível).'); return; }
    const valorTotal = qtd * Number(vendaProduto.preco);
    await supabase.from('produtos').update({ estoque: vendaProduto.estoque - qtd }).eq('id', vendaProduto.id);
    await supabase.from('movimentacoes').insert({
      descricao: `Venda: ${vendaProduto.nome} x${qtd}`,
      valor: valorTotal, categoria: 'produto', produto_id: vendaProduto.id, quantidade: qtd,
      data: dataParaISO(new Date()),
    });
    setVendaProduto(null);
    carregarProdutos();
    carregarFinanceiro();
  }

  function abrirPagamento(ag) {
    setPagamentoAg(ag);
    setFormaPagamento('dinheiro');
    setExtrasPagamento([]);
    const valor = ag.servicosTotal != null ? ag.servicosTotal : (ag.servicos?.preco || 0);
    setPagamentoValor(valor ? String(valor).replace('.', ',') : '');
  }

  function baseValorPagamento(ag) {
    return ag.servicosTotal != null ? ag.servicosTotal : (ag.servicos?.preco || 0);
  }

  function adicionarExtraPagamento(servicoId) {
    if (!servicoId) return;
    const svc = servicos.find((s) => s.id === servicoId);
    if (!svc) return;
    const novos = [...extrasPagamento, svc];
    setExtrasPagamento(novos);
    const total = baseValorPagamento(pagamentoAg) + novos.reduce((s, x) => s + Number(x.preco), 0);
    setPagamentoValor(String(total.toFixed(2)).replace('.', ','));
  }

  function removerExtraPagamento(idx) {
    const novos = extrasPagamento.filter((_, i) => i !== idx);
    setExtrasPagamento(novos);
    const total = baseValorPagamento(pagamentoAg) + novos.reduce((s, x) => s + Number(x.preco), 0);
    setPagamentoValor(String(total.toFixed(2)).replace('.', ','));
  }

  async function confirmarPagamento() {
    const valorNum = parseFloat(pagamentoValor.replace(',', '.')) || 0;
    const nomesExtras = extrasPagamento.map((s) => s.nome).join(' + ');
    const descBase = pagamentoAg.servicosNomes || pagamentoAg.servicos?.nome || 'serviço';
    const desc = nomesExtras ? `${descBase} + ${nomesExtras}` : descBase;
    await supabase.from('movimentacoes').insert({
      descricao: `Atendimento: ${desc} (${pagamentoAg.clientes?.nome || 'cliente'})`,
      valor: valorNum, categoria: 'servico', barbeiro_id: pagamentoAg.barbeiro_id || null,
      agendamento_id: pagamentoAg.id, data: dataParaISO(dataDono), forma_pagamento: formaPagamento,
    });
    setExtrasPagamento([]);
    setPagamentoAg(null);
    carregarAgenda(dataDono);
    carregarFinanceiro();
  }

  async function carregarFinanceiro(barbRef, filtroOverride) {
    const barb = barbRef || barbeiroLogado;
    const filtro = filtroOverride !== undefined ? filtroOverride : filtroBarbeiro;
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    let query = supabase.from('movimentacoes')
      .select('*, barbeiros(nome)')
      .gte('data', dataParaISO(ini)).lte('data', dataParaISO(fim));
    if (barb && barb.nivel !== 'admin') {
      query = query.eq('categoria', 'servico').eq('barbeiro_id', barb.id);
    } else if (filtro !== 'todos') {
      query = query.eq('barbeiro_id', filtro);
    }
    const { data } = await query.order('criado_em', { ascending: false });
    setMovimentacoes(data || []);
  }

  function trocarFiltroBarbeiro(valor) {
    setFiltroBarbeiro(valor);
    carregarAgenda(dataDono, null, valor);
    carregarFinanceiro(null, valor);
  }


  async function removerMovimentacao(id) {
    await supabase.from('movimentacoes').delete().eq('id', id);
    carregarFinanceiro();
  }

  function movsFiltradas() {
    if (finPeriodo === 'dia') {
      const hojeISO = dataParaISO(new Date());
      return movimentacoes.filter((m) => m.data === hojeISO);
    }
    return movimentacoes;
  }

  function mudarDiaDono(delta) {
    const nova = new Date(dataDono);
    nova.setDate(nova.getDate() + delta);
    setDataDono(nova);
    setMostrarFormManual(false); setMostrarFormBloqueio(false);
    carregarAgenda(nova);
  }

  function abrirEditorAlmoco() {
    const b = barbeiroLogado;
    setAlmocoIni(b?.almoco_inicio ? b.almoco_inicio.slice(0, 5) : '');
    setAlmocoFim(b?.almoco_fim ? b.almoco_fim.slice(0, 5) : '');
    setMostrarAlmoco(!mostrarAlmoco);
  }

  async function salvarAlmoco() {
    await supabase.from('barbeiros').update({ almoco_inicio: almocoIni || null, almoco_fim: almocoFim || null }).eq('id', barbeiroLogado.id);
    setBarbeiroLogado({ ...barbeiroLogado, almoco_inicio: almocoIni || null, almoco_fim: almocoFim || null });
    const { data } = await supabase.from('barbeiros').select('*').eq('ativo', true);
    if (data) setBarbeiros(data);
    setMostrarAlmoco(false);
  }

  function abrirEditorHorarioDia() {
    if (mostrarHorarioDia) { setMostrarHorarioDia(false); return; }
    setHdData(dataParaISO(dataDono));
    setHdIni(''); setHdFim('');
    setHdBarbeiro(ehAdmin ? (barbeiroLogado?.id || '') : (barbeiroLogado?.id || ''));
    setMostrarAlmoco(false);
    setMostrarHorarioDia(true);
  }

  async function salvarHorarioDia() {
    const alvo = ehAdmin ? (hdBarbeiro || barbeiroLogado?.id) : barbeiroLogado?.id;
    if (!alvo) { alert('Escolha o barbeiro.'); return; }
    if (!hdData) { alert('Escolha o dia.'); return; }
    if (!hdIni || !hdFim) { alert('Preencha o horário de início e fim.'); return; }
    if (hdFim <= hdIni) { alert('O fim precisa ser maior que o início.'); return; }
    // upsert (unique barbeiro_id + data): apaga o anterior desse barbeiro/dia e insere
    await supabase.from('horarios_dia').delete().eq('barbeiro_id', alvo).eq('data', hdData);
    const { error } = await supabase.from('horarios_dia').insert({ barbeiro_id: alvo, data: hdData, hora_inicio: hdIni, hora_fim: hdFim });
    if (error) { alert('Não consegui salvar. Tenta de novo.'); return; }
    setMostrarHorarioDia(false);
    const [ano, mes, dia] = hdData.split('-').map(Number);
    setDataDono(new Date(ano, mes - 1, dia));
    carregarAgenda(new Date(ano, mes - 1, dia));
  }

  async function limparHorarioDia() {
    const alvo = ehAdmin ? (hdBarbeiro || barbeiroLogado?.id) : barbeiroLogado?.id;
    if (!alvo || !hdData) { setMostrarHorarioDia(false); return; }
    await supabase.from('horarios_dia').delete().eq('barbeiro_id', alvo).eq('data', hdData);
    setMostrarHorarioDia(false);
    carregarAgenda(dataDono);
  }

  function irParaDiaDono(dataISO) {
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const nova = new Date(ano, mes - 1, dia);
    setDataDono(nova);
    setMostrarCalendarioDono(false);
    setMostrarFormManual(false); setMostrarFormBloqueio(false);
    carregarAgenda(nova);
  }

  async function cancelarAgendamentoDono(a) {
    const quem = a.nome_acompanhante || a.clientes?.nome || 'cliente';
    if (!confirm('Cancelar o horário de ' + quem + '?')) return;
    await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', a.id);
    carregarAgenda(dataDono);
  }

  async function salvarNomeCliente(a) {
    const novo = nomeEditado.trim();
    if (!novo) return;
    const clienteId = a.clientes?.id || a.cliente_id;
    if (!clienteId) { alert('Não consegui identificar o cliente.'); return; }
    setSalvandoNome(true);
    const { error } = await supabase.from('clientes').update({ nome: novo }).eq('id', clienteId);
    setSalvandoNome(false);
    if (error) { alert('Não consegui salvar o nome. Tente de novo.'); return; }
    // atualiza o modal aberto e recarrega a agenda pra refletir em todo lugar
    setModalAg({ ...a, clientes: { ...(a.clientes || {}), id: clienteId, nome: novo } });
    setEditandoNome(false);
    carregarAgenda(dataDono);
  }

  function whatsappCliente(a) {
    const tel = (a.clientes?.telefone || '').replace(/\D/g, '');
    if (tel.length < 10) { alert('Esse cliente não tem WhatsApp cadastrado.'); return; }
    const nome = (a.clientes?.nome || '').split(' ')[0];
    const dataTexto = dataDono.toLocaleDateString('pt-BR');
    const msg = `Olá ${nome}! Aqui é da Primen Barbershop, sobre seu horário de ${a.horario.slice(0, 5)} no dia ${dataTexto}.`;
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function remarcarPeloDono(a) {
    setRemarcarAg(a);
    setRemarcarData(dataParaISO(dataDono));
    setRemarcarHorario('');
    setModalAg(null);
    carregarOcupadosRemarcar(dataParaISO(dataDono), a);
  }

  async function carregarOcupadosRemarcar(dataISO, a) {
    setRemarcarHorario('');
    const barbId = a.barbeiro_id;
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const dataObj = new Date(ano, mes - 1, dia);
    const gradeDia = gradeDoDia(dataObj, nomeDoBarbeiro(barbId));
    const listaDia = (gradeDia.periodos || []).flat();
    // agendamentos do mesmo barbeiro no dia (menos o próprio, que vai ser cancelado)
    let query = supabase.from('agendamentos').select('id, horario, barbeiro_id, duracao_min').eq('data', dataISO).neq('status', 'cancelado');
    if (barbId) query = query.eq('barbeiro_id', barbId);
    const { data: ags } = await query;
    let ocup = [];
    (ags || []).forEach((o) => {
      if (o.id === a.id) return; // ignora o próprio agendamento
      const ini = o.horario.slice(0, 5);
      const slots = Math.max(1, Math.ceil((o.duracao_min || 15) / 15));
      const idx = listaDia.indexOf(ini);
      if (idx === -1) { ocup.push(ini); return; }
      for (let k = 0; k < slots; k++) if (listaDia[idx + k]) ocup.push(listaDia[idx + k]);
    });
    // bloqueios de faixa do dia
    const { data: bloqs } = await supabase.from('dias_bloqueados').select('barbeiro_id, hora_inicio, hora_fim').eq('data', dataISO);
    (bloqs || []).forEach((b) => {
      if (b.barbeiro_id && b.barbeiro_id !== barbId) return;
      if (b.hora_inicio) {
        const ini = b.hora_inicio.slice(0, 5); const fim = b.hora_fim ? b.hora_fim.slice(0, 5) : ini;
        ocup = ocup.concat(listaDia.filter((h) => h >= ini && h < fim));
      } else {
        ocup = ocup.concat(listaDia); // dia fechado
      }
    });
    setRemarcarOcupados(ocup);
  }

  async function salvarRemarcacao() {
    if (!remarcarHorario) { alert('Escolha o novo horário.'); return; }
    setRemarcarSalvando(true);
    const { error } = await supabase.from('agendamentos')
      .update({ data: remarcarData, horario: remarcarHorario })
      .eq('id', remarcarAg.id);
    setRemarcarSalvando(false);
    if (error) { alert('Não consegui remarcar. Tenta outro horário.'); return; }
    setRemarcarAg(null);
    carregarAgenda(dataDono);
  }

  async function salvarBloqueio() {
    const barbeiroId = bloqueioBarbeiro === 'todos' ? null : bloqueioBarbeiro;
    if (!bloqueioData) { alert('Escolha o dia.'); return; }
    if (bloqueioInicio && bloqueioFim && bloqueioFim <= bloqueioInicio) {
      alert('A hora de fim precisa ser maior que a de início.'); return;
    }
    await supabase.from('dias_bloqueados').insert({
      barbeiro_id: barbeiroId, data: bloqueioData, motivo: bloqueioMotivo.trim() || null,
      hora_inicio: bloqueioInicio || null, hora_fim: bloqueioFim || null,
    });
    setBloqueioMotivo(''); setBloqueioBarbeiro('todos'); setBloqueioInicio(''); setBloqueioFim(''); setMostrarFormBloqueio(false);
    const [ano, mes, dia] = bloqueioData.split('-').map(Number);
    const dataBloqueada = new Date(ano, mes - 1, dia);
    setDataDono(dataBloqueada);
    carregarAgenda(dataBloqueada);
  }

  async function removerBloqueio(id) {
    await supabase.from('dias_bloqueados').delete().eq('id', id);
    carregarAgenda(dataDono);
  }

  async function encaixarHorario(h, barbeiroId) {
    setMostrarFormBloqueio(false);
    setManualNome(''); setManualTel(''); setManualServico(''); setManualHorario(h);
    setManualBarbeiro(barbeiroId || '');
    setManualClienteId(null); setBuscaCliente(''); setManualModoCliente('cadastrado'); setErroManual('');
    setRemarcandoDonoId(null);
    const { data } = await supabase.from('clientes').select('id, nome, telefone').order('nome', { ascending: true });
    setListaClientes(data || []);
    setMostrarFormManual(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function abrirFormManual() {
    if (mostrarFormManual) { setMostrarFormManual(false); return; }
    setMostrarFormBloqueio(false);
    setManualNome(''); setManualTel(''); setManualServico(''); setManualBarbeiro(''); setManualHorario('');
    setManualClienteId(null); setBuscaCliente(''); setManualModoCliente('cadastrado'); setErroManual('');
    setRemarcandoDonoId(null);
    const { data } = await supabase.from('clientes').select('id, nome, telefone').order('nome', { ascending: true });
    setListaClientes(data || []);
    setMostrarFormManual(true);
  }

  function escolherClienteManual(c) {
    setManualClienteId(c.id);
    setManualNome(c.nome || '');
    setManualTel(c.telefone && !c.telefone.startsWith('manual-') ? c.telefone : '');
    setBuscaCliente('');
  }

  async function salvarAgendamentoManual() {
    setErroManual('');
    if (!manualServico || !manualHorario.trim()) {
      setErroManual('Preencha serviço e horário.'); return;
    }
    if (ehAdmin && !manualBarbeiro) { setErroManual('Escolha o barbeiro.'); return; }
    let clienteId = manualClienteId;
    if (!clienteId) {
      if (!manualNome.trim()) { setErroManual('Escolha ou digite o cliente.'); return; }
      const { data: cliente, error: erroCli } = await supabase.from('clientes')
        .insert({ nome: manualNome.trim(), telefone: manualTel.trim() || ('manual-' + Date.now()) }).select().single();
      if (erroCli) { setErroManual('Erro ao cadastrar cliente.'); return; }
      clienteId = cliente.id;
    }
    const barbId = ehAdmin ? (manualBarbeiro || null) : barbeiroLogado.id;
    const svc = servicos.find((s) => s.id === manualServico);
    const duracao = Math.max(1, Math.ceil((svc?.duracao_min || 15) / 15)) * 15;
    const { data: agManual, error: erroAg } = await supabase.from('agendamentos').insert({
      cliente_id: clienteId, barbeiro_id: barbId, servico_id: manualServico,
      data: dataParaISO(dataDono), horario: manualHorario.trim(), status: 'confirmado', origem: 'dono',
      duracao_min: duracao,
    }).select().maybeSingle();
    if (erroAg || !agManual) { setErroManual('Esse horário já está ocupado.'); return; }
    await supabase.from('agendamento_servicos').insert({ agendamento_id: agManual.id, servico_id: manualServico });
    setManualNome(''); setManualTel(''); setManualServico(''); setManualBarbeiro(''); setManualHorario('');
    setManualClienteId(null); setBuscaCliente('');
    setMostrarFormManual(false);
    carregarAgenda(dataDono);
  }

  const estilos = {
    tela: { background: '#0d0d0d', color: '#f2f2f2', minHeight: '100vh', fontFamily: 'sans-serif', padding: '24px' },
    conteudo: { maxWidth: '400px', margin: '0 auto' },
    conteudoLargo: { maxWidth: '1100px', margin: '0 auto' },
    titulo: { color: '#8a8a8a', fontSize: '13px', letterSpacing: '1px', marginBottom: '12px' },
    voltar: { display: 'flex', alignItems: 'center', gap: '8px', color: OURO, fontSize: '13px', cursor: 'pointer', marginBottom: '16px' },
    botao: (ativo) => ({ width: '100%', marginTop: '14px', padding: '12px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '14px', fontWeight: 500, cursor: ativo ? 'pointer' : 'default', opacity: ativo ? 1 : 0.4 }),
    input: { width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid #333', borderRadius: '6px', padding: '10px', fontSize: '14px', color: '#f2f2f2', marginBottom: '10px' },
    label: { fontSize: '12px', color: '#8a8a8a', marginBottom: '6px' },
    link: { fontSize: '11px', color: '#6b6b6b', cursor: 'pointer', textAlign: 'center', marginTop: '20px' },
    botaoSec: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #C9A227', background: 'transparent', color: OURO, fontSize: '12px', fontWeight: 500, cursor: 'pointer', marginBottom: '8px' },
  };

  const movs = movsFiltradas();
  const totalGeral = movs.reduce((s, m) => s + Number(m.valor), 0);
  const totalProdutos = movs.filter((m) => m.categoria === 'produto').reduce((s, m) => s + Number(m.valor), 0);
  const totalServicos = movs.filter((m) => m.categoria === 'servico').reduce((s, m) => s + Number(m.valor), 0);
  const porBarbeiro = {};
  movs.filter((m) => m.categoria === 'servico').forEach((m) => {
    const nome = m.barbeiros?.nome || 'Sem barbeiro';
    porBarbeiro[nome] = (porBarbeiro[nome] || 0) + Number(m.valor);
  });

  function BlocoAgenda() {
    return (
      <>
        <div style={{ marginBottom: '12px', textAlign: 'center', position: 'relative' }}>
          <p style={{ fontSize: '16px', fontWeight: 500, textTransform: 'capitalize', color: OURO, margin: 0, display: 'inline-block', borderBottom: '1px dashed #555', paddingBottom: '3px' }}>
            📅 {dataDono.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
          <input type="date" value={dataParaISO(dataDono)} onChange={(e) => e.target.value && irParaDiaDono(e.target.value)}
            onClick={(e) => { if (e.currentTarget.showPicker) { try { e.currentTarget.showPicker(); } catch (err) {} } }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }} />
        </div>

        {bloqueiosDoDia.map((b) => (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(163,61,61,0.12)', border: '1px solid #a33d3d', borderRadius: '8px', padding: '8px 10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: '#e07a7a' }}>
              {b.hora_inicio ? b.hora_inicio.slice(0, 5) + '–' + (b.hora_fim ? b.hora_fim.slice(0, 5) : '') + ' · ' : 'Dia todo · '}
              {b.barbeiro_id === null ? 'Barbearia' : (barbeiros.find((x) => x.id === b.barbeiro_id)?.nome?.split(' ')[0] || 'barbeiro')}
              {b.motivo ? ' · ' + b.motivo : ''}
            </span>
            {ehAdmin && <span onClick={() => removerBloqueio(b.id)} style={{ fontSize: '11px', color: '#C9A227', cursor: 'pointer' }}>reabrir</span>}
          </div>
        ))}

        <button style={estilos.botaoSec} onClick={abrirFormManual}>
          {mostrarFormManual ? 'Cancelar' : '+ Agendar para cliente'}
        </button>

        {mostrarFormManual && (
          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <span onClick={() => { setManualModoCliente('cadastrado'); setManualClienteId(null); setManualNome(''); setManualTel(''); }}
                style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', border: manualModoCliente === 'cadastrado' ? '1px solid #C9A227' : '1px solid #333', background: manualModoCliente === 'cadastrado' ? 'rgba(201,162,39,0.08)' : 'transparent', color: manualModoCliente === 'cadastrado' ? OURO : '#c9c9c9' }}>Cliente cadastrado</span>
              <span onClick={() => { setManualModoCliente('novo'); setManualClienteId(null); setManualNome(''); setManualTel(''); }}
                style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', border: manualModoCliente === 'novo' ? '1px solid #C9A227' : '1px solid #333', background: manualModoCliente === 'novo' ? 'rgba(201,162,39,0.08)' : 'transparent', color: manualModoCliente === 'novo' ? OURO : '#c9c9c9' }}>Cliente novo</span>
            </div>

            {manualModoCliente === 'cadastrado' ? (
              manualClienteId ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #C9A227', borderRadius: '6px', padding: '10px', marginBottom: '10px', background: 'rgba(201,162,39,0.06)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#f2f2f2' }}>{manualNome}</p>
                    {manualTel && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#8a8a8a' }}>{manualTel}</p>}
                  </div>
                  <span onClick={() => { setManualClienteId(null); setManualNome(''); setManualTel(''); }} style={{ fontSize: '12px', color: '#e07a7a', cursor: 'pointer' }}>trocar</span>
                </div>
              ) : (
                <>
                  <div style={estilos.label}>🔍 Buscar cliente pelo nome</div>
                  <input style={estilos.input} value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Digite o nome..." />
                  {buscaCliente.trim() && (
                    <div style={{ border: '1px solid #262626', borderRadius: '6px', marginBottom: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                      {listaClientes.filter((c) => c.nome?.toLowerCase().includes(buscaCliente.trim().toLowerCase())).slice(0, 30).map((c) => (
                        <div key={c.id} onClick={() => escolherClienteManual(c)} style={{ padding: '8px 10px', borderBottom: '1px solid #1f1f1f', cursor: 'pointer', fontSize: '13px' }}>
                          {c.nome}{c.telefone && !c.telefone.startsWith('manual-') ? <span style={{ fontSize: '11px', color: '#8a8a8a' }}> · {c.telefone}</span> : ''}
                        </div>
                      ))}
                      {listaClientes.filter((c) => c.nome?.toLowerCase().includes(buscaCliente.trim().toLowerCase())).length === 0 && (
                        <p style={{ padding: '8px 10px', margin: 0, fontSize: '12px', color: '#6b6b6b' }}>Nenhum cliente encontrado. Use "Cliente novo".</p>
                      )}
                    </div>
                  )}
                </>
              )
            ) : (
              <>
                <div style={estilos.label}>Nome do cliente</div>
                <input style={estilos.input} value={manualNome} onChange={(e) => setManualNome(e.target.value)} placeholder="Nome" />
                <div style={estilos.label}>WhatsApp (opcional)</div>
                <input style={estilos.input} value={manualTel} onChange={(e) => setManualTel(formatarTelefone(e.target.value))} placeholder="(32) 99999-9999" inputMode="numeric" />
              </>
            )}

            <div style={estilos.label}>Serviço</div>
            <select style={estilos.input} value={manualServico} onChange={(e) => setManualServico(e.target.value)}>
              <option value="">Escolha</option>
              {servicos.map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
            </select>
            {ehAdmin && (
              <>
                <div style={estilos.label}>Barbeiro</div>
                <select style={estilos.input} value={manualBarbeiro} onChange={(e) => setManualBarbeiro(e.target.value)}>
                  <option value="">Escolha o barbeiro</option>
                  {barbeiros.map((b) => (<option key={b.id} value={b.id}>{b.nome}</option>))}
                </select>
              </>
            )}
            <div style={estilos.label}>Horário</div>
            {(() => {
              const barbSel = ehAdmin ? manualBarbeiro : (barbeiroLogado?.id || '');
              const grade = gradeDoDia(dataDono, nomeDoBarbeiro(barbSel));
              const listaDia = (grade.periodos || []).flat();
              if (grade.precisaBarbeiro || grade.naoAtende || listaDia.length === 0) {
                return <input style={estilos.input} value={manualHorario} onChange={(e) => setManualHorario(e.target.value)} placeholder="HH:MM" />;
              }
              // ocupados: agendamentos do dia do barbeiro escolhido (expandidos por duração)
              const ocup = new Set();
              agendaDoDia.forEach((a) => {
                if (barbSel && a.barbeiro_id !== barbSel) return;
                const ini = a.horario.slice(0, 5);
                const slots = Math.max(1, Math.ceil((a.duracao_min || 15) / 15));
                const idx = listaDia.indexOf(ini);
                if (idx === -1) { ocup.add(ini); return; }
                for (let k = 0; k < slots; k++) if (listaDia[idx + k]) ocup.add(listaDia[idx + k]);
              });
              // passados (se o dia da agenda for hoje)
              const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
              const diaAg = new Date(dataDono); diaAg.setHours(0, 0, 0, 0);
              const ehHoje = diaAg.getTime() === hoje0.getTime();
              const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
                  {listaDia.map((h) => {
                    const passou = ehHoje && (() => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm <= agoraMin; })();
                    const indisp = ocup.has(h) || passou;
                    const sel = manualHorario === h;
                    if (indisp) return <div key={h} style={{ textAlign: 'center', fontSize: '11px', padding: '7px 0', borderRadius: '6px', color: '#4a4a4a', border: '1px solid #1f1f1f', textDecoration: 'line-through' }}>{h}</div>;
                    return <div key={h} onClick={() => setManualHorario(h)} style={{ textAlign: 'center', fontSize: '11px', padding: '7px 0', borderRadius: '6px', cursor: 'pointer', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent' }}>{h}</div>;
                  })}
                </div>
              );
            })()}
            {erroManual && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroManual}</p>}
            <button style={estilos.botao(true)} onClick={salvarAgendamentoManual}>Salvar agendamento</button>
          </div>
        )}

        {GrupoProdutos()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '10px' }}>
          <p style={{ ...estilos.titulo, margin: 0 }}>{ehAdmin ? 'AGENDA DO DIA' : 'MINHA AGENDA'}</p>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span onClick={() => setVistaAgenda('lista')} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', border: vistaAgenda === 'lista' ? '1px solid #C9A227' : '1px solid #333', color: vistaAgenda === 'lista' ? OURO : '#8a8a8a' }}>Lista</span>
            <span onClick={() => setVistaAgenda('grade')} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', border: vistaAgenda === 'grade' ? '1px solid #C9A227' : '1px solid #333', color: vistaAgenda === 'grade' ? OURO : '#8a8a8a' }}>Grade</span>
          </div>
        </div>

        {(() => {
          if (carregandoAgenda) return <p style={{ color: '#8a8a8a', textAlign: 'center' }}>Carregando...</p>;

          const cardAg = (a) => {
            const pago = agsPagos.includes(a.id);
            if (vistaAgenda === 'grade') {
              return (
                <div key={a.id} onClick={() => setModalAg(a)}
                  style={{ border: pago ? '1px solid #2f5a3f' : '1px solid #262626', background: pago ? 'rgba(92,182,122,0.08)' : 'rgba(201,162,39,0.04)', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '12px', color: OURO }}>{a.horario.slice(0, 5)}{(a.duracao_min && a.duracao_min > 15) ? '–' + horarioFim(a.horario, a.duracao_min) : ''}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome_acompanhante || a.clientes?.nome || 'Cliente'}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#8a8a8a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.servicosNomes || a.servicos?.nome}</p>
                  {pago && <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#5cb67a' }}>✓ Pago</p>}
                </div>
              );
            }
            return (
              <div key={a.id} onClick={() => setModalAg(a)}
                style={{ border: pago ? '1px solid #2f5a3f' : '1px solid #262626', background: pago ? 'rgba(92,182,122,0.06)' : 'transparent', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: OURO, fontSize: '13px', flexShrink: 0 }}>{a.horario.slice(0, 5)}{(a.duracao_min && a.duracao_min > 15) ? '–' + horarioFim(a.horario, a.duracao_min) : ''}</span>
                  <span style={{ fontSize: '13px', color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome_acompanhante || a.clientes?.nome || 'Cliente'}{a.nome_acompanhante && <span style={{ fontSize: '10px', color: '#8a8a8a' }}> (acomp.)</span>}{!a.nome_acompanhante && a.grupo_id && <span style={{ fontSize: '10px', color: '#8a8a8a' }}> +1</span>}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#8a8a8a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.servicosNomes || a.servicos?.nome}{pago ? ' · ✓ pago' : ''}</p>
              </div>
            );
          };

          const cardVazio = (h, barbId) => vistaAgenda === 'grade' ? (
            <div key={'v' + h} onClick={() => encaixarHorario(h, barbId)}
              style={{ border: '1px dashed #2a2a2a', borderRadius: '8px', padding: '8px', cursor: 'pointer', textAlign: 'center', color: '#5a5a5a' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600 }}>{h}</p>
              <p style={{ margin: '2px 0 0', fontSize: '10px' }}>+ encaixar</p>
            </div>
          ) : (
            <div key={'v' + h} onClick={() => encaixarHorario(h, barbId)}
              style={{ border: '1px dashed #2a2a2a', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#5a5a5a' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{h}</span>
              <span style={{ fontSize: '12px' }}>+ encaixar</span>
            </div>
          );

          // monta a lista de slots do dia pra um barbeiro: agendamento no início, vazio se livre, pula se dentro de um longo
          const montarLinhas = (itens, barbId) => {
            const grade = gradeDoDia(dataDono, nomeDoBarbeiro(barbId));
            const listaDia = (grade.periodos || []).flat();
            if (listaDia.length === 0) return itens.map(cardAg); // fallback (dia sem grade/fechado): só os agendados
            // horários de almoço do barbeiro dessa coluna
            const barbObj = barbeiros.find((b) => b.id === barbId);
            const almocoSet = new Set();
            if (barbObj?.almoco_inicio) {
              const ai = barbObj.almoco_inicio.slice(0, 5);
              const af = barbObj.almoco_fim ? barbObj.almoco_fim.slice(0, 5) : ai;
              listaDia.filter((h) => h >= ai && h < af).forEach((h) => almocoSet.add(h));
            }
            // horário do dia (exceção pontual): o que está fora do intervalo vira "fora do expediente"
            const foraSet = new Set();
            const hdBarb = (horariosDiaAgenda || []).find((x) => x.barbeiro_id === barbId);
            if (hdBarb) {
              const hi = hdBarb.hora_inicio.slice(0, 5);
              const hf = hdBarb.hora_fim.slice(0, 5);
              listaDia.filter((h) => h < hi || h >= hf).forEach((h) => foraSet.add(h));
            }
            const inicioMap = {};
            const ocupadoSet = new Set();
            itens.forEach((a) => {
              const ini = a.horario.slice(0, 5);
              inicioMap[ini] = a;
              const slots = Math.max(1, Math.ceil((a.duracao_min || 15) / 15));
              const idx = listaDia.indexOf(ini);
              if (idx !== -1) for (let k = 1; k < slots; k++) { if (listaDia[idx + k]) ocupadoSet.add(listaDia[idx + k]); }
            });
            const linhas = [];
            let almocoAberto = false;
            let foraAberto = false;
            listaDia.forEach((h) => {
              if (inicioMap[h]) { linhas.push(cardAg(inicioMap[h])); almocoAberto = false; foraAberto = false; }
              else if (ocupadoSet.has(h)) { /* dentro de um agendamento longo: pula */ }
              else if (foraSet.has(h)) {
                if (!foraAberto) { // mostra o bloco "fora do expediente" uma vez, no começo do intervalo
                  linhas.push(<div key={'fora' + h} style={{ border: '1px dashed #2a2a2a', borderRadius: '8px', padding: vistaAgenda === 'grade' ? '8px' : '8px 12px', marginBottom: vistaAgenda === 'grade' ? 0 : '6px', color: '#5a5a5a', textAlign: vistaAgenda === 'grade' ? 'center' : 'left', fontSize: '12px', background: 'rgba(255,255,255,0.015)' }}>🔒 fora do expediente</div>);
                  foraAberto = true;
                }
                almocoAberto = false;
              }
              else if (almocoSet.has(h)) {
                if (!almocoAberto) { // mostra o bloco de almoço uma vez, no começo do intervalo
                  linhas.push(<div key={'alm' + h} style={{ border: '1px solid #2a2a2a', borderRadius: '8px', padding: vistaAgenda === 'grade' ? '8px' : '8px 12px', marginBottom: vistaAgenda === 'grade' ? 0 : '6px', color: '#6b6b6b', textAlign: vistaAgenda === 'grade' ? 'center' : 'left', fontSize: '12px', background: 'rgba(255,255,255,0.02)' }}>🍽️ {h} · almoço</div>);
                  almocoAberto = true;
                }
                foraAberto = false;
              }
              else { linhas.push(cardVazio(h, barbId)); almocoAberto = false; foraAberto = false; }
            });
            itens.forEach((a) => { if (listaDia.indexOf(a.horario.slice(0, 5)) === -1) linhas.push(cardAg(a)); });
            return linhas;
          };

          const wrap = (linhas) => vistaAgenda === 'grade'
            ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>{linhas}</div>
            : <div>{linhas}</div>;

          const emTodos = ehAdmin && filtroBarbeiro === 'todos';
          if (emTodos) {
            const colunas = [...barbeiros].sort((a, b) => (b.nivel === 'admin' ? 1 : 0) - (a.nivel === 'admin' ? 1 : 0)).map((b) => ({ barbeiro: b, itens: agendaDoDia.filter((a) => a.barbeiro_id === b.id) }));
            return (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                {colunas.map(({ barbeiro, itens }) => (
                  <div key={barbeiro.id} style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: OURO, textAlign: 'center', margin: '0 0 8px' }}>{barbeiro.nome?.split(' ')[0]}</p>
                    {wrap(montarLinhas(itens, barbeiro.id))}
                  </div>
                ))}
              </div>
            );
          }
          // filtrado por um barbeiro (ou barbeiro comum logado): uma coluna com grade completa
          const barbAlvo = filtroBarbeiro !== 'todos' ? filtroBarbeiro : (barbeiroLogado && !ehAdmin ? barbeiroLogado.id : null);
          return wrap(montarLinhas(agendaDoDia, barbAlvo));
        })()}

        {modalAg && (() => {
          const a = modalAg;
          const pago = agsPagos.includes(a.id);
          const aberto = pagamentoAg?.id === a.id;
          return (
            <div onClick={() => { setModalAg(null); setPagamentoAg(null); setEditandoNome(false); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
              <div onClick={(e) => e.stopPropagation()}
                style={{ background: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '340px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: OURO }}>{a.horario.slice(0, 5)}{(a.duracao_min && a.duracao_min > 15) ? '–' + horarioFim(a.horario, a.duracao_min) : ''}</p>
                  <span onClick={() => { setModalAg(null); setPagamentoAg(null); setEditandoNome(false); }} style={{ fontSize: '18px', color: '#8a8a8a', cursor: 'pointer', lineHeight: 1 }}>×</span>
                </div>
                {editandoNome && !a.nome_acompanhante ? (
                  <div style={{ margin: '4px 0 8px' }}>
                    <input style={{ ...estilos.input, marginBottom: '8px' }} value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} placeholder="Nome do cliente" autoComplete="off" />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button disabled={salvandoNome} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }} onClick={() => salvarNomeCliente(a)}>{salvandoNome ? 'Salvando...' : 'Salvar nome'}</button>
                      <button style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#f2f2f2', fontSize: '13px', cursor: 'pointer' }} onClick={() => setEditandoNome(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 2px', fontSize: '15px', color: '#f2f2f2' }}>{a.nome_acompanhante || a.clientes?.nome || 'Cliente'}{a.nome_acompanhante && <span style={{ fontSize: '11px', color: '#8a8a8a' }}> (acomp. de {a.clientes?.nome?.split(' ')[0]})</span>}</p>
                )}
                <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#c9c9c9' }}>{a.servicosNomes || a.servicos?.nome}</p>
                <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#8a8a8a' }}>{a.barbeiros?.nome || 'Sem preferência'}</p>
                {a.clientes?.telefone && !a.clientes.telefone.startsWith('manual-') && <p style={{ margin: 0, fontSize: '12px', color: '#6b6b6b' }}>{a.clientes.telefone}</p>}
                {pago && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#5cb67a', fontWeight: 500 }}>✓ Pago</p>}

                {aberto ? (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #262626', paddingTop: '12px' }}>
                    <div style={estilos.label}>Valor pago (R$)</div>
                    <input style={estilos.input} value={pagamentoValor} onChange={(e) => setPagamentoValor(e.target.value)} inputMode="decimal" />

                    <div style={estilos.label}>Serviço a mais? (opcional)</div>
                    <select style={{ ...estilos.input, marginBottom: '6px' }} value="" onChange={(e) => { adicionarExtraPagamento(e.target.value); e.target.value = ''; }}>
                      <option value="">+ Adicionar serviço extra</option>
                      {servicos.map((s) => (<option key={s.id} value={s.id}>{s.nome} — R$ {formatarReal(s.preco)}</option>))}
                    </select>
                    {extrasPagamento.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#c9c9c9', padding: '4px 0' }}>
                        <span>+ {s.nome} (R$ {formatarReal(s.preco)})</span>
                        <span onClick={() => removerExtraPagamento(idx)} style={{ color: '#e07a7a', cursor: 'pointer' }}>remover</span>
                      </div>
                    ))}

                    <div style={estilos.label}>Forma de pagamento</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {[['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito'], ['dividir', 'Dividir'], ['assinatura', 'Assinatura'], ['pacote', 'Pacote']].map(([id, label]) => (
                        <span key={id} onClick={() => setFormaPagamento(id)} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: formaPagamento === id ? '1px solid #C9A227' : '1px solid #333', background: formaPagamento === id ? 'rgba(201,162,39,0.08)' : 'transparent', color: formaPagamento === id ? OURO : '#c9c9c9' }}>{label}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }} onClick={() => { confirmarPagamento(); setModalAg(null); }}>Confirmar</button>
                      <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#f2f2f2', fontSize: '13px', cursor: 'pointer' }} onClick={() => setPagamentoAg(null)}>Voltar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {a.clientes?.telefone && !a.clientes.telefone.startsWith('manual-') && (
                      <button onClick={() => whatsappCliente(a)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 'none', background: '#25D366', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>💬 WhatsApp do cliente</button>
                    )}
                    {!pago && <button onClick={() => abrirPagamento(a)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Marcar como pago</button>}
                    <button onClick={() => remarcarPeloDono(a)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #C9A227', background: 'transparent', color: OURO, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Remarcar</button>
                    {!a.nome_acompanhante && (a.clientes?.id || a.cliente_id) && (
                      <button onClick={() => { setNomeEditado(a.clientes?.nome || ''); setEditandoNome(true); }} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#c9c9c9', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>✏️ Editar nome do cliente</button>
                    )}
                    <button onClick={() => { cancelarAgendamentoDono(a); setModalAg(null); }} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #a33d3d', background: 'transparent', color: '#e07a7a', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancelar horário</button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {remarcarAg && (() => {
          const [ano, mes, dia] = remarcarData.split('-').map(Number);
          const dataObj = new Date(ano, mes - 1, dia);
          const gradeDia = gradeDoDia(dataObj, nomeDoBarbeiro(remarcarAg.barbeiro_id));
          const listaDia = (gradeDia.periodos || []).flat();
          const dur = remarcarAg.duracao_min || 15;
          const slots = Math.max(1, Math.ceil(dur / 15));
          const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
          const ehHoje = dataObj.getTime() === hoje0.getTime();
          const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
          const disponivel = (h) => {
            const idx = listaDia.indexOf(h);
            if (idx === -1) return false;
            for (let k = 0; k < slots; k++) {
              const slot = listaDia[idx + k];
              if (!slot) return false;
              if (remarcarOcupados.includes(slot)) return false;
            }
            if (ehHoje) { const [hh, mm] = h.split(':').map(Number); if (hh * 60 + mm <= agoraMin) return false; }
            return true;
          };
          return (
            <div onClick={() => setRemarcarAg(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
              <div onClick={(e) => e.stopPropagation()}
                style={{ background: '#161616', border: '1px solid #333', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '360px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: OURO }}>Remarcar</p>
                  <span onClick={() => setRemarcarAg(null)} style={{ fontSize: '18px', color: '#8a8a8a', cursor: 'pointer' }}>×</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#c9c9c9' }}>{remarcarAg.nome_acompanhante || remarcarAg.clientes?.nome} · {remarcarAg.servicosNomes || remarcarAg.servicos?.nome}</p>
                <div style={estilos.label}>Novo dia</div>
                <input type="date" style={estilos.input} value={remarcarData} onChange={(e) => { if (e.target.value) { setRemarcarData(e.target.value); carregarOcupadosRemarcar(e.target.value, remarcarAg); } }} />
                <div style={estilos.label}>Novo horário</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                  {listaDia.map((h) => {
                    const ok = disponivel(h);
                    const sel = remarcarHorario === h;
                    if (!ok) return <div key={h} style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', color: '#4a4a4a', border: '1px solid #1f1f1f', textDecoration: 'line-through' }}>{h}</div>;
                    return <div key={h} onClick={() => setRemarcarHorario(h)} style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', cursor: 'pointer', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent' }}>{h}</div>;
                  })}
                </div>
                <button disabled={!remarcarHorario || remarcarSalvando} onClick={salvarRemarcacao} style={estilos.botao(!!remarcarHorario && !remarcarSalvando)}>{remarcarSalvando ? 'Salvando...' : 'Confirmar remarcação'}</button>
              </div>
            </div>
          );
        })()}
      </>
    );
  }

  function BlocoFinanceiro() {
    return (
      <>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          {[['dia', 'Hoje'], ['mes', 'Mês']].map(([id, label]) => (
            <div key={id} onClick={() => setFinPeriodo(id)}
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: finPeriodo === id ? '1px solid #C9A227' : '1px solid #333', background: finPeriodo === id ? 'rgba(201,162,39,0.08)' : 'transparent', color: finPeriodo === id ? OURO : '#8a8a8a' }}>{label}</div>
          ))}
        </div>

        <div style={{ textAlign: 'center', border: '1px solid #C9A227', borderRadius: '12px', padding: '18px', marginBottom: '14px', background: 'rgba(201,162,39,0.05)' }}>
          <p style={{ fontSize: '11px', color: '#8a8a8a', margin: 0, letterSpacing: '1px' }}>{ehAdmin ? 'ENTRADAS' : 'MEU FATURAMENTO'} {finPeriodo === 'dia' ? 'DE HOJE' : 'DO MÊS'}</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: OURO, margin: '6px 0 0' }}>R$ {formatarReal(ehAdmin ? totalGeral : totalServicos)}</p>
        </div>

        {ehAdmin && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
            {[['geral', 'Geral'], ['barbeiro', 'Barbeiros'], ['produtos', 'Produtos']].map(([id, label]) => (
              <div key={id} onClick={() => setFinAba(id)}
                style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: finAba === id ? '1px solid #C9A227' : '1px solid #333', background: finAba === id ? 'rgba(201,162,39,0.08)' : 'transparent', color: finAba === id ? OURO : '#8a8a8a' }}>{label}</div>
            ))}
          </div>
        )}

        {!ehAdmin && (
          <>
            <p style={estilos.titulo}>MEUS ATENDIMENTOS PAGOS</p>
            {movs.length === 0 ? (
              <div style={{ textAlign: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '20px', color: '#6b6b6b', fontSize: '13px' }}>Nenhum atendimento pago nesse período.</div>
            ) : (
              movs.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #262626', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '13px' }}>{m.descricao}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#6b6b6b' }}>{new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span style={{ color: OURO, fontWeight: 500, fontSize: '13px' }}>R$ {formatarReal(m.valor)}</span>
                </div>
              ))
            )}
          </>
        )}

        {ehAdmin && finAba === 'geral' && (
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

        {ehAdmin && finAba === 'barbeiro' && (
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

        {ehAdmin && finAba === 'produtos' && (
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
    );
  }

  function GrupoHorarios() {
    if (!barbeiroLogado) return null;
    return (
      <>
        <button style={{ ...estilos.botaoSec, marginTop: '8px' }} onClick={abrirEditorAlmoco}>
          {mostrarAlmoco ? 'Cancelar' : '🍽️ Meu horário de almoço'}
        </button>
        {mostrarAlmoco && (
          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', color: '#8a8a8a', margin: '0 0 8px' }}>Esse intervalo fica indisponível pra agendar, todo dia. Pra mudar só num dia específico, use "bloquear horário".</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <input type="time" style={{ ...estilos.input, flex: 1, marginBottom: 0 }} value={almocoIni} onChange={(e) => setAlmocoIni(e.target.value)} />
              <span style={{ color: '#8a8a8a' }}>até</span>
              <input type="time" style={{ ...estilos.input, flex: 1, marginBottom: 0 }} value={almocoFim} onChange={(e) => setAlmocoFim(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }} onClick={salvarAlmoco}>Salvar</button>
              {(almocoIni || almocoFim) && <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#e07a7a', fontSize: '13px', cursor: 'pointer' }} onClick={() => { setAlmocoIni(''); setAlmocoFim(''); }}>Limpar</button>}
            </div>
          </div>
        )}

        <button style={{ ...estilos.botaoSec, marginTop: '8px' }} onClick={abrirEditorHorarioDia}>
          {mostrarHorarioDia ? 'Cancelar' : '🕐 Meu horário nesse dia'}
        </button>
        {mostrarHorarioDia && (
          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', color: '#8a8a8a', margin: '0 0 8px' }}>Pra um imprevisto: define o horário que você vai trabalhar SÓ nesse dia. Fora dele fica indisponível. O almoço continua valendo.</p>
            {ehAdmin && (
              <>
                <div style={estilos.label}>Barbeiro</div>
                <select style={estilos.input} value={hdBarbeiro} onChange={(e) => setHdBarbeiro(e.target.value)}>
                  <option value="">Escolha</option>
                  {barbeiros.map((b) => (<option key={b.id} value={b.id}>{b.nome}</option>))}
                </select>
              </>
            )}
            <div style={estilos.label}>Dia</div>
            <input type="date" style={estilos.input} value={hdData} onChange={(e) => setHdData(e.target.value)} />
            <div style={estilos.label}>Vou trabalhar das</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <input type="time" style={{ ...estilos.input, flex: 1, marginBottom: 0 }} value={hdIni} onChange={(e) => setHdIni(e.target.value)} />
              <span style={{ color: '#8a8a8a' }}>até</span>
              <input type="time" style={{ ...estilos.input, flex: 1, marginBottom: 0 }} value={hdFim} onChange={(e) => setHdFim(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }} onClick={salvarHorarioDia}>Salvar</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#e07a7a', fontSize: '13px', cursor: 'pointer' }} onClick={limparHorarioDia}>Remover</button>
            </div>
          </div>
        )}
      </>
    );
  }

  function GrupoProdutos() {
    if (!ehAdmin) return null;
    return (
      <>
        <button style={{ ...estilos.botaoSec, marginTop: '8px' }} onClick={() => { if (!mostrarProdutos) carregarProdutos(); setMostrarProdutos(!mostrarProdutos); setMostrarFormProduto(false); setVendaProduto(null); }}>
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
    );
  }

  function BlocoAdminExtra() {
    return (
      <>
        {ehAdmin && (
          <button style={estilos.botaoSec} onClick={() => { if (!mostrarFormBloqueio) setBloqueioData(dataParaISO(dataDono)); setMostrarFormBloqueio(!mostrarFormBloqueio); setMostrarFormManual(false); }}>
            {mostrarFormBloqueio ? 'Cancelar' : 'Fechar / bloquear este dia'}
          </button>
        )}
        {ehAdmin && mostrarFormBloqueio && (
          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
            <div style={estilos.label}>Dia</div>
            <input type="date" style={{ ...estilos.input, marginBottom: '8px' }} value={bloqueioData} onChange={(e) => setBloqueioData(e.target.value)} />
            <div style={estilos.label}>Fechar para</div>
            <select style={estilos.input} value={bloqueioBarbeiro} onChange={(e) => setBloqueioBarbeiro(e.target.value)}>
              <option value="todos">Barbearia toda</option>
              {barbeiros.map((b) => (<option key={b.id} value={b.id}>Só {b.nome}</option>))}
            </select>
            <div style={estilos.label}>Horário (deixe vazio pra fechar o dia todo)</div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input type="time" style={{ ...estilos.input, flex: 1 }} value={bloqueioInicio} onChange={(e) => setBloqueioInicio(e.target.value)} />
                          <span style={{ color: '#8a8a8a', alignSelf: 'center' }}>até</span>
                          <input type="time" style={{ ...estilos.input, flex: 1 }} value={bloqueioFim} onChange={(e) => setBloqueioFim(e.target.value)} />
                        </div>
            <div style={estilos.label}>Motivo (opcional)</div>
            <input style={estilos.input} value={bloqueioMotivo} onChange={(e) => setBloqueioMotivo(e.target.value)} placeholder="Ex: folga, feriado" />
            <button style={estilos.botao(true)} onClick={salvarBloqueio}>Confirmar bloqueio</button>
          </div>
        )}

        {GrupoHorarios()}
      </>
    );
  }

  const larguraArea = (modo === 'dono' && ehTelaGrande) ? estilos.conteudoLargo : estilos.conteudo;

  const servicoEhClub = servicosEscolhidos.some((s) => s.nome?.toLowerCase().includes('club'));
  const precoTotal = servicosEscolhidos.reduce((soma, s) => soma + Number(s.preco || 0), 0);
  const duracaoTotal = servicosEscolhidos.reduce((soma, s) => soma + Number(s.duracao_min || 0), 0);

  function alternarServico(s) {
    setServicosEscolhidos((atual) => {
      const jaTem = atual.some((x) => x.id === s.id);
      const nova = jaTem ? atual.filter((x) => x.id !== s.id) : [...atual, s];
      setServicoEscolhido(nova[0] || null);
      return nova;
    });
  }

  const slotsNecessarios = Math.max(1, Math.ceil(duracaoTotal / 15));
  const duracaoFilho = servicosFilho.reduce((soma, s) => soma + Number(s.duracao_min || 0), 0);
  const slotsFilho = Math.max(1, Math.ceil(duracaoFilho / 15));

  // slots livres pra um barbeiro específico a partir do índice idx (n slots seguidos)
  function horarioJaPassou(h) {
    if (!dataEscolhida) return false;
    const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
    const dia0 = new Date(dataEscolhida); dia0.setHours(0, 0, 0, 0);
    if (dia0.getTime() !== hoje0.getTime()) return false; // só bloqueia no dia de hoje
    const [hh, mm] = h.slice(0, 5).split(':').map(Number);
    const agora = new Date();
    return (hh * 60 + mm) <= (agora.getHours() * 60 + agora.getMinutes());
  }

  function slotsLivres(idx, n, todosHorarios, ocupadosBarbeiro) {
    for (let k = 0; k < n; k++) {
      const slot = todosHorarios[idx + k];
      if (!slot) return false;
      if (k === 0 && horarioJaPassou(slot)) return false;
      if (faixaHorariosDia.includes(slot)) return false;
      if (ocupadosBarbeiro.includes(slot)) return false;
    }
    return true;
  }

  function ocupadosDoBarbeiro(barb) {
    if (!barb || barb.semPref) {
      // sem preferência: considera todos os barbeiros ocupados juntos (conservador)
      return Object.values(ocupadosPorBarbeiro).flat();
    }
    return ocupadosPorBarbeiro[barb.id] || [];
  }

  // decide se o horário h está disponível conforme o modo (só pai / paralelo / sequencial)
  function horarioDisponivel(h, todosHorarios) {
    const idx = todosHorarios.indexOf(h);
    if (idx === -1) return false;
    const ocupPai = ocupadosDoBarbeiro(barbeiroEscolhido);
    if (!temAcompanhante) {
      return slotsLivres(idx, slotsNecessarios, todosHorarios, ocupPai);
    }
    if (modoAcompanhante === 'cada') {
      // paralelo: pai (barbeiro A) e filho (barbeiro B) livres no MESMO horário
      const ocupFilho = ocupadosDoBarbeiro(barbeiroFilho);
      const maxSlots = Math.max(slotsNecessarios, slotsFilho);
      return slotsLivres(idx, slotsNecessarios, todosHorarios, ocupPai)
        && slotsLivres(idx, slotsFilho, todosHorarios, ocupFilho)
        && !!todosHorarios[idx + maxSlots - 1];
    }
    // mesmo barbeiro (sequencial): pai + filho seguidos no mesmo barbeiro
    return slotsLivres(idx, slotsNecessarios + slotsFilho, todosHorarios, ocupPai);
  }

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
          <div style={larguraArea}>

            {modo === 'cliente' && (
              <div style={estilos.conteudo}>
                {tela === 'login' && (
                  <>
                    <p style={estilos.titulo}>ENTRAR</p>
                    <div style={estilos.label}>Celular</div>
                    <input style={estilos.input} value={loginTel} onChange={(e) => setLoginTel(formatarTelefone(e.target.value))} placeholder="(32) 99999-9999" inputMode="numeric" autoComplete="tel" name="telefone-login" />
                    <div style={estilos.label}>Senha</div>
                    <input style={estilos.input} type="password" value={loginSenha} onChange={(e) => setLoginSenha(e.target.value)} placeholder="Sua senha" />
                    {erroLogin && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroLogin}</p>}
                    <button onClick={tentarEntrar} disabled={processandoLogin} style={estilos.botao(!processandoLogin)}>{processandoLogin ? 'Entrando...' : 'Entrar'}</button>
                    <p style={{ fontSize: '11px', color: '#6b6b6b', textAlign: 'center', marginTop: '14px' }}>Primeira vez? É só digitar seu celular e uma senha nova que criamos sua conta.</p>
                    <p style={estilos.link} onClick={() => setModo('login-equipe')}>Acesso da equipe</p>
                  </>
                )}

                {tela === 'cadastro' && (
                  <>
                    <div style={estilos.voltar} onClick={() => { setTela('login'); setCadastroSenha(''); setErroLogin(''); }}>← Voltar</div>
                    <p style={estilos.titulo}>CRIAR CONTA</p>
                    <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '14px' }}>Esse número ainda não tem conta. Vamos criar!</p>
                    <div style={estilos.label}>Nome</div>
                    <input style={estilos.input} value={cadastroNome} onChange={(e) => setCadastroNome(e.target.value)} placeholder="Seu nome" autoComplete="name" name="nome-cadastro" />
                    <div style={estilos.label}>Crie uma senha (mín. 6 caracteres)</div>
                    <input style={estilos.input} type="password" value={cadastroSenha} onChange={(e) => setCadastroSenha(e.target.value)} placeholder="Sua senha" autoComplete="new-password" />
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
                    <div onClick={() => {
                        recomecarAgendamento();
                        setTela('agendar');
                      }}
                      style={{ border: '1px solid #C9A227', borderRadius: '12px', padding: '24px', marginBottom: '14px', cursor: 'pointer', textAlign: 'center', background: 'rgba(201,162,39,0.05)' }}>
                      <div style={{ fontSize: '30px', marginBottom: '6px' }}>✂️</div>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '16px', color: OURO }}>Agendar horário</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8a8a8a' }}>Escolha serviço, profissional e horário</p>
                    </div>
                    <div onClick={() => { carregarMeusHorarios(); setTela('meus-horarios'); }}
                  style={{ border: '1px solid #333', borderRadius: '12px', padding: '24px', cursor: 'pointer', textAlign: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '30px', marginBottom: '6px' }}>📋</div>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: '16px' }}>Meus horários</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8a8a8a' }}>Ver, remarcar ou cancelar</p>
                </div>
                  </>
                )}

                {tela === 'meus-horarios' && (
          <>
            <div style={estilos.voltar} onClick={() => setTela('menu')}>← Menu</div>
            <p style={estilos.titulo}>MEUS HORÁRIOS</p>

            {carregandoMeus && <p style={{ color: '#8a8a8a', textAlign: 'center' }}>Carregando...</p>}

            {!carregandoMeus && meusHorarios.length === 0 && (
              <p style={{ color: '#8a8a8a', textAlign: 'center', marginTop: '20px' }}>
                Você não tem horários marcados.
              </p>
            )}

            {!carregandoMeus && meusHorarios.map((ag) => (
              <div key={ag.id} style={{ border: '1px solid #333', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '15px', color: '#f2f2f2' }}>
                  {ag.servicos?.nome}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#c9c9c9' }}>
                  {ag.data.split('-').reverse().join('/')} às {ag.horario.slice(0, 5)}
                </p>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#8a8a8a' }}>
                  com {ag.barbeiros?.nome}
                </p>
                <button
                  onClick={() => remarcarMeuHorario(ag)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px' }}>
                  Remarcar
                </button>
                <button
                  onClick={() => cancelarMeuHorario(ag)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e07a7a', background: 'transparent', color: '#e07a7a', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            ))}
          </>
        )}
                {tela === 'agendar' && (
                  <>
                    {etapa === 'inicio' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setTela('menu')}>← Menu</div>
                        <p style={estilos.titulo}>QUEM VAI SER ATENDIDO?</p>
                        <div onClick={() => { setTemAcompanhante(false); setEtapa('servico'); }}
                          style={{ border: '1px solid #262626', borderRadius: '10px', padding: '18px', marginBottom: '10px', cursor: 'pointer', textAlign: 'center' }}>
                          <div style={{ fontSize: '26px', marginBottom: '4px' }}>🧔</div>
                          <p style={{ margin: 0, fontWeight: 500 }}>Só eu</p>
                        </div>
                        <div onClick={() => setTemAcompanhante(true)}
                          style={{ border: temAcompanhante ? '1px solid #C9A227' : '1px solid #262626', background: temAcompanhante ? 'rgba(201,162,39,0.06)' : 'transparent', borderRadius: '10px', padding: '18px', marginBottom: '10px', cursor: 'pointer', textAlign: 'center' }}>
                          <div style={{ fontSize: '26px', marginBottom: '4px' }}>🧔‍♂️👦</div>
                          <p style={{ margin: 0, fontWeight: 500 }}>Pai e filho</p>
                        </div>
                        {temAcompanhante && (
                          <div style={{ border: '1px solid #333', borderRadius: '10px', padding: '14px', marginTop: '6px' }}>
                            <div style={estilos.label}>Nome do acompanhante</div>
                            <input style={estilos.input} value={nomeFilho} onChange={(e) => setNomeFilho(e.target.value)} placeholder="Ex: João (filho)" />
                            <div style={estilos.label}>Como vão ser atendidos?</div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                              <div onClick={() => setModoAcompanhante('mesmo')}
                                style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', border: modoAcompanhante === 'mesmo' ? '1px solid #C9A227' : '1px solid #333', background: modoAcompanhante === 'mesmo' ? 'rgba(201,162,39,0.08)' : 'transparent', color: modoAcompanhante === 'mesmo' ? OURO : '#c9c9c9' }}>
                                Mesmo barbeiro<br /><span style={{ fontSize: '10px', color: '#8a8a8a' }}>um depois do outro</span>
                              </div>
                              <div onClick={() => setModoAcompanhante('cada')}
                                style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', border: modoAcompanhante === 'cada' ? '1px solid #C9A227' : '1px solid #333', background: modoAcompanhante === 'cada' ? 'rgba(201,162,39,0.08)' : 'transparent', color: modoAcompanhante === 'cada' ? OURO : '#c9c9c9' }}>
                                Cada um com seu barbeiro<br /><span style={{ fontSize: '10px', color: '#8a8a8a' }}>ao mesmo tempo</span>
                              </div>
                            </div>
                            <button disabled={!nomeFilho.trim()} onClick={() => setEtapa('servico')} style={estilos.botao(!!nomeFilho.trim())}>Continuar</button>
                          </div>
                        )}
                      </>
                    )}

                    {etapa === 'servico' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setTela('menu')}>← Menu</div>
                        <p style={estilos.titulo}>ESCOLHA O SERVIÇO</p>
                        <p style={{ fontSize: '12px', color: '#8a8a8a', margin: '0 0 12px' }}>Você pode escolher mais de um.</p>
                        {servicos.map((s) => {
                          const marcado = servicosEscolhidos.some((x) => x.id === s.id);
                          return (
                            <div key={s.id} onClick={() => alternarServico(s)}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: marcado ? '1px solid #C9A227' : '1px solid #262626', background: marcado ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '12px', marginBottom: '8px', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', border: marcado ? '1px solid #C9A227' : '1px solid #555', background: marcado ? OURO : 'transparent', color: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{marcado ? '✓' : ''}</div>
                                <div>
                                  <p style={{ margin: 0, fontWeight: 500 }}>{s.nome}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7a7a7a' }}>{s.duracao_min} min{s.nome?.toLowerCase().includes('club') ? ' · seg a qui' : ''}</p>
                                </div>
                              </div>
                              <p style={{ margin: 0, color: OURO, fontWeight: 500 }}>R$ {formatarReal(s.preco)}</p>
                            </div>
                          );
                        })}
                        {servicosEscolhidos.length > 0 && (
                          <div style={{ position: 'sticky', bottom: 0, background: '#0d0d0d', paddingTop: '10px', marginTop: '6px', borderTop: '1px solid #262626' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '13px', color: '#c9c9c9' }}>{servicosEscolhidos.length} serviço(s) · {duracaoTotal} min</span>
                              <span style={{ fontSize: '16px', fontWeight: 700, color: OURO }}>R$ {formatarReal(precoTotal)}</span>
                            </div>
                            <button onClick={() => setEtapa('equipe')} style={estilos.botao(true)}>Continuar</button>
                          </div>
                        )}
                      </>
                    )}

                    {etapa === 'equipe' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setEtapa('servico')}>← {servicosEscolhidos.map((s) => s.nome).join(' + ')}</div>
                        <p style={estilos.titulo}>EQUIPE DISPONÍVEL</p>
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
                        <button disabled={!barbeiroEscolhido} onClick={() => setEtapa(temAcompanhante ? 'servico-filho' : 'dataHora')} style={estilos.botao(!!barbeiroEscolhido)}>Continuar</button>
                      </>
                    )}

                    {etapa === 'servico-filho' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setEtapa('equipe')}>← Voltar</div>
                        <p style={estilos.titulo}>SERVIÇO DE {nomeFilho.toUpperCase()}</p>
                        <p style={{ fontSize: '12px', color: '#8a8a8a', margin: '0 0 12px' }}>Pode escolher mais de um.</p>
                        {servicos.map((s) => {
                          const marcado = servicosFilho.some((x) => x.id === s.id);
                          return (
                            <div key={s.id} onClick={() => setServicosFilho((atual) => atual.some((x) => x.id === s.id) ? atual.filter((x) => x.id !== s.id) : [...atual, s])}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: marcado ? '1px solid #C9A227' : '1px solid #262626', background: marcado ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '12px', marginBottom: '8px', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', border: marcado ? '1px solid #C9A227' : '1px solid #555', background: marcado ? OURO : 'transparent', color: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{marcado ? '✓' : ''}</div>
                                <div>
                                  <p style={{ margin: 0, fontWeight: 500 }}>{s.nome}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7a7a7a' }}>{s.duracao_min} min</p>
                                </div>
                              </div>
                              <p style={{ margin: 0, color: OURO, fontWeight: 500 }}>R$ {formatarReal(s.preco)}</p>
                            </div>
                          );
                        })}
                        {servicosFilho.length > 0 && (
                          <div style={{ position: 'sticky', bottom: 0, background: '#0d0d0d', paddingTop: '10px', marginTop: '6px', borderTop: '1px solid #262626' }}>
                            <button onClick={() => setEtapa(modoAcompanhante === 'cada' ? 'equipe-filho' : 'dataHora')} style={estilos.botao(true)}>Continuar</button>
                          </div>
                        )}
                      </>
                    )}

                    {etapa === 'equipe-filho' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setEtapa('servico-filho')}>← Voltar</div>
                        <p style={estilos.titulo}>BARBEIRO DE {nomeFilho.toUpperCase()}</p>
                        {barbeiros.map((b) => {
                          const sel = barbeiroFilho?.id === b.id;
                          return (
                            <div key={b.id} onClick={() => setBarbeiroFilho(b)}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}>
                              <AvatarBarbeiro barbeiro={b} tamanho={34} />
                              <div>
                                <p style={{ margin: 0 }}>{b.nome}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '10px', color: OURO }}>★ {Number(b.nota).toFixed(1)}</p>
                              </div>
                            </div>
                          );
                        })}
                        <button disabled={!barbeiroFilho} onClick={() => setEtapa('dataHora')} style={estilos.botao(!!barbeiroFilho)}>Continuar</button>
                      </>
                    )}

                    {etapa === 'dataHora' && (
                      <>
                        <div style={estilos.voltar} onClick={() => setEtapa('equipe')}>← {servicosEscolhidos.map((s) => s.nome).join(' + ')} · {barbeiroEscolhido?.nome}</div>
                        {servicoEhClub && (
                          <div style={{ border: '1px solid #C9A227', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', background: 'rgba(201,162,39,0.08)' }}>
                            <p style={{ margin: 0, fontSize: '11px', color: OURO }}>👑 Club Primen: disponível só de segunda a quinta.</p>
                          </div>
                        )}
                        <p style={estilos.titulo}>ESCOLHA A DATA</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span onClick={() => mudarMes(-1)} style={{ cursor: 'pointer', color: OURO, fontSize: '18px', padding: '0 8px', userSelect: 'none' }}>‹</span>
                          <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                          <span onClick={() => mudarMes(1)} style={{ cursor: 'pointer', color: OURO, fontSize: '18px', padding: '0 8px', userSelect: 'none' }}>›</span>
                        </div>
                        <div style={{ textAlign: 'right', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', color: '#6b6b6b' }}>{servicoEhClub ? 'seg a qui' : 'dom fechado'}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
                          {['D','S','T','Q','Q','S','S'].map((d, i) => (<div key={i} style={{ textAlign: 'center', fontSize: '10px', color: '#6b6b6b' }}>{d}</div>))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '16px' }}>
                          {diasDoMes().map((data, i) => {
                            if (!data) return <div key={i}></div>;
                            const dow = data.getDay();
                            const foraDoClub = servicoEhClub && (dow === 5 || dow === 6);
                            const bloqueado = dow === 0 || ehPassado(data) || foraDaJanela(data) || foraDoClub;
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
                                Cada barbeiro tem horário próprio.<br />Volte e escolha um barbeiro específico.
                              </div>
                            );
                          }
                          if (grade.naoAtende) {
                            return (
                              <div style={{ textAlign: 'center', border: '1px dashed #444', borderRadius: '8px', padding: '16px', color: '#8a8a8a', fontSize: '13px' }}>
                                {barbeiroEscolhido?.nome} não atende nesse dia. Escolha outra data.
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
                                {(() => { const todosDoDia = (grade.periodos || []).flat(); return grade.periodos[periodoEscolhido].map((h) => {
                                  const disponivel = horarioDisponivel(h, todosDoDia);
                                  const sel = horarioEscolhido === h;
                                  if (!disponivel) return (<div key={h} style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', color: '#4a4a4a', border: '1px solid #1f1f1f', textDecoration: 'line-through', cursor: 'default' }}>{h}</div>);
                                  return (
                                    <div key={h} onClick={() => setHorarioEscolhido(h)}
                                      style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', cursor: 'pointer', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent' }}>{h}</div>
                                  );
                                }); })()}
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
                        <p style={{ fontWeight: 500, fontSize: '16px', margin: '10px 0 4px' }}>{temAcompanhante ? 'Horários reservados!' : 'Horário reservado!'}</p>
                        <p style={{ fontSize: '13px', color: '#a3a3a3', margin: '0 0 4px' }}>{servicosEscolhidos.map((s) => s.nome).join(' + ')} · {dataEscolhida?.toLocaleDateString('pt-BR')} às {horarioEscolhido}</p>
                        <p style={{ fontSize: '12px', color: '#7a7a7a', margin: 0 }}>com {barbeiroEscolhido?.nome}</p>
                        {temAcompanhante && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #262626' }}>
                            <p style={{ fontSize: '13px', color: '#a3a3a3', margin: '0 0 2px' }}><strong style={{ color: '#f2f2f2' }}>{nomeFilho}:</strong> {servicosFilho.map((s) => s.nome).join(' + ')}</p>
                            <p style={{ fontSize: '12px', color: '#7a7a7a', margin: 0 }}>{modoAcompanhante === 'mesmo' ? `logo depois, com ${barbeiroEscolhido?.nome?.split(' ')[0]}` : `ao mesmo tempo, com ${barbeiroFilho?.nome?.split(' ')[0]}`}</p>
                          </div>
                        )}
                        <button onClick={abrirWhatsApp} style={{ width: '100%', marginTop: '18px', padding: '12px', borderRadius: '8px', border: 'none', background: '#25D366', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Falar com a barbearia</button>
                        <button onClick={() => setTela('menu')} style={{ width: '100%', marginTop: '10px', padding: '10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#f2f2f2', fontSize: '13px', cursor: 'pointer' }}>Voltar ao menu</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {modo === 'login-equipe' && (
              <div style={estilos.conteudo}>
                <div style={estilos.voltar} onClick={() => { setModo('cliente'); setEquipeUsuario(''); setEquipeSenha(''); setErroEquipe(''); }}>← Voltar</div>
                <p style={estilos.titulo}>ACESSO DA EQUIPE</p>
                <div style={estilos.label}>Usuário</div>
                <input style={estilos.input} value={equipeUsuario} onChange={(e) => setEquipeUsuario(e.target.value)} placeholder="Ex: luiz" autoCapitalize="none" />
                <div style={estilos.label}>Senha</div>
                <input style={estilos.input} type="password" value={equipeSenha} onChange={(e) => setEquipeSenha(e.target.value)} placeholder="Sua senha" />
                {erroEquipe && <p style={{ color: '#e07a7a', fontSize: '12px' }}>{erroEquipe}</p>}
                <button onClick={entrarComoEquipe} style={estilos.botao(true)}>Entrar</button>
              </div>
            )}

            {modo === 'dono' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <p style={{ ...estilos.titulo, margin: 0 }}>{ehAdmin ? 'PAINEL DO DONO' : 'MINHA AGENDA'}</p>
                  <span style={{ fontSize: '11px', color: '#6b6b6b', cursor: 'pointer' }} onClick={sairDaEquipe}>Sair</span>
                </div>
                <p style={{ fontSize: '13px', color: '#f2f2f2', margin: '0 0 16px' }}>Olá, {barbeiroLogado?.nome?.split(' ')[0]} 👋 {!ehAdmin && <span style={{ fontSize: '11px', color: '#8a8a8a' }}>(acesso da equipe)</span>}</p>

                {avisoNovo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(201,162,39,0.12)', border: '1px solid ' + OURO, borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '20px' }}>🔔</span>
                    <div style={{ flex: 1, lineHeight: 1.35 }}>
                      <div style={{ color: OURO, fontWeight: 700, fontSize: '14px' }}>Novo agendamento</div>
                      <div style={{ color: '#f2f2f2', fontSize: '13px' }}>{avisoNovo.nome} marcou {avisoNovo.horario}{avisoNovo.data ? ` · ${avisoNovo.data}` : ''}</div>
                    </div>
                    <span onClick={() => setAvisoNovo(null)} style={{ color: '#8a8a8a', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}>✕</span>
                  </div>
                )}

                {pushStatus !== 'ativo' && pushStatus !== 'sem-suporte' && (
                  <div onClick={ativarNotificacoes} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: '1px dashed #444', borderRadius: '10px', padding: '11px 14px', marginBottom: '16px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '18px' }}>🔔</span>
                    <div style={{ flex: 1, lineHeight: 1.35 }}>
                      <div style={{ color: '#f2f2f2', fontWeight: 600, fontSize: '13px' }}>{pushStatus === 'bloqueado' ? 'Notificações bloqueadas' : 'Ativar notificações no celular'}</div>
                      <div style={{ color: '#8a8a8a', fontSize: '11px' }}>{pushStatus === 'bloqueado' ? 'Libere nas configurações do navegador' : 'Receba um aviso mesmo com o app fechado'}</div>
                    </div>
                    {pushStatus !== 'bloqueado' && <span style={{ color: OURO, fontSize: '13px', fontWeight: 600 }}>Ativar</span>}
                  </div>
                )}
                {pushStatus === 'ativo' && (
                  <div style={{ fontSize: '11px', color: '#6b8a6b', marginBottom: '16px' }}>🔔 Notificações ativas neste aparelho</div>
                )}

                {ehAdmin && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#8a8a8a', width: '100%', marginBottom: '2px' }}>Ver:</span>
                    <button
                      onClick={() => trocarFiltroBarbeiro('todos')}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid ' + (filtroBarbeiro === 'todos' ? OURO : '#333'), background: filtroBarbeiro === 'todos' ? OURO : 'transparent', color: filtroBarbeiro === 'todos' ? '#0d0d0d' : '#c9c9c9', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      Todos
                    </button>
                    {barbeiros.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => trocarFiltroBarbeiro(b.id)}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid ' + (filtroBarbeiro === b.id ? OURO : '#333'), background: filtroBarbeiro === b.id ? OURO : 'transparent', color: filtroBarbeiro === b.id ? '#0d0d0d' : '#c9c9c9', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                        {b.nome?.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}

                {ehTelaGrande ? (
                  <>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={estilos.titulo}>AGENDA</p>
                        {BlocoAgenda()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={estilos.titulo}>FINANCEIRO</p>
                        {BlocoFinanceiro()}
                      </div>
                    </div>
                    <div style={{ marginTop: '24px', borderTop: '1px solid #262626', paddingTop: '20px' }}>
                      <p style={estilos.titulo}>GESTÃO</p>
                      {BlocoAdminExtra()}
                    </div>
                  </>
                ) : (
                  <>
                    <button style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: OURO, color: '#0d0d0d', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}
                      onClick={() => { if (!mostrarFinanceiro) carregarFinanceiro(); setMostrarFinanceiro(!mostrarFinanceiro); }}>
                      {mostrarFinanceiro ? '← Voltar à agenda' : '💰 Financeiro'}
                    </button>

                    {mostrarFinanceiro ? (
                      BlocoFinanceiro()
                    ) : (
                      <>
                        {BlocoAgenda()}
                        <div style={{ marginTop: '20px' }}>
                          {BlocoAdminExtra()}
                        </div>
                      </>
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