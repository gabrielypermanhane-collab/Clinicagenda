// Contrato de Funcionamento
const HORA_ABERTURA = "09:00";
const HORA_FECHAMENTO = "18:00";

const INITIAL_PACIENTES = [
  { id_paciente: 1, nome_completo: "Carlos Eduardo Silva", cpf: "111.222.333-44", data_nascimento: "1988-04-12", telefone: "(28) 99911-2233", email_contato: "carlos@gmail.com", senha: "123456" },
  { id_paciente: 2, nome_completo: "Mariana Souza Lima", cpf: "555.666.777-88", data_nascimento: "1995-10-24", telefone: "(28) 98844-5566", email_contato: "mariana@gmail.com", senha: "123456" }
];

const INITIAL_PROFISSIONAIS = [
  { id_profissional: 1, nome_completo: "Dra. Ana Beatriz", registro_profissional: "CREFITO 12345", especialidade: "Fisioterapia", telefone: "(28) 99111-0001", email_contato: "dra.ana@saude.com", senha: "123456" },
  { id_profissional: 2, nome_completo: "Dr. Roberto Martins", registro_profissional: "CRO 98765", especialidade: "Odontologia", telefone: "(28) 99222-0002", email_contato: "dr.roberto@saude.com", senha: "123456" }
];

const USUARIO_RECEPCAO = {
  usuario: "admin@saude.com",
  senha: "123456",
  nome_completo: "Equipe Recepção Central"
};

// Inicialização segura no LocalStorage
if (!localStorage.getItem('pacientes')) localStorage.setItem('pacientes', JSON.stringify(INITIAL_PACIENTES));
if (!localStorage.getItem('profissionais')) localStorage.setItem('profissionais', JSON.stringify(INITIAL_PROFISSIONAIS));
if (!localStorage.getItem('consultas')) localStorage.setItem('consultas', JSON.stringify([]));
if (!localStorage.getItem('indisponibilidades')) localStorage.setItem('indisponibilidades', JSON.stringify([]));
if (!localStorage.getItem('notificacoes_log')) localStorage.setItem('notificacoes_log', JSON.stringify([]));
if (!localStorage.getItem('admin_user')) localStorage.setItem('admin_user', JSON.stringify(USUARIO_RECEPCAO));

const api = {
  // 1. AUTENTICAÇÃO (RF01, RF02)
  async autenticar(tipo, identificador, senha) {
    if (tipo === 'recepcao') {
      const admin = JSON.parse(localStorage.getItem('admin_user')) || USUARIO_RECEPCAO;
      if (identificador === admin.usuario && senha === admin.senha) {
        return { perfil: 'recepcao', nome: admin.nome_completo };
      }
      throw new Error("Credenciais de recepção incorretas.");
    }
    if (tipo === 'profissional') {
      const medicos = JSON.parse(localStorage.getItem('profissionais')) || [];
      const medico = medicos.find(m => (m.email_contato || '').toLowerCase() === identificador.toLowerCase() && m.senha === senha);
      if (medico) {
        return { perfil: 'profissional', id: medico.id_profissional, nome: medico.nome_completo, especialidade: medico.especialidade };
      }
      throw new Error("E-mail ou senha do profissional incorretos.");
    }
    if (tipo === 'paciente') {
      const pacientes = JSON.parse(localStorage.getItem('pacientes')) || [];
      const cleanIdent = identificador.replace(/\D/g, '');
      const paciente = pacientes.find(p => ((p.cpf || '').replace(/\D/g, '') === cleanIdent || (p.email_contato || '').toLowerCase() === identificador.toLowerCase()) && p.senha === senha);
      if (paciente) {
        return { perfil: 'paciente', id: paciente.id_paciente, nome: paciente.nome_completo, email: paciente.email_contato };
      }
      throw new Error("CPF/E-mail ou senha do paciente incorretos.");
    }
    throw new Error("Perfil de acesso inválido.");
  },

  // 2. PACIENTES (RF03, RF14, RN04)
  async getPacientes() {
    return JSON.parse(localStorage.getItem('pacientes')) || [];
  },
  async criarPaciente(paciente) {
    const list = JSON.parse(localStorage.getItem('pacientes')) || [];
    const cpfLimpo = (paciente.cpf || '').replace(/\D/g, '');
    if (list.some(p => (p.cpf || '').replace(/\D/g, '') === cpfLimpo)) {
      throw new Error("Já existe um paciente cadastrado com este CPF (RN04).");
    }
    paciente.id_paciente = Date.now();
    paciente.senha = paciente.senha || "123456";
    list.push(paciente);
    localStorage.setItem('pacientes', JSON.stringify(list));
    return paciente;
  },
  async excluirPaciente(id) {
    const consultas = JSON.parse(localStorage.getItem('consultas')) || [];
    if (consultas.some(c => Number(c.id_paciente) === Number(id))) {
      throw new Error("Não é possível excluir o paciente porque existem consultas vinculadas.");
    }
    let list = JSON.parse(localStorage.getItem('pacientes')) || [];
    list = list.filter(p => Number(p.id_paciente) !== Number(id));
    localStorage.setItem('pacientes', JSON.stringify(list));
  },

  // 3. PROFISSIONAIS (RF04, RF15, RN05)
  async getProfissionais() {
    return JSON.parse(localStorage.getItem('profissionais')) || [];
  },
  async criarProfissional(prof) {
    const list = JSON.parse(localStorage.getItem('profissionais')) || [];
    const novoReg = (prof.registro_profissional || '').trim().toUpperCase();
    if (novoReg && list.some(p => (p.registro_profissional || '').toUpperCase() === novoReg)) {
      throw new Error("Já existe um profissional cadastrado com este registro (RN05).");
    }
    prof.id_profissional = Date.now();
    prof.senha = prof.senha || "123456";
    list.push(prof);
    localStorage.setItem('profissionais', JSON.stringify(list));
    return prof;
  },
  async excluirProfissional(id) {
    let list = JSON.parse(localStorage.getItem('profissionais')) || [];
    list = list.filter(p => Number(p.id_profissional) !== Number(id));
    localStorage.setItem('profissionais', JSON.stringify(list));
  },

  // 4. INDISPONIBILIDADES / FOLGAS
  async getIndisponibilidades(profId = null) {
    const list = JSON.parse(localStorage.getItem('indisponibilidades')) || [];
    return profId ? list.filter(i => Number(i.id_profissional) === Number(profId)) : list;
  },
  async criarIndisponibilidade(folga) {
    const list = JSON.parse(localStorage.getItem('indisponibilidades')) || [];
    folga.id_folga = Date.now();
    list.push(folga);
    localStorage.setItem('indisponibilidades', JSON.stringify(list));
    return folga;
  },
  async excluirIndisponibilidade(id) {
    let list = JSON.parse(localStorage.getItem('indisponibilidades')) || [];
    list = list.filter(i => Number(i.id_folga) !== Number(id));
    localStorage.setItem('indisponibilidades', JSON.stringify(list));
  },

  // 5. AUDITORIA E LOGS (RF13, RNF07)
  async getAuditoriaLogs() {
    return JSON.parse(localStorage.getItem('notificacoes_log')) || [];
  },
  async registrarLog(id_consulta, tipo, mensagem) {
    const logs = JSON.parse(localStorage.getItem('notificacoes_log')) || [];
    const logEntry = {
      id_notificacao: Date.now(),
      id_consulta,
      timestamp: new Date().toLocaleString('pt-BR'),
      tipo,
      mensagem,
      status_envio: "ENVIADO"
    };
    logs.unshift(logEntry);
    localStorage.setItem('notificacoes_log', JSON.stringify(logs));
    return logEntry;
  },

  // 6. CONSULTAS (RF05-RF10, RN01, RN02)
  async getConsultas() {
    return JSON.parse(localStorage.getItem('consultas')) || [];
  },
  async agendarConsulta({ id_paciente, id_profissional, data, horaInicio, horaFim }) {
    if (!id_paciente || !id_profissional) {
      throw new Error("A consulta deve conter obrigatoriamente um paciente e um profissional (RN02).");
    }
    if (horaInicio < HORA_ABERTURA || horaFim > HORA_FECHAMENTO || horaInicio >= horaFim) {
      throw new Error(`A consulta deve ocorrer entre ${HORA_ABERTURA} e ${HORA_FECHAMENTO} no mesmo dia.`);
    }

    const dataObj = new Date(data + "T00:00:00");
    const diaSemana = dataObj.getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      throw new Error("Não é permitido agendar consultas aos sábados e domingos.");
    }

    const indisps = JSON.parse(localStorage.getItem('indisponibilidades')) || [];
    const folga = indisps.find(i => Number(i.id_profissional) === Number(id_profissional) && i.data === data);
    if (folga) {
      throw new Error(`Profissional indisponível nesta data. Motivo: ${folga.motivo || 'Folga comunicada'}.`);
    }

    const consultas = JSON.parse(localStorage.getItem('consultas')) || [];
    const conflito = consultas.find(c => {
      if (Number(c.id_profissional) !== Number(id_profissional) || c.status === 'CANCELADA') return false;
      if (c.data !== data) return false;
      return (horaInicio < c.horaFim && horaFim > c.horaInicio);
    });

    if (conflito) {
      throw new Error("Horário indisponível para o profissional selecionado (RN01 - Conflito).");
    }

    const novaConsulta = {
      id_consulta: Date.now(),
      id_paciente: Number(id_paciente),
      id_profissional: Number(id_profissional),
      data,
      horaInicio,
      horaFim,
      status: "AGENDADA",
      motivo_cancelamento: null,
      atendimento: null
    };

    consultas.push(novaConsulta);
    localStorage.setItem('consultas', JSON.stringify(consultas));

    const pacientes = JSON.parse(localStorage.getItem('pacientes')) || [];
    const pac = pacientes.find(p => Number(p.id_paciente) === Number(id_paciente));
    const nome = pac ? pac.nome_completo : "Paciente";

    await this.registrarLog(
      novaConsulta.id_consulta,
      "CONFIRMACAO_AGENDAMENTO",
      `Notificação enviada para ${nome}: Consulta confirmada para ${data} às ${horaInicio}.`
    );

    return novaConsulta;
  },

  // 7. PRONTUÁRIO (RF11, RN03)
  async registrarAtendimento(id_consulta, anotacoes_clinicas, prescricao_ou_conduta) {
    const consultas = JSON.parse(localStorage.getItem('consultas')) || [];
    const index = consultas.findIndex(c => Number(c.id_consulta) === Number(id_consulta));
    if (index === -1) throw new Error("Consulta não encontrada (RN03).");

    if (consultas[index].status === "REALIZADA") {
      throw new Error("Este atendimento já foi registrado anteriormente.");
    }
    if (consultas[index].status === "CANCELADA") {
      throw new Error("Não é possível registrar atendimento de consulta cancelada.");
    }

    consultas[index].status = "REALIZADA";
    consultas[index].atendimento = {
      id_atendimento: Date.now(),
      id_consulta: Number(id_consulta),
      data_hora_registro: new Date().toLocaleString('pt-BR'),
      anotacoes_clinicas,
      prescricao_ou_conduta
    };

    localStorage.setItem('consultas', JSON.stringify(consultas));
    await this.registrarLog(id_consulta, "RESUMO_ATENDIMENTO", "Atendimento clínico registrado e prontuário salvo.");
  },

  // 8. CANCELAMENTO (RF07)
  async cancelarConsulta(id_consulta, motivo) {
    const consultas = JSON.parse(localStorage.getItem('consultas')) || [];
    const index = consultas.findIndex(c => Number(c.id_consulta) === Number(id_consulta));
    if (index !== -1) {
      consultas[index].status = "CANCELADA";
      consultas[index].motivo_cancelamento = motivo;
      localStorage.setItem('consultas', JSON.stringify(consultas));
      await this.registrarLog(id_consulta, "CANCELAMENTO_CONSULTA", `Consulta #${id_consulta} cancelada. Motivo: ${motivo}`);
    }
  }
};