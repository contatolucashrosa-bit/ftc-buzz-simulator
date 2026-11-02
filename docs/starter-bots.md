# Starter bots do BIOBUZZ: mecanismos, limitações e variantes no simulador

> Buzz Simulator. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
> Data: 02/11/2026.

## Fontes
- CADs públicos enviados pela equipe:
  - `goBILDA - FTC Starter Bot - BIOBUZZ - 3200-2627-0003.zip`;
  - `REV DUO - FTC Starter Bot - BIOBUZZ.step`;
  - `Robits AndyMark - FTC Starter Bot - BIOBUZZ.STEP`.
- Os CADs ficam **fora do git** (`.gitignore`) e **não são redistribuídos**. O simulador usa só parâmetros (medidas, tipo de tração e de mecanismo), com modelos 3D próprios, gerados no código.
- Os mecanismos foram identificados pelos nomes das peças dentro dos STEPs e pelas páginas públicas dos fabricantes.
- Medição: `scripts/step-bbox.mjs` mede a caixa envolvente de cada montagem; `scripts/cad-inventory.mjs` lista peças de uma pasta de STEPs.

## Resumo
Os três são os robôs **mais simples** da temporada:
- não têm mecanum, então não andam de lado;
- não colocam elementos dentro da FLOWER (não pontuam nela);
- só **tiram POLLEN** da FLOWER, lançam na HIVE e carregam até 4 elementos (G407).

| Starter bot | Tração | Intake | Lançador | Como tira o POLLEN da FLOWER |
|---|---|---|---|---|
| **goBILDA** | 6WD drop-center (roda do meio mais baixa) | Rodas Gecko num eixo | Volante (flywheel) | O próprio intake alcança o POLLEN dentro do anel de baixo e o puxa |
| **REV DUO** | Tanque por correias | Rolo | Volante | Um servo "cutucador" empurra o POLLEN para fora; o intake o recolhe do chão |
| **AndyMark Robits** | Tanque com rodas omni (pontas) e stealth (meio), motores NeveRest | Rodas complacentes | Volante com capô | Um servo programável solta o POLLEN da FLOWER; o intake o recolhe |

## Limitações (e o que o simulador reproduz)
| Limitação | goBILDA | REV DUO | AndyMark | No simulador |
|---|---|---|---|---|
| Não anda de lado | ✔ | ✔ | ✔ | A e D (e o analógico lateral) não fazem nada |
| Não coloca na FLOWER | ✔ | ✔ | ✔ | Sem "colocar"; G/RB aciona o servo de retirada (REV, AndyMark) |
| Retirar POLLEN exige dois passos | — | ✔ | ✔ | O intake não alcança o POLLEN dentro da FLOWER sem o servo |
| Recuperação do lançador entre bolas | — | — | — | Padrão por robô (0,40–0,50 s), editável na tela "Jogar" |

## Parâmetros usados (`src/config/robotPresets.ts`)
| Parâmetro | Robô de treino | goBILDA | REV DUO | AndyMark |
|---|---|---|---|---|
| Base (pol), frente × lado | 18 × 18 | 17,8 × 16,8 | 18 × 16,5 ¹ | 17,7 × 17,2 |
| Altura (pol) | 16 | 12,0 | 9,3 | 17,5 |
| Tração | mecanum | tanque | tanque | tanque |
| Velocidade máx. (m/s) | 1,6 | 1,5 | 1,3 | 1,4 |
| Giro máx. (rad/s) | 3,5 | 3,2 | 3,0 | 3,8 |
| Massa (kg) | 13 | 11 | 10 | 11 |
| Tempo entre lançamentos (s) | 0,30 | 0,45 | 0,50 | 0,40 |
| Retirada na FLOWER | intake | intake | servo | servo |

**Medidas:** base e altura vêm dos CADs, convertidos com `npm run cad:convert` e orientados na Oficina (vista de cima).

| Starter bot | Peças convertidas | Eixo para cima no CAD | Caixa medida (pol) |
|---|---|---|---|
| goBILDA | 289 (908 pequenas descartadas) | Z | 17,8 × 16,8 × 12,0 |
| REV DUO | 336 (1170 pequenas descartadas) | Z | 22,3 × 16,5 × 9,3 ¹ |
| AndyMark Robits | 390 (418 pequenas descartadas) | Y | 17,7 × 17,2 × 17,5 |

¹ A caixa do REV DUO passa de 18 pol no comprimento. Provavelmente alguma peça está fora da posição de largada ou solta no CAD; a física usa 18 pol (R102).

**Suposições:**
- A frente de cada modelo (lado do intake) foi escolhida pela vista de cima. No AndyMark ela é a menos certa: se o robô aparecer andando de costas, gire 180° na Oficina.
- Velocidade, giro, massa e tempo entre lançamentos são estimativas pelo tipo de motor e de tração, não medidas. A Oficina vai calcular esses valores pelo mecanismo real de cada equipe.

## Jogar com o CAD de verdade
Os CADs dos fabricantes não ficam no repositório, mas cada equipe pode baixá-los, convertê-los e importá-los na Oficina (passo a passo em `docs/cad-import.md`):
1. `npm run cad:convert -- "REV DUO - FTC Starter Bot - BIOBUZZ.step" rev-duo.glb`
2. Oficina → escolher o GLB → eixo e frente → mecanismos "REV DUO Starter Bot" → guardar.
3. Na tela "Jogar", escolher o robô marcado como "CAD importado".

Com o CAD importado, o modelo do fabricante substitui o nosso, e a física continua a da variante.

## Como o servo funciona no simulador
1. O robô encosta a frente na FLOWER (até 6 pol entre a frente e o eixo).
2. G ou RB aciona o servo: o braço desce e volta.
3. O POLLEN de baixo sai para o lado esquerdo do robô, já dentro da boca do intake. Os POLLEN de cima descem um nível.
4. Com o intake ligado (Espaço/LT), o POLLEN vai para o depósito.

O servo puxa o POLLEN em vez de chutá-lo. Um chute de verdade sacudia a pilha inteira, porque no simulador o anel do meio não colide com POLLEN (ver `src/sim/flower.ts`).
