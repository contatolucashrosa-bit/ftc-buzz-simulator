# M5a — Java do Android Studio no navegador: resultados

> Buzz Simulator. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
> Medições de 01/11/2026, num PC com Windows 11 e navegador baseado em Chromium. Ainda **não** foram medidas num Chromebook.

## Pergunta
Dá para importar o TeamCode de uma equipe (Java do Android Studio, com Pedro Pathing e RoadRunner) e rodar no navegador, **offline e sem servidor**, sem alterar o código?

## Resposta: sim
Nos três cenários abaixo, o código compilou e rodou no navegador **sem nenhuma alteração**.

| Cenário | Arquivos | javac | TeaVM (Java → JS) | Execução |
|---|---|---|---|---|
| OpMode básico (motores, IMU, telemetria formatada, `RUN_TO_POSITION`) | 1 | 29 ms | 2,7 s | 64 voltas/s; `RUN_TO_POSITION` parou a 5 ticks do alvo |
| Pedro Pathing 3.0.2 (`Mecanum`, `PinpointLocalizer`, `Paths`) | 1 + biblioteca | 59 ms | 3,0 s | Localizador mediu o deslocamento |
| **Quickstart oficial do RoadRunner 1.0, inteiro** (`MecanumDrive`, localizadores, tuning, mensagens) | 21 | 370 ms | 7,4 s | `MecanumDrive`, `LazyImu`, `FlightRecorder` e encoders rodam |
| 63 amostras oficiais do SDK FTC 11 (cada uma isolada) | 63 | 1,8 s no total | — | **24 compilam**; das 39 restantes, 26 dependem de visão (AprilTag/VisionPortal, M7) |

O Quickstart do Pedro também foi verificado com o javac do JDK: o `Constants.java` (onde a equipe configura o robô) compila; só os "tuners" não, porque usam a biblioteca de ajuste automático do Pedro, que sobe um servidor web no Control Hub.

## Como funciona

```mermaid
flowchart LR
  TC[TeamCode da equipe<br/>.java] --> JC[javac no navegador<br/>teavm-javac, WASM]
  LIB[(jars pré-compilados<br/>SDK simulado, Pedro,<br/>RoadRunner, Kotlin)] --> JC
  JC --> TV[TeaVM<br/>bytecode → JavaScript]
  LIB --> TV
  TV --> RUN[OpMode rodando<br/>na página]
  RUN <-- "@JSBody: motores, sensores,<br/>gamepad, telemetria" --> SIM[Simulador<br/>física Rapier]
```

- **SDK FTC simulado** (`src/java/sdk`):
  - escrito do zero;
  - as assinaturas públicas foram conferidas com `javap` no SDK oficial 12.0 (RobotCore e Hardware);
  - cobre OpMode/LinearOpMode, HardwareMap, DcMotor/Ex, Servo, CRServo, IMU, Gamepad (inclusive `aWasPressed()`), Telemetry, ElapsedTime, Range, unidades e RobotLog;
  - simula Pinpoint, SparkFun OTOS, OctoQuad e LynxModule.
- **Ritmo do laço:** `opModeIsActive()`, `idle()` e `sleep()` esperam o **próximo passo da física** (`@Async` + `globalThis.__buzzHw.onNextStep`). Assim, o laço da equipe roda no ritmo da simulação, como num Control Hub, e pausa junto com o jogo.
- **Controle dos motores:** `RUN_TO_POSITION` e `RUN_USING_ENCODER` são controlados pelo simulador, independentes do laço do OpMode, como no hardware real.

## Problemas encontrados e soluções

| Problema | Solução |
|---|---|
| No backend **wasm-gc** do TeaVM, `String.format("%.1f", x)` quebra dentro de `DecimalFormat` (ponteiro nulo) | Usar o **backend JavaScript** do TeaVM, onde a formatação funciona |
| `Thread.sleep(1)` do TeaVM limita o laço a ~66 voltas/s, e um `yield` vazio fica rápido demais | Sincronizar com o passo da física (`Hw.sync()`) |
| A biblioteca de assinaturas do javac do navegador não tem `Object.getClass()`, `wait()` nem `notify()` (usa nomes internos do TeaVM) | `scripts/patch-teavm-classlib.mjs` troca só a assinatura de `java.lang.Object` pela do JDK |
| O RoadRunner pede `RobotLog`, `HardwareMap.getNamesOf`, versão de firmware e `hardwareMap.voltageSensor` não vazio | Implementados no SDK simulado |

## Limitações conhecidas
1. **Diferenças do backend JavaScript:**
   - `%.1f` arredonda "meio para o par" (1,25 vira "1,2"; no Java real, "1,3");
   - um `NullPointerException` não pode ser capturado com `try/catch`: ele encerra o OpMode, o que na prática é o mesmo efeito do robô real;
   - a pilha de chamadas das exceções vem vazia, então as mensagens de erro precisam de outra fonte de linha (a fazer no M5).
2. **Tempo de tradução:** 3 a 7,5 s neste PC, e mais em Chromebook. Mitigação no M5:
   - traduzir num Web Worker, com barra de progresso;
   - guardar o resultado no IndexedDB, para recompilar só quando o código mudar.
3. **Visão:** AprilTag e `VisionPortal` existem desde o M7 (ver "Visão com AprilTag" abaixo). Limelight e processadores próprios com OpenCV ainda não.
4. **Kotlin no código da equipe:** não é suportado, porque não há compilador Kotlin offline no navegador. Bibliotecas Kotlin já compiladas, como o RoadRunner, funcionam.
5. **Tuners do Pedro** (AutoTune com servidor web) não se aplicam ao simulador. O plano é oferecer constantes já ajustadas para o robô simulado.
6. **Navegador:** o compilador usa WasmGC (Chrome/Edge 119+, Firefox 120+, Safari 18.2+). Em navegadores mais antigos, a biblioteca cai automaticamente no `compiler.js`.

## Tamanho do download (gzip)

| Parte | Tamanho | Quando é baixada |
|---|---|---|
| Compilador (`compiler.wasm` + classlibs + JS) | ~4,2 MB | Ao usar código Java pela primeira vez |
| SDK simulado + Pedro | ~0,2 MB | Idem |
| RoadRunner + Dashboard + Kotlin | ~2,0 MB | Só se o projeto usar RoadRunner |
| `compiler.js` (alternativa sem WasmGC) | ~1,4 MB | Só em navegador sem WasmGC |

Total do app com Java e RoadRunner: cerca de 8 MB, dentro da meta de 15 MB. Depois do primeiro acesso, fica guardado (PWA, M12).

## Decisão
**TeaVM (backend JavaScript) como runtime Java único**, com o SDK simulado, Pedro e RoadRunner pré-compilados. A integração com o jogo é o **M5**:
- `HardwareBus` real ligado ao robô simulado;
- Worker de compilação e cache no IndexedDB;
- importação de pasta ou `.zip` do Android Studio;
- escolha de OpModes `@Autonomous` e `@TeleOp`;
- erros de compilação em português, com arquivo e linha.

## Como reproduzir
1. `npm run dev`.
2. Na primeira vez, prepare a pasta `tmp-spike/` com as amostras oficiais do FtcRobotController e o TeamCode do road-runner-quickstart, mais o `manifest.json`. Essa pasta não vai para o git.
3. Abra `http://localhost:5173/m5a.html`. A página roda os quatro testes e imprime os tempos.

## M5 — integração com a partida (02/11/2026)

**Como usar:**
1. **Oficina → Código Java (TeamCode):** importar a pasta do projeto do Android Studio (ou só a `TeamCode`), um `.zip`, ou "Carregar exemplos" (`examples/TeamCode`).
2. **Conferir o mapa de hardware:** os nomes usados no `hardwareMap` são ligados aos dispositivos do robô simulado. A ligação é chutada pelo nome (`fl`, `frontLeft`, `left_front_drive`, `shooter`, `kicker`…) e pode ser corrigida na tabela. Um nome sem ligação aceita comandos e lê zero, então o OpMode não quebra por causa de um mecanismo que o simulador não tem.
3. **Testar a compilação** de cada OpMode. Os erros aparecem em português, com arquivo e linha.
4. **Tela "Jogar":** os OpModes `@Autonomous` aparecem no programa do AUTO, e os `@TeleOp`, no TELEOP.

**Ciclo na partida, como no Driver Station:**

| Momento | AUTO | TELEOP |
|---|---|---|
| Antes de "Iniciar partida" | INIT | — |
| AUTO (30 s) | START → laço | — |
| Transição (8 s) | STOP | INIT |
| TELEOP (2:00) | — | START → laço |
| Fim | — | STOP |

No treino livre, o TeleOp começa direto.

**Peças:**

| Arquivo | Papel |
|---|---|
| `src/java/project.ts` | Lê o projeto: TeamCode, OpModes, `@Disabled`, bibliotecas pelos imports, hardware usado e o mapa de nomes (com testes) |
| `src/java/compileWorker.ts` | javac + TeaVM num Web Worker (a página não trava) |
| `src/java/javaRuntime.ts` | Cache no IndexedDB (SHA-256 do código), tradução dos erros, execução do programa |
| `src/java/hardwareBus.ts` | `globalThis.__buzzHw` ligado ao `RobotHardware`: motores com encoder, servos, IMU e odometria pela pose real |
| `src/java/gamepadSource.ts` | Gamepad físico (mapeamento padrão) ou teclado |

**Gamepad 1 no teclado:**
- W A S D: analógico esquerdo; Q/E: analógico direito;
- setas: direcional; Espaço/F: gatilhos;
- H/G: bumpers; I J K L: Y X A B.

**Tempos medidos:** cerca de 3,5 s por OpMode no servidor de desenvolvimento e 1,9 s no build de produção. Da segunda vez, vem do cache e abre na hora. O laço Java gasta cerca de 1,4 ms por segundo de jogo.

## Visão com AprilTag (M7)

O `VisionPortal` e o `AprilTagProcessor` do SDK funcionam sem mudar o código. Qualquer `WebcamName` ("Webcam 1"...) é a câmera do robô simulado.

**Como a detecção funciona:** não há imagem. A cada quadro (30 fps), `src/sim/vision.ts` calcula onde cada tag aparece numa câmera "pinhole" (Logitech C920 a 640 × 480, `fx = fy = 622`). Uma tag é detectada quando cumpre três condições:
- está inteira dentro da imagem;
- está a até 144 pol;
- está virada para a câmera, com no máximo 70° de inclinação.

**Tags do campo:** IDs 30–45 (36h11, 3,25 pol), 4 por CELL, na face de baixo, a 4,25 pol de centro a centro (tira do CAD am-5888). Elas acompanham a inclinação da HIVE: depois de um TIP, as tags de cima e de baixo trocam de altura. A ordem dos IDs ao longo da CELL é suposição até a conferência com o CAD oficial.

**O que vem em cada detecção:**

| Campo | Conteúdo |
|---|---|
| `ftcPose` | x, y, z, yaw, pitch, roll, range, bearing e elevation, nas unidades de `setOutputUnits` (padrão: polegadas e graus) |
| `metadata` | Nome ("Red HIVE audience 2"), tamanho e posição no campo com as HIVEs na largada. Tags fora da biblioteca vêm sem pose, como no SDK |
| `robotPose` | A pose verdadeira do robô no referencial do simulador (x, y em pol; yaw 0 = +x) |
| `center` | Centro em pixels |

**Montagem da câmera:** vem de `setCameraPose(Position, YawPitchRollAngles)`, na convenção do SDK (pitch -90 = horizontal para a frente). Sem ela, a câmera fica na frente do robô, a 8 pol do chão e inclinada 25° para cima, porque as tags ficam no alto (CELL de cima a ~50 pol).

**Exemplo:** `examples/TeamCode/.../ExemploAprilTag.java` gira até achar a própria HIVE e para a 50 pol, só pela câmera. Na partida, ele achou as tags 34–37 em menos de 1 s e parou a ~51 pol.

**Limitações:** sem oclusão (robôs, elementos e a estrutura da HIVE não tapam a visão) e sem ruído ou borrão. Exposição e ganho são aceitos e ignorados. Não há imagem ao vivo nem Limelight.

**Limitação nova:** dois arquivos `.java` com o mesmo nome em pacotes diferentes ainda não compilam juntos, porque o javac do navegador confere o nome do arquivo sem as pastas.
