const API = '/api';

async function requisicao(caminho, opcoes = {}) {
  const sessao = JSON.parse(sessionStorage.getItem('sessao_usuario') || 'null');
  const token = sessao?.token;
  const resposta = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {})
    }
  });

  let dados = {};
  try {
    dados = await resposta.json();
  } catch (_) {
    dados = {};
  }

  if (!resposta.ok) {
    throw new Error(dados.erro || dados.mensagem || `Erro HTTP ${resposta.status}`);
  }

  return dados;
}

const api = {
  async autenticar(tipo, identificador, senha) {
    return requisicao('/login', {
      method: 'POST',
      body: JSON.stringify({ tipo, identificador, senha })
    });
  },

  async getPacientes() {
    return requisicao('/pacientes');
  },

  async criarPaciente(paciente) {
    return requisicao('/pacientes', {
      method: 'POST',
      body: JSON.stringify(paciente)
    });
  },

  async atualizarPaciente(id, paciente) {
    return requisicao(`/pacientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(paciente)
    });
  },

  async desativarPaciente(id) {
    return requisicao(`/pacientes/${id}/desativar`, { method: 'PUT' });
  },

  async getProfissionais() {
    return requisicao('/profissionais');
  },

  async criarProfissional(profissional) {
    return requisicao('/profissionais', {
      method: 'POST',
      body: JSON.stringify(profissional)
    });
  },

  async atualizarProfissional(id, profissional) {
    return requisicao(`/profissionais/${id}`, {
      method: 'PUT',
      body: JSON.stringify(profissional)
    });
  },

  async desativarProfissional(id) {
    return requisicao(`/profissionais/${id}/desativar`, { method: 'PUT' });
  },

  async getConsultas() {
    return requisicao('/consultas');
  },

  async agendarConsulta(consulta) {
    return requisicao('/consultas', {
      method: 'POST',
      body: JSON.stringify(consulta)
    });
  },

  async reagendarConsulta(id, consulta) {
    return requisicao(`/consultas/${id}/reagendar`, {
      method: 'PUT',
      body: JSON.stringify(consulta)
    });
  },

  async atualizarStatusConsulta(id, status) {
    return requisicao(`/consultas/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async cancelarConsulta(id, motivo) {
    return requisicao(`/consultas/${id}/cancelar`, {
      method: 'PUT',
      body: JSON.stringify({ motivo })
    });
  },

  async registrarAtendimento(id, anotacoes, conduta) {
    return requisicao(`/consultas/${id}/atendimento`, {
      method: 'PUT',
      body: JSON.stringify({ anotacoes, conduta })
    });
  },

  async getAuditoriaLogs() {
    return requisicao('/auditoria');
  },

  async getIndisponibilidades(idProfissional) {
    return requisicao(`/indisponibilidades/${idProfissional}`);
  },

  async criarIndisponibilidade(folga) {
    return requisicao('/indisponibilidades', {
      method: 'POST',
      body: JSON.stringify(folga)
    });
  },

  async excluirIndisponibilidade(id) {
    return requisicao(`/indisponibilidades/${id}`, { method: 'DELETE' });
  }
};
