# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
Install

npm install
npm install sqlite3
npm install -D @types/sqlite3
npm install express cors
npm install -D @types/express @types/cors ts-node

rodar 
npm run dev

npx ts-node src/backend/server.ts


public ip: 163.176.188.254

Deploy do Sistema EPI na Oracle Cloud Free Tier (São Paulo)

1. Criamos uma VM Ubuntu 22.04 na Oracle Cloud
2. Configuramos a rede (IP público, regras de firewall)
3. Instalamos Node.js, nginx, PM2 e tsx no servidor
4. Enviamos o projeto via SCP
5. Rodamos npm install e npm run build
6. Corrigimos o sqlite3 recompilando com build-from-source
7. Iniciamos o backend com PM2 usando tsx
8. Configuramos o nginx como proxy reverso
9. Resolvemos bloqueios do iptables e permissões
10. Movemos o dist para /var/www/html/app

App rodando em http://163.176.188.254 🎉


● URL customizada:
Sim, precisa comprar um domínio (ex: seuapp.com.br) em registros como Registro.br (~R$40/ano) ou GoDaddy. Depois aponta o DNS para o IP 163.176.188.254 e configura o nginx com o domínio. Também dá para adicionar HTTPS
gratuito com Let's Encrypt.


● Existem duas abordagens:

Opção 1 — Instância separada por empresa (mais simples)
- Copia a pasta do app para /home/ubuntu/empresa1, /home/ubuntu/empresa2, etc.
- Cada backend roda numa porta diferente (3001, 3002...)
- Cada empresa tem seu próprio SQLite isolado
- No nginx, configura subdomínios: empresa1.seuapp.com, empresa2.seuapp.com
- Limitação: a VM free tem 1GB de RAM, comporta ~5-10 empresas
