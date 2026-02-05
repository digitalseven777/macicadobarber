// agendamento.js
// Lógica completa do formulário de agendamento

import { db } from './firebase.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Horários disponíveis da barbearia
const HORARIOS_DISPONIVEIS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30'
];

let horarioSelecionado = null;
let horariosOcupados = [];

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    configurarData();
    aplicarMascaraWhatsApp();
    configurarEventos();
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
    
    HORARIOS_DISPONIVEIS.forEach(horario => {
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
    const dados = {
        nome: document.getElementById('nome').value,
        whatsapp: document.getElementById('whatsapp').value,
        servico: document.getElementById('servico').value,
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
