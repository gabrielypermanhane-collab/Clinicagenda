const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { inicializarBanco, getBanco } = require('./banco');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HORA_ABERTURA = '09:00';
const HORA_FECHAMENTO = '18:00';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function erro(res, status, mensagem) {
  return res.status(status).json({ erro: mensagem });
}

function cpfSoNumeros(cpf = '') {
  return String(cpf).replace(/\D/g, '');
}

async function senhaConfere(senhaDigitada, senhaSalva) {
  if (!senhaSalva) return false;
  if (senhaSalva.startsWith('$2a$') || senhaSalva.startsWith('$2b$')) {
    return bcrypt.compare(senhaDigitada, senhaSalva);
  }
  return senhaDigitada === senhaSalva;
}


function criarToken(dados) {
  return jwt.sign(dados, process.env.JWT_SECRET, { expiresIn: '2h' });
}

function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return erro(res, 401, 'Acesso não autorizado.');
  }
  try {
    req.usuario = jwt.verify(cabecalho.slice(7), process.env.JWT_SECRET);
    next();
  } catch (_) {
    return erro(res, 401, 'Token inválido ou expirado.');
  }
}

function autorizar(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return erro(res, 403, 'Você não possui permissão para esta operação.');
    }
    next();
  };
}

function statusParaFrontend(status) {
  return status === 'CONCLUIDA' ? 'REALIZADA' : status;
}

function formatarConsulta(row) {
  return {
    id_consulta: row.id_consulta,
    id_paciente: row.id_paciente,
    id_profissional: row.id_profissional,
    data: row.data_consulta,
    horaInicio: String(row.hora_inicio).slice(0, 5),
    horaFim: String(row.hora_fim).slice(0, 5),
    status: statusParaFrontend(row.status),
    motivo_cancelamento: row.status === 'CANCELADA' ? (row.observacao || null) : null,
    atendimento: row.id_atendimento ? {
      id_atendimento: row.id_atendimento,
      id_consulta: row.id_consulta,
      data_hora_registro: row.data_registro,
      anotacoes_clinicas: row.anotacoes_clinicas,
      prescricao_ou_conduta: row.prescricao
    } : null
  };
}

async function registrarNotificacao(conn, idConsulta, tipo, mensagem) {
  await conn.query(
    `INSERT INTO notificacao (id_consulta, tipo_notificacao, mensagem, status_envio)
     VALUES (?, ?, ?, 'ENVIADA')`,
    [idConsulta, tipo, mensagem.slice(0, 255)]
  );
}

async function criarDadosIniciais() {
  const banco = getBanco();
  const senhaPadrao = await bcrypt.hash('123456', 10);

  const [admins] = await banco.query(
    `SELECT id_usuario FROM usuario WHERE email_login = ? LIMIT 1`,
    ['admin@saude.com']
  );
  if (!admins.length) {
    await banco.query(
      `INSERT INTO usuario (email_login, senha_hash, perfil, ativo)
       VALUES (?, ?, 'ADMINISTRADOR', TRUE)`,
      ['admin@saude.com', senhaPadrao]
    );
  }

  const [profExistente] = await banco.query(
    `SELECT id_profissional FROM profissional WHERE email_contato = ? LIMIT 1`,
    ['dra.ana@saude.com']
  );
  if (!profExistente.length) {
    const [u] = await banco.query(
      `INSERT INTO usuario (email_login, senha_hash, perfil, ativo)
       VALUES (?, ?, 'PROFISSIONAL', TRUE)`,
      ['dra.ana@saude.com', senhaPadrao]
    );
    await banco.query(
      `INSERT INTO profissional
       (id_usuario, nome_completo, registro_profissional, especialidade, telefone, email_contato, status_ativo)
       VALUES (?, 'Dra. Ana Beatriz', 'CREFITO 12345', 'Fisioterapia', '(28) 99111-0001', 'dra.ana@saude.com', TRUE)`,
      [u.insertId]
    );
  }

  const cpfDemo = '111.222.333-44';
  const [pacExistente] = await banco.query(
    `SELECT id_paciente FROM paciente WHERE cpf = ? LIMIT 1`,
    [cpfDemo]
  );
  if (!pacExistente.length) {
    const [u] = await banco.query(
      `INSERT INTO usuario (email_login, senha_hash, perfil, ativo)
       VALUES (?, ?, 'PACIENTE', TRUE)`,
      ['carlos@gmail.com', senhaPadrao]
    );
    await banco.query(
      `INSERT INTO paciente
       (id_usuario, nome_completo, data_nascimento, cpf, telefone, email_contato, status_ativo)
       VALUES (?, 'Carlos Eduardo Silva', '1988-04-12', ?, '(28) 99911-2233', 'carlos@gmail.com', TRUE)`,
      [u.insertId, cpfDemo]
    );
  }
}

app.get('/api/saude', async (req, res) => {
  try {
    const banco = getBanco();
    await banco.query('SELECT 1');
    res.json({ ok: true, banco: process.env.DB_NAME || 'saude_mais' });
  } catch (e) {
    erro(res, 500, e.message);
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { tipo, identificador, senha } = req.body;
    const banco = getBanco();

    if (!tipo || !identificador || !senha) {
      return erro(res, 400, 'Informe perfil, usuário e senha.');
    }

    if (tipo === 'recepcao') {
      const [rows] = await banco.query(
        `SELECT id_usuario, email_login, senha_hash, perfil, ativo
         FROM usuario
         WHERE email_login = ? AND perfil IN ('ADMINISTRADOR','RECEPCIONISTA')
         LIMIT 1`,
        [identificador]
      );
      const u = rows[0];
      if (!u || !u.ativo || !(await senhaConfere(senha, u.senha_hash))) {
        return erro(res, 401, 'Credenciais de recepção incorretas.');
      }
      const token = criarToken({ id_usuario: u.id_usuario, perfil: u.perfil });
      return res.json({ perfil: 'recepcao', id: u.id_usuario, nome: 'Equipe Recepção Central', token });
    }

    if (tipo === 'profissional') {
      const [rows] = await banco.query(
        `SELECT p.id_profissional, p.nome_completo, p.especialidade,
                u.id_usuario, u.senha_hash, u.ativo
         FROM profissional p
         INNER JOIN usuario u ON u.id_usuario = p.id_usuario
         WHERE (LOWER(p.email_contato) = LOWER(?) OR LOWER(u.email_login) = LOWER(?))
           AND u.perfil = 'PROFISSIONAL'
         LIMIT 1`,
        [identificador, identificador]
      );
      const p = rows[0];
      if (!p || !p.ativo || !(await senhaConfere(senha, p.senha_hash))) {
        return erro(res, 401, 'E-mail ou senha do profissional incorretos.');
      }
      const token = criarToken({ id_usuario: p.id_usuario, id_profissional: p.id_profissional, perfil: 'PROFISSIONAL' });
      return res.json({ perfil: 'profissional', id: p.id_profissional, nome: p.nome_completo, especialidade: p.especialidade, token });
    }

    if (tipo === 'paciente') {
      const cpf = cpfSoNumeros(identificador);
      const [rows] = await banco.query(
        `SELECT p.id_paciente, p.nome_completo, p.email_contato,
                u.id_usuario, u.senha_hash, u.ativo
         FROM paciente p
         INNER JOIN usuario u ON u.id_usuario = p.id_usuario
         WHERE (
           REPLACE(REPLACE(REPLACE(p.cpf, '.', ''), '-', ''), ' ', '') = ?
           OR LOWER(p.email_contato) = LOWER(?)
           OR LOWER(u.email_login) = LOWER(?)
         )
         AND u.perfil = 'PACIENTE'
         LIMIT 1`,
        [cpf, identificador, identificador]
      );
      const p = rows[0];
      if (!p || !p.ativo || !(await senhaConfere(senha, p.senha_hash))) {
        return erro(res, 401, 'CPF/E-mail ou senha do paciente incorretos.');
      }
      const token = criarToken({ id_usuario: p.id_usuario, id_paciente: p.id_paciente, perfil: 'PACIENTE' });
      return res.json({ perfil: 'paciente', id: p.id_paciente, nome: p.nome_completo, email: p.email_contato, token });
    }

    return erro(res, 400, 'Perfil de acesso inválido.');
  } catch (e) {
    console.error(e);
    erro(res, 500, 'Erro interno ao realizar login.');
  }
});

app.get('/api/pacientes', autenticar, async (req, res) => {
  try {
    let sql = `SELECT DISTINCT p.id_paciente, p.nome_completo, p.data_nascimento, p.cpf, p.telefone, p.email_contato, p.endereco, p.status_ativo FROM paciente p`;
    const params = [];
    if (req.usuario.perfil === 'PROFISSIONAL') {
      sql += ` INNER JOIN consulta c ON c.id_paciente = p.id_paciente WHERE p.status_ativo = TRUE AND c.id_profissional = ?`;
      params.push(req.usuario.id_profissional);
    } else if (req.usuario.perfil === 'PACIENTE') {
      sql += ` WHERE p.status_ativo = TRUE AND p.id_paciente = ?`;
      params.push(req.usuario.id_paciente);
    } else {
      sql += ` WHERE p.status_ativo = TRUE`;
    }
    sql += ` ORDER BY p.nome_completo`;
    const [rows] = await getBanco().query(sql, params);
    res.json(rows);
  } catch (e) { erro(res, 500, e.message); }
});

app.post('/api/pacientes', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const { nome_completo, data_nascimento, cpf, telefone, email_contato, endereco } = req.body;
    if (!nome_completo || !data_nascimento || !cpf || !email_contato) {
      return erro(res, 400, 'Nome, nascimento, CPF e e-mail são obrigatórios.');
    }
    await conn.beginTransaction();

    const [cpfJaExiste] = await conn.query(`SELECT id_paciente FROM paciente WHERE cpf = ? LIMIT 1`, [cpf]);
    if (cpfJaExiste.length) {
      await conn.rollback();
      return erro(res, 409, 'Já existe um paciente cadastrado com este CPF (RN04).');
    }

    const [emailJaExiste] = await conn.query(`SELECT id_usuario FROM usuario WHERE email_login = ? LIMIT 1`, [email_contato]);
    if (emailJaExiste.length) {
      await conn.rollback();
      return erro(res, 409, 'Este e-mail já está vinculado a outro usuário.');
    }

    const hash = await bcrypt.hash('123456', 10);
    const [u] = await conn.query(
      `INSERT INTO usuario (email_login, senha_hash, perfil, ativo) VALUES (?, ?, 'PACIENTE', TRUE)`,
      [email_contato, hash]
    );
    const [p] = await conn.query(
      `INSERT INTO paciente
       (id_usuario, nome_completo, data_nascimento, cpf, telefone, email_contato, endereco, status_ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [u.insertId, nome_completo, data_nascimento, cpf, telefone || null, email_contato, endereco || null]
    );
    await conn.commit();
    res.status(201).json({ id_paciente: p.insertId, mensagem: 'Paciente cadastrado. Senha inicial: 123456' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    erro(res, 500, 'Erro ao cadastrar paciente.');
  } finally { conn.release(); }
});


app.put('/api/pacientes/:id', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const { nome_completo, data_nascimento, cpf, telefone, email_contato, endereco } = req.body;
    if (!nome_completo || !data_nascimento || !cpf || !email_contato) {
      return erro(res, 400, 'Nome, nascimento, CPF e e-mail são obrigatórios.');
    }

    await conn.beginTransaction();

    const [pacientes] = await conn.query(
      `SELECT id_usuario FROM paciente WHERE id_paciente = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!pacientes.length) {
      await conn.rollback();
      return erro(res, 404, 'Paciente não encontrado.');
    }

    const [cpfJaExiste] = await conn.query(
      `SELECT id_paciente FROM paciente WHERE cpf = ? AND id_paciente <> ? LIMIT 1`,
      [cpf, req.params.id]
    );
    if (cpfJaExiste.length) {
      await conn.rollback();
      return erro(res, 409, 'Já existe outro paciente cadastrado com este CPF.');
    }

    const idUsuario = pacientes[0].id_usuario;
    if (idUsuario) {
      const [emailJaExiste] = await conn.query(
        `SELECT id_usuario FROM usuario WHERE email_login = ? AND id_usuario <> ? LIMIT 1`,
        [email_contato, idUsuario]
      );
      if (emailJaExiste.length) {
        await conn.rollback();
        return erro(res, 409, 'Este e-mail já está vinculado a outro usuário.');
      }

      await conn.query(
        `UPDATE usuario SET email_login = ? WHERE id_usuario = ?`,
        [email_contato, idUsuario]
      );
    }

    await conn.query(
      `UPDATE paciente
       SET nome_completo = ?, data_nascimento = ?, cpf = ?, telefone = ?, email_contato = ?, endereco = ?
       WHERE id_paciente = ?`,
      [nome_completo, data_nascimento, cpf, telefone || null, email_contato, endereco || null, req.params.id]
    );

    await conn.commit();
    res.json({ mensagem: 'Paciente atualizado com sucesso.' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    erro(res, 500, 'Erro ao atualizar paciente.');
  } finally {
    conn.release();
  }
});

app.put('/api/pacientes/:id/desativar', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    await conn.beginTransaction();
    const [pacientes] = await conn.query(`SELECT id_usuario FROM paciente WHERE id_paciente = ? LIMIT 1`, [req.params.id]);
    if (!pacientes.length) {
      await conn.rollback();
      return erro(res, 404, 'Paciente não encontrado.');
    }
    await conn.query(`UPDATE paciente SET status_ativo = FALSE WHERE id_paciente = ?`, [req.params.id]);
    if (pacientes[0].id_usuario) await conn.query(`UPDATE usuario SET ativo = FALSE WHERE id_usuario = ?`, [pacientes[0].id_usuario]);
    await conn.commit();
    res.json({ mensagem: 'Paciente desativado com sucesso.' });
  } catch (e) {
    await conn.rollback();
    erro(res, 500, 'Erro ao desativar paciente.');
  } finally { conn.release(); }
});

app.get('/api/profissionais', autenticar, async (req, res) => {
  try {
    let sql = `SELECT DISTINCT p.id_profissional, p.nome_completo, p.registro_profissional, p.especialidade, p.telefone, p.email_contato, p.status_ativo FROM profissional p`;
    const params = [];
    if (req.usuario.perfil === 'PACIENTE') {
      sql += ` INNER JOIN consulta c ON c.id_profissional = p.id_profissional WHERE p.status_ativo = TRUE AND c.id_paciente = ?`;
      params.push(req.usuario.id_paciente);
    } else if (req.usuario.perfil === 'PROFISSIONAL') {
      sql += ` WHERE p.status_ativo = TRUE AND p.id_profissional = ?`;
      params.push(req.usuario.id_profissional);
    } else {
      sql += ` WHERE p.status_ativo = TRUE`;
    }
    sql += ` ORDER BY p.nome_completo`;
    const [rows] = await getBanco().query(sql, params);
    res.json(rows);
  } catch (e) { erro(res, 500, e.message); }
});

app.post('/api/profissionais', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const { nome_completo, registro_profissional, especialidade, telefone, email_contato } = req.body;
    if (!nome_completo || !registro_profissional || !especialidade || !email_contato) {
      return erro(res, 400, 'Nome, registro, especialidade e e-mail são obrigatórios.');
    }
    await conn.beginTransaction();

    const [reg] = await conn.query(`SELECT id_profissional FROM profissional WHERE registro_profissional = ? LIMIT 1`, [registro_profissional]);
    if (reg.length) {
      await conn.rollback();
      return erro(res, 409, 'Já existe um profissional cadastrado com este registro (RN05).');
    }
    const [email] = await conn.query(`SELECT id_usuario FROM usuario WHERE email_login = ? LIMIT 1`, [email_contato]);
    if (email.length) {
      await conn.rollback();
      return erro(res, 409, 'Este e-mail já está vinculado a outro usuário.');
    }

    const hash = await bcrypt.hash('123456', 10);
    const [u] = await conn.query(
      `INSERT INTO usuario (email_login, senha_hash, perfil, ativo) VALUES (?, ?, 'PROFISSIONAL', TRUE)`,
      [email_contato, hash]
    );
    const [p] = await conn.query(
      `INSERT INTO profissional
       (id_usuario, nome_completo, registro_profissional, especialidade, telefone, email_contato, status_ativo)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [u.insertId, nome_completo, registro_profissional, especialidade, telefone || null, email_contato]
    );
    await conn.commit();
    res.status(201).json({ id_profissional: p.insertId, mensagem: 'Profissional cadastrado. Senha inicial: 123456' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    erro(res, 500, 'Erro ao cadastrar profissional.');
  } finally { conn.release(); }
});


app.put('/api/profissionais/:id', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const { nome_completo, registro_profissional, especialidade, telefone, email_contato } = req.body;
    if (!nome_completo || !registro_profissional || !especialidade || !email_contato) {
      return erro(res, 400, 'Nome, registro, especialidade e e-mail são obrigatórios.');
    }

    await conn.beginTransaction();

    const [profissionais] = await conn.query(
      `SELECT id_usuario FROM profissional WHERE id_profissional = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!profissionais.length) {
      await conn.rollback();
      return erro(res, 404, 'Profissional não encontrado.');
    }

    const [registroJaExiste] = await conn.query(
      `SELECT id_profissional FROM profissional
       WHERE registro_profissional = ? AND id_profissional <> ? LIMIT 1`,
      [registro_profissional, req.params.id]
    );
    if (registroJaExiste.length) {
      await conn.rollback();
      return erro(res, 409, 'Já existe outro profissional cadastrado com este registro.');
    }

    const idUsuario = profissionais[0].id_usuario;
    if (idUsuario) {
      const [emailJaExiste] = await conn.query(
        `SELECT id_usuario FROM usuario WHERE email_login = ? AND id_usuario <> ? LIMIT 1`,
        [email_contato, idUsuario]
      );
      if (emailJaExiste.length) {
        await conn.rollback();
        return erro(res, 409, 'Este e-mail já está vinculado a outro usuário.');
      }

      await conn.query(
        `UPDATE usuario SET email_login = ? WHERE id_usuario = ?`,
        [email_contato, idUsuario]
      );
    }

    await conn.query(
      `UPDATE profissional
       SET nome_completo = ?, registro_profissional = ?, especialidade = ?, telefone = ?, email_contato = ?
       WHERE id_profissional = ?`,
      [nome_completo, registro_profissional, especialidade, telefone || null, email_contato, req.params.id]
    );

    await conn.commit();
    res.json({ mensagem: 'Profissional atualizado com sucesso.' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    erro(res, 500, 'Erro ao atualizar profissional.');
  } finally {
    conn.release();
  }
});

app.put('/api/profissionais/:id/desativar', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    await conn.beginTransaction();
    const [profissionais] = await conn.query(`SELECT id_usuario FROM profissional WHERE id_profissional = ? LIMIT 1`, [req.params.id]);
    if (!profissionais.length) {
      await conn.rollback();
      return erro(res, 404, 'Profissional não encontrado.');
    }
    await conn.query(`UPDATE profissional SET status_ativo = FALSE WHERE id_profissional = ?`, [req.params.id]);
    if (profissionais[0].id_usuario) await conn.query(`UPDATE usuario SET ativo = FALSE WHERE id_usuario = ?`, [profissionais[0].id_usuario]);
    await conn.commit();
    res.json({ mensagem: 'Profissional desativado com sucesso.' });
  } catch (e) {
    await conn.rollback();
    erro(res, 500, 'Erro ao desativar profissional.');
  } finally { conn.release(); }
});

app.get('/api/consultas', autenticar, async (req, res) => {
  try {
    let sql = `SELECT c.*, a.id_atendimento, a.data_registro, a.anotacoes_clinicas, a.prescricao FROM consulta c LEFT JOIN atendimento a ON a.id_consulta = c.id_consulta`;
    const params = [];
    if (req.usuario.perfil === 'PROFISSIONAL') {
      sql += ` WHERE c.id_profissional = ?`;
      params.push(req.usuario.id_profissional);
    } else if (req.usuario.perfil === 'PACIENTE') {
      sql += ` WHERE c.id_paciente = ?`;
      params.push(req.usuario.id_paciente);
    }
    sql += ` ORDER BY c.data_consulta, c.hora_inicio`;
    const [rows] = await getBanco().query(sql, params);
    res.json(rows.map(formatarConsulta));
  } catch (e) { erro(res, 500, e.message); }
});

app.post('/api/consultas', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const { id_paciente, id_profissional, data, horaInicio, horaFim } = req.body;
    if (!id_paciente || !id_profissional || !data || !horaInicio || !horaFim) {
      return erro(res, 400, 'Preencha paciente, profissional, data e horários.');
    }
    if (horaInicio < HORA_ABERTURA || horaFim > HORA_FECHAMENTO || horaInicio >= horaFim) {
      return erro(res, 400, `A consulta deve ocorrer entre ${HORA_ABERTURA} e ${HORA_FECHAMENTO}.`);
    }
    const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
    if (diaSemana === 0 || diaSemana === 6) {
      return erro(res, 400, 'Não é permitido agendar consultas aos sábados e domingos.');
    }

    const [folga] = await conn.query(
      `SELECT motivo FROM indisponibilidade WHERE id_profissional = ? AND data = ? LIMIT 1`,
      [id_profissional, data]
    );
    if (folga.length) {
      return erro(res, 409, `Profissional indisponível nesta data. Motivo: ${folga[0].motivo || 'Folga comunicada'}.`);
    }

    const [conflito] = await conn.query(
      `SELECT id_consulta FROM consulta
       WHERE id_profissional = ? AND data_consulta = ? AND status <> 'CANCELADA'
         AND ? < hora_fim AND ? > hora_inicio
       LIMIT 1`,
      [id_profissional, data, horaInicio, horaFim]
    );
    if (conflito.length) {
      return erro(res, 409, 'Horário indisponível para o profissional selecionado (RN01 - Conflito).');
    }

    const [conflitoPaciente] = await conn.query(
      `SELECT id_consulta FROM consulta
       WHERE id_paciente = ? AND data_consulta = ? AND status <> 'CANCELADA'
         AND ? < hora_fim AND ? > hora_inicio
       LIMIT 1`,
      [id_paciente, data, horaInicio, horaFim]
    );
    if (conflitoPaciente.length) {
      return erro(res, 409, 'O paciente já possui uma consulta neste horário.');
    }

    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO consulta (id_paciente, id_profissional, data_consulta, hora_inicio, hora_fim, status)
       VALUES (?, ?, ?, ?, ?, 'AGENDADA')`,
      [id_paciente, id_profissional, data, horaInicio, horaFim]
    );
    const [pac] = await conn.query(`SELECT nome_completo FROM paciente WHERE id_paciente = ?`, [id_paciente]);
    const nome = pac[0]?.nome_completo || 'Paciente';
    await registrarNotificacao(conn, r.insertId, 'CONFIRMACAO', `Notificação para ${nome}: consulta confirmada para ${data} às ${horaInicio}.`);
    await conn.commit();
    res.status(201).json({ id_consulta: r.insertId, mensagem: 'Consulta agendada.' });
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    console.error(e);
    erro(res, 500, 'Erro ao agendar consulta.');
  } finally { conn.release(); }
});


app.put('/api/consultas/:id/reagendar', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const { id_paciente, id_profissional, data, horaInicio, horaFim } = req.body;
    if (!id_paciente || !id_profissional || !data || !horaInicio || !horaFim) {
      return erro(res, 400, 'Preencha paciente, profissional, data e horários.');
    }

    if (horaInicio < HORA_ABERTURA || horaFim > HORA_FECHAMENTO || horaInicio >= horaFim) {
      return erro(res, 400, `A consulta deve ocorrer entre ${HORA_ABERTURA} e ${HORA_FECHAMENTO}.`);
    }

    const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
    if (diaSemana === 0 || diaSemana === 6) {
      return erro(res, 400, 'Não é permitido reagendar consultas aos sábados e domingos.');
    }

    await conn.beginTransaction();

    const [consulta] = await conn.query(
      `SELECT status FROM consulta WHERE id_consulta = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!consulta.length) {
      await conn.rollback();
      return erro(res, 404, 'Consulta não encontrada.');
    }
    if (consulta[0].status !== 'AGENDADA') {
      await conn.rollback();
      return erro(res, 409, 'Somente consultas agendadas podem ser reagendadas.');
    }

    const [folga] = await conn.query(
      `SELECT motivo FROM indisponibilidade WHERE id_profissional = ? AND data = ? LIMIT 1`,
      [id_profissional, data]
    );
    if (folga.length) {
      await conn.rollback();
      return erro(res, 409, `Profissional indisponível nesta data. Motivo: ${folga[0].motivo || 'Folga comunicada'}.`);
    }

    const [conflito] = await conn.query(
      `SELECT id_consulta FROM consulta
       WHERE id_profissional = ?
         AND data_consulta = ?
         AND status <> 'CANCELADA'
         AND id_consulta <> ?
         AND ? < hora_fim
         AND ? > hora_inicio
       LIMIT 1`,
      [id_profissional, data, req.params.id, horaInicio, horaFim]
    );
    if (conflito.length) {
      await conn.rollback();
      return erro(res, 409, 'Horário indisponível para o profissional selecionado (conflito de agenda).');
    }

    const [conflitoPaciente] = await conn.query(
      `SELECT id_consulta FROM consulta
       WHERE id_paciente = ? AND data_consulta = ? AND status <> 'CANCELADA'
         AND id_consulta <> ? AND ? < hora_fim AND ? > hora_inicio
       LIMIT 1`,
      [id_paciente, data, req.params.id, horaInicio, horaFim]
    );
    if (conflitoPaciente.length) {
      await conn.rollback();
      return erro(res, 409, 'O paciente já possui uma consulta neste horário.');
    }

    await conn.query(
      `UPDATE consulta
       SET id_paciente = ?, id_profissional = ?, data_consulta = ?, hora_inicio = ?, hora_fim = ?, observacao = NULL
       WHERE id_consulta = ?`,
      [id_paciente, id_profissional, data, horaInicio, horaFim, req.params.id]
    );

    await registrarNotificacao(
      conn,
      req.params.id,
      'REAGENDAMENTO',
      `Consulta #${req.params.id} reagendada para ${data} às ${horaInicio}.`
    );

    await conn.commit();
    res.json({ mensagem: 'Consulta reagendada com sucesso.' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    erro(res, 500, 'Erro ao reagendar consulta.');
  } finally {
    conn.release();
  }
});

app.put('/api/consultas/:id/status', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  try {
    const mapa = {
      AGENDADA: 'AGENDADA',
      CONFIRMADA: 'CONFIRMADA',
      EM_ATENDIMENTO: 'EM_ATENDIMENTO',
      REALIZADA: 'CONCLUIDA',
      CONCLUIDA: 'CONCLUIDA',
      FALTOU: 'FALTOU'
    };
    const novoStatus = mapa[req.body.status];
    if (!novoStatus) return erro(res, 400, 'Status inválido.');
    const [resultado] = await getBanco().query(
      `UPDATE consulta SET status = ? WHERE id_consulta = ? AND status <> 'CANCELADA'`,
      [novoStatus, req.params.id]
    );
    if (!resultado.affectedRows) return erro(res, 404, 'Consulta não encontrada ou cancelada.');
    res.json({ mensagem: 'Status atualizado com sucesso.' });
  } catch (e) { erro(res, 500, 'Erro ao atualizar status.'); }
});

app.put('/api/consultas/:id/cancelar', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA','PROFISSIONAL'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const motivo = String(req.body.motivo || '').trim();
    if (req.usuario.perfil === 'PROFISSIONAL') {
      const [propria] = await conn.query(`SELECT id_consulta FROM consulta WHERE id_consulta = ? AND id_profissional = ? LIMIT 1`, [req.params.id, req.usuario.id_profissional]);
      if (!propria.length) return erro(res, 403, 'Você não possui acesso a esta consulta.');
    }
    if (!motivo) return erro(res, 400, 'Informe o motivo do cancelamento.');
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE consulta SET status = 'CANCELADA', observacao = ? WHERE id_consulta = ? AND status <> 'CONCLUIDA'`,
      [motivo.slice(0, 500), req.params.id]
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return erro(res, 404, 'Consulta não encontrada ou já concluída.');
    }
    await registrarNotificacao(conn, req.params.id, 'CANCELAMENTO', `Consulta #${req.params.id} cancelada. Motivo: ${motivo}`);
    await conn.commit();
    res.json({ mensagem: 'Consulta cancelada.' });
  } catch (e) {
    await conn.rollback();
    erro(res, 500, e.message);
  } finally { conn.release(); }
});

app.put('/api/consultas/:id/atendimento', autenticar, autorizar('PROFISSIONAL'), async (req, res) => {
  const banco = getBanco();
  const conn = await banco.getConnection();
  try {
    const { anotacoes, conduta } = req.body;
    if (!String(anotacoes || '').trim()) return erro(res, 400, 'Informe as anotações clínicas.');
    await conn.beginTransaction();
    const [consulta] = await conn.query(`SELECT status, id_profissional FROM consulta WHERE id_consulta = ? FOR UPDATE`, [req.params.id]);
    if (!consulta.length) {
      await conn.rollback();
      return erro(res, 404, 'Consulta não encontrada.');
    }
    if (Number(consulta[0].id_profissional) !== Number(req.usuario.id_profissional)) {
      await conn.rollback();
      return erro(res, 403, 'Você não possui acesso a esta consulta.');
    }
    if (consulta[0].status === 'CANCELADA') {
      await conn.rollback();
      return erro(res, 409, 'Não é possível registrar atendimento de consulta cancelada.');
    }
    if (consulta[0].status === 'CONCLUIDA') {
      await conn.rollback();
      return erro(res, 409, 'Este atendimento já foi registrado anteriormente.');
    }
    await conn.query(
      `INSERT INTO atendimento (id_consulta, anotacoes_clinicas, prescricao) VALUES (?, ?, ?)`,
      [req.params.id, anotacoes, conduta || null]
    );
    await conn.query(`UPDATE consulta SET status = 'CONCLUIDA' WHERE id_consulta = ?`, [req.params.id]);
    await conn.commit();
    res.json({ mensagem: 'Atendimento registrado.' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return erro(res, 409, 'Este atendimento já foi registrado anteriormente.');
    erro(res, 500, e.message);
  } finally { conn.release(); }
});

app.get('/api/auditoria', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA'), async (req, res) => {
  try {
    const [rows] = await getBanco().query(
      `SELECT id_notificacao, id_consulta,
              DATE_FORMAT(data_envio, '%d/%m/%Y %H:%i:%s') AS timestamp,
              tipo_notificacao AS tipo,
              mensagem,
              CASE WHEN status_envio = 'ENVIADA' THEN 'ENVIADO' ELSE status_envio END AS status_envio
       FROM notificacao
       ORDER BY data_envio DESC, id_notificacao DESC`
    );
    res.json(rows);
  } catch (e) { erro(res, 500, e.message); }
});

app.get('/api/indisponibilidades/:idProfissional', autenticar, autorizar('ADMINISTRADOR','RECEPCIONISTA','PROFISSIONAL'), async (req, res) => {
  try {
    if (req.usuario.perfil === 'PROFISSIONAL' && Number(req.params.idProfissional) !== Number(req.usuario.id_profissional)) {
      return erro(res, 403, 'Você não possui acesso a esta agenda.');
    }
    const [rows] = await getBanco().query(
      `SELECT id_folga, id_profissional, data, motivo
       FROM indisponibilidade
       WHERE id_profissional = ?
       ORDER BY data DESC`,
      [req.params.idProfissional]
    );
    res.json(rows);
  } catch (e) { erro(res, 500, e.message); }
});

app.post('/api/indisponibilidades', autenticar, autorizar('PROFISSIONAL'), async (req, res) => {
  try {
    const { id_profissional, data, motivo } = req.body;
    if (!id_profissional || !data) return erro(res, 400, 'Profissional e data são obrigatórios.');
    if (Number(id_profissional) !== Number(req.usuario.id_profissional)) return erro(res, 403, 'Você só pode alterar a própria agenda.');
    const [r] = await getBanco().query(
      `INSERT INTO indisponibilidade (id_profissional, data, motivo) VALUES (?, ?, ?)`,
      [id_profissional, data, motivo || null]
    );
    res.status(201).json({ id_folga: r.insertId, mensagem: 'Folga cadastrada.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return erro(res, 409, 'Já existe um bloqueio para este profissional nesta data.');
    erro(res, 500, e.message);
  }
});

app.delete('/api/indisponibilidades/:id', autenticar, autorizar('PROFISSIONAL'), async (req, res) => {
  try {
    const [folgas] = await getBanco().query(`SELECT id_profissional FROM indisponibilidade WHERE id_folga = ? LIMIT 1`, [req.params.id]);
    if (!folgas.length) return erro(res, 404, 'Folga não encontrada.');
    if (Number(folgas[0].id_profissional) !== Number(req.usuario.id_profissional)) return erro(res, 403, 'Você só pode alterar a própria agenda.');
    const [r] = await getBanco().query(`DELETE FROM indisponibilidade WHERE id_folga = ?`, [req.params.id]);
    if (!r.affectedRows) return erro(res, 404, 'Folga não encontrada.');
    res.json({ mensagem: 'Folga removida.' });
  } catch (e) { erro(res, 500, e.message); }
});

app.use(express.static(__dirname));
app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'Rota da API não encontrada.' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

(async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('Defina JWT_SECRET no arquivo .env.');
    }
    await inicializarBanco();
    await criarDadosIniciais();
    app.listen(PORT, () => {
      console.log(`\nSaúde + iniciado em http://localhost:${PORT}`);
      console.log('Banco MySQL conectado: saude_mais');
      console.log('Recepção: admin@saude.com / 123456');
      console.log('Profissional: dra.ana@saude.com / 123456');
      console.log('Paciente: 111.222.333-44 / 123456\n');
    });
  } catch (e) {
    console.error('\nNão foi possível iniciar o sistema.');
    console.error(e.message);
    console.error('\nConfira se o MySQL está ligado e revise o arquivo .env.\n');
    process.exit(1);
  }
})();
