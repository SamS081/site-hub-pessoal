# Atol

Seu dia é uma ilha. O resto é mar.

Atol é um hub pessoal: tarefas, notas e hábitos em torno do dia de hoje. A home mostra o dia num relance, com uma ilha 3D no meio de um oceano noturno.

## Rodando

Precisa de Node.js 22.13 ou mais novo (o banco usa o `node:sqlite` embutido).

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Sem sessão, toda rota leva a `/login`, onde dá para criar uma conta.

### Variáveis de ambiente

Veja [`.env.example`](.env.example). Hoje há só uma, opcional:

| Variável | Padrão | Para quê |
|---|---|---|
| `ATOL_DB_PATH` | `data/atol.db` | arquivo SQLite das contas e sessões |

## Como os dados são guardados

- **Contas e sessões**: no servidor, num arquivo SQLite ([`lib/db.ts`](lib/db.ts)). As senhas são guardadas com scrypt. O banco guarda só o hash SHA-256 do token de sessão.
- **Tarefas, notas e hábitos**: no `localStorage` do navegador, separados por usuário ([`lib/orbita.ts`](lib/orbita.ts), chave `orbita:v1`). Ainda não sincronizam entre aparelhos.
- **Nova senha**: ainda não há envio de e-mail. O link aparece no console do servidor.

## Estrutura

```
app/                  rotas (App Router)
  page.tsx            home  (/)
  tarefas/            /tarefas
  notas/              /notas
  habitos/            /habitos
  login/              /login, mais as server actions de conta
  styles/             oceano, vidro e ilha, importados por globals.css
  globals.css         tokens da paleta "Laguna" e base
components/
  home/               a home: cena 3D, órbitas, barra superior e inferior, stats
  tarefas/            página de tarefas e seletor de horário
  notas/              página de notas e o céu de nuvens
  habitos/            página de hábitos e a cena do campo
  login/              tela de entrar e criar conta
  shared/             peças usadas em mais de uma rota (logo, céu)
  ui/                 primitivos shadcn / Base UI
lib/
  auth.ts             contas, senhas, sessões e reset (só servidor)
  db.ts               conexão e esquema do SQLite (só servidor)
  orbita.ts           tipos e hook dos dados locais do dia
  sound.ts            sons da interface
  utils.ts            cn()
public/               imagens estáticas
docs/                 notas de créditos
proxy.ts              redireciona para /login quando não há cookie de sessão
PRODUCT.md            produto, público e tom
DESIGN.md             identidade visual
```

Cada rota protegida em `app/` só checa a sessão e renderiza um `*-client.tsx`. Esse arquivo carrega a página de verdade, em `components/<rota>/`, só no navegador.

## Stack

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, shadcn com Base UI, motion, three.js com @react-three/fiber e lucide-react.

## Verificação

```bash
npx tsc --noEmit
npm run lint
npm run build
```
