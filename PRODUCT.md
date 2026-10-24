# Product

## Platform

web

## Users

Pessoas físicas que usam o Atol como hub pessoal do dia a dia: capturar anotações, acompanhar tarefas diárias e acessar outras funções pessoais num só lugar.

## Product Purpose

Atol é um hub pessoal que reúne anotações, tracking diário de tarefas e demais funções pessoais. Sucesso: a pessoa abre o Atol, entende o próprio dia num relance e age (marca, anota, retoma) sem atrito.

## Operating Context

- A superfície atual é a página inicial pós-login (home do usuário autenticado).
- A página de login será especificada pelo usuário depois que a home estiver pronta.
- Uso recorrente, várias vezes ao dia, em desktop e celular.

## Capabilities and Constraints

- Funções confirmadas: anotações e tracking diário de tarefas. "Demais funções" ainda não definidas (em aberto).
- Ainda não há backend nem autenticação; os dados da home são locais até haver API.
- Stack: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui; componentes em `components/ui`.
- Centro da home: uma ilha 3D (WebGL via three / @react-three/fiber) em canvas transparente, sobre o oceano noturno.
- Ícones: lucide-react.

## Brand Commitments

- Nome: Atol (um atol: ilha de coral em forma de anel ao redor de uma laguna). Marca em caixa-alta e baixa, "Atol", nunca "ATOL".
- Conceito: seu dia é uma ilha; tudo o mais fica ao redor dela. Tagline da home: "Seu dia é uma ilha. O resto é mar."
- Identidade: oceano noturno, profundo e luminoso (tema escuro). Ver DESIGN.md.
- Idioma da interface: português do Brasil.

## Evidence on Hand

Nenhum conteúdo real de usuário, depoimento ou métrica. Não fabricar números de uso ou depoimentos.

## Product Principles

1. O dia em um relance: a home mostra o que importa hoje antes de qualquer coisa.
2. Captura sem atrito: anotar ou criar tarefa deve levar um gesto.
3. Pessoal, não corporativo: tom íntimo e calmo, sem jargão de produtividade empresarial.
4. Uma ilha no centro: o dia da pessoa é o chão firme; tarefas, notas e hábitos ficam ao redor dele.
