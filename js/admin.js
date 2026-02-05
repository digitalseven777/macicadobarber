// admin.js
// Lógica do painel administrativo

import { db } from './firebase.js';
import {
    collection,
    getDocs,
    query,
    orderBy,
    updateDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TOKEN_KEY = 'barberagenda_admin_token';
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'danmacicado';

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    configurarLogin();
    iniciarPainel();
    configurarEdicao();
});

function configurarLogin() {
    const formLogin = document.getElementById('formLogin');

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        await fazerLogin();
    });
}

function iniciarPainel() {
    if (getToken()) {
        mostrarAdmin();
        carregarAgendamentos();
    } else {
        mostrarLogin();
    }
}

// ==================== AUTH ====================

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function mostrarLogin(mensagem) {
    const loginPanel = document.getElementById('loginPanel');
    const adminPanel = document.getElementById('adminPanel');
    const loginMensagem = document.getElementById('loginMensagem');

    adminPanel.style.display = 'none';
    loginPanel.style.display = 'block';

    if (mensagem) {
        loginMensagem.textContent = mensagem;
        loginMensagem.className = 'mensagem erro';
        loginMensagem.style.display = 'block';
    } else {
        loginMensagem.style.display = 'none';
    }
}

function mostrarAdmin() {
    const loginPanel = document.getElementById('loginPanel');
    const adminPanel = document.getElementById('adminPanel');

    loginPanel.style.display = 'none';
    adminPanel.style.display = 'block';
}

async function fazerLogin() {
    const usuario = document.getElementById('usuarioAdmin').value.trim();
    const senha = document.getElementById('senhaAdmin').value.trim();
    const loginMensagem = document.getElementById('loginMensagem');

    if (!usuario || !senha) {
        loginMensagem.textContent = 'Informe usuário e senha.';
        loginMensagem.className = 'mensagem erro';
        loginMensagem.style.display = 'block';
        return;
    }

    try {
        if (usuario !== ADMIN_USER || senha !== ADMIN_PASSWORD) {
            throw new Error('Usuário ou senha inválidos');
        }

        setToken('ok');
        document.getElementById('senhaAdmin').value = '';
        mostrarAdmin();
        carregarAgendamentos();

    } catch (erro) {
        loginMensagem.textContent = erro.message || 'Erro ao realizar login.';
        loginMensagem.className = 'mensagem erro';
        loginMensagem.style.display = 'block';
    }
}

// ==================== CARREGAR AGENDAMENTOS ====================

/**
 * Busca todos os agendamentos da API e renderiza na tabela
 */
async function carregarAgendamentos() {
    const tabelaBody = document.getElementById('tabelaBody');
    const mensagemVazio = document.getElementById('mensagemVazio');
    const totalElement = document.getElementById('totalAgendamentos');
    const totalAtivos = document.getElementById('totalAtivos');
    const totalCancelados = document.getElementById('totalCancelados');
    const token = getToken();

    if (!token) {
        mostrarLogin('Faça login para acessar o painel.');
        return;
    }
    
    // Mostra loading
    tabelaBody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2rem;">
                <span class="loading"></span> Carregando agendamentos...
            </td>
        </tr>
    `;
    
    try {
        // Lê todos os agendamentos do Firestore
        const q = query(collection(db, 'agendamentos'), orderBy('created_at', 'desc'));
        const snapshot = await getDocs(q);
        const agendamentos = [];
        snapshot.forEach(doc => {
            agendamentos.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Atualiza total
        totalElement.textContent = agendamentos.length;
        totalAtivos.textContent = agendamentos.filter(a => a.status !== 'cancelado').length;
        totalCancelados.textContent = agendamentos.filter(a => a.status === 'cancelado').length;
        
        // Se não houver agendamentos
        if (agendamentos.length === 0) {
            tabelaBody.innerHTML = '';
            mensagemVazio.style.display = 'block';
            return;
        }
        
        // Renderiza agendamentos na tabela
        mensagemVazio.style.display = 'none';
        renderizarAgendamentos(agendamentos);
        
    } catch (erro) {
        console.error('Erro ao carregar agendamentos:', erro);
        
        tabelaBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: var(--error);">
                    ❌ Erro ao carregar agendamentos. Verifique o Firebase.
                </td>
            </tr>
        `;
    }
}

// ==================== RENDERIZAR TABELA ====================

/**
 * Renderiza a lista de agendamentos na tabela
 */
function renderizarAgendamentos(agendamentos) {
    const tabelaBody = document.getElementById('tabelaBody');
    tabelaBody.innerHTML = ''; // Limpa tabela
    
    // Ordena por data e horário (mais recentes primeiro)
    agendamentos.sort((a, b) => {
        if (a.data !== b.data) {
            return new Date(b.data) - new Date(a.data);
        }
        return b.horario.localeCompare(a.horario);
    });
    
    // Cria uma linha para cada agendamento
    agendamentos.forEach(agendamento => {
        const tr = document.createElement('tr');

        const status = agendamento.status === 'cancelado' ? 'cancelado' : 'ativo';
        const statusLabel = status === 'cancelado' ? 'Cancelado' : 'Ativo';
        const isCancelado = status === 'cancelado';
        
        tr.innerHTML = `
            <td>${agendamento.id}</td>
            <td>${formatarData(agendamento.data)}</td>
            <td><strong>${agendamento.horario}</strong></td>
            <td>${agendamento.cliente_nome}</td>
            <td>
                <a href="https://wa.me/55${limparWhatsApp(agendamento.cliente_whatsapp)}" 
                   target="_blank" 
                   class="whatsapp-link">
                    ${agendamento.cliente_whatsapp}
                </a>
            </td>
            <td>${agendamento.servico}</td>
            <td>${formatarDataHora(agendamento.created_at)}</td>
            <td><span class="status-pill status-${status}">${statusLabel}</span></td>
            <td>
                <div class="acoes-group">
                    <button class="btn btn-secondary btn-small" data-acao="editar" data-id="${agendamento.id}">
                        Editar
                    </button>
                    <button class="btn btn-danger btn-small" data-acao="cancelar" data-id="${agendamento.id}" ${isCancelado ? 'disabled' : ''}>
                        Cancelar
                    </button>
                </div>
            </td>
        `;
        
        tr.querySelectorAll('button[data-acao]').forEach(btn => {
            btn.addEventListener('click', () => {
                const acao = btn.getAttribute('data-acao');
                if (acao === 'editar') {
                    abrirModalEdicao(agendamento);
                }
                if (acao === 'cancelar') {
                    cancelarAgendamento(agendamento.id);
                }
            });
        });

        tabelaBody.appendChild(tr);
    });
}

// ==================== EDIÇÃO / CANCELAMENTO ====================

function configurarEdicao() {
    const modal = document.getElementById('editModal');
    const btnCancelar = document.getElementById('btnCancelarEdicao');
    const formEditar = document.getElementById('formEditar');

    btnCancelar.addEventListener('click', () => fecharModalEdicao());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) fecharModalEdicao();
    });

    formEditar.addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarEdicao();
    });
}

function abrirModalEdicao(agendamento) {
    document.getElementById('editId').value = agendamento.id;
    document.getElementById('editNome').value = agendamento.cliente_nome || '';
    document.getElementById('editWhatsApp').value = agendamento.cliente_whatsapp || '';
    document.getElementById('editServico').value = agendamento.servico || '';
    document.getElementById('editData').value = agendamento.data || '';
    document.getElementById('editHorario').value = agendamento.horario || '';
    document.getElementById('editMensagem').style.display = 'none';
    document.getElementById('editModal').style.display = 'flex';
}

function fecharModalEdicao() {
    document.getElementById('editModal').style.display = 'none';
}

async function salvarEdicao() {
    const id = document.getElementById('editId').value;
    const dados = {
        cliente_nome: document.getElementById('editNome').value.trim(),
        cliente_whatsapp: document.getElementById('editWhatsApp').value.trim(),
        servico: document.getElementById('editServico').value.trim(),
        data: document.getElementById('editData').value,
        horario: document.getElementById('editHorario').value,
        updated_at: serverTimestamp()
    };

    try {
        const ref = doc(db, 'agendamentos', id);
        await updateDoc(ref, dados);
        fecharModalEdicao();
        carregarAgendamentos();
    } catch (erro) {
        const msg = document.getElementById('editMensagem');
        msg.textContent = 'Erro ao salvar alterações. Tente novamente.';
        msg.className = 'mensagem erro';
        msg.style.display = 'block';
    }
}

async function cancelarAgendamento(id) {
    const confirmar = window.confirm('Tem certeza que deseja cancelar este agendamento?');
    if (!confirmar) return;

    try {
        const ref = doc(db, 'agendamentos', id);
        await updateDoc(ref, {
            status: 'cancelado',
            updated_at: serverTimestamp()
        });
        carregarAgendamentos();
    } catch (erro) {
        alert('Erro ao cancelar. Tente novamente.');
    }
}

// ==================== UTILITÁRIOS ====================

/**
 * Formata data de YYYY-MM-DD para DD/MM/YYYY
 */
function formatarData(data) {
    if (!data) return '-';
    
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

/**
 * Formata data e hora do timestamp do banco
 */
function formatarDataHora(timestamp) {
    if (!timestamp) return '-';

    let data = timestamp;
    if (typeof timestamp.toDate === 'function') {
        data = timestamp.toDate();
    } else if (!(timestamp instanceof Date)) {
        data = new Date(timestamp);
    }
    
    // Verifica se a data é válida
    if (isNaN(data.getTime())) {
        return timestamp; // Retorna o valor original se não conseguir converter
    }
    
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

/**
 * Remove formatação do WhatsApp para link
 */
function limparWhatsApp(whatsapp) {
    return whatsapp.replace(/\D/g, '');
}
