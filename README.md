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
- **Variantes de robô** inspiradas nos starter bots públicos do BIOBUZZ (modelos 3D próprios, sem redistribuir os CADs):
  - **goBILDA**: 6WD drop-center, intake de rodas Gecko que puxa o POLLEN de dentro da FLOWER;
  - **REV DUO**: tração tanque por correias e um servo que tira o POLLEN da FLOWER;
  - **AndyMark Robits**: tanque com rodas omni e stealth, lançador com capô e servo de retirada.
  - Os starter bots não andam de lado nem pontuam na FLOWER. Detalhes em [docs/starter-bots.md](docs/starter-bots.md).
- **Oficina com importação de CAD**: GLB, STL e STEP (até 40 MB no navegador). Montagens maiores passam pelo conversor `npm run cad:convert`. O modelo é orientado, conferido contra o R102 e guardado neste aparelho; depois, aparece na tela "Jogar". Detalhes em [docs/cad-import.md](docs/cad-import.md).
- **Cenário de evento** gerado no código: céu com nuvens, gramado, floresta, cogumelos e flores low-poly, painéis com as faixas da WestSharks (com espaço para a logo autorizada), três arquibancadas com plateia e, em cada ALLIANCE AREA, 2 HUMAN PLAYERS apicultores, 2 pilotos e 1 técnico.
- **POLLEN e NECTAR perfurados**: 26 furos, com os diâmetros dos desenhos oficiais.
- **Partida completa**: AUTO de 30 s, transição de 8 s e TELEOP de 2:00, com o relógio oficial.
- **Pontuação automática** de todas as linhas da Tabela 10-2:
  - LEAVE, PARK, HIVE TIP (AUTO/TELEOP), CELL, FLOWER (dona + bônus do NECTAR mais baixo) e GARDEN;
  - **RANKING POINTS** SWARM, POLLINATOR 1 e 2.
- **Faltas automáticas**: G410 (NECTAR na FLOWER antes de 1:00), com MAJOR FOUL creditado à adversária.
- **HUMAN PLAYER**: introduz NECTAR pela LOADING ZONE, 1 por TIP ou todos com 1:00 restante (G426).
- **Score Overlay** recriado nativamente: barra do evento, alianças, ícones de RP, números das equipes e cronômetro.
- **Placar animado e resultados**: números que sobem contando com "+N", ícones de RP que acendem ao serem conquistados, tela de resultado com recorde da equipe e posição no ranking.
- **Replay** dos últimos 30 s (pausa ou fim da partida), com velocidades de 0,25× a 2× e barra de posição.
- **Placares**: ranking de qualificação local (média de RP, média de pontos e recorde), histórico de partidas e ranking da turma por arquivo JSON (exportar e importar).
- **Autônomos de exemplo**: LEAVE, LEAVE + PARK, ou lançar na HIVE e estacionar.
- **Controles**: teclado, gamepad e toque; câmeras de plateia, piloto, robô, de cima e livre.
- **Qualidade ajustável** para computadores escolares modestos.

Próximos marcos: Java do Android Studio no navegador (com Pedro Pathing e RoadRunner), marcação de mecanismos no CAD, placares locais, robôs-bot e modo 100% offline (PWA). O roadmap completo está em [docs/phase-1-analysis.md](docs/phase-1-analysis.md).

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
├── docs/starter-bots.md           # mecanismos e limitações dos starter bots de referência
├── docs/cad-import.md             # importação de CAD na Oficina e conversor STEP → GLB
├── scripts/step-to-glb.mjs        # conversor de montagens STEP grandes (npm run cad:convert)
├── src/
│   ├── rules/        # leitura tipada do arquivo de regras
│   ├── scoring/      # motor de pontuação puro (Tabela 10-2) + testes
│   ├── match/        # relógio da partida e regras do HUMAN PLAYER + testes
│   ├── sim/          # física e modelos: campo, HIVE, FLOWER, elementos, robô
│   ├── game/         # controlador da partida e autônomos de exemplo
│   ├── render/       # palco Three.js, câmeras, cenário e presets de qualidade
│   ├── config/       # preferências, padrões e variantes de robô (módulos leves)
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
- **Jogar:** número da equipe, nome do evento, robô, programa do AUTO, tempo entre lançamentos e qualidade gráfica.
- **Oficina:** importar o CAD do robô (GLB, STL ou STEP), orientar, conferir o tamanho (R102), escolher os mecanismos e guardar.
- **Arena:** Score Overlay no topo, HUD do robô (depósito, lançador, NECTAR liberado) e ajuda de controles.

**Controles:**

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
