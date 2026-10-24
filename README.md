# Atol

Seu dia é uma ilha. O resto é mar.

Atol é um hub pessoal: tarefas, notas e hábitos ao redor do dia de hoje. A home mostra o dia num relance, com uma ilha 3D no centro de um oceano noturno.

## Rodando

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O login fica em `/login` (ainda sem backend).

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/Base UI, motion, three / @react-three/fiber e lucide-react.

## Onde fica o quê

- `app/`: rotas, `globals.css` (tokens da paleta "Laguna") e `styles/` (oceano, vidro, ilha).
- `components/orbita/`: a home, o login, o logo e a cena.
- `lib/orbita.ts`: dados locais (guardados neste navegador, chave `orbita:v1`).
- `PRODUCT.md` e `DESIGN.md`: produto e identidade visual.

## Verificação

```bash
npx tsc --noEmit
npx eslint app components lib
npx next build
```
