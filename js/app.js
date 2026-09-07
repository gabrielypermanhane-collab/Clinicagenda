document.addEventListener('DOMContentLoaded', async () => {
  let usuario = JSON.parse(sessionStorage.getItem('sessao_usuario')) || null;

  const telaLogin = document.getElementById('view-login');
  const painel = document.getElementById('view-dashboard');
  const nomeUsuario = document.getElementById('user-display-label');
  const botaoSair = document.getElementById('btn-logout');

  const areaRecepcao = document.getElementById('perfil-view-recepcao');
  const areaPaciente = document.getElementById('perfil-view-paciente');
  const areaProfissional = document.getElementById('perfil-view-profissional');
  const menuRecepcao = document.getElementById('nav-recepcao');
  const menuProfissional = document.getElementById('nav-profissional');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      if (!targetId) return;

      const nav = btn.closest('.nav-tabs');
      if (nav) {
        nav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      }
      btn.classList.add('active');

      const containerPerfil = btn.closest('#view-dashboard');
      if (containerPerfil) {
        containerPerfil.querySelectorAll('.tab-content').forEach(c => {
          c.classList.remove('active');
        });
        
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
          targetTab.classList.add('active');
        }
      }
    });
  });

  window.fecharModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  };
  window.abrirModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  };

  const botaoAgendar = document.getElementById('btn-open-modal-agendamento');
  if (botaoAgendar) botaoAgendar.onclick = () => abrirModal('modal-agendamento');

  const botaoPaciente = document.getElementById('btn-open-modal-paciente');
  if (botaoPaciente) botaoPaciente.onclick = () => {
    document.getElementById('form-paciente')?.reset();
    document.getElementById('pac-id').value = '';
    document.getElementById('titulo-modal-paciente').textContent = 'Cadastrar Paciente';
    document.getElementById('btn-salvar-paciente').textContent = 'Salvar Paciente';
    abrirModal('modal-paciente');
  };

  const botaoProfissional = document.getElementById('btn-open-modal-profissional');
  if (botaoProfissional) botaoProfissional.onclick = () => {
    document.getElementById('form-profissional')?.reset();
    document.getElementById('prof-id').value = '';
    document.getElementById('titulo-modal-profissional').textContent = 'Cadastrar Profissional de Saúde';
    document.getElementById('btn-salvar-profissional').textContent = 'Salvar Profissional';
    abrirModal('modal-profissional');
  };

  const botaoFolga = document.getElementById('btn-open-modal-folga') || document.getElementById('btn-open-modal-indisp');
  if (botaoFolga) botaoFolga.onclick = () => abrirModal('modal-folga');

  const alertas = document.getElementById('alert-container');
  function mostrarAlerta(msg, tipo = 'error') {
    if (!alertas) return;
    alertas.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
    setTimeout(() => { alertas.innerHTML = ''; }, 4500);
  }

  async function carregarSeletores() {
    const [pacientes, profissionais] = await Promise.all([api.getPacientes(), api.getProfissionais()]);

    const campoPaciente = document.getElementById('campo-paciente');
    if (campoPaciente) {
      campoPaciente.innerHTML = '<option value="">Selecione um paciente</option>';
      pacientes.forEach(p => {
        campoPaciente.innerHTML += `<option value="${p.id_paciente}">${p.nome_completo} (CPF: ${p.cpf})</option>`;
      });
    }

    const campoProfissional = document.getElementById('campo-profissional');
    const filtroProfissional = document.getElementById('filtro-profissional');
    const reagendarPaciente = document.getElementById('reagendar-paciente');
    const reagendarProfissional = document.getElementById('reagendar-profissional');

    if (reagendarPaciente) {
      reagendarPaciente.innerHTML = '<option value="">Selecione um paciente</option>';
      pacientes.forEach(p => {
        reagendarPaciente.innerHTML += `<option value="${p.id_paciente}">${p.nome_completo} (CPF: ${p.cpf})</option>`;
      });
    }

    if (campoProfissional) campoProfissional.innerHTML = '<option value="">Selecione um profissional</option>';
    if (filtroProfissional) filtroProfissional.innerHTML = '<option value="">Todos os profissionais</option>';
    if (reagendarProfissional) reagendarProfissional.innerHTML = '<option value="">Selecione um profissional</option>';

    profissionais.forEach(p => {
      if (campoProfissional) campoProfissional.innerHTML += `<option value="${p.id_profissional}">${p.nome_completo} - ${p.especialidade}</option>`;
      if (filtroProfissional) filtroProfissional.innerHTML += `<option value="${p.id_profissional}">${p.nome_completo} (${p.especialidade})</option>`;
      if (reagendarProfissional) reagendarProfissional.innerHTML += `<option value="${p.id_profissional}">${p.nome_completo} - ${p.especialidade}</option>`;
    });
  }

  async function renderizarAgendaGeral() {
    const tbody = document.getElementById('agenda-body');
    if (!tbody) return;

    const [consultas, pacientes, profissionais] = await Promise.all([
      api.getConsultas(), 
      api.getPacientes(), 
      api.getProfissionais()
    ]);
    
    const filtroData = document.getElementById('filtro-data')?.value;
    const filtroProfissional = document.getElementById('filtro-profissional')?.value;
    const filtroStatus = document.getElementById('filtro-status')?.value;
    const visualizacao = document.getElementById('visualizacao-agenda')?.value || 'dia';

    let inicioSemana = '';
    let fimSemana = '';
    if (filtroData && visualizacao === 'semana') {
      const referencia = new Date(`${filtroData}T12:00:00`);
      const dia = referencia.getDay();
      const deslocamento = dia === 0 ? -6 : 1 - dia;
      const inicio = new Date(referencia);
      inicio.setDate(referencia.getDate() + deslocamento);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
      inicioSemana = inicio.toISOString().split('T')[0];
      fimSemana = fim.toISOString().split('T')[0];
    }

    const lista = consultas.filter(c => {
      const mesmaData = !filtroData || (visualizacao === 'semana' ? c.data >= inicioSemana && c.data <= fimSemana : c.data === filtroData);
      const mesmoProfissional = !filtroProfissional || String(c.id_profissional) === String(filtroProfissional);
      const mesmoStatus = !filtroStatus || c.status === filtroStatus;
      return mesmaData && mesmoProfissional && mesmoStatus;
    });

    tbody.innerHTML = '';
    if (lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Nenhum agendamento encontrado para os filtros selecionados.</td></tr>';
      return;
    }

    lista.forEach(c => {
      const paciente = pacientes.find(p => p.id_paciente === Number(c.id_paciente));
      const profissional = profissionais.find(p => p.id_profissional === Number(c.id_profissional));
      const status = c.status;
      const classeStatus = `badge-${status.toLowerCase()}`;

      tbody.innerHTML += `
        <tr>
          <td>${c.data}</td>
          <td><strong>${c.horaInicio} - ${c.horaFim}</strong></td>
          <td>${paciente ? paciente.nome_completo : 'Paciente'}</td>
          <td>${profissional ? profissional.nome_completo : 'Profissional'}</td>
          <td>${profissional ? profissional.especialidade : '-'}</td>
          <td><span class="badge ${classeStatus}">${status}</span></td>
          <td>
            <select onchange="alterarStatusConsulta(${c.id_consulta}, this.value)" style="margin-right:0.35rem; padding:0.3rem;">
              <option value="">Alterar status</option>
              <option value="AGENDADA">Agendada</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="EM_ATENDIMENTO">Em atendimento</option>
              <option value="REALIZADA">Concluída</option>
              <option value="FALTOU">Faltou</option>
            </select>
            ${status === 'AGENDADA' ? `<button class="btn btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-right:0.35rem;" onclick="abrirModalReagendamento(${c.id_consulta})">Reagendar</button>` : ''}
            ${status !== 'CANCELADA' && status !== 'REALIZADA' ? `<button class="btn-danger-sm" onclick="abrirModalCancelamento(${c.id_consulta})">Cancelar</button>` : ''}
          </td>
        </tr>
      `;
    });
  }

  async function renderizarPacientes() {
    const tbody = document.getElementById('pacientes-body');
    if (!tbody) return;
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
          <td><button class="btn btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-right:0.35rem;" onclick="editarPac(${p.id_paciente})">Editar</button><button class="btn-danger-sm" onclick="desativarPac(${p.id_paciente})">Desativar</button></td>
        </tr>
      `;
    });
  }

  async function renderizarProfissionais() {
    const tbody = document.getElementById('profissionais-body');
    if (!tbody) return;

    const profissionais = await api.getProfissionais();
    const buscaInput = document.getElementById('busca-profissional');
    const termo = (buscaInput ? buscaInput.value : '').toLowerCase().trim();

    tbody.innerHTML = '';

    const filtrados = profissionais.filter(p => {
      const nome = p.nome_completo.toLowerCase();
      const especialidade = p.especialidade.toLowerCase();
      const registro = p.registro_profissional.toLowerCase();
      return nome.includes(termo) || especialidade.includes(termo) || registro.includes(termo);
    });

    if (filtrados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Nenhum profissional cadastrado ou encontrado.</td></tr>';
      return;
    }

    filtrados.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${p.nome_completo}</strong></td>
          <td><code>${p.registro_profissional}</code></td>
          <td><span class="badge badge-agendada">${p.especialidade || '-'}</span></td>
          <td>${p.telefone || '-'}</td>
          <td>${p.email_contato || '-'}</td>
          <td><button class="btn btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-right:0.35rem;" onclick="editarProf(${p.id_profissional})">Editar</button><button class="btn-danger-sm" onclick="desativarProf(${p.id_profissional})">Desativar</button></td>
        </tr>
      `;
    });
  }

  async function renderizarAuditoria() {
    const tbody = document.getElementById('auditoria-body');
    if (!tbody) return;
    const logs = await api.getAuditoriaLogs();
    tbody.innerHTML = '';

    if (logs.length === 0) {
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

  async function renderizarVisaoProfissional() {
    if (!usuario || usuario.perfil !== 'profissional') return;

    const tbodyAgenda = document.getElementById('prof-consultas-body');
    if (tbodyAgenda) {
      const [consultas, pacientes] = await Promise.all([api.getConsultas(), api.getPacientes()]);
      const minhas = consultas.filter(c => Number(c.id_profissional) === Number(usuario.id));

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
      const folgas = await api.getIndisponibilidades(usuario.id);
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

  async function renderizarVisaoPaciente() {
    if (!usuario || usuario.perfil !== 'paciente') return;

    const tbody = document.getElementById('paciente-consultas-body');
    if (!tbody) return;
    const [consultas, profissionais] = await Promise.all([api.getConsultas(), api.getProfissionais()]);
    const minhas = consultas.filter(c => Number(c.id_paciente) === Number(usuario.id));

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

  function aplicarSessao() {
    if (!usuario) {
      if (telaLogin) telaLogin.classList.remove('hidden');
      if (painel) painel.classList.add('hidden');
      return;
    }

    if (telaLogin) telaLogin.classList.add('hidden');
    if (painel) painel.classList.remove('hidden');

    if (areaRecepcao) areaRecepcao.classList.add('hidden');
    if (areaPaciente) areaPaciente.classList.add('hidden');
    if (areaProfissional) areaProfissional.classList.add('hidden');
    if (menuRecepcao) menuRecepcao.classList.add('hidden');
    if (menuProfissional) menuProfissional.classList.add('hidden');

    if (usuario.perfil === 'recepcao') {
      if (nomeUsuario) nomeUsuario.innerHTML = 'Perfil: <strong>Recepção / Administração</strong>';
      if (areaRecepcao) areaRecepcao.classList.remove('hidden');
      if (menuRecepcao) menuRecepcao.classList.remove('hidden');
      carregarSeletores();
      renderizarAgendaGeral();
      renderizarPacientes();
      renderizarProfissionais();
      renderizarAuditoria();
    } else if (usuario.perfil === 'profissional') {
      if (nomeUsuario) nomeUsuario.innerHTML = `Profissional: <strong>${usuario.nome}</strong>`;
      if (areaProfissional) areaProfissional.classList.remove('hidden');
      if (menuProfissional) menuProfissional.classList.remove('hidden');
      renderizarVisaoProfissional();
    } else if (usuario.perfil === 'paciente') {
      if (nomeUsuario) nomeUsuario.innerHTML = `Paciente: <strong>${usuario.nome}</strong>`;
      if (areaPaciente) areaPaciente.classList.remove('hidden');
      renderizarVisaoPaciente();
    }
  }

  const abasLogin = document.querySelectorAll('.login-tab-btn');
  const tipoLogin = document.getElementById('login-tipo-selecionado');
  const textoUsuario = document.getElementById('label-login-usuario');
  const campoUsuario = document.getElementById('login-usuario');
  const erroLogin = document.getElementById('login-alert');

  abasLogin.forEach(btn => {
    btn.onclick = () => {
      abasLogin.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tipo = btn.dataset.type;
      if (tipoLogin) tipoLogin.value = tipo;
      if (erroLogin) erroLogin.classList.add('hidden');

      if (textoUsuario && campoUsuario) {
        if (tipo === 'recepcao') {
          textoUsuario.textContent = 'E-mail ou Usuário *';
          campoUsuario.placeholder = 'admin@saude.com';
        } else if (tipo === 'profissional') {
          textoUsuario.textContent = 'E-mail Profissional *';
          campoUsuario.placeholder = 'dra.ana@saude.com';
        } else {
          textoUsuario.textContent = 'CPF do Paciente *';
          campoUsuario.placeholder = '111.222.333-44';
        }
      }
    };
  });

  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      if (erroLogin) erroLogin.classList.add('hidden');
      try {
        const tipo = tipoLogin ? tipoLogin.value : 'recepcao';
        const identificador = campoUsuario ? campoUsuario.value.trim() : '';
        const senha = document.getElementById('login-senha')?.value.trim() || '';

        usuario = await api.autenticar(tipo, identificador, senha);
        sessionStorage.setItem('sessao_usuario', JSON.stringify(usuario));
        aplicarSessao();
      } catch (err) {
        if (erroLogin) {
          erroLogin.textContent = err.message;
          erroLogin.classList.remove('hidden');
        }
      }
    };
  }

  if (botaoSair) {
    botaoSair.onclick = () => {
      sessionStorage.removeItem('sessao_usuario');
      usuario = null;
      aplicarSessao();
    };
  }

  const formAgendamento = document.getElementById('form-agendamento');
  if (formAgendamento) {
    formAgendamento.onsubmit = async (e) => {
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
        formAgendamento.reset();
        fecharModal('modal-agendamento');
        renderizarAgendaGeral();
        renderizarAuditoria();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    };
  }

  window.abrirModalReagendamento = async (id) => {
    try {
      const consultas = await api.getConsultas();
      const consulta = consultas.find(c => Number(c.id_consulta) === Number(id));
      if (!consulta) {
        mostrarAlerta('Consulta não encontrada.', 'error');
        return;
      }

      document.getElementById('reagendar-consulta-id').value = consulta.id_consulta;
      document.getElementById('reagendar-paciente').value = consulta.id_paciente;
      document.getElementById('reagendar-profissional').value = consulta.id_profissional;
      document.getElementById('reagendar-data').value = consulta.data;
      document.getElementById('reagendar-hora-inicio').value = consulta.horaInicio;
      document.getElementById('reagendar-hora-fim').value = consulta.horaFim;
      abrirModal('modal-reagendamento');
    } catch (err) {
      mostrarAlerta(err.message, 'error');
    }
  };

  const formReagendamento = document.getElementById('form-reagendamento');
  if (formReagendamento) {
    formReagendamento.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('reagendar-consulta-id').value;
        await api.reagendarConsulta(id, {
          id_paciente: document.getElementById('reagendar-paciente').value,
          id_profissional: document.getElementById('reagendar-profissional').value,
          data: document.getElementById('reagendar-data').value,
          horaInicio: document.getElementById('reagendar-hora-inicio').value,
          horaFim: document.getElementById('reagendar-hora-fim').value
        });
        mostrarAlerta('Consulta reagendada com sucesso!', 'success');
        fecharModal('modal-reagendamento');
        await renderizarAgendaGeral();
        await renderizarAuditoria();
      } catch (err) {
        mostrarAlerta(err.message, 'error');
      }
    };
  }

  window.abrirModalCancelamento = (id) => {
    const elId = document.getElementById('cancelar-consulta-id');
    const elMotivo = document.getElementById('cancelar-motivo');
    if (elId) elId.value = id;
    if (elMotivo) elMotivo.value = '';
    abrirModal('modal-cancelamento');
  };

  const formCancelamento = document.getElementById('form-cancelamento');
  if (formCancelamento) {
    formCancelamento.onsubmit = async (e) => {
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

  const formAtendimento = document.getElementById('form-atendimento');
  if (formAtendimento) {
    formAtendimento.onsubmit = async (e) => {
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

  window.editarPac = async (id) => {
    try {
      const pacientes = await api.getPacientes();
      const paciente = pacientes.find(p => Number(p.id_paciente) === Number(id));
      if (!paciente) return mostrarAlerta('Paciente não encontrado.', 'error');

      document.getElementById('pac-id').value = paciente.id_paciente;
      document.getElementById('pac-nome').value = paciente.nome_completo || '';
      document.getElementById('pac-cpf').value = paciente.cpf || '';
      document.getElementById('pac-nasc').value = String(paciente.data_nascimento || '').slice(0, 10);
      document.getElementById('pac-tel').value = paciente.telefone || '';
      document.getElementById('pac-email').value = paciente.email_contato || '';
      document.getElementById('titulo-modal-paciente').textContent = 'Editar Paciente';
      document.getElementById('btn-salvar-paciente').textContent = 'Salvar Alterações';
      abrirModal('modal-paciente');
    } catch (err) {
      mostrarAlerta(err.message, 'error');
    }
  };

  const formPaciente = document.getElementById('form-paciente');
  if (formPaciente) {
    formPaciente.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('pac-id').value;
        const dados = {
          nome_completo: document.getElementById('pac-nome').value,
          cpf: document.getElementById('pac-cpf').value,
          data_nascimento: document.getElementById('pac-nasc').value,
          telefone: document.getElementById('pac-tel').value,
          email_contato: document.getElementById('pac-email').value
        };

        if (id) {
          await api.atualizarPaciente(id, dados);
          mostrarAlerta('Paciente atualizado com sucesso!', 'success');
        } else {
          await api.criarPaciente(dados);
          mostrarAlerta('Paciente cadastrado com sucesso!', 'success');
        }

        formPaciente.reset();
        document.getElementById('pac-id').value = '';
        fecharModal('modal-paciente');
        await carregarSeletores();
        await renderizarPacientes();
      } catch (err) {
        mostrarAlerta(err.message, 'error');
      }
    };
  }

  window.editarProf = async (id) => {
    try {
      const profissionais = await api.getProfissionais();
      const profissional = profissionais.find(p => Number(p.id_profissional) === Number(id));
      if (!profissional) return mostrarAlerta('Profissional não encontrado.', 'error');

      document.getElementById('prof-id').value = profissional.id_profissional;
      document.getElementById('prof-nome').value = profissional.nome_completo || '';
      document.getElementById('prof-registro').value = profissional.registro_profissional || '';
      document.getElementById('prof-esp').value = profissional.especialidade || '';
      document.getElementById('prof-tel').value = profissional.telefone || '';
      document.getElementById('prof-email').value = profissional.email_contato || '';
      document.getElementById('titulo-modal-profissional').textContent = 'Editar Profissional de Saúde';
      document.getElementById('btn-salvar-profissional').textContent = 'Salvar Alterações';
      abrirModal('modal-profissional');
    } catch (err) {
      mostrarAlerta(err.message, 'error');
    }
  };

  const formProfissional = document.getElementById('form-profissional');
  if (formProfissional) {
    formProfissional.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('prof-id').value;
        const dados = {
          nome_completo: document.getElementById('prof-nome').value.trim(),
          registro_profissional: document.getElementById('prof-registro').value.trim(),
          especialidade: document.getElementById('prof-esp').value.trim(),
          telefone: document.getElementById('prof-tel').value.trim(),
          email_contato: document.getElementById('prof-email').value.trim()
        };

        if (id) {
          await api.atualizarProfissional(id, dados);
          mostrarAlerta('Profissional atualizado com sucesso!', 'success');
        } else {
          await api.criarProfissional(dados);
          mostrarAlerta('Profissional cadastrado com sucesso!', 'success');
        }

        formProfissional.reset();
        document.getElementById('prof-id').value = '';
        fecharModal('modal-profissional');
        await carregarSeletores();
        await renderizarProfissionais();
      } catch (err) {
        mostrarAlerta(err.message, 'error');
      }
    };
  }

  const formFolga = document.getElementById('form-folga');
  if (formFolga) {
    formFolga.onsubmit = async (e) => {
      e.preventDefault();
      await api.criarIndisponibilidade({
        id_profissional: usuario.id,
        data: document.getElementById('folga-data').value,
        motivo: document.getElementById('folga-motivo').value
      });
      mostrarAlerta("Folga cadastrada!", "success");
      formFolga.reset();
      fecharModal('modal-folga');
      renderizarVisaoProfissional();
    };
  }

  window.removerFolga = async (id) => {
    await api.excluirIndisponibilidade(id);
    renderizarVisaoProfissional();
  };
  window.desativarPac = async (id) => {
    if (confirm("Deseja realmente desativar este paciente?")) {
      try {
        await api.desativarPaciente(id);
        await carregarSeletores();
        renderizarPacientes();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    }
  };
  window.desativarProf = async (id) => {
    if (confirm("Deseja realmente desativar este profissional?")) {
      await api.desativarProfissional(id);
      await carregarSeletores();
      renderizarProfissionais();
    }
  };


  window.alterarStatusConsulta = async (id, status) => {
    if (!status) return;
    try {
      await api.atualizarStatusConsulta(id, status);
      mostrarAlerta('Status da consulta atualizado.', 'success');
      renderizarAgendaGeral();
    } catch (err) {
      mostrarAlerta(err.message, 'error');
      renderizarAgendaGeral();
    }
  };

  const filtroData = document.getElementById('filtro-data');
  const filtroProf = document.getElementById('filtro-profissional');
  const filtroStatus = document.getElementById('filtro-status');
  const visualizacaoAgenda = document.getElementById('visualizacao-agenda');
  const buscaPaciente = document.getElementById('busca-paciente');
  const buscaProfissional = document.getElementById('busca-profissional');

  if (filtroData) filtroData.onchange = renderizarAgendaGeral;
  if (filtroProf) filtroProf.onchange = renderizarAgendaGeral;
  if (filtroStatus) filtroStatus.onchange = renderizarAgendaGeral;
  if (visualizacaoAgenda) visualizacaoAgenda.onchange = renderizarAgendaGeral;
  if (buscaPaciente) buscaPaciente.oninput = renderizarPacientes;
  if (buscaProfissional) buscaProfissional.oninput = renderizarProfissionais;

  const hoje = new Date().toISOString().split('T')[0];
  if (filtroData) filtroData.value = hoje;
  const campoData = document.getElementById('campo-data');
  if (campoData) campoData.value = hoje;

  aplicarSessao();
});