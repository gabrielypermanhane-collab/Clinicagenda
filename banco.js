const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'saude_mais'
};

let pool;

async function inicializarBanco() {
  const conexaoInicial = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true
  });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conexaoInicial.query(schema);
  await conexaoInicial.end();

  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
  });


  return pool;
}

function getBanco() {
  if (!pool) {
    throw new Error('Banco ainda não foi inicializado.');
  }
  return pool;
}

module.exports = { inicializarBanco, getBanco };
