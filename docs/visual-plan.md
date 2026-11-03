# Plano visual: deixar o Buzz Simulator mais parecido com uma partida real

> Buzz Simulator. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
> Data: 02/11/2026. Base: plano "melhorias v2" da equipe e as imagens de referência do vídeo da RTX.

**Regra:** nada do vídeo oficial é copiado (quadros, texturas, modelos ou áudio). As imagens servem só de referência de estilo: tudo é recriado, ou vem de pacotes com licença livre (CC0 ou MIT) conferida no momento do download e registrada em `vendor/README.md`.

## Bibliotecas e assets candidatos

| Necessidade | Opção | Licença | Por quê |
|---|---|---|---|
| Muitos objetos iguais (bolas, plateia, árvores) | `THREE.InstancedMesh` (já no Three.js) | MIT | 1 chamada de desenho para centenas de objetos: mantém 60 FPS |
| Elementos perfurados | Malha gerada no código, a partir das medidas do desenho AndyMark (26 furos) + `alphaTest` | — | Fiel ao objeto real, sem textura de terceiros |
| Cenário (árvores, cogumelos, flores, grama) | **Kenney Nature Kit** (glTF) | CC0 (conferir no download) | Low-poly leve, combina com o estilo do vídeo |
| HUMAN PLAYERS e plateia | Bonecos low-poly gerados no código (cápsulas + chapéu de apicultor), animados por quadros-chave; alternativa: personagens CC0 da Quaternius | — / CC0 (conferir) | O estilo "boneco liso" do vídeo é fácil de recriar e não pesa |
| Animação | `THREE.AnimationMixer` (já no Three.js) | MIT | Toca as animações dos personagens |
| Céu e luz | `Sky` (exemplos do Three.js) + neblina (`THREE.Fog`) | MIT | Céu e horizonte sem textura pesada |
| Sombra suave e brilho (qualidade Alta) | `postprocessing` (pmndrs) | Zlib | Só liga no preset Alto |
| Sons | Pacotes de áudio da Kenney (impacto, interface) ou sons sintetizados com a Web Audio API | CC0 / — | Sem áudio do vídeo |
| Importação de CAD (Oficina) | `occt-import-js` (já adicionado e testado com os STEPs do POLLEN e do NECTAR) | LGPL-2.1 (módulo separado) | STEP direto no navegador |

## Presets de qualidade

| Item | Baixo (Chromebook) | Médio | Alto |
|---|---|---|---|
| Cenário | Grama plana + silhueta de floresta | + árvores e cogumelos instanciados | + flores e animação de vento |
| Plateia | Faixa colorida | Bonecos instanciados, parados | Bonecos com animação leve |
| HUMAN PLAYERS | Ícone sobre a ALLIANCE AREA | Boneco com animação | Boneco com animação e sombra |
| Elementos | Esfera lisa | Perfurados (alphaTest) | Perfurados + sombra |
| Sombras / pós-processamento | Desligados | Sombra simples | Sombras suaves + brilho |

## Marcos

| Marco | Entrega | Como testar |
|---|---|---|
| 2 — Elementos | POLLEN e NECTAR perfurados (26 furos, medidas do desenho), plástico, instancing, sons de impacto | 56 elementos a 60 FPS no preset Médio |
| 3 — HUMAN PLAYERS | Bonecos vermelho e azul com chapéu de apicultor; estados: esperar, pegar NECTAR, colocar na LOADING ZONE, voltar; respeitam a G426/G427 e os tempos | O NECTAR introduzido pela tecla N passa a ser entregue pelo boneco |
| 4 — Ambiente | Grama, floresta, cogumelos e flores low-poly; plateia instanciada; banners com espaço trocável para a logo da WestSharks; luz e neblina | Trocar o preset e medir o FPS |
| 5 — Experiência | Números animados, ícones de RP, resultados detalhados, ranking de qualificação local, replay curto | Partida completa e replay |

## Situação (02/11/2026)
- **Marco 2:** POLLEN e NECTAR perfurados (textura procedural com os 26 furos), desenhados com uma malha instanciada por tipo (3 chamadas de desenho para todas as bolas). Sons sintetizados com a Web Audio API (`src/render/audio.ts`): batidas das bolas (pelo salto de velocidade), lançamento, TIP com torcida, pontos e buzinas da partida. Tecla M liga e desliga.
- **Marco 3:** HUMAN PLAYERS apicultores (vermelho e azul) com máquina de estados: ir até a caixa de NECTAR da ALLIANCE AREA, pegar, voltar à borda da LOADING ZONE e soltar. O NECTAR só entra no campo no instante em que é solto (G426/G427), e a caixa mostra quantos ainda estão fora do campo.
- **Marco 5:** placar com números animados e "+N", ícones de RP com animação ao conquistar, tela de resultado (recorde e posição no ranking), ranking de qualificação local com troca por arquivo (`src/match/history.ts`) e replay dos últimos 30 s (`src/game/replay.ts`).
- **Iluminação e materiais (03/11/2026), inspirados no FTCSim (Unity WebGL), mas feitos no Three.js:**
  - tonemapping ACES;
  - luz principal quente com sombras suaves (PCF) e contraluz fria;
  - mapa de ambiente (`RoomEnvironment`) para reflexos em metal e plástico;
  - oclusão de ambiente (GTAO) com MSAA no pós-processamento;
  - TILES de espuma com poros, juntas de encaixe e relevo (`bumpMap`);
  - trilhos do chassi com furação e cubos de alumínio nas rodas.

  Por preset:

  | Preset | Sombras | Reflexos | Oclusão de ambiente | Custo por quadro (RTX 4060, 1280 × 720) |
  |---|---|---|---|---|
  | Baixo (padrão em Chromebooks) | — | — | — | igual ao de antes |
  | Médio | 1024 px | sim | — | 5,0 → 6,4 ms |
  | Alto | 2048 px | sim | sim | 5,8 → 9,7 ms |

  Capturas de comparação sem a aba visível: `?autoplay&quality=high&cam=driver` (só no servidor de desenvolvimento) abre direto no treino.
- **Marco 4:** céu, gramado, floresta, cogumelos, flores, arquibancada com plateia (animada no Alto) e banners da WestSharks, tudo em `src/render/environment.ts`, com quantidades por preset. Medido no navegador: cerca de 57 FPS nos três presets (limite da taxa de atualização da tela).
