# 🐝 Buzz Simulator

<p align="center">
  <a href="https://github.com/contatolucashrosa-bit/ftc-buzz-simulator">
    <img src="https://img.shields.io/badge/GitHub-ftc--buzz--simulator-181717?style=for-the-badge&logo=github">
  </a>
  <a href="https://www.linkedin.com/in/lucas-hochmann-rosa">
    <img src="https://img.shields.io/badge/LinkedIn-Lucas_Hochmann_Rosa-0A66C2?style=for-the-badge&logo=linkedin">
  </a>
  <a href="#-technologies">
    <img src="https://img.shields.io/badge/TypeScript-7-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  </a>
  <a href="#-technologies">
    <img src="https://img.shields.io/badge/Three.js-0.187-000000?style=for-the-badge&logo=threedotjs&logoColor=white">
  </a>
  <a href="#-technologies">
    <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-2ea44f?style=for-the-badge">
  </a>
</p>

<p align="center"><a href="README.md">🇧🇷 Português</a> · 🇺🇸 English</p>

> Design, program and play FTC — right in the browser. Built in partnership with **[WestSharksFTC #24823](https://www.westsharksftc.com/)**.

---

## ⚡ Quick Start

```bash
git clone https://github.com/contatolucashrosa-bit/ftc-buzz-simulator.git
cd ftc-buzz-simulator
npm install
npm run dev
```

To build and test the production version:

```bash
npm run build
npm run preview
```

---

## 📌 Overview

**Buzz Simulator** is a 3D simulator of the **BIOBUZZ™ presented by RTX** season (*FIRST*® Tech Challenge 2026-2027), entirely in Brazilian Portuguese. High school students practice strategy, driving, CAD and robot programming without needing the physical robot.

It runs in the browser on Windows, macOS, Linux, Chromebooks and tablets, **with no installation, no account and no server**. Everything stays on the device and, after the first visit, it works offline.

The source of truth for the rules is the official *BIOBUZZ Competition Manual*, version **TU07**.

> **Testing version (0.x):** rules, physics and scoring may still change between versions.

---

## ✨ Main Features

- **3D field with the manual's measurements:** 36 TILES, LOADING ZONES, GARDENS, the structure with two bistable HIVEs (±30°) and 4 FLOWERS; 40 POLLEN and 16 perforated NECTAR in the official starting layout (§10.3.1), with real physics.
- **Full match:** 30 s AUTO, 8 s transition and 2:00 TELEOP, with the official clock and buzzers.
- **Automatic scoring** of every line in Table 10-2 and the SWARM, POLLINATOR 1 and 2 RANKING POINTS.
- **Automatic fouls**, with a MAJOR FOUL credited to the opponent:
  - G410: NECTAR in a FLOWER before 1:00;
  - G402: touching an opponent while fully on their side during AUTO;
  - G405: launching an element out of the field, away from your own HIVE;
  - G421: PIN against the wall or another robot for more than 3 s (plus another MAJOR every 3 s).
- **Robots:** an 18 × 18 in practice robot (mecanum) and variants inspired by the public starter bots (goBILDA, REV DUO, AndyMark), with measurements taken from their CAD.
- **Bot robots:** a partner and up to 2 opponents (easy, medium or hard), with an automatic blue HUMAN PLAYER.
- **Local second player:** the red partner can be driven by another person on the same computer or with a second gamepad.
- **Android Studio Java code in the match:** import TeamCode (folder or `.zip`) unchanged, including Pedro Pathing and RoadRunner; INIT, START and STOP follow the match, with telemetry in the HUD and compile errors in Portuguese.
- **AprilTag vision:** the SDK's `VisionPortal` and `AprilTagProcessor` work with the robot's simulated camera. Tags 30–45 sit under the CELLS and follow the HIVE's tilt; `ftcPose`, `robotPose` and `metadata` come out as on the real robot.
- **CAD Workshop:** imports GLB, STL and STEP (up to 40 MB in the browser), orients the model, checks R102 and stores it on the device.
- **Team robots:** export and import robots as `.buzzrobot.zip`, with model, measurements, mechanisms and credit.
- Recreated **Score Overlay**, animated scoreboard, results screen, **replay** of the last 30 s and an exportable local **ranking**.
- **Season scenery** generated in code, inspired by the BIOBUZZ reveal video: the arena in a meadow with hills, a pine forest, ferns, wildflowers and mushrooms; DRIVE TEAMS and HUMAN PLAYERS as beekeepers in full suits (pink for red, lavender for blue), plus synthesized **sounds**.
- **Arena in the video and CAD colors:** light-gray TILES, polycarbonate perimeter with black rails, green FLOWERS with yellow tops and HIVE CELLS framed in the alliance color.
- **Arena-style lighting:** soft shadows, reflections on metal and plastic, ambient occlusion and textured foam TILES, in three quality presets (Low, for Chromebooks, stays light).
- **Controls** for keyboard, gamepad and touch; adjustable graphics quality for modest school computers.

---

## 🧭 Table of Contents

- [Architecture](#️-architecture)
- [Module Map](#️-module-map)
- [Technologies](#-technologies)
- [Match flow](#-match-flow)
- [Project construction rules](#-project-construction-rules)
- [Requirements](#️-requirements)
- [Installation](#-installation)
- [Environment Configuration](#-environment-configuration)
- [Running](#️-running)
- [Deploy and offline use](#-deploy-and-offline-use)
- [Notices](#️-notices)
- [License](#-license)
- [Author](#‍-author)

---

## 🏗️ Architecture

```text
ftc-buzz-simulator/
├── index.html
├── package.json
├── vite.config.ts
├── data/rules/biobuzz-tu07.json    # manual rules as data, with the cited page
├── docs/                           # analysis, roadmap, CAD, Java, bots and starter bots
├── examples/TeamCode/              # sample OpModes to import in the Workshop
├── public/                         # icon and manifest for the installable app
├── scripts/                        # STEP → GLB converter, Java libs build and offline plugin
├── vendor/java-libs/               # in-browser Java compiler and simulated FTC SDK (jar)
└── src/
    ├── rules/      # typed reading of the rules file
    ├── scoring/    # pure scoring engine (Table 10-2)
    ├── match/      # clock, HUMAN PLAYER and match history
    ├── sim/        # physics: field, HIVE, FLOWER, elements and robot
    ├── game/       # match, autonomous routines, bots, fouls and replay
    ├── java/       # simulated FTC SDK, compilation and hardware bridge
    ├── workshop/   # CAD import, storage and robot packages
    ├── render/     # Three.js stage, scenery and sounds
    ├── input/      # keyboard, gamepad and touch
    ├── config/     # preferences and robot variants
    ├── ui/         # screens, Score Overlay and HUD
    └── styles/     # FIRST color tokens and styles
```

The scoring engine does not depend on 3D: it takes a "snapshot" of the match and returns points and RP, so each rule is tested in isolation. Physics runs at a fixed step: the same inputs give the same result.

---

## 🗺️ Module Map

| File | Purpose |
| ------ | ------ |
| `src/game/game.ts` | Match controller: phases, robots, bots, Java, fouls, sounds and replay. |
| `src/scoring/scoring.ts` | Table 10-2 scoring, fouls and RANKING POINTS. |
| `src/game/fouls.ts` | Contact fouls (G402 and G421) from geometry. |
| `src/game/bot.ts` | Bot brain: collect, launch taking turns and park. |
| `src/sim/robot.ts` | Physical robot: drivetrain, intake, launcher and FLOWER mechanism. |
| `src/sim/hive.ts` / `src/sim/flower.ts` | Tipping HIVE (TIP) and FLOWER stack. |
| `src/java/javaRuntime.ts` | Compiles TeamCode in the browser and runs the OpMode. |
| `src/java/hardwareBus.ts` | Connects the Java `hardwareMap` to the simulated motors and sensors. |
| `src/workshop/cadImport.ts` | Reading and normalizing GLB, STL and STEP. |
| `src/workshop/robotPackage.ts` | `.buzzrobot.zip` package for moving robots between computers. |
| `src/ui/app.ts` | Navigation and the Home, Play, Workshop, Leaderboards, Team robots and About screens. |
| `scripts/step-to-glb.mjs` | Converts large STEP assemblies to GLB (`npm run cad:convert`). |
| `scripts/offline-plugin.mjs` | Generates the service worker that makes the app work offline. |

---

## 🧰 Technologies

**Language:** TypeScript 7, with strong typing for the rules.

**3D:** Three.js, which runs on the WebGL 2 of old Chromebooks.

**Physics:** Rapier (WebAssembly), fast and deterministic.

**Build and tests:** Vite 8 and Vitest.

**Java in the browser:** `javac` + TeaVM in a Web Worker, with a simulated FTC SDK, Pedro Pathing and RoadRunner.

**CAD:** `occt-import-js` (OpenCascade in WebAssembly) and `meshoptimizer`.

**Audio:** Web Audio API, with no sound files.

**Font:** bundled Roboto, *FIRST*'s official font, which works offline.

---

## 🎮 Match flow

On the **Play** screen the team picks its number, event, robot, AUTO program (sample or Java), partner (bot, second player or none), opponents and level. The match follows the manual:

| Phase | Duration | Who is in control |
| --- | --- | --- |
| AUTO | 30 s | Chosen program (sample or Java OpMode) |
| Transition | 8 s | Robots stopped (G403) |
| TELEOP | 2:00 | Driver (or Java OpMode); with 1:00 left, FLOWERS and all NECTAR are released |

**Player 1 controls:**

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | W A S D | left stick |
| Turn | Q / E | right stick |
| Intake (hold) | Space | LT or LB |
| Launch the whole hopper in a burst | F | RT |
| FLOWER mechanism: place (practice robot) or removal servo (REV DUO, AndyMark) | G | RB |
| Launcher speed / angle | ↑ ↓ / ← → | D-pad |
| HUMAN PLAYER: introduce NECTAR | N | Y |
| Camera · drive mode · restart · pause | C · O · R · Esc | Back · — · — · Start |
| Scoreboard: broadcast → driver → hidden | V | — |
| "Follow robot" camera: orbit / tilt / zoom | drag the mouse / wheel / double click resets | right stick ↕ tilts; R3 + ↔ orbits |

**Second player controls:** I/K drive, J/L turn, H intake, Y launch (automatic aim at the upper CELL), U uses the FLOWER. Or a second connected gamepad. With a second player and a Java TeleOp, gamepad1's keyboard A/B/X/Y buttons move to 1/2/3/4, and LB/RB to Z/X.

---

## 📐 Project construction rules

- Identifiers, file and folder names, rules JSON keys and technical log messages are in English.
- Interface text and documentation are in Brazilian Portuguese.
- Code comments are in Portuguese, reserved for non-obvious decisions — the "why", not the "what".
- Official FTC terms (POLLEN, NECTAR, HIVE, TIP, FLOWER, GARDEN, LOADING ZONE, LEAVE, PARK) follow the manual's spelling.
- Every implemented rule cites the manual section or page. Anything not in the manual is marked as an **assumption** in `data/rules/biobuzz-tu07.json`.

---

## ⚙️ Requirements

- **To play:** a modern browser with WebGL 2 and WebAssembly (current Chrome, Edge, Firefox or Safari). The fastest Java path uses WasmGC (Chrome/Edge 119+, Firefox 120+, Safari 18.2+).
- **To develop:** Node.js 20 or newer and npm 10 or newer.
- **To rebuild the Java libraries (optional):** a local JDK (`npm run java:libs`).

---

## 🚀 Installation

```bash
npm install
```

---

## 🔐 Environment Configuration

This project uses no environment variables. The application runs entirely in the browser and stores robots, Java projects and matches on the device itself (IndexedDB and localStorage).

---

## ▶️ Running

| Command | What it does |
|---|---|
| `npm run dev` | Development server at `http://localhost:5173` |
| `npm test` | Scoring, clock, HIVE, FLOWER, bot, foul, Java and package tests |
| `npm run build` | Type-checks and builds the static site into `dist/` |
| `npm run preview` | Serves `dist/` locally for checking |
| `npm run cad:convert -- robot.step robot.glb` | Converts a large robot STEP into GLB for the Workshop |
| `npm run java:libs` | Rebuilds the simulated FTC SDK and Pedro Pathing |

---

## 🌐 Deploy and offline use

The contents of `dist/` are a static site and can be published on any free host, such as GitHub Pages.

**Offline (PWA):** on the first visit, the service worker stores the app on the device (about 21 MB, including the Java compiler). After that, Buzz Simulator opens and plays without internet, and the browser offers "Install app". The in-browser STEP reader (7.6 MB) is stored the first time it is used.

---

## ⚠️ Notices

- Buzz Simulator is an **independent project, not affiliated with or endorsed by *FIRST*®**. *FIRST*®, *FIRST*® Tech Challenge and BIOBUZZ™ are registered trademarks of For Inspiration and Recognition of Science and Technology (*FIRST*).
- No protected logo or asset is used. The 3D models and icons were recreated for this project; the colors follow *FIRST*'s official palette. The manual and the official CAD files are not redistributed.
- **Known limitations:**
  - the mass that tips the HIVE is not in the manual; the current value is a tunable assumption;
  - the exact position of the FLOWERS and zones was estimated from the manual's figures, until checked against the official CAD;
  - contact fouls are estimated from physics, with no referee: G405 intent is inferred from the launch direction;
  - vision is geometric: the camera sees tags by field of view, distance (up to 12 ft) and angle, with no occlusion by robots or elements and no noise; Limelight and custom (OpenCV) processors do not exist yet.
- The `dist/` directory is generated by the build and must not be committed.

Detailed documentation (in Portuguese): [roadmap](docs/phase-1-analysis.md) · [Java](docs/m5a-java-runtime.md) · [CAD](docs/cad-import.md) · [starter bots](docs/starter-bots.md) · [bot robots](docs/bots.md).

---

## 📄 License

Licensed under MIT. Feel free to use, modify and distribute it, keeping the copyright notice and crediting **Lucas Hochmann Rosa**.

---

## 👨‍💻 Author

**Lucas Hochmann Rosa**

- Repository: <https://github.com/contatolucashrosa-bit/ftc-buzz-simulator>
- GitHub: <https://github.com/contatolucashrosa-bit>
- LinkedIn: <https://www.linkedin.com/in/lucas-hochmann-rosa>
- E-mail: hrlucas.dev@gmail.com

In partnership with **WestSharksFTC #24823** (SESI SENAI Chapecó).

---
