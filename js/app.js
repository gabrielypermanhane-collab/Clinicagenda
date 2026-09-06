document.addEventListener('DOMContentLoaded', async () => {
  // 1. Controle de Abas
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // 2. Utilitários de Modal (Globais)
  window.fecharModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  };
  
  window.abrirModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  };

  // Associação segura dos botões de abrir modal
  const btnModalAgenda = document.getElementById('btn-open-modal-agendamento') || document.getElementById('btn-open-modal');
  const btnModalPac = document.getElementById('btn-open-modal-paciente');
  const btnModalProf = document.getElementById('btn-open-modal-profissional');

  if (btnModalAgenda) btnModalAgenda.onclick = () => abrirModal('modal-agendamento');
  if (btnModalPac) btnModalPac.onclick = () => abrirModal('modal-paciente');
  if (btnModalProf) btnModalProf.onclick = () => abrirModal('modal-profissional');

  // Sistema de Alertas
  const alertContainer = document.getElementById('alert-container');
  function mostrarAlerta(msg, tipo = 'error') {
    if (!alertContainer) return;
    alertContainer.innerHTML = `<div class="alert alert-${tipo}">${msg}</div>`;
    setTimeout(() => { alertContainer.innerHTML = ''; }, 4000);
  }

  // 3. Seletores e Filtros da Agenda
  const filtroData = document.getElementById('filtro-data');
  const filtroProfissional = document.getElementById('filtro-profissional');
  const campoData = document.getElementById('campo-data');
  const campoPaciente = document.getElementById('campo-paciente');
  const campoProfissional = document.getElementById('campo-profissional');

  const hoje = new Date().toISOString().split('T')[0];
  if (filtroData) filtroData.value = hoje;
  if (campoData) campoData.value = hoje;

  // Atualizar seletores suspensos (selects)
  async function atualizarSeletores() {
    const [pacientes, profissionais] = await Promise.all([
      api.getPacientes(), 
      api.getProfissionais()
    ]);

    if (filtroProfissional) {
      filtroProfissional.innerHTML = '<option value="">Todos os profissionais</option>';
      profissionais.forEach(p => {
        filtroProfissional.innerHTML += `<option value="${p.id}">${p.nome} (${p.especialidade})</option>`;
      });
    }

    if (campoProfissional) {
      campoProfissional.innerHTML = '<option value="">Selecione um profissional</option>';
      profissionais.forEach(p => {
        campoProfissional.innerHTML += `<option value="${p.id}">${p.nome} - ${p.especialidade}</option>`;
      });
    }

    if (campoPaciente) {
      campoPaciente.innerHTML = '<option value="">Selecione um paciente</option>';
      pacientes.forEach(p => {
        campoPaciente.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
      });
    }
  }

  // 4. Renderizar Tabela de Pacientes
  async function renderizarPacientes() {
    const tbody = document.getElementById('pacientes-body');
    if (!tbody) return;
    
    const pacientes = await api.getPacientes();
    tbody.innerHTML = '';

    if (!pacientes || pacientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum paciente cadastrado.</td></tr>';
      return;
    }

    pacientes.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.nome}</strong></td>
        <td>${p.cpf || '-'}</td>
        <td>${p.telefone || '-'}</td>
        <td>${p.email || '-'}</td>
        <td>${p.nascimento || '-'}</td>
        <td><button class="btn-danger-sm" onclick="excluirPac(${p.id})">Excluir</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 5. Renderizar Tabela de Profissionais
  async function renderizarProfissionais() {
    const tbody = document.getElementById('profissionais-body');
    if (!tbody) return;

    const profissionais = await api.getProfissionais();
    tbody.innerHTML = '';

    if (!profissionais || profissionais.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum profissional cadastrado.</td></tr>';
      return;
    }

    profissionais.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.nome}</strong></td>
        <td><span class="badge badge-agendado">${p.especialidade}</span></td>
        <td>${p.telefone || '-'}</td>
        <td>${p.email || '-'}</td>
        <td><button class="btn-danger-sm" onclick="excluirProf(${p.id})">Excluir</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 6. Renderizar Agenda
  async function renderizarAgenda() {
    const tbody = document.getElementById('agenda-body');
    if (!tbody) return;

    const [consultas, pacientes, profissionais] = await Promise.all([
      api.getConsultas(), 
      api.getPacientes(), 
      api.getProfissionais()
    ]);
    
    tbody.innerHTML = '';

    const filtradas = consultas.filter(c => {
      const matchData = (filtroData && filtroData.value) ? c.data === filtroData.value : true;
      const matchProf = (filtroProfissional && filtroProfissional.value) ? String(c.profissionalId) === filtroProfissional.value : true;
      return matchData && matchProf;
    });

    if (filtradas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Nenhum agendamento encontrado para este filtro.</td></tr>';
      return;
    }

    filtradas.forEach(c => {
      const pac = pacientes.find(p => p.id === Number(c.pacienteId)) || { nome: 'Não encontrado' };
      const prof = profissionais.find(p => p.id === Number(c.profissionalId)) || { nome: 'Não encontrado', especialidade: '-' };

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.horaInicio} - ${c.horaFim}</strong></td>
        <td>${pac.nome}</td>
        <td>${prof.nome}</td>
        <td>${prof.especialidade}</td>
        <td><span class="badge badge-${c.status.toLowerCase()}">${c.status}</span></td>
        <td>${c.status === 'Agendado' ? `<button class="btn-danger-sm" onclick="cancelarConsulta(${c.id})">Cancelar</button>` : '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Formulário: Cadastrar Paciente
  const formPac = document.getElementById('form-paciente');
  if (formPac) {
    formPac.onsubmit = async (e) => {
      e.preventDefault();
      await api.criarPaciente({
        nome: document.getElementById('pac-nome').value,
        cpf: document.getElementById('pac-cpf').value,
        nascimento: document.getElementById('pac-nasc').value,
        telefone: document.getElementById('pac-tel').value,
        email: document.getElementById('pac-email').value
      });
      mostrarAlerta("Paciente cadastrado com sucesso!", "success");
      e.target.reset();
      fecharModal('modal-paciente');
      await atualizarSeletores();
      await renderizarPacientes();
    };
  }

  // Formulário: Cadastrar Profissional
  const formProf = document.getElementById('form-profissional');
  if (formProf) {
    formProf.onsubmit = async (e) => {
      e.preventDefault();
      await api.criarProfissional({
        nome: document.getElementById('prof-nome').value,
        especialidade: document.getElementById('prof-esp').value,
        telefone: document.getElementById('prof-tel').value,
        email: document.getElementById('prof-email').value
      });
      mostrarAlerta("Profissional cadastrado com sucesso!", "success");
      e.target.reset();
      fecharModal('modal-profissional');
      await atualizarSeletores();
      await renderizarProfissionais();
    };
  }

  // Formulário: Novo Agendamento
  const formAgend = document.getElementById('form-agendamento');
  if (formAgend) {
    formAgend.onsubmit = async (e) => {
      e.preventDefault();
      const horaInicio = document.getElementById('campo-hora-inicio').value;
      const horaFim = document.getElementById('campo-hora-fim').value;

      if (horaInicio >= horaFim) {
        mostrarAlerta("O horário de término deve ser posterior ao de início.");
        return;
      }

      try {
        await api.agendarConsulta({
          pacienteId: Number(campoPaciente.value),
          profissionalId: Number(campoProfissional.value),
          data: campoData.value,
          horaInicio,
          horaFim
        });
        mostrarAlerta("Consulta agendada com sucesso!", "success");
        e.target.reset();
        if (filtroData && campoData) campoData.value = filtroData.value;
        fecharModal('modal-agendamento');
        renderizarAgenda();
      } catch (err) {
        mostrarAlerta(err.message, "error");
      }
    };
  }

  // Funções Globais de Exclusão / Cancelamento
  window.excluirPac = async (id) => {
    if (confirm("Deseja excluir este paciente?")) {
      await api.excluirPaciente(id);
      await atualizarSeletores();
      await renderizarPacientes();
    }
  };

  window.excluirProf = async (id) => {
    if (confirm("Deseja excluir este profissional?")) {
      await api.excluirProfissional(id);
      await atualizarSeletores();
      await renderizarProfissionais();
    }
  };

  window.cancelarConsulta = async (id) => {
    if (confirm("Deseja cancelar esta consulta?")) {
      await api.cancelarConsulta(id);
      renderizarAgenda();
    }
  };

  if (filtroData) filtroData.onchange = renderizarAgenda;
  if (filtroProfissional) filtroProfissional.onchange = renderizarAgenda;

  // Carregamento inicial de todas as visões
  await atualizarSeletores();
  await renderizarAgenda();
  await renderizarPacientes();
  await renderizarProfissionais();
});