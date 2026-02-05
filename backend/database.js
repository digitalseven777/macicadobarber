// database.js
// Módulo responsável por toda interação com o banco de dados SQLite

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho do arquivo do banco de dados
const dbPath = path.join(__dirname, 'database.sqlite');

// Cria/conecta ao banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('✅ Conectado ao banco de dados SQLite');
  }
});

// Cria a tabela de agendamentos se não existir
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_nome TEXT NOT NULL,
      cliente_whatsapp TEXT NOT NULL,
      servico TEXT NOT NULL,
      data TEXT NOT NULL,
      horario TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Erro ao criar tabela:', err.message);
    } else {
      console.log('✅ Tabela de agendamentos está pronta');
    }
  });
});

/**
 * Cria um novo agendamento no banco de dados
 * @param {Object} dados - Dados do agendamento (nome, whatsapp, servico, data, horario)
 * @returns {Promise} - Promise com o resultado da inserção
 */
const criarAgendamento = (dados) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO agendamentos (cliente_nome, cliente_whatsapp, servico, data, horario)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [dados.nome, dados.whatsapp, dados.servico, dados.data, dados.horario],
      function(err) {
        if (err) {
          reject(err);
        } else {
          // this.lastID contém o ID do registro inserido
          resolve({
            id: this.lastID,
            ...dados
          });
        }
      }
    );
  });
};

/**
 * Lista todos os agendamentos do banco de dados
 * @returns {Promise} - Promise com array de agendamentos
 */
const listarAgendamentos = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM agendamentos
      ORDER BY data DESC, horario DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

/**
 * Busca horários ocupados em uma data específica
 * @param {String} data - Data no formato YYYY-MM-DD
 * @returns {Promise} - Promise com array de horários ocupados
 */
const buscarHorariosOcupados = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT horario FROM agendamentos
      WHERE data = ?
    `;

    db.all(sql, [data], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Retorna apenas os horários
        resolve(rows.map(row => row.horario));
      }
    });
  });
};

// Exporta as funções para uso no server.js
module.exports = {
  db,
  criarAgendamento,
  listarAgendamentos,
  buscarHorariosOcupados
};
