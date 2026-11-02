# Buzz Simulator

[![GitHub](https://img.shields.io/badge/GitHub-contatolucashrosa--bit-181717?logo=github)](https://github.com/contatolucashrosa-bit)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-lucas--hochmann--rosa-0A66C2?logo=linkedin)](https://www.linkedin.com/in/lucas-hochmann-rosa)
[![TypeScript](https://img.shields.io/badge/TypeScript-Three.js%20%2B%20Rapier-3178C6?logo=typescript)](#technologies)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[🇧🇷 Português](README.md) · 🇺🇸 English

> Design, program and play FTC — right in your browser.

Created by **Lucas Hochmann Rosa** ([github.com/contatolucashrosa-bit](https://github.com/contatolucashrosa-bit)), in partnership with **[WestSharksFTC #24823](https://www.westsharksftc.com/)**.

## Overview

Buzz Simulator is a 3D simulator of the **BIOBUZZ™ presented by RTX** season (*FIRST*® Tech Challenge 2026-2027), fully in Brazilian Portuguese. It is built for high school students to practice strategy, driving and, in the next milestones, robot CAD and programming, without needing the physical robot.

**Platform independent:** it runs in the browser on Windows, macOS, Linux, Chromebook and tablets, **with no installation, no account and no server**. Everything stays on the device.

The source of truth for the rules is the official *BIOBUZZ Competition Manual*, version **TU07**.

## Features

Available now (milestones M0–M3):
- **3D field** built from the manual's dimensions:
  - 36 TILES, LOADING ZONES and GARDENS;
  - HIVE structure with two bi-stable HIVEs (±30° seesaws);
  - 4 FLOWERS with rings and scoring volume.
- **40 POLLEN and 16 NECTAR** in the official staging (§10.3.1), with real physics (Rapier).
- **Generic 18 × 18 in robot** with:
  - mecanum drive;
  - an intake for up to 4 elements (G407) that never takes opponent NECTAR (G408);
  - a launcher with trajectory preview;
  - a "place" action for the FLOWERS.
- **Robot variants** inspired by the public BIOBUZZ starter bots (our own 3D models; the CADs are not redistributed):
  - **goBILDA**: drop-center 6WD, Gecko wheel intake that pulls POLLEN out of the FLOWER;
  - **REV DUO**: belt tank drive and a servo that takes POLLEN out of the FLOWER;
  - **AndyMark Robits**: tank drive with omni and stealth wheels, hooded launcher and a release servo.
  - The starter bots cannot strafe or score in the FLOWER. Details in [docs/starter-bots.md](docs/starter-bots.md) (in Portuguese).
- **Workshop with CAD import**: GLB, STL and STEP (up to 40 MB in the browser). Larger assemblies go through the `npm run cad:convert` converter. The model is oriented, checked against R102 and stored on this device; it then shows up on the "Play" screen. Details in [docs/cad-import.md](docs/cad-import.md) (in Portuguese).
- **Event scenery** generated in code: sky with clouds, grass, low-poly forest, mushrooms and flowers, backdrops with WestSharks banners (with a slot for the authorized logo), three bleachers with an audience and, in each ALLIANCE AREA, 2 beekeeper HUMAN PLAYERS, 2 drivers and 1 coach.
- **Perforated POLLEN and NECTAR**: 26 holes, with the diameters from the official drawings.
- **Full match**: 30 s AUTO, 8 s transition and 2:00 TELEOP, with the official clock.
- **Automatic scoring** of every row of Table 10-2:
  - LEAVE, PARK, HIVE TIP (AUTO/TELEOP), CELL, FLOWER (owner + bottom NECTAR bonus) and GARDEN;
  - SWARM, POLLINATOR 1 and 2 **RANKING POINTS**.
- **Automatic fouls**: G410 (NECTAR in a FLOWER before 1:00), with a MAJOR FOUL credited to the opponent.
- **HUMAN PLAYER**: enters NECTAR through the LOADING ZONE, 1 per TIP or all of it with 1:00 left (G426).
- **Natively recreated Score Overlay**: event bar, alliances, RP icons, team numbers and timer.
- **Sample autonomous routines**: LEAVE, LEAVE + PARK, or launching into the HIVE and parking.
- **Controls**: keyboard, gamepad and touch; audience, driver, robot, top-down and free cameras.
- **Adjustable quality** for modest school computers.

Next milestones: Android Studio Java in the browser (with Pedro Pathing and RoadRunner), mechanism tagging on the CAD, local leaderboards, bot robots and a 100% offline mode (PWA). The full roadmap is in [docs/phase-1-analysis.md](docs/phase-1-analysis.md) (in Portuguese).

## Table of Contents

- [Architecture](#architecture)
- [Technologies](#technologies)
- [Project build rules](#project-build-rules)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running](#running)
- [Web Interface](#web-interface)
- [Disclaimer](#disclaimer)
- [Author](#author)
- [License](#license)

## Architecture

```
ftc-buzz-simulator/
├── data/rules/biobuzz-tu07.json   # manual rules as data (points, timing, dimensions), with page citations
├── docs/phase-1-analysis.md       # Phase 1 analysis, decisions and roadmap
├── docs/starter-bots.md           # mechanisms and limitations of the reference starter bots
├── docs/cad-import.md             # Workshop CAD import and the STEP → GLB converter
├── scripts/step-to-glb.mjs        # converter for large STEP assemblies (npm run cad:convert)
├── src/
│   ├── rules/        # typed access to the rules file
│   ├── scoring/      # pure scoring engine (Table 10-2) + tests
│   ├── match/        # match clock and HUMAN PLAYER rules + tests
│   ├── sim/          # physics and models: field, HIVE, FLOWER, elements, robot
│   ├── game/         # match controller and sample autonomous routines
│   ├── render/       # Three.js stage, cameras, scenery and quality presets
│   ├── config/       # preferences, defaults and robot variants (lightweight modules)
│   ├── input/        # keyboard, gamepad and touch
│   ├── ui/           # screens, Score Overlay and HUD
│   └── styles/       # FIRST color tokens and styles
└── cad/              # (not in git) official field CAD, for calibration
```

The scoring engine does not depend on 3D: it takes a "snapshot" of the match and returns points and RP. That is why each rule can be tested in isolation. Physics runs on a fixed step, so the same inputs give the same result.

## Technologies

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Native to the browser; strong typing for the rules |
| 3D | Three.js | Lightweight and runs on WebGL 2 on older Chromebooks |
| Physics | Rapier (WASM) | Fast and deterministic (replays) |
| Build | Vite | Static site that can be hosted for free |
| Tests | Vitest | One test per row of Table 10-2 |
| Font | Roboto (bundled) | Official *FIRST* font, works offline |

## Project build rules

- **Logic in English**: identifiers, file and folder names, keys of the rules JSON and technical log messages.
- **Comments and documentation in Portuguese**: comments only when they explain a "why", and the README and the whole user interface in Brazilian Portuguese.
- Official FTC terms (POLLEN, NECTAR, HIVE, TIP, FLOWER, GARDEN, LOADING ZONE, LEAVE, PARK) follow the manual's spelling.
- Every implemented rule cites the manual's section or page. Anything not in the manual is marked as an **assumption** in `data/rules/biobuzz-tu07.json`.

## Requirements

- **To play:** a modern browser with WebGL 2 and WebAssembly (current Chrome, Edge, Firefox or Safari).
- **To develop:** Node.js 20 or newer.

## Installation

```bash
npm install
```

## Running

| Command | What it does |
|---|---|
| `npm run dev` | Development server at `http://localhost:5173` |
| `npm test` | Tests for the scoring rules, clock and HIVE |
| `npm run build` | Type-checks and generates the static site in `dist/` |
| `npm run preview` | Serves `dist/` locally for checking |

The contents of `dist/` can be published on any free static host, such as GitHub Pages.

## Web Interface

- **Home:** introduction, "Play in the browser" button and supported platforms.
- **Play:** team number, event name, robot, AUTO routine, time between launches and graphics quality.
- **Workshop:** import the robot CAD (GLB, STL or STEP), orient it, check its size (R102), choose the mechanisms and save it.
- **Arena:** Score Overlay at the top, robot HUD (hopper, launcher, released NECTAR) and controls help.

**Controls:**

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | W A S D | left stick |
| Turn | Q / E | right stick |
| Intake (hold) | Space | LT or LB |
| Launch the whole hopper in a burst | F | RT |
| FLOWER mechanism: place (training robot) or retrieval servo (REV DUO, AndyMark) | G | RB |
| Launcher speed / angle | ↑ ↓ / ← → | D-pad |
| HUMAN PLAYER: enter NECTAR | N | Y |
| Camera · drive mode · restart · pause | C · O · R · Esc | Back · — · — · Start |
| Scoreboard: broadcast → driver → hidden | V | — |
| "Follow robot" camera: orbit / tilt / zoom | drag the mouse / wheel / double-click resets | right stick ↕ tilts; R3 + ↔ orbits |

## Disclaimer

- Buzz Simulator is an **independent project, not affiliated with or endorsed by *FIRST*®**. *FIRST*®, *FIRST*® Tech Challenge and BIOBUZZ™ are registered trademarks of For Inspiration and Recognition of Science and Technology (*FIRST*).
- No logos or protected assets are used. The 3D models and icons were recreated for this project; colors follow the official *FIRST* palette.
- **Known limitations:**
  - the mass that tips the HIVE is not in the manual; the current value is a tunable assumption;
  - the exact positions of the FLOWERS and zones were estimated from the manual's figures, until they are checked against the official CAD;
  - in this version, the blue alliance has no robots.

## Author

**Lucas Hochmann Rosa** — [GitHub](https://github.com/contatolucashrosa-bit) · hrlucas.dev@gmail.com

In partnership with **WestSharksFTC #24823** (SESI SENAI Chapecó).

## License

Distributed under the [MIT](LICENSE) license.
