// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Página inicial e página "Conheça a FIRST": o simulador como porta de entrada para o FIRST® Tech Challenge.
// Só texto e links para os sites oficiais; nenhum logotipo da FIRST é usado (exigem autorização).
import { APP, DISCLAIMER } from "../config/app";

const IMG = `${import.meta.env.BASE_URL}img`;

/** Link externo que abre em outra aba. */
const ext = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export function homeHtml(matchesPlayed: number): string {
  return `
    <section class="home-hero">
      <div class="home-hero-text">
        <span class="badge">Temporada <em>FIRST</em>® CANOPY 2026-2027 · BIOBUZZ™</span>
        <h1>${APP.name.replace(/(\S+)$/, "<span>$1</span>")}</h1>
        <p class="lead">Simulador gratuito de <em>FIRST</em>® Tech Challenge, feito a partir da temporada BIOBUZZ™. Treine estratégia, pilote, programe em Java e monte o robô no CAD, direto do navegador, e descubra o que é fazer parte de uma equipe de robótica.</p>
        <div class="actions">
          <button class="btn btn-primary" data-go="setup">Jogar uma partida</button>
          <button class="btn btn-secondary" data-play="practice">Treino livre</button>
          <button class="btn btn-ghost" data-go="first">Conheça a <em>FIRST</em></button>
        </div>
        <ul class="platforms" aria-label="Funciona em">
          <li>Windows</li><li>macOS</li><li>Linux</li><li>Chromebook</li><li>Tablet</li><li>Offline</li>
        </ul>
      </div>
      <figure class="home-hero-shot">
        <img src="${IMG}/arena-driver.jpg" width="1280" height="720" alt="Arena do BIOBUZZ no simulador: HIVE com as CELLS vermelhas e azuis, FLOWERS verdes e robôs no campo, num prado cercado de floresta">
      </figure>
    </section>

    <section class="feature-strip" aria-label="Destaques">
      <div><strong>Regras do manual</strong><span>Pontuação, RANKING POINTS e faltas automáticas citando a regra.</span></div>
      <div><strong>Java de verdade</strong><span>O TeamCode do Android Studio roda sem mudanças, com AprilTag.</span></div>
      <div><strong>Sem instalar nada</strong><span>Sem conta e sem servidor; funciona offline depois do 1º acesso.</span></div>
      <div><strong>Gratuito</strong><span>Código aberto (MIT), feito para escolas e equipes.</span></div>
    </section>

    <h2 class="section-title">Comece por aqui</h2>
    <section class="mode-grid" aria-label="Modos">
      <article class="mode mode-play">
        <h3>Jogar</h3>
        <p>Partida completa com AUTO, TELEOP, placar oficial e robôs-bot como parceiro e adversários. Ou chame um amigo para o 2º controle.</p>
        <button class="btn btn-secondary btn-small" data-go="setup">Configurar partida</button>
      </article>
      <article class="mode mode-code">
        <h3>Programar</h3>
        <p>Importe a pasta ou o .zip do TeamCode e rode seus OpModes @Autonomous e @TeleOp, com telemetria e erros em português.</p>
        <button class="btn btn-secondary btn-small" data-go="workshop">Abrir a Oficina</button>
      </article>
      <article class="mode mode-cad">
        <h3>Montar o robô</h3>
        <p>Traga o CAD (GLB, STL ou STEP), confira o tamanho pelo R102 e jogue com o seu robô. Compartilhe com a equipe por arquivo.</p>
        <button class="btn btn-secondary btn-small" data-go="teamRobots">Robôs da equipe</button>
      </article>
      <article class="mode mode-rank">
        <h3>Competir</h3>
        <p>Ranking de qualificação deste aparelho, recordes e replay dos últimos 30 s. Junte os arquivos da turma num ranking só.</p>
        <button class="btn btn-secondary btn-small" data-go="leaderboard">Ver placares</button>
      </article>
    </section>

    <section class="season">
      <figure><img src="${IMG}/arena-audience.jpg" width="1280" height="720" loading="lazy" alt="Vista da plateia: equipes de apicultores rosa e lavanda dos dois lados da arena"></figure>
      <div>
        <h2>O desafio BIOBUZZ</h2>
        <p>Na temporada de biodiversidade, os robôs fazem o papel de polinizadores. Eles coletam POLLEN do chão e lançam na HIVE da aliança até ela virar (TIP). Também empilham elementos nas FLOWERS para dominá-las, e o HUMAN PLAYER entra com o NECTAR.</p>
        <p>Duas alianças de dois robôs disputam cada partida de 2:38. Ganha quem combina pontos, estratégia e trabalho em equipe.</p>
        <button class="btn btn-secondary btn-small" data-play="practice">Experimentar agora</button>
      </div>
    </section>

    <section class="first-cta">
      <div>
        <h2>Gostou? Isso é só o começo.</h2>
        <p>A <em>FIRST</em>® reúne estudantes do mundo todo em equipes de robótica, com mentores, competições e muita colaboração. No Brasil, os torneios são organizados pelo SESI. Que tal montar ou entrar numa equipe?</p>
      </div>
      <button class="btn btn-primary" data-go="first">Conheça a <em>FIRST</em></button>
    </section>
    ${matchesPlayed > 0 ? `<p class="hint">Partidas jogadas neste aparelho: <strong>${matchesPlayed}</strong>.</p>` : ""}
    <p class="notice">${DISCLAIMER}</p>`;
}

export function firstHtml(): string {
  return `
    <section class="first-page">
      <span class="badge">Inspiração e reconhecimento da ciência e tecnologia</span>
      <h1>Conheça a <em>FIRST</em>®</h1>
      <p class="lead">A <em>FIRST</em>® (<em>For Inspiration and Recognition of Science and Technology</em>) é uma organização sem fins lucrativos, fundada em 1989 por Dean Kamen. Ela usa a robótica para inspirar jovens a se tornarem líderes e inovadores em ciência e tecnologia. Este simulador nasceu dentro de uma equipe <em>FIRST</em> e quer levar mais gente até ela.</p>

      <h2 class="section-title">Os programas</h2>
      <div class="program-grid">
        <article class="program program-fll">
          <h3><em>FIRST</em>® LEGO® League</h3>
          <p class="ages">5 a 16 anos</p>
          <p>Desafios com peças LEGO®, pesquisa e um projeto de inovação. Desafio da temporada: <strong>BIOGLOW</strong>.</p>
        </article>
        <article class="program program-ftc">
          <h3><em>FIRST</em>® Tech Challenge</h3>
          <p class="ages">12 a 18 anos</p>
          <p>Equipes projetam, constroem e programam robôs de até 18 pol para jogos em aliança. Desafio da temporada: <strong>BIOBUZZ™</strong> presented by RTX, que este simulador recria.</p>
        </article>
        <article class="program program-frc">
          <h3><em>FIRST</em>® Robotics Competition</h3>
          <p class="ages">14 a 18 anos</p>
          <p>Robôs de grande porte, construídos em poucas semanas, como num time de engenharia de verdade. Desafio da temporada: <strong>BIOCORE</strong> presented by Haas.</p>
        </article>
      </div>
      <p class="hint">As idades podem variar por região. Fonte: ${ext("https://www.firstinspires.org/first-canopy", "temporada <em>FIRST</em> CANOPY")}.</p>

      <h2 class="section-title">A temporada <em>FIRST</em>® CANOPY 2026-2027</h2>
      <p>O tema é <strong>biodiversidade</strong>: usar ciência, tecnologia e a própria natureza como inspiração para fortalecer as conexões que protegem o planeta. Os três programas têm desafios ligados ao tema, e no BIOBUZZ os robôs fazem o papel dos polinizadores.</p>

      <h2 class="section-title">Os valores</h2>
      <div class="values">
        <div><strong>Gracious Professionalism®</strong><span>Competir com garra e, ao mesmo tempo, respeitar e ajudar os outros. Ganhar sem deixar ninguém para trás.</span></div>
        <div><strong>Coopertition®</strong><span>Cooperar mesmo competindo: no BIOBUZZ, as alianças mudam a cada partida, e o adversário de hoje é o parceiro de amanhã.</span></div>
      </div>

      <h2 class="section-title">No Brasil</h2>
      <p>O <strong>SESI</strong> é o operador oficial dos torneios da <em>FIRST</em> no país, com equipes nos 26 estados e no Distrito Federal, e leva as melhores para o <em>FIRST</em> Championship. A WestSharksFTC #24823, parceira deste projeto, é uma dessas equipes. Notícias da temporada: ${ext("https://noticias.portaldaindustria.com.br/noticias/robotica/sesi-lanca-nova-temporada-da-robotica-educacional-focada-em-biodiversidade/", "SESI lança a temporada de biodiversidade")}.</p>

      <h2 class="section-title">Como participar</h2>
      <ul class="link-list">
        <li>${ext("https://www.firstinspires.org/team-event-search", "Encontrar equipes e eventos perto de você")}</li>
        <li>${ext("https://www.firstinspires.org/programs/ftc/", "Saber mais sobre o <em>FIRST</em> Tech Challenge")}</li>
        <li>${ext("https://www.firstinspires.org/community/volunteers", "Ser voluntário")} — mentores, juízes e árbitros fazem os eventos acontecerem</li>
        <li>${ext("https://www.firstinspires.org/donate", "Apoiar a <em>FIRST</em>")}</li>
      </ul>

      <section class="first-cta">
        <div>
          <h2>Treine aqui, compita de verdade.</h2>
          <p>Use o simulador para aprender as regras, testar estratégias e programar antes de ter o robô. Depois, leve isso para uma equipe.</p>
        </div>
        <button class="btn btn-primary" data-go="setup">Jogar uma partida</button>
      </section>
      <p class="notice">${DISCLAIMER} Os textos desta página foram escritos para o simulador; as informações oficiais estão em ${ext("https://www.firstinspires.org/", "firstinspires.org")}.</p>
    </section>`;
}
