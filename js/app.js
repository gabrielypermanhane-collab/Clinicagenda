document.addEventListener('DOMContentLoaded', async () => {
  let usuarioLogado = JSON.parse(sessionStorage.getItem('sessao_usuario')) || null;

  // Telas e Contêineres
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const userDisplayLabel = document.getElementById('user-display-label');
  const btnLogout = document.getElementById('btn-logout');

  // Perfis
  const perfilRecepcao = document.getElementById('perfil-view-recepcao');
  const perfilPaciente = document.getElementById('perfil-view-paciente');
  const perfilProfissional = document.getElementById('perfil-view-profissional');
  const navRecepcao = document.getElementById('nav-recepcao');
  const navProfissional = document.getElementById('nav-profissional');

  // Navegação de Abas
  // Navegação de Abas Corrigida
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      if (!targetId) return;

      // 1. Desativa todos os botões de abas do mesmo menu
      const nav = btn.closest('.nav-tabs');
      if (nav) {
        nav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      }
      btn.classList.add('active');

      // 2. Localiza o contêiner do perfil atual (recepção ou profissional)
      const containerPerfil = btn.closest('#view-dashboard');
      if (containerPerfil) {
        // Oculta todas as abas
        containerPerfil.querySelectorAll('.tab-content').forEach(c => {
          c.classList.remove('active');
        });
        
        // Exibe apenas a aba clicada
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
          targetTab.classList.add('active');
        }
      }
    });
  });

  // Utilitários de Modal Globais
  window.fecharModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  };
  window.abrirModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  };

  // Associação defensiva dos botões de abrir modal
  const btnAgend = document.getElementById('btn-open-modal-agendamento');
  if (btnAgend) btnAgend.onclick = () => abrirModal('modal-agendamento');

  const btnPac = document.getElementById('btn-open-modal-paciente');
  if (btnPac) btnPac.onclick = () => abrirModal('modal-paciente');

  const btnProf = document.getElementById('btn-open-modal-profissional');
  if (btnProf) btnProf.onclick = () => abrirModal('modal-profissional');

  const btnFolga = document.getElementById('btn-open-modal-folga') || document.getElementById('btn-open-modal-indisp');
  if (btnFolga) btnFolga.onclick = () => abrirModal('modal-folga');

  const alertContainer = document.getElementById('alert-container');
  function mostrarAlerta(msg, tipo = 'error') {
    if (!alertContainer) return;
    alertContainer.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
    setTimeout(() => { alertContainer.innerHTML = ''; }, 4500);
  }

  // Preenchimento de Seletores
  async function carregarSeletores() {
    if (typeof api === 'undefined') return;
    const [pacientes, profissionais] = await Promise.all([api.getPacientes(), api.getProfissionais()]);

    const campoPac = document.getElementById('campo-paciente');
    if (campoPac) {
      campoPac.innerHTML = '<option value="">Selecione um paciente</option>';
      pacientes.forEach(p => {
        const nomePac = p.nome_completo || p.nome || 'Paciente sem nome';
        campoPac.innerHTML += `<option value="${p.id_paciente || p.id}">${nomePac} (CPF: ${p.cpf})</option>`;
      });
    }

    const campoProf = document.getElementById('campo-profissional');
    const filtroProf = document.getElementById('filtro-profissional');
    if (campoProf) campoProf.innerHTML = '<option value="">Selecione um profissional</option>';
    if (filtroProf) filtroProf.innerHTML = '<option value="">Todos os profissionais</option>';

    profissionais.forEach(p => {
      const nomeProf = p.nome_completo || p.nome || 'Profissional';
      const idProf = p.id_profissional || p.id;
      if (campoProf) campoProf.innerHTML += `<option value="${idProf}">${nomeProf} - ${p.especialidade}</option>`;
      if (filtroProf) filtroProf.innerHTML += `<option value="${idProf}">${nomeProf} (${p.especialidade})</option>`;
    });
  }

  // 1. Agenda Geral
  async function renderizarAgendaGeral() {
    const tbody = document.getElementById('agenda-body');
    if (!tbody || typeof api === 'undefined') return;

    const [consultas, pacientes, profissionais] = await Promise.all([
      api.getConsultas(), 
      api.getPacientes(), 
      api.getProfissionais()
    ]);
    
    const filtroData = document.getElementById('filtro-data')?.value;
    const filtroProf = document.getElementById('filtro-profissional')?.value;
    const filtroStatus = document.getElementById('filtro-status')?.value;

    const lista = consultas.filter(c => {
      const idProfConsulta = String(c.id_profissional || c.profissionalId);
      const matchData = filtroData ? c.data === filtroData : true;
      const matchProf = filtroProf ? idProfConsulta === String(filtroProf) : true;
      const matchStatus = filtroStatus ? c.status.toUpperCase() === filtroStatus.toUpperCase() : true;
      return matchData && matchProf && matchStatus;
    });

    tbody.innerHTML = '';
    if (lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Nenhum agendamento encontrado para os filtros selecionados.</td></tr>';
      return;
    }

    lista.forEach(c => {
      const idPac = Number(c.id_paciente || c.pacienteId);
      const idProf = Number(c.id_profissional || c.profissionalId);
      
      const pac = pacientes.find(p => Number(p.id_paciente || p.id) === idPac) || { nome_completo: 'Paciente' };
      const prof = profissionais.find(p => Number(p.id_profissional || p.id) === idProf) || { nome_completo: 'Profissional', especialidade: '-' };
      
      const statusFinal = (c.status || 'AGENDADA').toUpperCase();
      const badgeClass = `badge-${statusFinal.toLowerCase()}`;
      const idConsulta = c.id_consulta || c.id;

      tbody.innerHTML += `
        <tr>
          <td><strong>${c.horaInicio} - ${c.horaFim}</strong></td>
          <td>${pac.nome_completo || pac.nome}</td>
          <td>${prof.nome_completo || prof.nome}</td>
          <td>${prof.especialidade}</td>
          <td><span class="badge ${badgeClass}">${statusFinal}</span></td>
          <td>
            ${statusFinal === 'AGENDADA' ? `<button class="btn-danger-sm" onclick="abrirModalCancelamento(${idConsulta})">Cancelar</button>` : '-'}
          </td>
        </tr>
      `;
    });
  }

  // 2. Pacientes
  async function renderizarPacientes() {
    const tbody = document.getElementById('pacientes-body');
    if (!tbody || typeof api === 'undefined') return;
    const pacientes = await api.getPacientes();
    const buscaInput = document.getElementById('busca-paciente');
    const termo = (buscaInput ? buscaInput.value : '').toLowerCase().trim();

    tbody.innerHTML = '';
    const filtrados = pacientes.filter(p => p.nome_completo.toLowerCase().includes(termo) || p.cpf.includes(termo));

    if (filtrados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum paciente encontrado.</td></tr>';
      return;
    }

    filtrados.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${p.nome_completo}</strong></td>
          <td>${p.cpf}</td>
          <td>${p.telefone}</td>
          <td>${p.email_contato}</td>
          <td>${p.data_nascimento}</td>
          <td><button class="btn-danger-sm" onclick="excluirPac(${p.id_paciente})">Excluir</button></td>
        </tr>
      `;
    });
  }

  // 3. Profissionais
 // 3. Profissionais com Suporte Seguro a Qualquer Formato
  async function renderizarProfissionais() {
    const tbody = document.getElementById('profissionais-body');
    if (!tbody || typeof api === 'undefined') return;

    const profissionais = await api.getProfissionais() || [];
    const buscaInput = document.getElementById('busca-profissional');
    const termo = (buscaInput ? buscaInput.value : '').toLowerCase().trim();

    tbody.innerHTML = '';

    const filtrados = profissionais.filter(p => {
      const nome = (p.nome_completo || p.nome || '').toLowerCase();
      const esp = (p.especialidade || '').toLowerCase();
      const reg = (p.registro_profissional || '').toLowerCase();
      return nome.includes(termo) || esp.includes(termo) || reg.includes(termo);
    });

    if (filtrados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Nenhum profissional cadastrado ou encontrado.</td></tr>';
      return;
    }

    filtrados.forEach(p => {
      const nome = p.nome_completo || p.nome || 'Sem nome';
      const registro = p.registro_profissional || 'REG-PADRAO';
      const idProf = p.id_profissional || p.id;

      tbody.innerHTML += `
        <tr>
          <td><strong>${nome}</strong></td>
          <td><code>${registro}</code></td>
          <td><span class="badge badge-agendada">${p.especialidade || '-'}</span></td>
          <td>${p.telefone || '-'}</td>
          <td>${p.email_contato || p.email || '-'}</td>
          <td><button class="btn-danger-sm" onclick="excluirProf(${idProf})">Excluir</button></td>
        </tr>
      `;
    });
  }

  // 4. Auditoria
  async function renderizarAuditoria() {
    const tbody = document.getElementById('auditoria-body');
    if (!tbody || typeof api === 'undefined') return;
    const logs = await api.getAuditoriaLogs();
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum registro de log.</td></tr>';
      return;
    }

    logs.forEach(l => {
      tbody.innerHTML += `
        <tr>
          <td><small>${l.timestamp}</small></td>
          <td>Consulta #${l.id_consulta}</td>
          <td><span class="badge badge-agendada">${l.tipo}</span></td>
          <td>${l.mensagem}</td>
          <td><strong style="color: var(--success); font-size: 0.85rem;">✓ ${l.status_envio}</strong></td>
        </tr>
      `;
    });
  }

  // 5. Profissional
  async function renderizarVisaoProfissional() {
    if (!usuarioLogado || usuarioLogado.perfil !== 'profissional' || typeof api === 'undefined') return;

    const tbodyAgenda = document.getElementById('prof-consultas-body');
    if (tbodyAgenda) {
      const [consultas, pacientes] = await Promise.all([api.getConsultas(), api.getPacientes()]);
      const minhas = consultas.filter(c => Number(c.id_profissional) === Number(usuarioLogado.id));

      tbodyAgenda.innerHTML = '';
      if (minhas.length === 0) {
        tbodyAgenda.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum atendimento atribuído à sua agenda.</td></tr>';
      } else {
        minhas.forEach(c => {
          const pac = pacientes.find(p => p.id_paciente === Number(c.id_paciente)) || { nome_completo: 'Paciente' };
          const badgeClass = `badge-${c.status.toLowerCase()}`;

          let acaoAtendimento = '-';
          if (c.status === 'AGENDADA') {
            acaoAtendimento = `<button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="iniciarAtendimento(${c.id_consulta}, '${pac.nome_completo}')">Atender Paciente</button>`;
          } else if (c.atendimento) {
            acaoAtendimento = `<small><strong>Anotações:</strong> ${c.atendimento.anotacoes_clinicas}<br><strong>Conduta:</strong> ${c.atendimento.prescricao_ou_conduta || 'Nenhuma'}</small>`;
          } else if (c.status === 'CANCELADA') {
            acaoAtendimento = `<small style="color: var(--danger);">Motivo: ${c.motivo_cancelamento || 'Cancelada'}</small>`;
          }

          tbodyAgenda.innerHTML += `
            <tr>
              <td>${c.data}</td>
              <td><strong>${c.horaInicio} - ${c.horaFim}</strong></td>
              <td>${pac.nome_completo}</td>
              <td><span class="badge ${badgeClass}">${c.status}</span></td>
              <td>${acaoAtendimento}</td>
            </tr>
          `;
        });
      }
    }

    const tbodyFolgas = document.getElementById('prof-folgas-body');
    if (tbodyFolgas) {
      const folgas = await api.getIndisponibilidades(usuarioLogado.id);
      tbodyFolgas.innerHTML = '';
      if (folgas.length === 0) {
        tbodyFolgas.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum dia de bloqueio cadastrado.</td></tr>';
      } else {
        folgas.forEach(f => {
          tbodyFolgas.innerHTML += `
            <tr>
              <td><strong>${f.data}</strong></td>
              <td>${f.motivo || 'Folga comunicada'}</td>
              <td><button class="btn-danger-sm" onclick="removerFolga(${f.id_folga})">Remover</button></td>
            </tr>
          `;
        });
      }
    }
  }

  // 6. Paciente
  async function renderizarVisaoPaciente() {
    if (!usuarioLogado || usuarioLogado.perfil !== 'paciente' || typeof api === 'undefined') return;

    const tbody = document.getElementById('paciente-consultas-body');
    if (!tbody) return;
    const [consultas, profissionais] = await Promise.all([api.getConsultas(), api.getProfissionais()]);
    const minhas = consultas.filter(c => Number(c.id_paciente) === Number(usuarioLogado.id));

    tbody.innerHTML = '';
    if (minhas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Você não possui consultas agendadas.</td></tr>';
      return;
    }

    minhas.forEach(c => {
      const prof = profissionais.find(p => p.id_profissional === Number(c.id_profissional)) || { nome_completo: 'Profissional' };
      const badgeClass = `badge-${c.status.toLowerCase()}`;

      let prontuario = '<small style="color: var(--text-muted);">Aguardando atendimento</small>';
      if (c.atendimento) {
        prontuario = `<small style="color: var(--primary);"><strong>Conduta:</strong> ${c.atendimento.prescricao_ou_conduta || 'Atendimento concluído.'}</small>`;
      } else if (c.status === 'CANCELADA') {
        prontuario = `<small style="color: var(--danger);">Cancelada: ${c.motivo_cancelamento || 'Sem motivo'}</small>`;
      }

      tbody.innerHTML += `
        <tr>
          <td>${c.data}</td>
          <td><strong>${c.horaInicio} - ${c.horaFim}</strong></td>
          <td>${prof.nome_completo}</td>
          <td><span class="badge ${badgeClass}">${c.status}</span></td>
          <td>${prontuario}</td>
        </tr>
      `;
    });
  }

  // Sessão
  function aplicarSessao() {
    if (!usuarioLogado) {
      if (viewLogin) viewLogin.classList.remove('hidden');
      if (viewDashboard) viewDashboard.classList.add('hidden');
      return;
    }

    if (viewLogin) viewLogin.classList.add('hidden');
    if (viewDashboard) viewDashboard.classList.remove('hidden');

    if (perfilRecepcao) perfilRecepcao.classList.add('hidden');
    if (perfilPaciente) perfilPaciente.classList.add('hidden');
    if (perfilProfissional) perfilProfissional.classList.add('hidden');
    if (navRecepcao) navRecepcao.classList.add('hidden');
    if (navProfissional) navProfissional.classList.add('hidden');

    if (usuarioLogado.perfil === 'recepcao') {
      if (userDisplayLabel) userDisplayLabel.innerHTML = 'Perfil: <strong>Recepção / Administração</strong>';
      if (perfilRecepcao) perfilRecepcao.classList.remove('hidden');
      if (navRecepcao) navRecepcao.classList.remove('hidden');
      renderizarAgendaGeral();
      renderizarPacientes();
      renderizarProfissionais();
      renderizarAuditoria();
    } else if (usuarioLogado.perfil === 'profissional') {
      if (userDisplayLabel) userDisplayLabel.innerHTML = `Profissional: <strong>${usuarioLogado.nome}</strong>`;
      if (perfilProfissional) perfilProfissional.classList.remove('hidden');
      if (navProfissional) navProfissional.classList.remove('hidden');
      renderizarVisaoProfissional();
    } else if (usuarioLogado.perfil === 'paciente') {
      if (userDisplayLabel) userDisplayLabel.innerHTML = `Paciente: <strong>${usuarioLogado.nome}</strong>`;
      if (perfilPaciente) perfilPaciente.classList.remove('hidden');
      renderizarVisaoPaciente();
    }
  }

  // Abas do Login
  const loginTabs = document.querySelectorAll('.login-tab-btn');
  const inputTipo = document.getElementById('login-tipo-selecionado');
  const labelUsuario = document.getElementById('label-login-usuario');
  const inputUsuario = document.getElementById('login-usuario');
  const loginAlert = document.getElementById('login-alert');

  loginTabs.forEach(btn => {
    btn.onclick = () => {
      loginTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tipo = btn.dataset.type;
      if (inputTipo) inputTipo.value = tipo;
      if (loginAlert) loginAlert.classList.add('hidden');

      if (labelUsuario && inputUsuario) {
        if (tipo === 'recepcao') {
          labelUsuario.textContent = 'E-mail ou Usuário *';
          inputUsuario.placeholder = 'admin@saude.com';
        } else if (tipo === 'profissional') {
          labelUsuario.textContent = 'E-mail Profissional *';
          inputUsuario.placeholder = 'dra.ana@saude.com';
        } else {
          labelUsuario.textContent = 'CPF do Paciente *';
          inputUsuario.placeholder = '111.222.333-44';
        }
      }
    };
  });

  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      if (loginAlert) loginAlert.classList.add('hidden');
      try {
        const tipo = inputTipo ? inputTipo.value : 'recepcao';
        const usuario = inputUsuario ? inputUsuario.value.trim() : '';
        const senha = document.getElementById('login-senha')?.value.trim() || '';
        
        usuarioLogado = await api.autenticar(tipo, usuario, senha);
        sessionStorage.setItem('sessao_usuario', JSON.stringify(usuarioLogado));
        aplicarSessao();
      } catch (err) {
        if (loginAlert) {
          loginAlert.textContent = err.message;
          loginAlert.classList.remove('hidden');
        }
      }
    };
  }

  if (btnLogout) {
    btnLogout.onclick = () => {
      sessionStorage.removeItem('sessao_usuario');
      usuarioLogado = null;
      aplicarSessao();
    };
  }

  // Agendamento
  const formAgend = document.getElementById('form-agendamento');
  if (formAgend) {
    formAgend.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api.agendarConsulta({
          id_paciente: document.getElementById('campo-paciente').value,
          id_profissional: document.getElementById('campo-profissional').value,
          data: document.getElementById('campo-data').value,
          horaInicio: document.getElementById('campo-hora-inicio').value,
          horaFim: document.getElementById('campo-hora-fim').value
        });
        mostrarAlerta("Consulta agendada com sucesso! Log registrado.", "success");
        formAgend.reset();
        fecharModal('modal-agendamento');
        renderizarAgendaGeral();
        renderizarAuditoria();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    };
  }

  // Cancelamento
  window.abrirModalCancelamento = (id) => {
    const elId = document.getElementById('cancelar-consulta-id');
    const elMotivo = document.getElementById('cancelar-motivo');
    if (elId) elId.value = id;
    if (elMotivo) elMotivo.value = '';
    abrirModal('modal-cancelamento');
  };

  const formCanc = document.getElementById('form-cancelamento');
  if (formCanc) {
    formCanc.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('cancelar-consulta-id')?.value;
      const motivo = document.getElementById('cancelar-motivo')?.value;
      await api.cancelarConsulta(id, motivo);
      mostrarAlerta("Consulta cancelada e log registrado.", "success");
      fecharModal('modal-cancelamento');
      renderizarAgendaGeral();
      renderizarAuditoria();
    };
  }

  // Atendimento / Prontuário
  window.iniciarAtendimento = (consultaId, pacienteNome) => {
    const elId = document.getElementById('atendimento-consulta-id');
    const elNome = document.getElementById('atendimento-paciente-nome');
    const elAnot = document.getElementById('atendimento-anotacoes');
    const elCond = document.getElementById('atendimento-conduta');
    if (elId) elId.value = consultaId;
    if (elNome) elNome.textContent = pacienteNome;
    if (elAnot) elAnot.value = '';
    if (elCond) elCond.value = '';
    abrirModal('modal-atendimento');
  };

  const formAtend = document.getElementById('form-atendimento');
  if (formAtend) {
    formAtend.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('atendimento-consulta-id')?.value;
      const anotacoes = document.getElementById('atendimento-anotacoes')?.value;
      const conduta = document.getElementById('atendimento-conduta')?.value;

      try {
        await api.registrarAtendimento(id, anotacoes, conduta);
        mostrarAlerta("Atendimento concluído e prontuário salvo!", "success");
        fecharModal('modal-atendimento');
        renderizarVisaoProfissional();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    };
  }

  // Formulários de Cadastros
  const formPac = document.getElementById('form-paciente');
  if (formPac) {
    formPac.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api.criarPaciente({
          nome_completo: document.getElementById('pac-nome').value,
          cpf: document.getElementById('pac-cpf').value,
          data_nascimento: document.getElementById('pac-nasc').value,
          telefone: document.getElementById('pac-tel').value,
          email_contato: document.getElementById('pac-email').value
        });
        mostrarAlerta("Paciente cadastrado com sucesso!", "success");
        formPac.reset();
        fecharModal('modal-paciente');
        await carregarSeletores();
        renderizarPacientes();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    };
  }

// Cadastro de Profissional (Médico) Defensivo
  const formProf = document.getElementById('form-profissional');
  if (formProf) {
    formProf.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const nome = document.getElementById('prof-nome')?.value.trim();
        const registro = document.getElementById('prof-registro')?.value.trim() || ("REG-" + Date.now().toString().slice(-5));
        const especialidade = document.getElementById('prof-esp')?.value.trim();
        const telefone = document.getElementById('prof-tel')?.value.trim();
        const email = document.getElementById('prof-email')?.value.trim();

        if (!nome || !especialidade) {
          mostrarAlerta("Preencha o nome e a especialidade do profissional.");
          return;
        }

        await api.criarProfissional({
          nome_completo: nome,
          registro_profissional: registro,
          especialidade: especialidade,
          telefone: telefone,
          email_contato: email
        });

        mostrarAlerta("Profissional cadastrado com sucesso!", "success");
        formProf.reset();
        fecharModal('modal-profissional');
        await carregarSeletores();
        await renderizarProfissionais();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    };
  }

  const formFolga = document.getElementById('form-folga');
  if (formFolga) {
    formFolga.onsubmit = async (e) => {
      e.preventDefault();
      await api.criarIndisponibilidade({
        id_profissional: usuarioLogado.id,
        data: document.getElementById('folga-data').value,
        motivo: document.getElementById('folga-motivo').value
      });
      mostrarAlerta("Folga cadastrada!", "success");
      formFolga.reset();
      fecharModal('modal-folga');
      renderizarVisaoProfissional();
    };
  }

  // Operações Globais de Exclusão
  window.removerFolga = async (id) => {
    await api.excluirIndisponibilidade(id);
    renderizarVisaoProfissional();
  };
  window.excluirPac = async (id) => {
    if (confirm("Deseja realmente excluir este paciente?")) {
      try {
        await api.excluirPaciente(id);
        await carregarSeletores();
        renderizarPacientes();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    }
  };
  window.excluirProf = async (id) => {
    if (confirm("Deseja realmente excluir este profissional?")) {
      await api.excluirProfissional(id);
      await carregarSeletores();
      renderizarProfissionais();
    }
  };

  // Filtros
  const fData = document.getElementById('filtro-data');
  const fProf = document.getElementById('filtro-profissional');
  const fStatus = document.getElementById('filtro-status');
  const bPac = document.getElementById('busca-paciente');
  const bProf = document.getElementById('busca-profissional');

  if (fData) fData.onchange = renderizarAgendaGeral;
  if (fProf) fProf.onchange = renderizarAgendaGeral;
  if (fStatus) fStatus.onchange = renderizarAgendaGeral;
  if (bPac) bPac.oninput = renderizarPacientes;
  if (bProf) bProf.oninput = renderizarProfissionais;

  const hoje = new Date().toISOString().split('T')[0];
  if (fData) fData.value = hoje;
  const cData = document.getElementById('campo-data');
  if (cData) cData.value = hoje;

  await carregarSeletores();
  aplicarSessao();
});