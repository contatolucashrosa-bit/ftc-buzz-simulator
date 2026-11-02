// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Ponto de entrada. Fontes empacotadas localmente (funcionam offline).
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/900.css";
import "./styles/main.css";
import { App } from "./ui/app";

new App(document.getElementById("app")!).start();
