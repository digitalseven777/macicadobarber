// servicos.js
// Renderiza o catálogo de serviços no site

import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULT_CONFIG = {
    servicos: [
        { nome: 'Corte Tradicional', preco: 60 },
        { nome: 'Barba Completa', preco: 45 },
        { nome: 'Corte + Barba', preco: 95 },
        { nome: 'Degradê Premium', preco: 75 },
        { nome: 'Pigmentação de Barba', preco: 55 },
        { nome: 'Tratamento Capilar', preco: 50 }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    carregarServicos();
});

async function carregarServicos() {
    let servicos = DEFAULT_CONFIG.servicos;

    try {
        const ref = doc(db, 'config', 'barbearia');
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) {
            await setDoc(ref, DEFAULT_CONFIG);
        } else {
            const data = snapshot.data();
            servicos = data?.servicos?.length ? data.servicos : DEFAULT_CONFIG.servicos;
        }
    } catch (erro) {
        console.error('Erro ao carregar serviços:', erro);
    }

    renderizarServicos(servicos);
}

function renderizarServicos(servicos) {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;

    grid.innerHTML = '';
    servicos.forEach(servico => {
        const card = document.createElement('div');
        card.className = 'service-card';

        card.innerHTML = `
            <strong>${servico.nome}</strong>
            <p style="margin-top: 8px; color: var(--text-dim);">
                Atendimento premium com acabamento profissional.
            </p>
            <div class="service-meta">
                <span>Preço atualizado</span>
                <span>${formatarPreco(servico.preco)}</span>
            </div>
        `;

        grid.appendChild(card);
    });
}

function formatarPreco(valor) {
    const numero = Number(valor ?? 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
}
