# Atol

Seu dia é uma ilha. O resto é mar.

Atol é um hub pessoal: tarefas, notas e hábitos em torno do dia de hoje. A home mostra o dia num relance, com uma ilha 3D no meio de um oceano noturno.

## Rodando

Precisa de Node.js 20.9 ou mais novo.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Sem sessão, toda rota leva a `/login`, onde dá para criar uma conta. Para desenvolver não é preciso configurar nada: o banco é um arquivo local em `data/atol.db`.

### Variáveis de ambiente

Todas são opcionais em desenvolvimento. Veja [`.env.example`](.env.example).

| Variável | Para quê |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | banco no Turso; sem elas, usa o arquivo local |
| `ATOL_DB_PATH` | onde fica o arquivo local (padrão `data/atol.db`) |
| `SITE_URL` | endereço público do site, usado no link de nova senha |
| `RESEND_API_KEY`, `EMAIL_FROM` | envio do e-mail de nova senha pelo Resend |

## Como os dados são guardados

- **Contas, sessões e tentativas de login**: no servidor, num banco SQLite acessado pelo libSQL ([`lib/db.ts`](lib/db.ts)). Em produção, no Turso; em desenvolvimento, num arquivo local. As senhas são guardadas com scrypt. O banco guarda só o hash SHA-256 dos tokens de sessão e de nova senha. Depois de 5 senhas erradas, o e-mail espera um minuto para tentar de novo.
- **Tarefas, notas e hábitos**: no `localStorage` do navegador, separados por usuário ([`lib/orbita.ts`](lib/orbita.ts), chave `orbita:v1`). Ainda não sincronizam entre aparelhos.
- **Nova senha**: o link é enviado por e-mail quando o Resend está configurado. Sem ele, a recuperação fica desligada em produção; em desenvolvimento o link aparece na própria tela de login.

## Publicando (Vercel + Turso)

1. Crie um banco em [turso.tech](https://turso.tech) e gere um token para ele.
2. Em [vercel.com](https://vercel.com), importe este repositório (o Next.js é detectado sozinho).
3. Em **Settings → Environment Variables**, cadastre `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` e `SITE_URL` (o endereço que a Vercel der ao site).
4. Faça o deploy. As tabelas são criadas no primeiro acesso.
5. Opcional: para ligar a recuperação de senha, crie uma chave no [Resend](https://resend.com), verifique um domínio e cadastre `RESEND_API_KEY` e `EMAIL_FROM`.

Depois disso, cada `git push` na `main` publica uma nova versão.

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
  auth.ts             contas, senhas, sessões, limite de tentativas e reset (só servidor)
  db.ts               conexão (Turso ou arquivo local) e esquema (só servidor)
  mail.ts             envio de e-mail pelo Resend (só servidor)
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
