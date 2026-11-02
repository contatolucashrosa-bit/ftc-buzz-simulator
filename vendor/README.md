# vendor/ — dependências de terceiros empacotadas

Arquivos de terceiros guardados no repositório, para o Buzz Simulator funcionar **offline e sem servidor**.
Nenhum desses arquivos foi escrito por este projeto; cada um mantém a licença original.

## teavm-javac/

Compilador Java para o navegador: `javac` (OpenJDK) + TeaVM.

| Item | Detalhe |
|---|---|
| Origem | https://github.com/Vsprocessing/teavm-javac (fork de https://github.com/konsoletyper/teavm-javac), commit `3503e02` |
| Licença | Apache-2.0 (`teavm-javac/LICENSE`); componentes do OpenJDK sob GPLv2 com Classpath Exception |
| Arquivos copiados | `teavm-javac.js`, `teavm-javac.d.ts`, `compiler.wasm`, `compiler.wasm-runtime.js`, `compiler.js` (alternativa para navegadores sem WasmGC), `compile-classlib-teavm.bin`, `runtime-classlib-teavm.bin` |
| Alteração local | Em `compile-classlib-teavm.bin`, a assinatura de `java.lang.Object` foi trocada pela do JDK, para `getClass()`, `wait()` e `notify()` compilarem. Script: `scripts/patch-teavm-classlib.mjs` (idempotente) |

## java-libs/

Bibliotecas que o código das equipes costuma usar, já compiladas. São geradas por `scripts/build-java-libs.mjs`.

| Arquivo | Origem | Licença |
|---|---|---|
| `buzz-ftc-sdk.jar` | Este projeto (`src/java/sdk`) | MIT |
| `pedropathing-3.0.2.jar` | Fontes `com.pedropathing:core` e `:revhub` 3.0.2 (Maven Central), compilados contra o SDK simulado | BSD-3-Clause (`licenses/pedropathing-LICENSE.txt`) |
| `roadrunner-core-1.0.1.jar`, `roadrunner-actions-1.0.1.jar` | `maven.brott.dev` | MIT (`licenses/roadrunner-LICENSE.txt`) |
| `roadrunner-ftc-0.1.25.jar` | `classes.jar` do AAR em `maven.brott.dev` | BSD-3-Clause-Clear (`licenses/roadrunner-ftc-LICENSE.txt`) |
| `dashboard-core-0.5.1.jar`, `dashboard-0.5.1.jar` | `maven.brott.dev` (o segundo é o `classes.jar` do AAR) | MIT (`licenses/ftc-dashboard-LICENSE.txt`) |
| `kotlin-stdlib-1.9.24.jar` | Maven Central | Apache-2.0 (`licenses/kotlin-LICENSE.txt`) |

Para regenerar (precisa de JDK 17+):

```bash
node scripts/build-java-libs.mjs
```
