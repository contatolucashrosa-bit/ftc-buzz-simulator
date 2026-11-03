// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Ponto de entrada. Fontes empacotadas localmente (funcionam offline).
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/900.css";
import "./styles/main.css";
import { App } from "./ui/app";

new App(document.getElementById("app")!).start();

// Modo offline (PWA): guarda o app neste aparelho depois do primeiro acesso. Só no build de produção,
// para não atrapalhar o recarregamento automático do servidor de desenvolvimento.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // sem service worker (ex.: aberto via file://): o app continua funcionando online
    });
  });
}
