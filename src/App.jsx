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

const OURO = '#C9A227';

function dataParaISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function App() {
  const [modo, setModo] = useState('cliente');
  const [mostrarAbertura, setMostrarAbertura] = useState(true);

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

  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');

  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [dataDono, setDataDono] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  const [agendaDoDia, setAgendaDoDia] = useState([]);
  const [bloqueiosDoDia, setBloqueiosDoDia] = useState([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);

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

  // Segurança: se o vídeo não disparar o "onEnded", fecha a abertura em 6s
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
  }, []);

  function gradeDoDia(data) { return data.getDay() === 6 ? gradeSabado : gradeSemana; }
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
    if (!nomeCliente.trim() || !telefoneCliente.trim()) { setErroSalvar('Preencha nome e WhatsApp.'); return; }
    setSalvando(true);
    const { data: cliente, error: erroCliente } = await supabase.from('clientes').insert({ nome: nomeCliente.trim(), telefone: telefoneCliente.trim() }).select().single();
    if (erroCliente) { setErroSalvar('Erro ao cadastrar cliente.'); setSalvando(false); return; }
    const { error: erroAg } = await supabase.from('agendamentos').insert({
      cliente_id: cliente.id, barbeiro_id: barbeiroEscolhido?.id || null, servico_id: servicoEscolhido.id,
      data: dataParaISO(dataEscolhida), horario: horarioEscolhido, status: 'confirmado', origem: 'cliente',
    });
    setSalvando(false);
    if (erroAg) { setErroSalvar('Esse horário já foi reservado. Escolha outro.'); return; }
    setEtapa('sucesso');
  }

  function recomecar() {
    setEtapa('servico'); setServicoEscolhido(null); setBarbeiroEscolhido(null);
    setDataEscolhida(null); setHorarioEscolhido(null); setPeriodoEscolhido(0);
    setHorariosOcupados([]); setNomeCliente(''); setTelefoneCliente(''); setErroSalvar('');
    setDiaFechadoCliente(false);
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
      .select('id, horario, status, origem, clientes(nome, telefone), servicos(nome), barbeiros(nome)')
      .eq('data', dataISO).neq('status', 'cancelado').order('horario', { ascending: true });
    const { data: bloqs } = await supabase.from('dias_bloqueados').select('id, barbeiro_id, motivo').eq('data', dataISO);
    setAgendaDoDia(ags || []);
    setBloqueiosDoDia(bloqs || []);
    setCarregandoAgenda(false);
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
      .insert({ nome: manualNome.trim(), telefone: manualTel.trim() || 'não informado' }).select().single();
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

  return (
    <>
      {mostrarAbertura && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#0d0d0d', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video
            src={videoAbertura}
            autoPlay
            muted
            playsInline
            onEnded={() => setMostrarAbertura(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
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
                {etapa === 'servico' && (
                  <>
                    <p style={estilos.titulo}>ESCOLHA O SERVIÇO</p>
                    {servicos.map((s) => (
                      <div key={s.id} onClick={() => { setServicoEscolhido(s); setEtapa('equipe'); }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '8px', cursor: 'pointer' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 500 }}>{s.nome}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7a7a7a' }}>{s.duracao_min} min</p>
                        </div>
                        <p style={{ margin: 0, color: OURO, fontWeight: 500 }}>R$ {Number(s.preco).toFixed(2).replace('.', ',')}</p>
                      </div>
                    ))}
                    <p style={estilos.link} onClick={() => setModo('login-dono')}>Acesso do dono</p>
                  </>
                )}

                {etapa === 'equipe' && (
                  <>
                    <div style={estilos.voltar} onClick={() => setEtapa('servico')}>← {servicoEscolhido?.nome}</div>
                    <p style={estilos.titulo}>EQUIPE DISPONÍVEL</p>
                    <div onClick={() => setBarbeiroEscolhido({ id: null, nome: 'Sem preferência', semPref: true })}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', border: barbeiroEscolhido?.semPref ? '1px solid #C9A227' : '1px solid #333', background: barbeiroEscolhido?.semPref ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#1f1f1f', border: '1px solid #444' }}></div>
                      <p style={{ margin: 0 }}>Sem preferência</p>
                    </div>
                    {barbeiros.map((b) => {
                      const sel = barbeiroEscolhido?.id === b.id && !barbeiroEscolhido?.semPref;
                      return (
                        <div key={b.id} onClick={() => setBarbeiroEscolhido(b)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#C9A227', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d0d0d', fontWeight: 500, fontSize: '13px' }}>
                            {b.nome.split(' ').map(w => w[0]).slice(0, 2).join('')}
                          </div>
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
                    {dataEscolhida && !diaFechadoCliente && (
                      <>
                        <p style={estilos.titulo}>HORÁRIO · <span style={{ color: OURO, textTransform: 'capitalize' }}>{dataEscolhida.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span></p>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                          {gradeDoDia(dataEscolhida).nomes.map((nome, i) => {
                            const ativo = periodoEscolhido === i;
                            return (
                              <div key={i} onClick={() => { setPeriodoEscolhido(i); setHorarioEscolhido(null); }}
                                style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', border: ativo ? '1px solid #C9A227' : '1px solid #333', background: ativo ? 'rgba(201,162,39,0.08)' : 'transparent' }}>
                                {nome} <span style={{ color: '#7a7a7a' }}>({gradeDoDia(dataEscolhida).periodos[i].length})</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                          {gradeDoDia(dataEscolhida).periodos[periodoEscolhido].map((h) => {
                            const ocupado = horariosOcupados.includes(h);
                            const sel = horarioEscolhido === h;
                            if (ocupado) return (<div key={h} style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', color: '#4a4a4a', border: '1px solid #1f1f1f', textDecoration: 'line-through', cursor: 'default' }}>{h}</div>);
                            return (
                              <div key={h} onClick={() => setHorarioEscolhido(h)}
                                style={{ textAlign: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', cursor: 'pointer', border: sel ? '1px solid #C9A227' : '1px solid #333', background: sel ? 'rgba(201,162,39,0.08)' : 'transparent' }}>{h}</div>
                            );
                          })}
                        </div>
                        <button disabled={!horarioEscolhido} onClick={() => setEtapa('dados')} style={estilos.botao(!!horarioEscolhido)}>Continuar</button>
                      </>
                    )}
                  </>
                )}

                {etapa === 'dados' && (
                  <>
                    <div style={estilos.voltar} onClick={() => setEtapa('dataHora')}>← Voltar</div>
                    <p style={estilos.titulo}>SEUS DADOS</p>
                    <div style={estilos.label}>Nome</div>
                    <input style={estilos.input} value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Seu nome" />
                    <div style={estilos.label}>WhatsApp</div>
                    <input style={estilos.input} value={telefoneCliente} onChange={(e) => setTelefoneCliente(e.target.value)} placeholder="(32) 9 9999-9999" />
                    <div style={{ border: '1px solid #262626', borderRadius: '8px', padding: '14px', marginTop: '8px', fontSize: '13px', color: '#a3a3a3' }}>
                      <p style={{ margin: 0, color: '#f2f2f2', fontWeight: 500 }}>Resumo</p>
                      <p style={{ margin: '8px 0 0' }}>{servicoEscolhido?.nome}</p>
                      <p style={{ margin: '4px 0 0' }}>com {barbeiroEscolhido?.nome}</p>
                      <p style={{ margin: '4px 0 0', textTransform: 'capitalize' }}>{dataEscolhida?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às {horarioEscolhido}</p>
                    </div>
                    {erroSalvar && <p style={{ color: '#e07a7a', fontSize: '12px', marginTop: '10px' }}>{erroSalvar}</p>}
                    <button disabled={salvando} onClick={confirmarAgendamento} style={estilos.botao(!salvando)}>{salvando ? 'Salvando...' : 'Confirmar agendamento'}</button>
                  </>
                )}

                {etapa === 'sucesso' && (
                  <div style={{ textAlign: 'center', border: '1px dashed #C9A227', borderRadius: '12px', padding: '28px 20px' }}>
                    <div style={{ fontSize: '32px', color: OURO }}>✓</div>
                    <p style={{ fontWeight: 500, fontSize: '16px', margin: '10px 0 4px' }}>Horário reservado!</p>
                    <p style={{ fontSize: '13px', color: '#a3a3a3', margin: 0 }}>{servicoEscolhido?.nome} · {dataEscolhida?.toLocaleDateString('pt-BR')} às {horarioEscolhido}</p>
                    <button onClick={recomecar} style={estilos.botao(true)}>Fazer novo agendamento</button>
                  </div>
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
                  <span style={{ fontSize: '11px', color: '#6b6b6b', cursor: 'pointer' }} onClick={() => { setModo('cliente'); setSenhaDigitada(''); }}>Sair</span>
                </div>

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
                    <input style={estilos.input} value={manualTel} onChange={(e) => setManualTel(e.target.value)} placeholder="(32) 9 9999-9999" />
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
                  agendaDoDia.map((a) => (
                    <div key={a.id} style={{ border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontWeight: 500, color: OURO }}>{a.horario.slice(0, 5)}</p>
                        {a.origem === 'dono' && <span style={{ fontSize: '10px', color: '#6b6b6b' }}>manual</span>}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{a.clientes?.nome || 'Cliente'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8a8a8a' }}>{a.servicos?.nome} · {a.barbeiros?.nome || 'Sem preferência'}</p>
                      {a.clientes?.telefone && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b6b6b' }}>{a.clientes.telefone}</p>}
                    </div>
                  ))
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