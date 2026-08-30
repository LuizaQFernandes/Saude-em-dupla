[README.md](https://github.com/user-attachments/files/31621248/README.md)
# 💚 Saúde em Dupla

Aplicativo de acompanhamento de hábitos saudáveis para duas pessoas (Luiza e Matheus), pensado **mobile-first**. Cada pessoa usa o app no próprio celular, registra seus hábitos do dia, acompanha o progresso e gera um resumo para compartilhar manualmente pelo WhatsApp.

Não existe backend, banco de dados, API externa, login ou sincronização entre dispositivos — é **HTML + CSS + JavaScript puro**, e todos os dados ficam salvos localmente no navegador (`localStorage`) do próprio celular.

## Índice

- [Funcionalidades](#funcionalidades)
- [Como abrir o app](#como-abrir-o-app)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Arquitetura de dados](#arquitetura-de-dados)
- [Design](#design)
- [Privacidade](#privacidade)
- [Limitações atuais e possíveis evoluções](#limitações-atuais-e-possíveis-evoluções)

## Funcionalidades

**Hábitos**
- 9 hábitos padrão (Cardio, Academia, Água, Frutas, Legumes, Whey, Fio dental, Cotonete, Fortalecimento de joelho) + possibilidade de criar hábitos personalizados (nome, ícone e obrigatoriedade escolhidos pelo usuário, com uma biblioteca de mais de 70 emojis organizados por categoria).
- Cada usuário decide, para cada hábito, se ele está **ativo** e se é **obrigatório** — essa configuração é individual: o mesmo hábito pode ser obrigatório para uma pessoa e opcional para a outra.
- Pontuação e progresso do dia são sempre calculados dinamicamente a partir dos hábitos ativos daquele usuário (não existe um "total fixo" de pontos).

**Água**
- Card dedicado com anel de progresso (gradiente aquático) mostrando volume atual, meta e percentual.
- Botões de adição rápida na Home (`+250ml`, `+500ml`, `+750ml`) e toast com opção de **desfazer** a última ação.
- Tocar no card abre um painel de edição para adicionar, remover, corrigir um registro específico ou ajustar a meta diária.
- Meta de água configurável por usuário (padrão: 3.000 ml).

**Acompanhamento**
- Progresso do dia (círculo + pontuação + mensagem contextual do tipo "Faltam 3 hábitos...").
- Lembretes contextuais dentro do app (não são notificações reais do sistema) baseados no horário e nos hábitos ainda pendentes.
- Tela **Semana**: total de pontos, média diária, dias perfeitos, melhor dia, consistência e sequência atual (streak).
- Tela **Histórico**: últimos 7 dias com pontuação de cada um.
- **Resumo do dia** pronto para colar no WhatsApp, em versão completa ou compacta, com botão de copiar e compartilhar (usa a Web Share API quando disponível).

**Personalização**
- Onboarding simples (nome + seleção de hábitos obrigatórios) na primeira abertura.
- Tela "Meus hábitos" para ativar/desativar, editar ou excluir hábitos personalizados (hábitos padrão não podem ser excluídos, só desativados).
- **Light Mode e Dark Mode** com troca instantânea, preferência salva no `localStorage` e paleta própria para cada tema (não é só inverter cores).

## Como abrir o app

Este projeto é **modular** (`index.html` + `style.css` + `js/` + `assets/fonts/`) e é assim que ele é versionado e publicado

**No computador (desenvolvimento):** sirva a pasta com qualquer servidor estático local, por exemplo:

```bash
npx serve .
```

Abrir o `index.html` direto por duplo clique também funciona na maioria dos navegadores de desktop.

**No celular:** o jeito confiável é abrir a versão publicada via **GitHub Pages** (Settings → Pages, apontando para a branch com estes arquivos) — como é servido por HTTP de verdade, os caminhos relativos para `style.css`, `js/*.js` e as fontes resolvem normalmente, sem as limitações de abrir um `index.html` solto direto do sistema de arquivos do celular. No Safari (iPhone), depois de abrir o link publicado, dá pra usar "Adicionar à Tela de Início" para um acesso tipo app.

## Estrutura do projeto

```
saude-em-dupla/
├── index.html          # Estrutura de todas as telas, modais e onboarding
├── style.css            # Design system (cores, tipografia, componentes) — Light + Dark Mode
├── assets/
│   └── fonts/            # Karla e Inconsolata, auto-hospedadas (sem CDN)
└── js/
    ├── storage.js        # Persistência (localStorage) + migração de versões antigas dos dados
    ├── habits.js          # Catálogo global de hábitos (id, nome, ícone) + utilitários de data
    ├── users.js            # Usuário + configuração individual por hábito (active/mandatory)
    ├── progress.js          # Conclusões diárias, água e cálculo de pontuação
    ├── reminders.js          # Lembretes contextuais e perguntas "Como está seu dia?"
    ├── ui.js                  # Toda a renderização/DOM (não guarda estado nem regra de negócio)
    └── app.js                  # Orquestração: eventos, navegação, estatísticas
```

## Arquitetura de dados

Tudo fica em uma única chave do `localStorage`. A ideia central é que **hábito** e **configuração do usuário para aquele hábito** são coisas separadas:

```
Habit                       →  o que é (id, nome, ícone, tipo: padrão/personalizado)
User.habitSettings[habitId] →  como esta pessoa usa esse hábito (active, mandatory)
Days[userId][data]          →  o que foi concluído naquele dia, água e horários
```

Isso permite, por exemplo, que "Fortalecimento de joelho" seja obrigatório para uma pessoa e opcional para a outra sem duplicar o hábito, e que a pontuação máxima do dia se ajuste automaticamente conforme hábitos são ativados, desativados ou criados.

## Design

- Tipografia: **Karla** (textos e títulos) e **Inconsolata** (números e métricas), ambas auto-hospedadas.
- Ícones de interface (navegação, configurações, engrenagem, sol/lua, adicionar, editar, excluir etc.) em **line art/outline**. Ícones de hábitos continuam em emoji, propositalmente expressivos.
- Paleta em tons de verde-sálvia inspirada em apps de saúde e wellness, com versão própria para Dark Mode (não é o Light Mode com cores invertidas).

## Privacidade

Não há coleta de dados, analytics, trackers ou envio de informação para qualquer servidor. Tudo o que é digitado ou registrado permanece no `localStorage` do navegador daquele celular.

## Limitações atuais e possíveis evoluções

- Não há sincronização entre os dois celulares — cada um mantém seus próprios dados.
- O envio do resumo pelo WhatsApp é manual (o app só copia/compartilha o texto).
- Lembretes existem apenas enquanto o app está aberto (não são notificações reais do sistema).
- A estrutura já está organizada para permitir, futuramente, transformar o projeto em PWA e adicionar notificações reais, sem precisar de uma reescrita.
