CREATE DATABASE IF NOT EXISTS saude_mais
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE saude_mais;

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  email_login VARCHAR(100) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('ADMINISTRADOR','RECEPCIONISTA','PROFISSIONAL','PACIENTE') NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paciente (
  id_paciente INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NULL,
  nome_completo VARCHAR(150) NOT NULL,
  data_nascimento DATE NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  telefone VARCHAR(20),
  email_contato VARCHAR(100),
  endereco VARCHAR(255),
  status_ativo BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_paciente_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profissional (
  id_profissional INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NULL,
  nome_completo VARCHAR(150) NOT NULL,
  registro_profissional VARCHAR(50) UNIQUE,
  especialidade VARCHAR(100) NOT NULL,
  telefone VARCHAR(20),
  email_contato VARCHAR(100),
  status_ativo BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_profissional_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consulta (
  id_consulta INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT NOT NULL,
  id_profissional INT NOT NULL,
  data_consulta DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  status ENUM('AGENDADA','CONFIRMADA','EM_ATENDIMENTO','CONCLUIDA','CANCELADA','FALTOU') DEFAULT 'AGENDADA',
  observacao VARCHAR(500),
  CONSTRAINT fk_consulta_paciente
    FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente),
  CONSTRAINT fk_consulta_profissional
    FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional),
  INDEX idx_consulta_agenda (id_profissional, data_consulta, hora_inicio, hora_fim)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS atendimento (
  id_atendimento INT AUTO_INCREMENT PRIMARY KEY,
  id_consulta INT NOT NULL UNIQUE,
  data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  anotacoes_clinicas TEXT,
  prescricao TEXT,
  CONSTRAINT fk_atendimento_consulta
    FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificacao (
  id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
  id_consulta INT NOT NULL,
  tipo_notificacao ENUM('CONFIRMACAO','LEMBRETE','CANCELAMENTO','REAGENDAMENTO') NOT NULL,
  mensagem VARCHAR(255) NOT NULL,
  status_envio ENUM('PENDENTE','ENVIADA','ERRO') DEFAULT 'PENDENTE',
  data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notificacao_consulta
    FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS indisponibilidade (
  id_folga INT AUTO_INCREMENT PRIMARY KEY,
  id_profissional INT NOT NULL,
  data DATE NOT NULL,
  motivo VARCHAR(255),
  CONSTRAINT fk_indisponibilidade_profissional
    FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional),
  UNIQUE KEY uk_indisponibilidade_prof_data (id_profissional, data)
) ENGINE=InnoDB;
