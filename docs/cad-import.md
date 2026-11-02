# Importar o CAD do robô

> Buzz Simulator. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
> Data: 02/11/2026.

## Estratégia
A importação segue a mesma ideia do simulador BEE, mas com código próprio (nada do BEE foi copiado):
- O jogo importa formatos de malha, **GLB** e **STL**, direto na Oficina.
- O **STEP** passa por um conversor fora do jogo. No BEE, ele usa ferramentas em Python; aqui, é um script em Node (`scripts/step-to-glb.mjs`) com OpenCascade (`occt-import-js`), sem instalar Python.
- **STEP pequeno** (até 40 MB) também é lido direto no navegador, com o mesmo OpenCascade em WebAssembly.

O modelo importado vira só o **visual** do robô. A física usa uma caixa com as medidas do CAD (limitada a 18 pol, R102) e os **mecanismos** escolhidos na Oficina (tração, intake, lançador e retirada na FLOWER, ver `docs/starter-bots.md`). Assim, um CAD com milhares de peças não pesa na física.

## Passo a passo
1. **Exporte o CAD:**
   - GLB ou STL direto do Onshape, Fusion 360, SolidWorks ou Inventor; ou
   - STEP. Se passar de 40 MB, converta antes:
     ```bash
     npm run cad:convert -- "robo.step" robo.glb
     ```
2. **Abra a Oficina**, arraste o arquivo ou clique em "Escolher arquivo".
3. **Ajuste:**
   - **Unidade:** detectada pelo tamanho (um robô de FTC tem de 10 a 25 pol);
   - **Eixo para cima:** Z para STEP e STL, Y para GLB;
   - **Frente:** gire até a seta branca apontar para o intake.
4. **Confira o R102:** a caixa precisa caber em 18 × 18 × 18 pol. Se não couber, confira a unidade ou se o CAD está com algum mecanismo aberto.
5. **Escolha os mecanismos** e guarde. O robô aparece na tela "Jogar", com a etiqueta "CAD importado".

Os robôs ficam no IndexedDB **deste aparelho**. Nada é enviado para a internet.

## O conversor (`scripts/step-to-glb.mjs`)
**Problema:** o OpenCascade em WebAssembly lê a estrutura de montagens grandes (100 MB ou mais), mas devolve as peças sem malha. Nos starter bots, um único sólido problemático esvaziava todos os outros que eram triangulados junto com ele.

**Solução:**
1. O script lê as entidades do STEP e mantém a **estrutura da montagem inteira** (produtos, posições, cores).
2. A **geometria** é separada em lotes de sólidos (`--batch`, padrão 120). Cada lote vira um STEP pequeno, lido por uma instância nova do OpenCascade.
3. Um lote que falha perde só as próprias peças. Lotes menores (`--batch 8`) isolam as peças ruins.
4. As peças menores que `--min-size` mm (padrão 8: parafusos, porcas) são descartadas.
5. As malhas são juntadas por cor e gravadas num GLB, em metros. Ao guardar na Oficina, o modelo é juntado de novo por cor, para ter poucas chamadas de desenho no jogo.

**Opções:**

| Opção | Padrão | Efeito |
|---|---|---|
| `--batch` | 120 | Sólidos por lote |
| `--min-size` | 8 | Descarta peças menores (mm) |
| `--deflection` | 1,2 | Erro máximo da malha (mm); maior deixa o arquivo mais leve |

## Starter bots
Os três starter bots de referência foram convertidos com este script. Os GLBs ficam em `cad/robots/`, fora do git, porque não temos licença para redistribuir os CADs dos fabricantes. Para jogar com eles, cada equipe baixa o CAD no site do fabricante, converte e importa na Oficina.
