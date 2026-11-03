# 🐝 Buzz Simulator

<p align="center">
  <a href="https://github.com/contatolucashrosa-bit/ftc-buzz-simulator">
    <img src="https://img.shields.io/badge/GitHub-ftc--buzz--simulator-181717?style=for-the-badge&logo=github">
  </a>
  <a href="https://www.linkedin.com/in/lucas-hochmann-rosa">
    <img src="https://img.shields.io/badge/LinkedIn-Lucas_Hochmann_Rosa-0A66C2?style=for-the-badge&logo=linkedin">
  </a>
  <a href="#-tecnologias-utilizadas">
    <img src="https://img.shields.io/badge/TypeScript-7-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  </a>
  <a href="#-tecnologias-utilizadas">
    <img src="https://img.shields.io/badge/Three.js-0.187-000000?style=for-the-badge&logo=threedotjs&logoColor=white">
  </a>
  <a href="#-tecnologias-utilizadas">
    <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-2ea44f?style=for-the-badge">
  </a>
</p>

<p align="center">🇧🇷 Português · <a href="README.en.md">🇺🇸 English</a></p>

> Projete, programe e jogue FTC — direto do navegador. Criado em parceria com a **[WestSharksFTC #24823](https://www.westsharksftc.com/)**.

---

## ⚡ Início

```bash
git clone https://github.com/contatolucashrosa-bit/ftc-buzz-simulator.git
cd ftc-buzz-simulator
npm install
npm run dev
```

Para gerar e testar a versão de produção:

```bash
npm run build
npm run preview
```

---

## 📌 Visão Geral

O **Buzz Simulator** é um simulador 3D da temporada **BIOBUZZ™ presented by RTX** (*FIRST*® Tech Challenge 2026-2027), todo em português do Brasil. Estudantes do ensino médio treinam estratégia, pilotagem, CAD e programação do robô sem precisar do robô físico.

Roda no navegador em Windows, macOS, Linux, Chromebook e tablets, **sem instalação, sem conta e sem servidor**. Tudo fica no próprio aparelho e, depois do primeiro acesso, funciona offline.

A fonte da verdade das regras é o manual oficial *BIOBUZZ Competition Manual*, versão **TU07**.

> **Versão de testes (0.x):** regras, física e pontuação ainda podem mudar entre as versões.

---

## ✨ Principais Funcionalidades

- **Campo 3D com as medidas do manual:** 36 TILES, LOADING ZONES, GARDENS, a estrutura com duas HIVEs biestáveis (±30°) e 4 FLOWERS; 40 POLLEN e 16 NECTAR perfurados na largada oficial (§10.3.1), com física real.
- **Partida completa:** AUTO de 30 s, transição de 8 s e TELEOP de 2:00, com relógio oficial e buzinas.
- **Pontuação automática** de todas as linhas da Tabela 10-2 e dos RANKING POINTS SWARM, POLLINATOR 1 e 2.
- **Faltas automáticas**, com MAJOR FOUL creditado à adversária:
  - G410: NECTAR na FLOWER antes de 1:00;
  - G402: encostar num adversário estando todo no lado dele durante o AUTO;
  - G405: lançar um elemento para fora do campo, para longe da própria HIVE;
  - G421: PIN contra a parede ou outro robô por mais de 3 s (e outra MAJOR a cada 3 s).
- **Robôs:** robô de treino 18 × 18 pol (mecanum) e variantes inspiradas nos starter bots públicos (goBILDA, REV DUO, AndyMark), com medidas tiradas do CAD.
- **Robôs-bot:** parceiro e até 2 adversários (fácil, médio ou difícil), com HUMAN PLAYER azul automático.
- **2º jogador local:** o parceiro vermelho pode ser pilotado por outra pessoa no mesmo computador ou pelo 2º controle.
- **Código Java do Android Studio na partida:** importe o TeamCode (pasta ou `.zip`) sem mudar nada, com Pedro Pathing e RoadRunner; INIT, START e STOP seguem a partida, com telemetria no HUD e erros de compilação em português.
- **Visão com AprilTag:** `VisionPortal` e `AprilTagProcessor` do SDK funcionam com a câmera simulada do robô. As tags 30–45 ficam sob as CELLS e acompanham a inclinação da HIVE; `ftcPose`, `robotPose` e `metadata` vêm como no robô real.
- **Oficina de CAD:** importa GLB, STL e STEP (até 40 MB no navegador), orienta o modelo, confere o R102 e guarda no aparelho.
- **Robôs da equipe:** exporta e importa robôs como `.buzzrobot.zip`, com modelo, medidas, mecanismos e crédito.
- **Score Overlay** recriado, placar animado, tela de resultado, **replay** dos últimos 30 s e **ranking** local exportável.
- **Cenário da temporada** gerado no código, inspirado no vídeo de divulgação da BIOBUZZ: a arena num prado com colinas, floresta de pinheiros, samambaias, flores silvestres e cogumelos; DRIVE TEAMS e HUMAN PLAYERS como apicultores de macacão (rosa na vermelha, lavanda na azul), além de **sons** sintetizados.
- **Arena nas cores do vídeo e do CAD:** TILES cinza-claro, perímetro de policarbonato com perfis pretos, FLOWERS verdes com topo amarelo e CELLS da HIVE com molduras na cor da aliança.
- **Gráficos com iluminação de ginásio:** sombras suaves, reflexos em metal e plástico, oclusão de ambiente e TILES de espuma com relevo, em três presets de qualidade (o Baixo, para Chromebooks, continua leve).
- **Conheça a *FIRST*:** página que apresenta a *FIRST*®, os três programas e os desafios da temporada *FIRST* CANOPY, os valores, o SESI como operador no Brasil e como entrar numa equipe, com links para os sites oficiais (sem logotipos).
- **Controles** por teclado, gamepad e toque; qualidade gráfica ajustável para computadores escolares modestos.

---

## 🧭 Sumário

- [Arquitetura](#️-arquitetura)
- [Mapa dos Módulos](#️-mapa-dos-módulos)
- [Tecnologias utilizadas](#-tecnologias-utilizadas)
- [Dinâmica da partida](#-dinâmica-da-partida)
- [Regras da construção do projeto](#-regras-da-construção-do-projeto)
- [Requisitos](#️-requisitos)
- [Instalação](#-instalação)
- [Configuração de Ambiente](#-configuração-de-ambiente)
- [Execução](#️-execução)
- [Deploy e uso offline](#-deploy-e-uso-offline)
- [Avisos](#️-avisos)
- [Licença](#-licença)
- [Autor](#‍-autor)

---

## 🏗️ Arquitetura

```text
ftc-buzz-simulator/
├── index.html
├── package.json
├── vite.config.ts
├── data/rules/biobuzz-tu07.json    # regras do manual em dados, com a página citada
├── docs/                           # análise, roadmap, CAD, Java, bots e starter bots
├── examples/TeamCode/              # OpModes de exemplo para importar na Oficina
├── public/                         # ícone e manifesto do app instalável
├── scripts/                        # conversor STEP → GLB, build das libs Java e plugin offline
├── vendor/java-libs/               # compilador Java do navegador e SDK FTC simulado (jar)
└── src/
    ├── rules/      # leitura tipada do arquivo de regras
    ├── scoring/    # motor de pontuação puro (Tabela 10-2)
    ├── match/      # relógio, HUMAN PLAYER e histórico de partidas
    ├── sim/        # física: campo, HIVE, FLOWER, elementos e robô
    ├── game/       # partida, autônomos, bots, faltas e replay
    ├── java/       # SDK FTC simulado, compilação e ponte de hardware
    ├── workshop/   # importação de CAD, armazenamento e pacotes de robô
    ├── render/     # palco Three.js, cenário e sons
    ├── input/      # teclado, gamepad e toque
    ├── config/     # preferências e variantes de robô
    ├── ui/         # telas, Score Overlay e HUD
    └── styles/     # tokens de cor da FIRST e estilos
```

O motor de pontuação não depende do 3D: recebe um "retrato" da partida e devolve pontos e RP, então cada regra é testada isoladamente. A física roda em passo fixo: as mesmas entradas dão o mesmo resultado.

---

## 🗺️ Mapa dos Módulos

| Arquivo | Função |
| ------ | ------ |
| `src/game/game.ts` | Controlador da partida: fases, robôs, bots, Java, faltas, sons e replay. |
| `src/scoring/scoring.ts` | Pontuação da Tabela 10-2, faltas e RANKING POINTS. |
| `src/game/fouls.ts` | Faltas de contato (G402 e G421) por geometria. |
| `src/game/bot.ts` | Cérebro dos robôs-bot: coletar, lançar com revezamento e estacionar. |
| `src/sim/robot.ts` | Robô físico: tração, intake, lançador e mecanismo da FLOWER. |
| `src/sim/hive.ts` / `src/sim/flower.ts` | HIVE basculante (TIP) e pilha da FLOWER. |
| `src/java/javaRuntime.ts` | Compila o TeamCode no navegador e roda o OpMode. |
| `src/java/hardwareBus.ts` | Liga o `hardwareMap` do Java aos motores e sensores simulados. |
| `src/workshop/cadImport.ts` | Leitura e normalização de GLB, STL e STEP. |
| `src/workshop/robotPackage.ts` | Pacote `.buzzrobot.zip` para trocar robôs entre computadores. |
| `src/ui/app.ts` | Navegação e telas Jogar, Oficina, Placares, Robôs da equipe e Sobre. |
| `src/ui/home.ts` | Página inicial e página "Conheça a *FIRST*" (programas, temporada *FIRST* CANOPY, valores, SESI e como participar). |
| `scripts/step-to-glb.mjs` | Converte montagens STEP grandes em GLB (`npm run cad:convert`). |
| `scripts/offline-plugin.mjs` | Gera o service worker que deixa o app offline. |

---

## 🧰 Tecnologias utilizadas

**Linguagem:** TypeScript 7, com tipagem forte para as regras.

**3D:** Three.js, que roda em WebGL 2 de Chromebooks antigos.

**Física:** Rapier (WebAssembly), rápida e determinística.

**Build e testes:** Vite 8 e Vitest.

**Java no navegador:** `javac` + TeaVM num Web Worker, com SDK FTC simulado, Pedro Pathing e RoadRunner.

**CAD:** `occt-import-js` (OpenCascade em WebAssembly) e `meshoptimizer`.

**Áudio:** Web Audio API, sem arquivos de som.

**Fonte:** Roboto empacotada, a fonte oficial da *FIRST*, que funciona offline.

---

## 🎮 Dinâmica da partida

Na tela **Jogar** a equipe escolhe número, evento, robô, programa do AUTO (de exemplo ou Java), parceiro (bot, 2º jogador ou nenhum), adversários e nível. A partida segue o manual:

| Fase | Duração | Quem controla |
| --- | --- | --- |
| AUTO | 30 s | Programa escolhido (exemplo ou OpMode Java) |
| Transição | 8 s | Robôs parados (G403) |
| TELEOP | 2:00 | Piloto (ou OpMode Java); com 1:00 restante, FLOWERS e todo o NECTAR liberados |

**Controles do jogador 1:**

| Ação | Teclado | Gamepad |
|---|---|---|
| Mover | W A S D | analógico esquerdo |
| Girar | Q / E | analógico direito |
| Intake (segurar) | Espaço | LT ou LB |
| Lançar todo o depósito em rajada | F | RT |
| Mecanismo da FLOWER: colocar (robô de treino) ou servo de retirada (REV DUO, AndyMark) | G | RB |
| Velocidade / ângulo do lançador | ↑ ↓ / ← → | direcional |
| HUMAN PLAYER: introduzir NECTAR | N | Y |
| Câmera · direção · reiniciar · pausar | C · O · R · Esc | Back · — · — · Start |
| Placar: transmissão → piloto → oculto | V | — |
| Câmera "Seguir robô": girar / inclinar / aproximar | arrastar o mouse / roda / duplo clique volta ao padrão | analógico direito ↕ inclina; R3 + ↔ gira |

**Controles do 2º jogador:** I/K anda, J/L gira, H coleta, Y lança (mira automática na CELL de cima), U usa a FLOWER. Ou o 2º controle conectado. Com 2º jogador e TeleOp em Java, os botões A/B/X/Y do gamepad1 no teclado passam para 1/2/3/4, e LB/RB para Z/X.

---

## 📐 Regras da construção do projeto

- Identificadores, nomes de arquivos e pastas, chaves do JSON de regras e mensagens técnicas de log ficam em inglês.
- Textos de interface e documentação ficam em português do Brasil.
- Comentários no código ficam em português, reservados para decisões não óbvias — o "porquê", não o "o quê".
- Termos oficiais do FTC (POLLEN, NECTAR, HIVE, TIP, FLOWER, GARDEN, LOADING ZONE, LEAVE, PARK) seguem a grafia do manual.
- Toda regra implementada cita a seção ou página do manual. O que não está no manual fica marcado como **suposição** em `data/rules/biobuzz-tu07.json`.

---

## ⚙️ Requisitos

- **Para jogar:** navegador moderno com WebGL 2 e WebAssembly (Chrome, Edge, Firefox ou Safari atuais). O Java mais rápido usa WasmGC (Chrome/Edge 119+, Firefox 120+, Safari 18.2+).
- **Para desenvolver:** Node.js 20 ou superior e npm 10 ou superior.
- **Para recompilar as bibliotecas Java (opcional):** JDK local (`npm run java:libs`).

---

## 🚀 Instalação

```bash
npm install
```

---

## 🔐 Configuração de Ambiente

Este projeto não usa variáveis de ambiente. A aplicação roda inteiramente no navegador e guarda robôs, projetos Java e partidas no próprio aparelho (IndexedDB e localStorage).

---

## ▶️ Execução

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm test` | Testes de pontuação, relógio, HIVE, FLOWER, bots, faltas, Java e pacotes |
| `npm run build` | Verifica os tipos e gera o site estático em `dist/` |
| `npm run preview` | Serve o `dist/` localmente para conferência |
| `npm run cad:convert -- robo.step robo.glb` | Converte um STEP grande de robô em GLB para a Oficina |
| `npm run java:libs` | Recompila o SDK FTC simulado e o Pedro Pathing |

---

## 🌐 Deploy e uso offline

O conteúdo de `dist/` é um site estático e pode ser publicado em qualquer hospedagem gratuita, como o GitHub Pages.

**Offline (PWA):** no primeiro acesso, o service worker guarda o app no aparelho (cerca de 21 MB, com o compilador Java). Depois disso, o Buzz Simulator abre e joga sem internet, e o navegador oferece "Instalar app". A leitura de STEP no navegador (7,6 MB) é guardada na primeira vez que for usada.

---

## ⚠️ Avisos

- O Buzz Simulator é um **projeto independente, sem afiliação nem endosso da *FIRST*®**. *FIRST*®, *FIRST*® Tech Challenge e BIOBUZZ™ são marcas registradas da For Inspiration and Recognition of Science and Technology (*FIRST*).
- Nenhum logotipo ou asset protegido é usado. Os modelos 3D e os ícones foram recriados para este projeto; as cores seguem a paleta oficial da *FIRST*. O manual e os CADs oficiais não são redistribuídos.
- **Limitações conhecidas:**
  - a massa que faz a HIVE virar não consta no manual; o valor atual é uma suposição calibrável;
  - a posição exata das FLOWERS e zonas foi estimada pelas figuras do manual, até a conferência com o CAD oficial;
  - as faltas de contato são estimadas pela física, sem árbitro: a intenção do G405 é deduzida pela direção do lançamento;
  - a visão é geométrica: a câmera vê as tags pelo campo de visão, distância (até 12 pés) e ângulo, sem oclusão por robôs ou elementos e sem ruído; Limelight e processadores próprios (OpenCV) ainda não existem.
- O diretório `dist/` é gerado pelo build e não deve ser versionado.

Documentação detalhada: [roadmap](docs/phase-1-analysis.md) · [Java](docs/m5a-java-runtime.md) · [CAD](docs/cad-import.md) · [starter bots](docs/starter-bots.md) · [robôs-bot](docs/bots.md).

---

## 📄 Licença

Licenciado sob MIT. Sinta-se livre para usar, modificar e distribuir, mantendo o aviso de copyright e atribuindo crédito a **Lucas Hochmann Rosa**.

---

## 👨‍💻 Autor

**Lucas Hochmann Rosa**

- Repositório: <https://github.com/contatolucashrosa-bit/ftc-buzz-simulator>
- GitHub: <https://github.com/contatolucashrosa-bit>
- LinkedIn: <https://www.linkedin.com/in/lucas-hochmann-rosa>
- E-mail: hrlucas.dev@gmail.com

Em parceria com a **WestSharksFTC #24823** (SESI SENAI Chapecó).

---
