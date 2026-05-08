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


cd /mnt/c/Users/vitor/OneDrive/Projetos/vitejs-vite-hfwmqfrm
bash deploy.sh

● Sim, a forma mais comum é subdomínio por empresa:

empresa1.seuapp.com.br                                                                                                                                                                                                      
empresa2.seuapp.com.br

Como funciona:
1. Compra um domínio (ex: seuapp.com.br)
2. No DNS, cria um wildcard *.seuapp.com.br → 163.176.188.254 — assim qualquer subdomínio já aponta pro servidor
3. No nginx, cada empresa tem seu próprio bloco server com server_name empresa1.seuapp.com.br apontando para a porta do backend dela

● Comandos executados no servidor (via SSH)

# Instalar dependências
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -                                                                                                                                                                                                                                           
sudo apt install -y nodejs nginx build-essential
sudo npm install -g pm2 tsx

# Enviar projeto (WSL local)
scp -i ~/Downloads/ssh-key-2026-04-26.key -r /mnt/c/Users/vitor/OneDrive/Projetos/vitejs-vite-hfwmqfrm/. ubuntu@163.176.188.254:/home/ubuntu/app

# Instalar dependências do projeto
cd /home/ubuntu/app
npm install

# Recompilar sqlite3
npm install sqlite3 --build-from-source

# Build do frontend
npm run build

# Iniciar backend com PM2
pm2 start "tsx src/backend/server.ts" --name backend
pm2 save
pm2 startup

# Copiar dist para pasta do nginx
sudo cp -r /home/ubuntu/app/dist /var/www/html/app
sudo chown -R www-data:www-data /var/www/html/app

# Configurar nginx
sudo nano /etc/nginx/sites-available/app
sudo ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo systemctl reload nginx

# Abrir portas no firewall
sudo ufw allow 80
sudo ufw allow 22
sudo ufw enable

# Remover regra iptables bloqueante
---
Remover regra bloqueante do iptables

O Oracle Cloud adiciona por padrão uma regra que bloqueia todo tráfego de entrada antes do UFW processar. É necessário removê-la.

# 1. Listar as regras para identificar o número da regra REJECT
sudo iptables -L INPUT --line-numbers

Procure a linha com **_REJECT_** e **_icmp-host-prohibited_** — geralmente é a regra número 5:

num  target   prot  source    destination

...

5    REJECT   all   anywhere  anywhere   reject-with icmp-host-prohibited

# 2. Remover a regra pelo número encontrado (ex: 5)
sudo iptables -D INPUT 5

▎ Atenção: o número pode variar. Sempre confirme com o primeiro comando antes de deletar.


Conteúdo do /etc/nginx/sites-available/app
```
server {
    listen 80;

    root /var/www/html/app;
    index index.html;
    
    location /api/ {
      proxy_pass http://localhost:3000;
    }
    
    location / {
      try_files $uri $uri/ /index.html;
    }
}
```

1. Compra do domínio — segurid.com.br comprado no Registro.br
2. DNS — Adicionados dois registros A na zona DNS do Registro.br:
   - segurid.com.br → 163.176.188.254
   - www.segurid.com.br → 163.176.188.254
3. Certificado SSL — Instalado o Certbot (cliente Let's Encrypt) no servidor e gerado o certificado para segurid.com.br e www.segurid.com.br. Validade: 90 dias com renovação automática configurada.
4. Nginx — Atualizado o arquivo /etc/nginx/sites-available/app com:
   - Redirecionamento automático HTTP → HTTPS
   - SSL com o certificado do Let's Encrypt
   - Proxy /api/ → backend na porta 3000
   - Root apontando para /var/www/html/app (onde ficam os arquivos do frontend)
5. Resultado — App acessível em https://segurid.com.br com câmera funcionando via HTTPS.

como subir
npx vite build
bash deploy.sh --skip-build

---                                                                                                                                                                                                                                                                                                         
#2 — apiFetch fora do setState (App.tsx)
Os três handlers (handleSetEntregas, handleSetFuncionarios, handleSetEpis) foram refatorados. Agora leem o estado atual via entregasRef.current / funcionariosRef.current / episRef.current (refs que espelham o state a cada render), computam o diff e disparam os apiFetch antes de chamar               
setEntregas/setFuncionarios/setEpis(next) — que agora é uma chamada pura sem side-effects. Em criarFuncionario foi adicionado funcionariosEnviadosRef.current.add(data.id) para garantir que o dedup guard cobre esse caminho também (#8).

#4 — Token sumindo no refresh (api.ts)                                                                                                                                                                                                                                                                      
_token agora inicia com sessionStorage.getItem('epi_token'). setToken() sincroniza com o sessionStorage. Refresh da página preserva a sessão enquanto a aba estiver aberta.

#5 — 413 silencioso no POST de biometria (server.ts + BiometriaPage.tsx)
express.json({ limit: '2mb' }) resolve o limite de 100 KB. Além disso, a biometria facial agora só envia imagem_base64 quando não há descriptor_json — economiza ~300 KB na requisição quando o reconhecimento funcionou.

#6 — deleteBio atualizava UI mesmo com falha (BiometriaPage.tsx)
setFuncionarios e o toast agora ficam dentro do try, após confirmação de res.ok. Se a API falhar, a biometria permanece na lista e um toast de erro é exibido.

#7 — Rate limiter zerado no restart (database.ts + crud.ts + server.ts)
Tabela login_attempts no SQLite registra IP e timestamp de cada falha. O login handler consulta (bloqueadoPorRateLimit), registra falhas (registrarFalhaLogin) e limpa no sucesso (limparTentativasLogin). Persiste entre restarts do PM2/deploy.
