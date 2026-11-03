# Robôs-bot

> Buzz Simulator. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
> Data: 02/11/2026.

Parceiro e adversários controlados pelo simulador, para treinar uma partida com 4 robôs, como num evento.

## Configuração (tela "Jogar")
- **Parceiro:** 1 bot na aliança vermelha (o jogador é o vermelho 1).
- **Adversários:** 0, 1 ou 2 bots na aliança azul. O HUMAN PLAYER azul também é do simulador e entrega NECTAR sempre que a regra G426 libera.
- **Nível:**

  | Nível | Potência máxima | Erro de mira | Tempo para decidir |
  |---|---|---|---|
  | Fácil | 55% | ±8% | 0,8 s |
  | Médio | 75% | ±4% | 0,4 s |
  | Difícil | 95% | ±1,5% | 0,15 s |

- **Modelos:** os bots usam as variantes dos starter bots (goBILDA, REV DUO e AndyMark), com as mesmas limitações: tanque, sem colocar na FLOWER.
- **Pré-carga e largada:** cada bot começa com 4 POLLEN (G304), tocando a parede da própria aliança e fora da LOADING ZONE. Quando falta robô numa aliança, os 4 POLLEN dele ficam na LOADING ZONE (§10.3.1).

## Estratégia (`src/game/bot.ts`)
Máquina de estados simples, como um starter bot bem pilotado:

| Estado | O que faz |
|---|---|
| Coletar | Vai até o POLLEN (ou NECTAR da própria aliança) solto mais perto, de frente, com o intake ligado. Ignora o que está dentro de FLOWER, no GARDEN encostado na parede e embaixo da HIVE. Evita disputar com um robô mais perto e prefere o próprio lado do campo |
| Ir lançar | Vai até a frente da CELL de cima da própria HIVE, contornando a HIVE pela lateral se estiver do outro lado. Se um parceiro já está no ponto de lançamento, espera ao lado (revezamento) |
| Lançar | Mira com o cálculo de trajetória (`hiveShot`, mais o erro do nível) e lança o depósito em rajada |
| Estacionar | Nos últimos 12 s, vai para a LOADING ZONE (PARK) |
| Destravar | Se quase não anda por 1,5 s, dá ré girando e escolhe outro alvo |

A navegação anda de frente (ou de ré) até o destino e só então gira para a mira, porque os starter bots são tanque.

## Resultados medidos (partidas completas simuladas, 02/11/2026)

| Configuração | Vermelha | Azul | Custo da simulação |
|---|---|---|---|
| Parceiro + 2 adversários, médio | 114 (5 TIPs) | 115 (5 TIPs, 4 RP) | 17,8 ms por segundo de jogo |
| Parceiro + 2 adversários, difícil | 139 (6 TIPs) | 146 (6 TIPs, 5 RP) | 15,7 ms por segundo de jogo |

Com 4 robôs, um quadro do jogo leva em média 6,5 ms (p95 8,1 ms): cabe nos 60 FPS.

## Limitações
- Os bots não usam o servo de retirada da FLOWER nem colocam elementos nela.
- Faltas de contato entre robôs (G4xx) ainda não são avaliadas.
- O replay grava todos os robôs, mas o código Java da equipe só controla o vermelho 1.
