# Massa do POLLEN e do NECTAR e o TIP da HIVE

> Buzz Simulator. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
> Data: 02/11/2026.

## 1. O que o manual diz
- **POLLEN:** bola Gopher ResisDent™ de polietileno, amarela, de cerca de 2,8 pol (7,1 cm). **NECTAR:** a mesma bola em vermelho e azul, de cerca de 3,6 pol (9,1 cm). As duas "não são perfeitamente esféricas e podem variar de tamanho" (§9.8 p.72).
- O manual **não informa massa**.
- **TIP:** a HIVE vira "quando elementos suficientes são LANÇADOS na CELL" (§8 p.60). Não há número; o TIP é definido só pelo movimento e pelo amortecedor (§10.5.1 p.85).
- **Largada:** cada CELL de cima começa com **3 NECTAR**, e a HIVE não vira com eles (§10.3.1 p.82).

## 2. Massas calculadas
Fontes: desenhos e STEPs oficiais da AndyMark enviados pela equipe (am-5851_yellow, am-5852_red, am-5852_blue). Material dos desenhos: polietileno.

| Elemento | Desenho | Volume pelo STEP | Massa (PE 0,92–0,96 g/cm³) | Valor usado |
|---|---|---|---|---|
| POLLEN | Ø 2,8 pol, parede 0,07 pol, 26 furos Ø 0,4 pol | 22,29 cm³ | 20,5–21,4 g | **21 g** |
| NECTAR | Ø 3,6 pol, parede 0,09 pol, 26 furos Ø 0,6 pol | 43,11 cm³ | 39,7–41,4 g | **41 g** |

- **Método:** o STEP foi lido com `occt-import-js` (OpenCascade), e o volume saiu da malha pelo teorema da divergência (script: `scripts/step-volume.mjs`).
- **Conferência:** o cálculo analítico (casca esférica menos os 26 furos) deu 23,3 e 46,7 cm³, próximo do STEP. A diferença vem da parede do furo e dos detalhes do molde.
- **Comparação externa:** bolas de *pickleball* externas, de tamanho parecido (2,87 pol), pesam 22–26,5 g. É coerente com os 21 g do POLLEN.
- **Relação:** **1 NECTAR ≈ 1,94 POLLEN** (praticamente 2).
- **Suposição:** a densidade exata do plástico. Pesar 10 bolas numa balança de cozinha confirma em 1 minuto.

## 3. Quantos elementos viram a HIVE?
O TIP depende do **torque** da carga na CELL de cima, comparado com o torque que mantém a HIVE apoiada no amortecedor. Esse segundo valor vem da massa e do centro de gravidade da própria HIVE, que **só o CAD da arena** (ou um teste no campo real) informa.

Por isso, a tabela abaixo é **condicional ao limiar**, expresso como massa equivalente na CELL de cima. A restrição conhecida é que o limiar é **maior que 123 g**, porque os 3 NECTAR da largada não viram a HIVE.

| Limiar (g) | Só POLLEN | Só NECTAR | 1 NECTAR + | 2 NECTAR + | 3 NECTAR + | Da largada (3 NECTAR já na CELL) |
|---|---|---|---|---|---|---|
| 130 | 7 | 4 | 5 POLLEN | 3 POLLEN | 1 POLLEN | +1 POLLEN ou +1 NECTAR |
| **135 (usado no simulador)** | 7 | 4 | 5 POLLEN | 3 POLLEN | 1 POLLEN | +1 POLLEN ou +1 NECTAR |
| 150 | 8 | 4 | 6 POLLEN | 4 POLLEN | 2 POLLEN | +2 POLLEN ou +1 NECTAR |
| 170 | 9 | 5 | 7 POLLEN | 5 POLLEN | 3 POLLEN | +3 POLLEN ou +2 NECTAR |
| 200 | 10 | 5 | 8 POLLEN | 6 POLLEN | 4 POLLEN | +4 POLLEN ou +2 NECTAR |

Observações:
- **Braço de alavanca:** os elementos rolam até o fundo da CELL, perto do pivô, porque na CELL de cima o fundo desce em direção ao pivô (inclinação de 30°). O NECTAR, maior, fica um pouco mais longe do pivô (≈ +4% de braço). Por isso, na prática, 1 NECTAR vale um pouco mais que 1,94 POLLEN.
- **Depois de um TIP:** a CELL que fica para cima está vazia (o conteúdo da que desceu cai no campo). Use a coluna "Só POLLEN" e as seguintes.
- **Escolha do padrão de 135 g** (suposição): mantém a regra visível da largada (os 3 NECTAR não viram, +1 elemento vira) com o menor limiar possível. O valor é configurável em `src/sim/geometry.ts` (`HIVE.tipThresholdKg`) e está registrado em `data/rules/biobuzz-tu07.json`.

## 4. Como calibrar de verdade
1. **CAD da arena** (assim que chegar): a massa da HIVE, o centro de gravidade em relação ao pivô e a posição do amortecedor dão o torque de virada. Com isso, o simulador passa a calcular por torque, sem usar o limiar fixo.
2. **Teste no campo da equipe**, se houver acesso a uma HIVE real:
   - partir da largada (3 NECTAR na CELL de cima);
   - colocar POLLEN um a um e anotar quantos viram a HIVE;
   - repetir 5 vezes e usar a mediana;
   - repetir com a CELL vazia (só POLLEN e só NECTAR).
3. Informar o resultado aqui; o simulador ajusta o limiar.
