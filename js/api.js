const USE_MOCK = true;
const API_BASE_URL = 'http://localhost:5000/api';

const INITIAL_PACIENTES = [
  { id: 1, nome: "Carlos Eduardo Silva", cpf: "111.222.333-44", telefone: "(28) 99911-2233", email: "carlos@gmail.com", nascimento: "1988-04-12" },
  { id: 2, nome: "Mariana Souza Lima", cpf: "555.666.777-88", telefone: "(28) 98844-5566", email: "mariana@gmail.com", nascimento: "1995-10-24" }
];

const INITIAL_PROFISSIONAIS = [
  { id: 1, nome: "Dra. Ana Beatriz", especialidade: "Fisioterapia", telefone: "(28) 99111-0001", email: "anabeatriz@clinica.com" },
  { id: 2, nome: "Dr. Roberto Martins", especialidade: "Odontologia", telefone: "(28) 99222-0002", email: "roberto@clinica.com" },
  { id: 3, nome: "Dra. Juliana Rocha", especialidade: "Psicologia", telefone: "(28) 99333-0003", email: "juliana@clinica.com" }
];

if (!localStorage.getItem('pacientes')) localStorage.setItem('pacientes', JSON.stringify(INITIAL_PACIENTES));
if (!localStorage.getItem('profissionais')) localStorage.setItem('profissionais', JSON.stringify(INITIAL_PROFISSIONAIS));
if (!localStorage.getItem('consultas')) localStorage.setItem('consultas', JSON.stringify([]));

const api = {
  // PACIENTES
  async getPacientes() {
    return JSON.parse(localStorage.getItem('pacientes'));
  },
  async criarPaciente(paciente) {
    const list = JSON.parse(localStorage.getItem('pacientes'));
    paciente.id = Date.now();
    list.push(paciente);
    localStorage.setItem('pacientes', JSON.stringify(list));
    return paciente;
  },
  async excluirPaciente(id) {
    let list = JSON.parse(localStorage.getItem('pacientes'));
    list = list.filter(p => p.id !== Number(id));
    localStorage.setItem('pacientes', JSON.stringify(list));
  },

  // PROFISSIONAIS
  async getProfissionais() {
    return JSON.parse(localStorage.getItem('profissionais'));
  },
  async criarProfissional(prof) {
    const list = JSON.parse(localStorage.getItem('profissionais'));
    prof.id = Date.now();
    list.push(prof);
    localStorage.setItem('profissionais', JSON.stringify(list));
    return prof;
  },
  async excluirProfissional(id) {
    let list = JSON.parse(localStorage.getItem('profissionais'));
    list = list.filter(p => p.id !== Number(id));
    localStorage.setItem('profissionais', JSON.stringify(list));
  },

  // CONSULTAS
  async getConsultas() {
    return JSON.parse(localStorage.getItem('consultas'));
  },
  async agendarConsulta(novaConsulta) {
    const consultas = JSON.parse(localStorage.getItem('consultas'));

    // Regra de Conflito de Horário
    const conflito = consultas.find(c => {
      if (c.profissionalId !== Number(novaConsulta.profissionalId) || c.status === 'Cancelado') return false;
      if (c.data !== novaConsulta.data) return false;
      return (novaConsulta.horaInicio < c.horaFim && novaConsulta.horaFim > c.horaInicio);
    });

    if (conflito) {
      throw new Error("Horário indisponível. O profissional já possui uma consulta nesse período.");
    }

    novaConsulta.id = Date.now();
    novaConsulta.status = 'Agendado';
    consultas.push(novaConsulta);
    localStorage.setItem('consultas', JSON.stringify(consultas));
    return novaConsulta;
  },
  async cancelarConsulta(id) {
    const consultas = JSON.parse(localStorage.getItem('consultas'));
    const index = consultas.findIndex(c => c.id === Number(id));
    if (index !== -1) {
      consultas[index].status = 'Cancelado';
      localStorage.setItem('consultas', JSON.stringify(consultas));
    }
  }
};