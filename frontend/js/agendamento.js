// agendamento.js
// Lógica completa do formulário de agendamento

import { db } from './firebase.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

let horarioSelecionado = null;
let horariosOcupados = [];
let configAtual = null;

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    configurarData();
    aplicarMascaraWhatsApp();
    configurarEventos();
    carregarConfiguracao();
});

// ==================== CONFIGURAÇÃO DA DATA ====================

/**
 * Define a data mínima como hoje e máxima como 30 dias à frente
 */
function configurarData() {
    const inputData = document.getElementById('data');
    const hoje = new Date();
    const dataMaxima = new Date();
    dataMaxima.setDate(hoje.getDate() + 30);
    
    // Formata datas para o formato YYYY-MM-DD
    inputData.min = formatarDataParaInput(hoje);
    inputData.max = formatarDataParaInput(dataMaxima);
}

/**
 * Converte Date para formato YYYY-MM-DD
 */
function formatarDataParaInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// ==================== CONFIGURAÇÃO DINÂMICA ====================

async function carregarConfiguracao() {
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

    renderizarServicos();
}

function renderizarServicos() {
    const select = document.getElementById('servico');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um serviço</option>';
    const servicos = (configAtual && configAtual.servicos) ? configAtual.servicos : DEFAULT_CONFIG.servicos;

    servicos.forEach(servico => {
        const option = document.createElement('option');
        option.value = servico.nome;
        option.dataset.preco = String(servico.preco ?? 0);
        option.textContent = `${servico.nome} - ${formatarPreco(servico.preco)}`;
        select.appendChild(option);
    });
}

function formatarPreco(valor) {
    const numero = Number(valor ?? 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
}

// ==================== MÁSCARA DE WHATSAPP ====================

/**
 * Aplica máscara no campo WhatsApp: (XX) XXXXX-XXXX
 */
function aplicarMascaraWhatsApp() {
    const inputWhatsApp = document.getElementById('whatsapp');
    
    inputWhatsApp.addEventListener('input', (e) => {
        let valor = e.target.value.replace(/\D/g, ''); // Remove não-numéricos
        
        if (valor.length > 0) {
            valor = valor.replace(/^(\d{2})(\d)/g, '($1) $2');
            valor = valor.replace(/(\d)(\d{4})$/, '$1-$2');
        }
        
        e.target.value = valor;
    });
}

// ==================== EVENTOS ====================

/**
 * Configura todos os event listeners
 */
function configurarEventos() {
    const inputData = document.getElementById('data');
    const form = document.getElementById('formAgendamento');
    
    // Quando a data mudar, carrega os horários
    inputData.addEventListener('change', carregarHorarios);
    
    // Quando o formulário for submetido
    form.addEventListener('submit', enviarAgendamento);
}

// ==================== HORÁRIOS ====================

/**
 * Carrega os horários disponíveis para a data selecionada
 */
async function carregarHorarios() {
    const data = document.getElementById('data').value;
    
    if (!data) return;

    horarioSelecionado = null;
    document.getElementById('horario').value = '';

    if (!configAtual) {
        await carregarConfiguracao();
    }

    if (!dataAberta(data)) {
        horariosOcupados = [];
        renderizarHorarios();
        exibirMensagem('Este dia está fora do horário de funcionamento.', 'erro');
        return;
    }
    
    try {
        // Busca horários ocupados no Firestore
        const q = query(collection(db, 'agendamentos'), where('data', '==', data));
        const snapshot = await getDocs(q);
        const ocupados = [];
        snapshot.forEach(doc => {
            const ag = doc.data();
            if (ag && ag.horario && ag.status !== 'cancelado') {
                ocupados.push(ag.horario);
            }
        });
        horariosOcupados = ocupados;
        renderizarHorarios();
        
    } catch (erro) {
        console.error('Erro ao carregar horários:', erro);
        horariosOcupados = [];
        renderizarHorarios();
        exibirMensagem('Erro ao consultar horários. Exibindo todos os horários.', 'erro');
    }
}

/**
 * Renderiza os botões de horário na tela
 */
function renderizarHorarios() {
    const grid = document.getElementById('horariosGrid');
    grid.innerHTML = ''; // Limpa grid

    const horarios = gerarHorarios(
        configAtual?.horario_inicio || DEFAULT_CONFIG.horario_inicio,
        configAtual?.horario_fim || DEFAULT_CONFIG.horario_fim,
        configAtual?.intervalo_minutos || DEFAULT_CONFIG.intervalo_minutos
    );
    
    horarios.forEach(horario => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'horario-btn';
        btn.textContent = horario;
        
        // Verifica se o horário está ocupado
        if (horariosOcupados.includes(horario)) {
            btn.classList.add('ocupado');
            btn.disabled = true;
        } else {
            btn.addEventListener('click', () => selecionarHorario(horario, btn));
        }
        
        grid.appendChild(btn);
    });
}

/**
 * Seleciona um horário
 */
function selecionarHorario(horario, botao) {
    // Remove seleção anterior
    document.querySelectorAll('.horario-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Adiciona seleção ao botão clicado
    botao.classList.add('selected');
    horarioSelecionado = horario;
    
    // Atualiza campo hidden
    document.getElementById('horario').value = horario;
}

// ==================== ENVIO DO FORMULÁRIO ====================

/**
 * Envia o agendamento para a API
 */
async function enviarAgendamento(e) {
    e.preventDefault(); // Evita reload da página
    
    // Validação: verifica se horário foi selecionado
    if (!horarioSelecionado) {
        exibirMensagem('Por favor, selecione um horário', 'erro');
        return;
    }
    
    // Coleta os dados do formulário
    const selectServico = document.getElementById('servico');
    const servicoNome = selectServico.value;
    const servicoPreco = Number(selectServico.selectedOptions[0]?.dataset?.preco ?? 0);

    const dados = {
        nome: document.getElementById('nome').value,
        whatsapp: document.getElementById('whatsapp').value,
        servico: servicoNome,
        servico_preco: servicoPreco,
        data: document.getElementById('data').value,
        horario: horarioSelecionado
    };
    
    // Desabilita botão durante envio
    const btnSubmit = document.getElementById('btnSubmit');
    const textoOriginal = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="loading"></span> Agendando...';
    
    try {
        // Verifica se já existe agendamento no mesmo horário/data
        const q = query(
            collection(db, 'agendamentos'),
            where('data', '==', dados.data),
            where('horario', '==', dados.horario)
        );
        const existe = await getDocs(q);
        if (!existe.empty) {
            exibirMensagem('Este horário já está ocupado. Por favor, escolha outro.', 'erro');
            return;
        }

        // Salva no Firestore
        await addDoc(collection(db, 'agendamentos'), {
            cliente_nome: dados.nome,
            cliente_whatsapp: dados.whatsapp,
            servico: dados.servico,
            servico_preco: dados.servico_preco,
            data: dados.data,
            horario: dados.horario,
            status: 'ativo',
            created_at: serverTimestamp()
        });

        // Sucesso
        exibirMensagem(
            `✅ Agendamento confirmado! ${dados.nome}, aguardamos você no dia ${formatarDataBR(dados.data)} às ${dados.horario}.`,
            'sucesso'
        );

        // Limpa formulário após 3 segundos
        setTimeout(() => {
            document.getElementById('formAgendamento').reset();
            horarioSelecionado = null;
            document.getElementById('horariosGrid').innerHTML = '';
        }, 3000);
        
    } catch (erro) {
        console.error('Erro ao enviar agendamento:', erro);
        exibirMensagem('Erro ao salvar no banco. Tente novamente.', 'erro');
    } finally {
        // Reabilita botão
        btnSubmit.disabled = false;
        btnSubmit.textContent = textoOriginal;
    }
}

// ==================== UTILITÁRIOS ====================

function dataAberta(data) {
    const dias = configAtual?.dias_funcionamento || DEFAULT_CONFIG.dias_funcionamento;
    const diaSemana = new Date(`${data}T00:00:00`).getDay();
    return dias.includes(diaSemana);
}

function gerarHorarios(inicio, fim, intervaloMinutos) {
    const paraMinutos = (horaStr) => {
        const [h, m] = horaStr.split(':').map(Number);
        return h * 60 + m;
    };

    const paraHora = (minutos) => {
        const h = String(Math.floor(minutos / 60)).padStart(2, '0');
        const m = String(minutos % 60).padStart(2, '0');
        return `${h}:${m}`;
    };

    const horarios = [];
    const inicioMin = paraMinutos(inicio);
    const fimMin = paraMinutos(fim);
    const passo = Number(intervaloMinutos) || 30;

    for (let t = inicioMin; t <= fimMin; t += passo) {
        horarios.push(paraHora(t));
    }
    return horarios;
}

/**
 * Exibe mensagem de feedback para o usuário
 */
function exibirMensagem(texto, tipo) {
    const divMensagem = document.getElementById('mensagem');
    divMensagem.textContent = texto;
    divMensagem.className = `mensagem ${tipo}`;
    divMensagem.style.display = 'block';
    
    // Rola para a mensagem
    divMensagem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Remove mensagem após 5 segundos
    setTimeout(() => {
        divMensagem.style.display = 'none';
    }, 5000);
}

/**
 * Formata data de YYYY-MM-DD para DD/MM/YYYY
 */
function formatarDataBR(data) {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}
