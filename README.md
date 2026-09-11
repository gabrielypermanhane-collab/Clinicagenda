# Saúde+ — Sistema de Agendamento Clínico


O **Saúde+** é um sistema acadêmico desenvolvido para auxiliar no gerenciamento de clínicas e consultórios, permitindo o cadastro de pacientes e profissionais, agendamento de consultas e registro de atendimentos.

##Participantes do desenvolvimento
Gabriely Permanhane Leal, Graciane Lima Costa da Silva e Mariana Bettini Neves. 

## Funcionalidades

- Cadastro e edição de pacientes e profissionais
- Desativação de cadastros
- Agendamento, reagendamento e cancelamento de consultas
- Verificação de conflito de horários
- Agenda diária e semanal
- Registro e histórico de atendimentos
- Controle de indisponibilidade dos profissionais
- Notificações simuladas
- Autenticação e controle de acesso por perfil

## Tecnologias utilizadas

- HTML
- CSS
- JavaScript
- Node.js
- Express
- MySQL
- JWT
- Bcrypt

## Como executar

### 1. Configurar o banco

Abra o MySQL Workbench e execute o script SQL do projeto para criar o banco:

`saude_mais`

### 2. Configurar o ambiente

Crie o arquivo `.env` na pasta principal do projeto, utilizando o `.env.example` como modelo, e informe os dados de conexão com o MySQL.

### 3. Instalar as dependências

No terminal, dentro da pasta do projeto:

npm install

Caso o PowerShell apresente erro:

npm.cmd install

### 4. Iniciar o sistema

npm start

Ou:

npm.cmd start

Depois, acesse o endereço local informado no terminal.

## Segurança

O sistema utiliza autenticação com JWT, senhas armazenadas com hash e controle de acesso conforme o perfil do usuário.

Os perfis disponíveis são:

- Administrador
- Recepcionista
- Profissional
- Paciente

## Banco de Dados

O banco `saude_mais` possui as principais tabelas:

- usuario
- paciente
- profissional
- consulta
- atendimento
- notificacao
- indisponibilidade

## Projeto acadêmico

Sistema desenvolvido para fins acadêmicos como projeto de um sistema de agendamento para clínicas e consultórios.
