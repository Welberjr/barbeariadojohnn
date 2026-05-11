# 💈 Barbearia do Johnn

Sistema de gestão profissional para barbearia, com IA integrada ao WhatsApp.

## 🛠️ Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Banco**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Validação**: Zod + React Hook Form
- **Gráficos**: Recharts
- **Ícones**: Lucide
- **Toasts**: Sonner

## 🚀 Como rodar localmente

```powershell
# 1. Clone e entre na pasta
cd "C:\Users\welbe\OneDrive\Documentos\GitHub\barbearia-do-johnn"

# 2. Copie o env e preencha
copy .env.example .env.local
# Edite .env.local com suas chaves do Supabase

# 3. Instale dependências (já feito)
npm install

# 4. Rode em dev
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 📁 Estrutura

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/              # Tela de login
│   ├── admin/                  # Painel admin (protegido)
│   │   ├── _components/        # Sidebar e Topbar
│   │   └── page.tsx            # Dashboard
│   ├── layout.tsx              # Layout raiz
│   ├── page.tsx                # Redirect → /login
│   └── globals.css             # Tailwind + tema dark
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Cliente browser
│   │   ├── server.ts           # Cliente server
│   │   └── middleware.ts       # Refresh sessão
│   └── utils.ts                # cn(), formatadores
└── middleware.ts               # Auth guard
```

## 🎨 Tema

**Cyber Dark + Dourado** (casa com a logo da barbearia)

- `--bg-DEFAULT`: `#0A0E1A` (fundo)
- `--primary-DEFAULT`: `#FB944D` (laranja)
- `--gold-DEFAULT`: `#D4A04F` (dourado)

## 📚 Documentação completa

Toda a documentação está no Obsidian Vault em:
`C:\Users\welbe\OneDrive\Documentos\Obsidian Vault\Claude\BarbeariaDoJohnn\`

- `Contexto.md` — visão geral do projeto
- `Pendencias.md` — backlog
- `Decisoes.md` — decisões arquiteturais
- `Sessoes.md` — registro cronológico
- `database/*.sql` — schema do banco

## 📞 Cliente

**Jonathan (Barbearia do Johnn)**
- QI QL 20 Loja 08, Taguatinga, Brasília
- (61) 99264-3078
- @barbearia_dojohnn
