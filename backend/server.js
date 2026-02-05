// server.js
// Servidor principal da aplicação - API REST

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const {
  criarAgendamento,
  listarAgendamentos,
  buscarHorariosOcupados
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_TOKEN_TTL_MINUTES = parseInt(process.env.ADMIN_TOKEN_TTL_MINUTES || '1440', 10);
const adminTokens = new Map();

// ==================== MIDDLEWARES ====================

// Permite requisições de qualquer origem (frontend)
app.use(cors());

// Permite receber JSON no body das requisições
app.use(express.json());

// Log de todas as requisições recebidas
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toLocaleString('pt-BR')}`);
  next();
});

// ==================== AUTH ADMIN ====================

function emitirTokenAdmin() {
  const token = crypto.randomBytes(24).toString('hex');
  const expiraEm = Date.now() + ADMIN_TOKEN_TTL_MINUTES * 60 * 1000;
  adminTokens.set(token, expiraEm);
  return token;
}

function tokenAdminValido(token) {
  if (!token) return false;
  const expiraEm = adminTokens.get(token);
  if (!expiraEm) return false;
  if (Date.now() > expiraEm) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    token = req.headers['x-admin-token'] || '';
  }

  if (!tokenAdminValido(token)) {
    return res.status(401).json({
      erro: 'Não autorizado',
      mensagem: 'Token inválido ou expirado.'
    });
  }

  return next();
}

// ==================== ROTAS DA API ====================

/**
 * GET /
 * Rota de teste para verificar se a API está rodando
 */
app.get('/', (req, res) => {
  res.json({
    mensagem: 'API de Agendamento - BarberAgenda',
    versao: '1.1.0',
    status: 'online'
  });
});

/**
 * POST /admin/login
 * Body: { password }
 */
app.post('/admin/login', (req, res) => {
  const { password } = req.body || {};

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      erro: 'Senha admin não configurada',
      mensagem: 'Defina ADMIN_PASSWORD no ambiente do servidor.'
    });
  }

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      erro: 'Senha inválida',
      mensagem: 'A senha informada está incorreta.'
    });
  }

  const token = emitirTokenAdmin();

  return res.json({
    token,
    expiresInMinutes: ADMIN_TOKEN_TTL_MINUTES
  });
});

/**
 * POST /agendamentos
 * Cria um novo agendamento
 * Body: { nome, whatsapp, servico, data, horario }
 */
app.post('/agendamentos', async (req, res) => {
  try {
    const { nome, whatsapp, servico, data, horario } = req.body;

    // Validação: verifica se todos os campos foram enviados
    if (!nome || !whatsapp || !servico || !data || !horario) {
      return res.status(400).json({
        erro: 'Todos os campos são obrigatórios',
        camposObrigatorios: ['nome', 'whatsapp', 'servico', 'data', 'horario']
      });
    }

    // Verifica se o horário já está ocupado naquela data
    const horariosOcupados = await buscarHorariosOcupados(data);
    if (horariosOcupados.includes(horario)) {
      return res.status(409).json({
        erro: 'Horário indisponível',
        mensagem: 'Este horário já está ocupado. Por favor, escolha outro.'
      });
    }

    // Cria o agendamento no banco de dados
    const novoAgendamento = await criarAgendamento(req.body);

    console.log('✅ Novo agendamento criado:', novoAgendamento);

    // Retorna sucesso com status 201 (Created)
    res.status(201).json({
      mensagem: 'Agendamento realizado com sucesso!',
      agendamento: novoAgendamento
    });

  } catch (erro) {
    console.error('❌ Erro ao criar agendamento:', erro);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      mensagem: 'Não foi possível criar o agendamento. Tente novamente.'
    });
  }
});

/**
 * GET /agendamentos
 * Lista todos os agendamentos (ADMIN)
 */
app.get('/agendamentos', requireAdminAuth, async (req, res) => {
  try {
    const agendamentos = await listarAgendamentos();

    res.json({
      total: agendamentos.length,
      agendamentos: agendamentos
    });

  } catch (erro) {
    console.error('❌ Erro ao listar agendamentos:', erro);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      mensagem: 'Não foi possível listar os agendamentos.'
    });
  }
});

/**
 * GET /agendamentos/horarios-ocupados/:data
 * Retorna os horários ocupados em uma data específica
 * Parâmetro: data no formato YYYY-MM-DD
 */
app.get('/agendamentos/horarios-ocupados/:data', async (req, res) => {
  try {
    const { data } = req.params;
    const horariosOcupados = await buscarHorariosOcupados(data);

    res.json({
      data: data,
      horariosOcupados: horariosOcupados
    });

  } catch (erro) {
    console.error('❌ Erro ao buscar horários ocupados:', erro);
    res.status(500).json({
      erro: 'Erro interno do servidor',
      mensagem: 'Não foi possível buscar os horários ocupados.'
    });
  }
});

// ==================== TRATAMENTO DE ERROS ====================

// Rota 404 - Rota não encontrada
app.use((req, res) => {
  res.status(404).json({
    erro: 'Rota não encontrada',
    mensagem: `A rota ${req.url} não existe nesta API.`
  });
});

// ==================== INICIA O SERVIDOR ====================

app.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════════════════╗
║                                                     ║
║  🚀 Servidor rodando com sucesso!                   ║
║                                                     ║
║  📍 URL: http://localhost:${PORT}                     ║
║  📅 Data: ${new Date().toLocaleDateString('pt-BR')}                          ║
║  🕐 Hora: ${new Date().toLocaleTimeString('pt-BR')}                         ║
║                                                     ║
╚═════════════════════════════════════════════════════╝
  `);

  if (!ADMIN_PASSWORD) {
    console.warn('⚠️  ADMIN_PASSWORD não configurada. Defina no ambiente para proteger o admin.');
  }
});
