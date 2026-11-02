# Buzz Simulator

[![GitHub](https://img.shields.io/badge/GitHub-contatolucashrosa--bit-181717?logo=github)](https://github.com/contatolucashrosa-bit)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-lucas--hochmann--rosa-0A66C2?logo=linkedin)](https://www.linkedin.com/in/lucas-hochmann-rosa)
[![TypeScript](https://img.shields.io/badge/TypeScript-Three.js%20%2B%20Rapier-3178C6?logo=typescript)](#tecnologias)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green)](LICENSE)

🇧🇷 Português · [🇺🇸 English](README.en.md)

> Projete, programe e jogue FTC — direto do navegador.

Criado por **Lucas Hochmann Rosa** ([github.com/contatolucashrosa-bit](https://github.com/contatolucashrosa-bit)), em parceria com **[WestSharksFTC #24823](https://www.westsharksftc.com/)**.

## Visão Geral

O Buzz Simulator é um simulador 3D da temporada **BIOBUZZ™ presented by RTX** (*FIRST*® Tech Challenge 2026-2027), todo em português do Brasil. Ele foi feito para estudantes do ensino médio treinarem estratégia, pilotagem e, nos próximos marcos, CAD e programação do robô, sem precisar do robô físico.

**Independente de plataforma:** roda no navegador em Windows, macOS, Linux, Chromebook e tablets, **sem instalação, sem conta e sem servidor**. Tudo fica no próprio aparelho.

A fonte da verdade das regras é o manual oficial *BIOBUZZ Competition Manual*, versão **TU07**.

## Funcionalidades

Já disponível (marcos M0–M3):
- **Campo 3D** com as medidas do manual:
  - 36 TILES, LOADING ZONES e GARDENS;
  - estrutura da HIVE com duas HIVEs biestáveis (gangorras de ±30°);
  - 4 FLOWERS com anéis e volume de pontuação.
- **40 POLLEN e 16 NECTAR** na largada oficial (§10.3.1), com física real (Rapier).
- **Robô genérico 18 × 18 pol** com:
  - tração mecanum;
  - intake de até 4 elementos (G407), que nunca pega NECTAR adversário (G408);
  - lançador com prévia da trajetória;
  - "colocar" para as FLOWERS.
- **Partida completa**: AUTO de 30 s, transição de 8 s e TELEOP de 2:00, com o relógio oficial.
- **Pontuação automática** de todas as linhas da Tabela 10-2:
  - LEAVE, PARK, HIVE TIP (AUTO/TELEOP), CELL, FLOWER (dona + bônus do NECTAR mais baixo) e GARDEN;
  - **RANKING POINTS** SWARM, POLLINATOR 1 e 2.
- **Faltas automáticas**: G410 (NECTAR na FLOWER antes de 1:00), com MAJOR FOUL creditado à adversária.
- **HUMAN PLAYER**: introduz NECTAR pela LOADING ZONE, 1 por TIP ou todos com 1:00 restante (G426).
- **Score Overlay** recriado nativamente: barra do evento, alianças, ícones de RP, números das equipes e cronômetro.
- **Autônomos de exemplo**: LEAVE, LEAVE + PARK, ou lançar na HIVE e estacionar.
- **Controles**: teclado, gamepad e toque; câmeras de plateia, piloto, robô, de cima e livre.
- **Qualidade ajustável** para computadores escolares modestos.

Próximos marcos: Java do Android Studio no navegador (com Pedro Pathing e RoadRunner), Oficina com importação de CAD em STEP, placares locais, robôs-bot e modo 100% offline (PWA). O roadmap completo está em [docs/phase-1-analysis.md](docs/phase-1-analysis.md).

## Sumário

- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Regras de construção do projeto](#regras-de-construção-do-projeto)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Execução](#execução)
- [Interface Web](#interface-web)
- [Avisos](#avisos)
- [Autor](#autor)
- [Licença](#licença)

## Arquitetura

```
ftc-buzz-simulator/
├── data/rules/biobuzz-tu07.json   # regras do manual em dados (pontos, tempos, medidas), com página citada
├── docs/phase-1-analysis.md       # análise da Fase 1, decisões e roadmap
├── src/
│   ├── rules/        # leitura tipada do arquivo de regras
│   ├── scoring/      # motor de pontuação puro (Tabela 10-2) + testes
│   ├── match/        # relógio da partida e regras do HUMAN PLAYER + testes
│   ├── sim/          # física e modelos: campo, HIVE, FLOWER, elementos, robô
│   ├── game/         # controlador da partida e autônomos de exemplo
│   ├── render/       # palco Three.js, câmeras e presets de qualidade
│   ├── input/        # teclado, gamepad e toque
│   ├── ui/           # telas, Score Overlay e HUD
│   └── styles/       # tokens de cor da FIRST e estilos
└── cad/              # (fora do git) CAD oficial da arena, para calibração
```

O motor de pontuação não depende do 3D: ele recebe um "retrato" da partida e devolve pontos e RP. Por isso, cada regra pode ser testada isoladamente. A física roda em passo fixo, então as mesmas entradas dão o mesmo resultado.

## Tecnologias

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript | Nativa do navegador; tipagem forte para as regras |
| 3D | Three.js | Leve e roda em WebGL 2 de Chromebooks antigos |
| Física | Rapier (WASM) | Rápida e determinística (replays) |
| Build | Vite | Site estático, hospedável de graça |
| Testes | Vitest | Um teste por regra da Tabela 10-2 |
| Fonte | Roboto (empacotada) | Fonte oficial da *FIRST*, funciona offline |

## Regras de construção do projeto

- **Lógica em inglês**: identificadores, nomes de arquivos e pastas, chaves do JSON de regras e mensagens técnicas de log.
- **Comentários e documentação em português**: comentários só quando explicam um "porquê", e README e toda a interface do usuário em português do Brasil.
- Termos oficiais do FTC (POLLEN, NECTAR, HIVE, TIP, FLOWER, GARDEN, LOADING ZONE, LEAVE, PARK) seguem a grafia do manual.
- Toda regra implementada cita a seção ou página do manual. O que não está no manual fica marcado como **suposição** em `data/rules/biobuzz-tu07.json`.

## Requisitos

- **Para jogar:** um navegador moderno com WebGL 2 e WebAssembly (Chrome, Edge, Firefox ou Safari atuais).
- **Para desenvolver:** Node.js 20 ou superior.

## Instalação

```bash
npm install
```

## Execução

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm test` | Testes das regras de pontuação, relógio e HIVE |
| `npm run build` | Verifica os tipos e gera o site estático em `dist/` |
| `npm run preview` | Serve o `dist/` localmente para conferência |

O conteúdo de `dist/` pode ser publicado em qualquer hospedagem estática gratuita, como o GitHub Pages.

## Interface Web

- **Início:** apresentação, botão "Jogar no navegador" e plataformas suportadas.
- **Jogar:** número da equipe, nome do evento, programa do AUTO e qualidade gráfica.
- **Arena:** Score Overlay no topo, HUD do robô (depósito, lançador, NECTAR liberado) e ajuda de controles.

**Controles:**

| Ação | Teclado | Gamepad |
|---|---|---|
| Mover | W A S D | analógico esquerdo |
| Girar | Q / E | analógico direito |
| Intake (segurar) | Espaço | LT ou LB |
| Lançar todo o depósito em rajada | F | RT |
| Colocar na FLOWER | G | RB |
| Velocidade / ângulo do lançador | ↑ ↓ / ← → | direcional |
| HUMAN PLAYER: introduzir NECTAR | N | Y |
| Câmera · direção · reiniciar · pausar | C · O · R · Esc | Back · — · — · Start |
| Placar: transmissão → piloto → oculto | V | — |
| Câmera "Seguir robô": girar / inclinar / aproximar | arrastar o mouse / roda / duplo clique volta ao padrão | analógico direito ↕ inclina; R3 + ↔ gira |

## Avisos

- O Buzz Simulator é um **projeto independente, sem afiliação nem endosso da *FIRST*®**. *FIRST*®, *FIRST*® Tech Challenge e BIOBUZZ™ são marcas registradas da For Inspiration and Recognition of Science and Technology (*FIRST*).
- Nenhum logotipo ou asset protegido é usado. Os modelos 3D e os ícones foram recriados para este projeto; as cores seguem a paleta oficial da *FIRST*.
- **Limitações conhecidas:**
  - a massa que faz a HIVE virar não consta no manual; o valor atual é uma suposição calibrável;
  - a posição exata das FLOWERS e zonas foi estimada pelas figuras do manual, até a conferência com o CAD oficial;
  - nesta versão, a aliança azul não tem robôs.

## Autor

**Lucas Hochmann Rosa** — [GitHub](https://github.com/contatolucashrosa-bit) · hrlucas.dev@gmail.com

Em parceria com a **WestSharksFTC #24823** (SESI SENAI Chapecó).

## Licença

Distribuído sob a licença [MIT](LICENSE).
