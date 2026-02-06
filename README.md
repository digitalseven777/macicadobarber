# Sistema de Agendamento - BarberAgenda

Sistema completo de agendamento online para barbearias, com painel administrativo protegido por senha.

## Tecnologias Utilizadas

Frontend
- HTML5
- CSS3
- JavaScript Vanilla
- Firebase (Firestore)

## Estrutura do Projeto

barberagenda/
|-- index.html
|-- agendar.html
|-- admin.html
|-- privacidade.html
|-- css/style.css
|-- js/agendamento.js
|-- js/admin.js
|-- js/firebase.js
|
|-- README.md

## Instalação e Configuração (local)

1. Abra o projeto
   Opção A: Live Server no VSCode
   Opção B: Servidor simples
   cd .
   npx http-server -p 8000

Acesse: http://localhost:8000

## Acesso ao Admin

Abra admin.html e faça login com:
- Usuário: admin
- Senha: danmacicado

## Observações

- O painel admin agora é protegido por login simples no frontend.
- Os agendamentos são gravados no Firebase Firestore.
