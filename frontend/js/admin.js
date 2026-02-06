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
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TOKEN_KEY = 'barberagenda_admin_token';
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'danmacicado';

const DEFAULT_CONFIG = {
    horario_inicio: '09:00',
    horario_fim: '18:30',
    intervalo_minutos: 30,
    dias_funcionamento: [1, 2, 3, 4, 5, 6],
    servicos: [
        { nome: 'Corte Tradicional', preco: 60 },
        { nome: 'Barba Completa', preco: 45 },
        { nome: 'Corte + Barba', preco: 95 },
        { nome: 'Degradê Premium', preco: 75 },
        { nome: 'Pigmentação de Barba', preco: 55 },
        { nome: 'Tratamento Capilar', preco: 50 }
    ]
};

let configAtual = null;
let agendamentosCache = [];
let chartStatus = null;
let chartDias = null;

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    configurarLogin();
    iniciarPainel();
    configurarEdicao();
    configurarConfiguracoes();
    configurarDashboard();
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
        carregarConfiguracoes();
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
        carregarConfiguracoes();
        carregarAgendamentos();

    } catch (erro) {
        loginMensagem.textContent = erro.message || 'Erro ao realizar login.';
        loginMensagem.className = 'mensagem erro';
        loginMensagem.style.display = 'block';
    }
}

// ==================== CONFIGURAÇÕES ====================

function configurarConfiguracoes() {
    const formFuncionamento = document.getElementById('formFuncionamento');
    const formServico = document.getElementById('formServico');
    const listaServicos = document.getElementById('listaServicos');

    if (formFuncionamento) {
        formFuncionamento.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarFuncionamento();
        });
    }

    if (formServico) {
        formServico.addEventListener('submit', async (e) => {
            e.preventDefault();
            await adicionarServico();
        });
    }

    if (listaServicos) {
        listaServicos.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-acao="remover-servico"]');
            if (!btn) return;
            const index = Number(btn.dataset.index);
            removerServico(index);
        });
    }
}

async function carregarConfiguracoes() {
    try {
        const ref = doc(db, 'config', 'barbearia');
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) {
            await setDoc(ref, DEFAULT_CONFIG);
            configAtual = { ...DEFAULT_CONFIG };
        } else {
            configAtual = { ...DEFAULT_CONFIG, ...snapshot.data() };
        }
    } catch (erro) {
        console.error('Erro ao carregar configuração:', erro);
        configAtual = { ...DEFAULT_CONFIG };
    }

    renderizarConfiguracoes();
}

function renderizarConfiguracoes() {
    const diasContainer = document.getElementById('diasFuncionamento');
    if (diasContainer) {
        diasContainer.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = configAtual.dias_funcionamento.includes(Number(input.value));
        });
    }

    const horarioInicio = document.getElementById('horarioInicio');
    const horarioFim = document.getElementById('horarioFim');
    const intervalo = document.getElementById('intervaloMinutos');

    if (horarioInicio) horarioInicio.value = configAtual.horario_inicio;
    if (horarioFim) horarioFim.value = configAtual.horario_fim;
    if (intervalo) intervalo.value = configAtual.intervalo_minutos;

    renderizarListaServicos();
}

async function salvarFuncionamento() {
    const diasContainer = document.getElementById('diasFuncionamento');
    const msg = document.getElementById('msgFuncionamento');
    if (!diasContainer) {
        exibirMensagemConfig(msg, 'Não foi possível localizar os dias de funcionamento.', 'erro');
        return;
    }

    const diasSelecionados = Array.from(diasContainer.querySelectorAll('input[type="checkbox"]'))
        .filter(input => input.checked)
        .map(input => Number(input.value));

    if (diasSelecionados.length === 0) {
        exibirMensagemConfig(msg, 'Selecione pelo menos um dia.', 'erro');
        return;
    }

    const horarioInicio = document.getElementById('horarioInicio').value;
    const horarioFim = document.getElementById('horarioFim').value;
    const intervaloMinutos = Number(document.getElementById('intervaloMinutos').value);

    if (!horarioInicio || !horarioFim) {
        exibirMensagemConfig(msg, 'Informe o horário de início e fim.', 'erro');
        return;
    }

    if (!intervaloMinutos || intervaloMinutos < 5) {
        exibirMensagemConfig(msg, 'Informe um intervalo válido (mínimo 5 minutos).', 'erro');
        return;
    }

    if (horarioFim <= horarioInicio) {
        exibirMensagemConfig(msg, 'O horário de fim deve ser maior que o início.', 'erro');
        return;
    }

    try {
        const ref = doc(db, 'config', 'barbearia');
        await setDoc(ref, {
            dias_funcionamento: diasSelecionados,
            horario_inicio: horarioInicio,
            horario_fim: horarioFim,
            intervalo_minutos: intervaloMinutos
        }, { merge: true });

        configAtual = {
            ...configAtual,
            dias_funcionamento: diasSelecionados,
            horario_inicio: horarioInicio,
            horario_fim: horarioFim,
            intervalo_minutos: intervaloMinutos
        };

        exibirMensagemConfig(msg, 'Funcionamento atualizado com sucesso.', 'sucesso');
    } catch (erro) {
        console.error('Erro ao salvar funcionamento:', erro);
        const detalhe = erro?.message ? ` (${erro.message})` : '';
        exibirMensagemConfig(msg, `Erro ao salvar. Tente novamente.${detalhe}`, 'erro');
    }
}

async function adicionarServico() {
    const msg = document.getElementById('msgServicos');
    const nome = document.getElementById('servicoNome').value.trim();
    const preco = Number(document.getElementById('servicoPreco').value);

    if (!nome || Number.isNaN(preco)) {
        exibirMensagemConfig(msg, 'Informe nome e preço.', 'erro');
        return;
    }

    const novosServicos = [...(configAtual?.servicos || [])];
    novosServicos.push({ nome, preco });

    try {
        const ref = doc(db, 'config', 'barbearia');
        await setDoc(ref, { servicos: novosServicos }, { merge: true });
        configAtual = { ...configAtual, servicos: novosServicos };
        renderizarListaServicos();
        document.getElementById('servicoNome').value = '';
        document.getElementById('servicoPreco').value = '';
        exibirMensagemConfig(msg, 'Serviço adicionado.', 'sucesso');
    } catch (erro) {
        console.error('Erro ao adicionar serviço:', erro);
        exibirMensagemConfig(msg, 'Erro ao salvar serviço.', 'erro');
    }
}

async function removerServico(index) {
    const msg = document.getElementById('msgServicos');
    const novosServicos = [...(configAtual?.servicos || [])];
    if (!novosServicos[index]) return;

    novosServicos.splice(index, 1);

    try {
        const ref = doc(db, 'config', 'barbearia');
        await setDoc(ref, { servicos: novosServicos }, { merge: true });
        configAtual = { ...configAtual, servicos: novosServicos };
        renderizarListaServicos();
        exibirMensagemConfig(msg, 'Serviço removido.', 'sucesso');
    } catch (erro) {
        console.error('Erro ao remover serviço:', erro);
        exibirMensagemConfig(msg, 'Erro ao remover serviço.', 'erro');
    }
}

function renderizarListaServicos() {
    const lista = document.getElementById('listaServicos');
    if (!lista) return;

    const servicos = configAtual?.servicos || [];
    lista.innerHTML = '';

    if (servicos.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-dim);">Nenhum serviço cadastrado.</p>';
        return;
    }

    servicos.forEach((servico, index) => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        item.innerHTML = `
            <div>
                <strong>${servico.nome}</strong>
                <div style="color: var(--text-dim); font-size: 0.85rem;">
                    ${formatarPreco(servico.preco)}
                </div>
            </div>
            <button class="btn btn-danger btn-small" data-acao="remover-servico" data-index="${index}">
                Remover
            </button>
        `;
        lista.appendChild(item);
    });
}

function exibirMensagemConfig(elemento, texto, tipo) {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.className = `mensagem ${tipo}`;
    elemento.style.display = 'block';

    setTimeout(() => {
        elemento.style.display = 'none';
    }, 3000);
}

// ==================== DASHBOARD ====================

function configurarDashboard() {
    const mesInput = document.getElementById('mesDashboard');
    if (!mesInput) return;

    mesInput.value = formatarMesAtual();
    mesInput.addEventListener('change', atualizarDashboard);
}

function atualizarDashboard() {
    const mesInput = document.getElementById('mesDashboard');
    if (!mesInput) return;

    if (typeof Chart === 'undefined') return;

    const mes = mesInput.value;
    const agendamentos = agendamentosCache.filter(ag => typeof ag.data === 'string' && ag.data.startsWith(mes));

    const total = agendamentos.length;
    const finalizados = agendamentos.filter(a => a.status === 'finalizado').length;
    const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;
    const ativos = total - finalizados - cancelados;

    const dashTotal = document.getElementById('dashTotal');
    const dashFinalizados = document.getElementById('dashFinalizados');
    const dashCancelados = document.getElementById('dashCancelados');

    if (dashTotal) dashTotal.textContent = total;
    if (dashFinalizados) dashFinalizados.textContent = finalizados;
    if (dashCancelados) dashCancelados.textContent = cancelados;

    const statusData = [ativos, finalizados, cancelados];
    const statusLabels = ['Ativos', 'Finalizados', 'Cancelados'];

    if (chartStatus) chartStatus.destroy();
    const canvasStatus = document.getElementById('chartStatus');
    const canvasDias = document.getElementById('chartDias');
    if (!canvasStatus || !canvasDias) return;

    chartStatus = new Chart(canvasStatus, {
        type: 'doughnut',
        data: {
            labels: statusLabels,
            datasets: [{
                data: statusData,
                backgroundColor: ['#f5b700', '#00e5ff', '#ff3b3b'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#f2f2f5' } } }
        }
    });

    const contagemDias = new Map();
    agendamentos.forEach(ag => {
        if (!ag.data) return;
        contagemDias.set(ag.data, (contagemDias.get(ag.data) || 0) + 1);
    });

    const diasOrdenados = Array.from(contagemDias.keys()).sort();
    const labelsDias = diasOrdenados.map(formatarData);
    const valoresDias = diasOrdenados.map(dia => contagemDias.get(dia));

    if (chartDias) chartDias.destroy();
    chartDias = new Chart(canvasDias, {
        type: 'bar',
        data: {
            labels: labelsDias,
            datasets: [{
                label: 'Agendamentos',
                data: valoresDias,
                backgroundColor: '#f5b700'
            }]
        },
        options: {
            scales: {
                x: { ticks: { color: '#f2f2f5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#f2f2f5' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: { legend: { display: false } }
        }
    });

    renderizarTopDias(contagemDias);
}

function renderizarTopDias(contagemDias) {
    const lista = document.getElementById('topDias');
    if (!lista) return;

    const top = Array.from(contagemDias.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    lista.innerHTML = '';
    if (top.length === 0) {
        lista.innerHTML = '<li>Nenhum agendamento no mês.</li>';
        return;
    }

    top.forEach(([dia, total]) => {
        const item = document.createElement('li');
        item.textContent = `${formatarData(dia)} • ${total} agendamentos`;
        lista.appendChild(item);
    });
}

function formatarMesAtual() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
}

// ==================== CARREGAR AGENDAMENTOS ====================

/**
 * Busca todos os agendamentos da API e renderiza na tabela
 */
async function carregarAgendamentos() {
    const lista = document.getElementById('agendamentosLista');
    const mensagemVazio = document.getElementById('mensagemVazio');
    const totalElement = document.getElementById('totalAgendamentos');
    const totalAtivos = document.getElementById('totalAtivos');
    const totalFinalizados = document.getElementById('totalFinalizados');
    const totalCancelados = document.getElementById('totalCancelados');
    const token = getToken();

    if (!token) {
        mostrarLogin('Faça login para acessar o painel.');
        return;
    }
    
    // Mostra loading
    lista.innerHTML = `
        <div class="agendamentos-loading">
            <span class="loading"></span> Carregando agendamentos...
        </div>
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
        totalFinalizados.textContent = agendamentos.filter(a => a.status === 'finalizado').length;
        totalCancelados.textContent = agendamentos.filter(a => a.status === 'cancelado').length;
        totalAtivos.textContent = agendamentos.filter(a => a.status !== 'cancelado' && a.status !== 'finalizado').length;

        agendamentosCache = agendamentos;
        atualizarDashboard();
        
        // Se não houver agendamentos
        if (agendamentos.length === 0) {
            lista.innerHTML = '';
            mensagemVazio.style.display = 'block';
            agendamentosCache = [];
            atualizarDashboard();
            return;
        }
        
        // Renderiza agendamentos na tabela
        mensagemVazio.style.display = 'none';
        renderizarAgendamentos(agendamentos);
        
    } catch (erro) {
        console.error('Erro ao carregar agendamentos:', erro);
        
        lista.innerHTML = `
            <div class="agendamentos-loading" style="color: var(--error);">
                ❌ Erro ao carregar agendamentos. Verifique o Firebase.
            </div>
        `;
    }
}

// ==================== RENDERIZAR TABELA ====================

/**
 * Renderiza a lista de agendamentos na tabela
 */
function renderizarAgendamentos(agendamentos) {
    const lista = document.getElementById('agendamentosLista');
    lista.innerHTML = '';
    
    // Ordena por data e horário (mais recentes primeiro)
    agendamentos.sort((a, b) => {
        if (a.data !== b.data) {
            return new Date(b.data) - new Date(a.data);
        }
        return b.horario.localeCompare(a.horario);
    });
    
    const grupos = new Map();
    agendamentos.forEach(agendamento => {
        const data = agendamento.data || 'Sem data';
        if (!grupos.has(data)) grupos.set(data, []);
        grupos.get(data).push(agendamento);
    });

    const datasOrdenadas = Array.from(grupos.keys()).sort((a, b) => new Date(b) - new Date(a));

    datasOrdenadas.forEach(data => {
        const itens = grupos.get(data);
        const grupo = document.createElement('div');
        grupo.className = 'agendamentos-dia';

        const header = document.createElement('div');
        header.className = 'agendamentos-dia-header';
        header.innerHTML = `
            <div>
                <div class="agendamentos-dia-data">${formatarDataComDia(data)}</div>
                <div class="agendamentos-dia-sub">${itens.length} agendamento(s)</div>
            </div>
            <div class="pill">${formatarData(data)}</div>
        `;

        const listaDia = document.createElement('div');
        listaDia.className = 'agendamentos-dia-lista';

        itens.forEach(agendamento => {
            let status = 'ativo';
            let statusLabel = 'Ativo';
            if (agendamento.status === 'cancelado') {
                status = 'cancelado';
                statusLabel = 'Cancelado';
            } else if (agendamento.status === 'finalizado') {
                status = 'finalizado';
                statusLabel = 'Finalizado';
            }

            const isCancelado = status === 'cancelado';
            const isFinalizado = status === 'finalizado';

            const item = document.createElement('div');
            item.className = 'agendamento-item';
            item.innerHTML = `
                <div class="agendamento-main">
                    <div class="agendamento-hora">${agendamento.horario || '--:--'}</div>
                    <div class="agendamento-info">
                        <div class="agendamento-cliente">${agendamento.cliente_nome || 'Sem nome'}</div>
                        <div class="agendamento-meta">
                            <span>${agendamento.servico || 'Serviço não informado'}</span>
                            <span>•</span>
                            <a href="https://wa.me/55${limparWhatsApp(agendamento.cliente_whatsapp)}" 
                               target="_blank" 
                               class="whatsapp-link">
                                ${agendamento.cliente_whatsapp || 'WhatsApp não informado'}
                            </a>
                        </div>
                    </div>
                </div>
                <div class="agendamento-extra">
                    <div class="agendamento-status">
                        <span class="status-pill status-${status}">${statusLabel}</span>
                        <span class="agendamento-criado">${formatarDataHora(agendamento.created_at)}</span>
                    </div>
                    <div class="acoes-group">
                        <button class="btn btn-secondary btn-small" data-acao="editar" data-id="${agendamento.id}">
                            Editar
                        </button>
                        <button class="btn btn-primary btn-small" data-acao="finalizar" data-id="${agendamento.id}" ${isCancelado || isFinalizado ? 'disabled' : ''}>
                            Finalizar
                        </button>
                        <button class="btn btn-danger btn-small" data-acao="cancelar" data-id="${agendamento.id}" ${isCancelado ? 'disabled' : ''}>
                            Cancelar
                        </button>
                    </div>
                </div>
            `;

            item.querySelectorAll('button[data-acao]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const acao = btn.getAttribute('data-acao');
                    if (acao === 'editar') {
                        abrirModalEdicao(agendamento);
                    }
                    if (acao === 'cancelar') {
                        cancelarAgendamento(agendamento.id);
                    }
                    if (acao === 'finalizar') {
                        finalizarAgendamento(agendamento.id);
                    }
                });
            });

            listaDia.appendChild(item);
        });

        grupo.appendChild(header);
        grupo.appendChild(listaDia);
        lista.appendChild(grupo);
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

async function finalizarAgendamento(id) {
    const confirmar = window.confirm('Marcar este agendamento como finalizado?');
    if (!confirmar) return;

    try {
        const ref = doc(db, 'agendamentos', id);
        await updateDoc(ref, {
            status: 'finalizado',
            updated_at: serverTimestamp()
        });
        carregarAgendamentos();
    } catch (erro) {
        alert('Erro ao finalizar. Tente novamente.');
    }
}

// ==================== UTILITÁRIOS ====================

/**
 * Formata data de YYYY-MM-DD para DD/MM/YYYY
 */
function formatarData(data) {
    if (!data) return '-';
    if (!String(data).includes('-')) return String(data);
    
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarDataComDia(data) {
    if (!data) return 'Sem data';
    if (!String(data).includes('-')) return String(data);
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const diaSemana = new Date(`${data}T00:00:00`).getDay();
    const nomeDia = dias[diaSemana] || '';
    return `${formatarData(data)} • ${nomeDia}`;
}

function formatarPreco(valor) {
    const numero = Number(valor ?? 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
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
    if (!whatsapp) return '';
    return whatsapp.replace(/\D/g, '');
}

window.carregarAgendamentos = carregarAgendamentos;
