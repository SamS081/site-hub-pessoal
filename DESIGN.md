---
name: Atol
description: Hub pessoal do dia, desenhado como um atol num oceano noturno.
colors:
  background: "#04121a"
  foreground: "#eee6d3"
  raised: "#0b2129"
  popover: "#0d262f"
  muted: "#0e2a33"
  accent: "#123540"
  muted-foreground: "#8fa3a3"
  line: "rgb(238 230 211 / 0.12)"
  input: "rgb(238 230 211 / 0.18)"
  ring: "rgb(47 211 192 / 0.85)"
  lagoon: "#2fd3c0"
  coral: "#ff6a4d"
  sky: "#8fd8ff"
  destructive: "#ff7a66"
  done: "{colors.lagoon}"
  late: "{colors.coral}"
  star: "{colors.coral}"
  nebula: "{colors.sky}"
typography:
  wordmark:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "min(15vw, 25vh, 15.5rem)"
    fontWeight: 800
    fontVariation: "\"wdth\" 90"
    lineHeight: 0.8
    letterSpacing: "-0.04em"
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 2.6vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  figure:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 3.2vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.12em"
  numeric:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "\"tnum\""
rounded:
  md: "9.6px"
  lg: "12px"
  xl: "16.8px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
  button-primary-knob:
    backgroundColor: "{colors.lagoon}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
  glass-button:
    backgroundColor: "rgb(11 33 41 / 0.45)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
  glass-panel:
    backgroundColor: "rgb(9 29 37 / 0.82)"
    textColor: "{colors.foreground}"
    rounded: "16px"
---

# Design System: Atol

## Overview

**Creative North Star: "Seu dia é uma ilha."**

Atol é um atol visto de cima, à noite: um anel de recife em volta de uma laguna, e no meio uma ilha pequena e firme, que é o dia da pessoa. A home é um pôster de uma tela só: a palavra "Atol" enorme, pesada e apertada; a tagline "Seu dia é uma ilha. / O resto é mar."; a ilha 3D no centro, flutuando sobre um oceano escuro e luminoso; e, nas bordas, os números do dia.

O clima é noite no mar: profundo, calmo, com luz que vem de baixo. O fundo é o abismo azul-esverdeado, nunca preto puro; o texto é areia quente, nunca branco frio. A cor acesa é rara e deliberada: turquesa da laguna para o que está feito e o progresso, coral para o "agora" e o que atrasou.

**Key Characteristics:**
- Mundo único escuro (`color-scheme: dark`, `theme-color #04121a`).
- Uma tela, sem rolagem, na home; a ilha 3D vive num canvas transparente, então o oceano (Sky) aparece por trás dela.
- Tipografia de impacto: Bricolage Grotesque pesada e apertada na marca e nos números; Manrope no resto.
- Acento gasto em doses pequenas: uma barra, um ponto, um arco. Nunca uma superfície cheia.
- Vidro escuro só para controles e menus; nunca vidro sobre vidro.

## Colors

Paleta "Laguna": a noite do mar, com areia e duas luzes.

### Neutral
- **Abismo** (`background`, #04121a): chão de toda a interface, `theme-color` do navegador.
- **Areia** (`foreground`, #eee6d3): texto principal, ilha do logo, ação primária. 15.3:1 sobre o abismo.
- **Raso** (`raised`, #0b2129): o único plano acima do chão; base do vidro, cards e popovers (`popover` #0d262f).
- **Areia molhada** (`muted-foreground`, #8fa3a3): texto secundário, rótulos. 7.2:1 sobre o abismo, 6.3:1 sobre o raso, ≥5:1 sobre o brilho do horizonte.
- **Linha** (`line`): areia a 12%. Bordas, divisórias, trilhas.

### Accents
- **Laguna** (`lagoon` = `done`, #2fd3c0): feito, progresso, seção atual, foco (`ring`), cursor, seleção. Barra de tarefas, pontos de hábito, arco do dia já vivido, recife do logo. 10.1:1.
- **Coral** (`coral` = `late` = `star`, #ff6a4d): agora e atrasado. Horário de "A seguir", ponto do "agora" no anel do dia. 6.7:1.
- **Céu** (`sky` = `nebula`, #8fd8ff): secundário frio, para notas e gráficos; pontos bioluminescentes no ar.
- **Erro** (`destructive`, #ff7a66): mensagens de erro, 6.9:1 no painel.

### Named Rules
**The One Glow Rule.** Cada figura gasta no máximo um acento. Se duas coisas vizinhas estão acesas, uma está errada.

**The Coral Is Now Rule.** Coral só marca o agora e o atraso. Nunca decoração, nunca superfície.

**The Colour Plus Form Rule.** Estado nunca é só cor: feito é cheio, futuro é contorno vazio, hoje tem um anel em volta.

## Typography

**Display:** Bricolage Grotesque (variável, eixos `wght`, `opsz`, `wdth`), `--font-display` / `--font-heading`.
**Body:** Manrope, `--font-sans`.
**Mono:** Geist Mono, `--font-mono`.

### Hierarchy
- **Wordmark** (utilitário `wordmark`: Bricolage 800, `wdth 90`, opsz automático, -0.04em, entrelinha 0.8): "Atol" na home, no logo e no título do login. Sempre "Atol", caixa-alta e baixa.
- **Display** (Bricolage 700, -0.03em): tagline da home, títulos.
- **Figure** (Bricolage 700, -0.04em, tabular): números do dia (3/7, 14:30).
- **Label** (Manrope 600, 0.75rem, 0.12–0.14em, versal): rótulos de figura, período do dia, rodapé.
- **Body** (Manrope 400–500): todo o resto.
- **Numeric** (Geist Mono, tabular): horários e contagens em listas.

## Layout

Home de uma tela (`h-dvh`, sem rolagem). Desktop: o palco da ilha centrado atrás de duas colunas; à esquerda a marca, a tagline e o período; à direita as três figuras e o anel do dia. Celular: marca, ilha (ocupa a altura restante), linha de três figuras. Calha `--gutter: clamp(1rem, 2.8vw, 2.75rem)`.

## Scene

O oceano noturno (`components/shared/sky.tsx`, `app/styles/sky.css`): gradiente do abismo até um brilho teal no horizonte (`--horizon: 64%`), água escura com ondulações turquesa lentas e uma coluna de brilho sob a ilha, pontos tênues no ar alto, halo turquesa atrás do centro, névoa baixa e grão fino. Só `transform` e `opacity` animam; com `prefers-reduced-motion` tudo para.

## Logo

Um atol visto de cima: anel de recife (r 10 num viewBox 32, traço 2.75, pontas redondas) quebrado por duas passagens, uma larga no alto à direita e uma estreita embaixo à esquerda, com a ilha sólida no centro. Recife em laguna, ilha em areia (`tone="mono"` usa uma cor só). Entrada: os dois arcos se desenham e a ilha emerge; no hover o recife gira um pouco, como a maré. Favicon: o mesmo símbolo sobre o abismo.

## Components

- **Primário:** pílula areia com texto abismo; no login, um botão redondo laguna carrega a seta.
- **Vidro escuro** (`glass-button`, `glass-panel`): preenchimento abismo-teal translúcido, desfoque com saturação, fio de areia no topo, sombra funda. Brilho laguna sob o ponteiro.
- **Links de seção** (`ink-link`): sublinhado desenhado; o atual em laguna, 2px.
- **Foco:** contorno laguna de 2px, afastado 3px, sempre visível.

## Do's and Don'ts

### Do:
- **Do** manter o fundo em `background` e deixar o canvas da ilha transparente.
- **Do** usar Bricolage pesada e apertada para a marca e os números; Manrope para o resto.
- **Do** gastar laguna e coral em pontos, barras e arcos, um por figura.
- **Do** respeitar `prefers-reduced-motion`, `prefers-reduced-transparency` e `prefers-contrast`.

### Don't:
- **Don't** usar preto ou branco puros.
- **Don't** pintar superfícies grandes de laguna ou coral.
- **Don't** escrever "ATOL" em caixa-alta na marca.
- **Don't** pôr vidro sobre vidro.
