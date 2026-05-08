import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import {listarEntregas, criarEntrega, atualizarStatusEntrega, listarFuncionarios, criarFuncionario, atualizarFuncionario, deletarFuncionario, listarEpis, criarEpi, atualizarEpi, deletarEpi, salvarBiometria, deletarBiometria, atualizarDescriptorBiometria, listarCargos, criarCargo, atualizarCargo, deletarCargo, listarUsuarios, criarUsuario, atualizarUsuario, deletarUsuario, atualizarHashSenha} from './crud.ts';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET ?? 'epi-seguranca-2024-jwt-secret-key';

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend rodando em http://localhost:${PORT} (e acessível na rede local)`);
});

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://segurid.com.br',
        'http://segurid.com.br',
        'http://163.176.188.254',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json());

// ─── Login (rota pública) ─────────────────────────────────────────────────────

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, senha } = req.body as { username?: string; senha?: string };
        if (!username || !senha) return res.status(400).json({ error: 'Credenciais inválidas' });

        const users = await listarUsuarios();
        const user = users.find(u => u.username === username);

        if (!user) {
            await bcrypt.compare('dummy', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012');
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        let valido = false;
        if (user.senha.startsWith('$2')) {
            valido = await bcrypt.compare(senha, user.senha);
        } else {
            valido = user.senha === senha;
            if (valido && user.id) {
                const hash = await bcrypt.hash(senha, 10);
                await atualizarHashSenha(user.id, hash);
            }
        }

        if (!valido) return res.status(401).json({ error: 'Credenciais inválidas' });

        const { senha: _s, ...userSemSenha } = user;
        const token = jwt.sign(
            { id: userSemSenha.id, username: userSemSenha.username, role: userSemSenha.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ ...userSemSenha, token });
    } catch {
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ─── Middleware JWT (todas as rotas abaixo exigem token válido) ───────────────

const autenticar = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Não autorizado' });
        return;
    }
    try {
        (req as any).usuario = jwt.verify(header.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};

app.use(autenticar);

// ─── Entregas ─────────────────────────────────────────────────────────────────

app.get('/api/entregas', async (_req, res) => {
    try {
        const entregas = await listarEntregas();
        res.json(entregas);
    } catch (error) {
        console.error('Erro ao buscar entregas:', error);
        res.status(500).json({ error: 'Erro ao buscar entregas' });
    }
});

app.post('/api/entregas', async (req, res) => {
    try {
        const novaEntrega = req.body;
        const id = await criarEntrega(novaEntrega);
        res.status(201).json({ id, ...novaEntrega });
    } catch (error) {
        console.error('Erro ao criar entregas:', error);
        res.status(500).json({ error: 'Erro ao criar entrega' });
    }
});

app.put('/api/entregas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await atualizarStatusEntrega(id, req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar entrega:', error);
        res.status(500).json({ error: 'Erro ao atualizar entrega' });
    }
});

// ─── Funcionários ─────────────────────────────────────────────────────────────

app.get('/api/funcionarios', async (_req, res) => {
    try {
        const funcionarios = await listarFuncionarios();
        res.json(funcionarios);
    } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        res.status(500).json({ error: 'Erro ao buscar funcionários' });
    }
});

app.post('/api/funcionarios', async (req, res) => {
    try {
        const novoFuncionario = req.body;
        const id = await criarFuncionario(novoFuncionario);
        res.status(201).json({ id, ...novoFuncionario, biometrias: [] });
    } catch (error) {
        console.error('Erro ao criar funcionário:', error);
        res.status(500).json({ error: 'Erro ao criar funcionário' });
    }
});

app.put('/api/funcionarios/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await atualizarFuncionario(id, req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        res.status(500).json({ error: 'Erro ao atualizar funcionário' });
    }
});

app.delete('/api/funcionarios/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await deletarFuncionario(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar funcionário:', error);
        res.status(500).json({ error: 'Erro ao deletar funcionário' });
    }
});

// ─── EPIs ─────────────────────────────────────────────────────────────────────

app.get('/api/epis', async (_req, res) => {
    try {
        const epis = await listarEpis();
        res.json(epis);
    } catch (error) {
        console.error('Erro ao buscar EPIs:', error);
        res.status(500).json({ error: 'Erro ao buscar EPIs' });
    }
});

app.post('/api/epis', async (req, res) => {
    try {
        const id = await criarEpi(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (error) {
        console.error('Erro ao criar EPI:', error);
        res.status(500).json({ error: 'Erro ao criar EPI' });
    }
});

app.put('/api/epis/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await atualizarEpi(id, req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar EPI:', error);
        res.status(500).json({ error: 'Erro ao atualizar EPI' });
    }
});

app.delete('/api/epis/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await deletarEpi(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar EPI:', error);
        res.status(500).json({ error: 'Erro ao deletar EPI' });
    }
});

// ─── Cargos ───────────────────────────────────────────────────────────────────

app.get('/api/cargos', async (_req, res) => {
    try { res.json(await listarCargos()); }
    catch (error) { res.status(500).json({ error: 'Erro ao buscar cargos' }); }
});
app.post('/api/cargos', async (req, res) => {
    try { const id = await criarCargo(req.body.nome); res.status(201).json({ id, nome: req.body.nome }); }
    catch (error) { res.status(500).json({ error: 'Erro ao criar cargo' }); }
});
app.put('/api/cargos/:id', async (req, res) => {
    try { await atualizarCargo(parseInt(req.params.id), req.body.nome); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Erro ao atualizar cargo' }); }
});
app.delete('/api/cargos/:id', async (req, res) => {
    try { await deletarCargo(parseInt(req.params.id)); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Erro ao deletar cargo' }); }
});

// ─── Biometrias ───────────────────────────────────────────────────────────────

app.post('/api/biometrias', async (req, res) => {
    try {
        const id = await salvarBiometria(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (error) {
        console.error('Erro ao salvar biometria:', error);
        res.status(500).json({ error: 'Erro ao salvar biometria' });
    }
});

app.patch('/api/biometrias/:id/descriptor', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await atualizarDescriptorBiometria(id, req.body.descriptor_json);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar descriptor:', error);
        res.status(500).json({ error: 'Erro ao atualizar descriptor' });
    }
});

app.delete('/api/biometrias/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await deletarBiometria(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar biometria:', error);
        res.status(500).json({ error: 'Erro ao deletar biometria' });
    }
});

// ─── Usuários ─────────────────────────────────────────────────────────────────

app.get('/api/users', async (_req, res) => {
    try {
        const users = await listarUsuarios();
        res.json(users.map(({ senha: _s, ...u }) => u));
    } catch { res.status(500).json({ error: 'Erro ao buscar usuários' }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const id = await criarUsuario(req.body);
        const { senha: _s, ...semSenha } = req.body;
        res.status(201).json({ id, ...semSenha });
    } catch { res.status(500).json({ error: 'Erro ao criar usuário' }); }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        await atualizarUsuario(parseInt(req.params.id), req.body);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro ao atualizar usuário' }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await deletarUsuario(parseInt(req.params.id));
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro ao deletar usuário' }); }
});