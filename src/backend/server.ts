import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import {listarEntregas, criarEntrega, atualizarStatusEntrega, listarFuncionarios, criarFuncionario, atualizarFuncionario, deletarFuncionario, listarEpis, criarEpi, atualizarEpi, deletarEpi, salvarBiometria, deletarBiometria, atualizarDescriptorBiometria, buscarImagemBiometria, listarCargos, criarCargo, atualizarCargo, deletarCargo, listarUsuarios, criarUsuario, atualizarUsuario, deletarUsuario, atualizarHashSenha, bloqueadoPorRateLimit, registrarFalhaLogin, limparTentativasLogin, registrarAuditoria, listarAuditLog, contarAuditLog} from './crud.ts';

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET não está definido. Configure a variável de ambiente antes de iniciar o servidor.');
    process.exit(1);
}
const JWT_SECRET: string = process.env.JWT_SECRET;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend rodando em http://localhost:${PORT} (e acessível na rede local)`);
});

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://segurid.com.br',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '2mb' }));

// ─── Login (rota pública) ─────────────────────────────────────────────────────

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const ip = req.ip ?? 'unknown';
    try {
        const { username, senha } = req.body as { username?: string; senha?: string };
        if (!username || !senha) return res.status(400).json({ error: 'Credenciais inválidas' });

        if (await bloqueadoPorRateLimit(ip))
            return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' });

        const users = await listarUsuarios();
        const user = users.find(u => u.username === username);

        if (!user) {
            await bcrypt.compare('dummy', '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012');
            await registrarFalhaLogin(ip);
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

        if (!valido) {
            await registrarFalhaLogin(ip);
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        await limparTentativasLogin(ip);
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

// ─── Autorização ──────────────────────────────────────────────────────────────

const soAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req as any).usuario?.role !== 'admin') {
        res.status(403).json({ error: 'Acesso restrito a administradores' });
        return;
    }
    next();
};

const soOperadorOuAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = (req as any).usuario?.role;
    if (role !== 'admin' && role !== 'operador') {
        res.status(403).json({ error: 'Acesso restrito a operadores e administradores' });
        return;
    }
    next();
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseId(param: string | string[]): number | null {
    const s = Array.isArray(param) ? param[0] : param;
    const n = parseInt(s, 10);
    return isNaN(n) || n <= 0 ? null : n;
}

const ROLES_VALIDOS = ['admin', 'operador', 'colaborador'];
const STATUS_VALIDOS = ['pendente_assinatura', 'assinado', 'cancelado'];
const TIPOS_BIOMETRIA = ['facial', 'digital', 'manual'];

function validarEntregaPost(b: any): string | null {
    if (!Number.isInteger(b.funcionario_id)) return 'funcionario_id deve ser um inteiro';
    if (!b.funcionario?.trim()) return 'funcionario é obrigatório';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.data ?? '')) return 'data inválida (esperado YYYY-MM-DD)';
    if (!Array.isArray(b.itens) || b.itens.length === 0) return 'itens deve ser um array não vazio';
    return null;
}

function validarEntregaPut(b: any): string | null {
    if (b.status !== undefined && !STATUS_VALIDOS.includes(b.status)) return `status inválido; valores aceitos: ${STATUS_VALIDOS.join(', ')}`;
    return null;
}

function validarFuncionario(b: any): string | null {
    if (!b.nome?.trim()) return 'nome é obrigatório';
    if (!b.matricula?.trim()) return 'matrícula é obrigatória';
    if (!b.setor?.trim()) return 'setor é obrigatório';
    if (!b.cargo?.trim()) return 'cargo é obrigatório';
    if (!b.email?.trim()) return 'email é obrigatório';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return 'email inválido';
    if (!b.telefone?.trim()) return 'telefone é obrigatório';
    return null;
}

function validarEpi(b: any): string | null {
    if (!b.nome?.trim()) return 'nome é obrigatório';
    if (typeof b.estoque !== 'number' || b.estoque < 0) return 'estoque deve ser um número >= 0';
    if (typeof b.minimo !== 'number' || b.minimo < 0) return 'minimo deve ser um número >= 0';
    return null;
}

function validarBiometria(b: any): string | null {
    if (!Number.isInteger(b.funcionario_id) || b.funcionario_id <= 0) return 'funcionario_id deve ser um inteiro positivo';
    if (!TIPOS_BIOMETRIA.includes(b.tipo)) return `tipo inválido; valores aceitos: ${TIPOS_BIOMETRIA.join(', ')}`;
    if (!b.data?.trim()) return 'data é obrigatória';
    return null;
}

function validarUsuarioPost(b: any): string | null {
    if (!b.nome?.trim()) return 'nome é obrigatório';
    if (!b.username?.trim()) return 'username é obrigatório';
    if (!b.senha?.trim()) return 'senha é obrigatória';
    if (!ROLES_VALIDOS.includes(b.role)) return `role inválido; valores aceitos: ${ROLES_VALIDOS.join(', ')}`;
    return null;
}

function validarUsuarioPut(b: any): string | null {
    if (b.nome !== undefined && !String(b.nome).trim()) return 'nome não pode ser vazio';
    if (b.username !== undefined && !String(b.username).trim()) return 'username não pode ser vazio';
    if (b.role !== undefined && !ROLES_VALIDOS.includes(b.role)) return `role inválido; valores aceitos: ${ROLES_VALIDOS.join(', ')}`;
    return null;
}

function actor(req: express.Request): { id: number; username: string } {
    const u = (req as any).usuario ?? {};
    return { id: u.id ?? null, username: u.username ?? 'desconhecido' };
}

// ─── Entregas ─────────────────────────────────────────────────────────────────

app.get('/api/entregas', async (req, res) => {
    const limit  = Math.min(Math.max(1, parseInt(req.query.limit  as string) || 500), 1000);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    try {
        const entregas = await listarEntregas(limit, offset);
        res.json(entregas);
    } catch (error) {
        console.error('Erro ao buscar entregas:', error);
        res.status(500).json({ error: 'Erro ao buscar entregas' });
    }
});

app.post('/api/entregas', soOperadorOuAdmin, async (req, res) => {
    const err = validarEntregaPost(req.body);
    if (err) return res.status(400).json({ error: err });
    try {
        const novaEntrega = req.body;
        const id = await criarEntrega(novaEntrega);
        const a = actor(req);
        registrarAuditoria('entrega_criada', 'entrega', id,
            `Para: ${novaEntrega.funcionario} · ${novaEntrega.itens.length} item(ns)`,
            a.id, a.username);
        res.status(201).json({ id, ...novaEntrega });
    } catch (error) {
        console.error('Erro ao criar entregas:', error);
        res.status(500).json({ error: 'Erro ao criar entrega' });
    }
});

app.put('/api/entregas/:id', async (req, res) => {
    const err = validarEntregaPut(req.body);
    if (err) return res.status(400).json({ error: err });
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    const role = (req as any).usuario?.role;
    if (req.body.status === 'cancelado' || req.body.status === 'assinado') {
        if (role !== 'admin' && role !== 'operador')
            return res.status(403).json({ error: 'Ação restrita a operadores e administradores' });
    }
    try {
        await atualizarStatusEntrega(id, req.body);
        const a = actor(req);
        if (req.body.status === 'assinado')
            registrarAuditoria('entrega_assinada', 'entrega', id,
                `Tipo: ${req.body.tipo_assinatura ?? '—'}`, a.id, a.username);
        else if (req.body.status === 'cancelado')
            registrarAuditoria('entrega_cancelada', 'entrega', id, null, a.id, a.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar entrega:', error);
        res.status(500).json({ error: 'Erro ao atualizar entrega' });
    }
});

// ─── Funcionários ─────────────────────────────────────────────────────────────

app.get('/api/funcionarios', async (req, res) => {
    const limit  = Math.min(Math.max(1, parseInt(req.query.limit  as string) || 500), 1000);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    try {
        const funcionarios = await listarFuncionarios(limit, offset);
        res.json(funcionarios);
    } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        res.status(500).json({ error: 'Erro ao buscar funcionários' });
    }
});

app.post('/api/funcionarios', soOperadorOuAdmin, async (req, res) => {
    const err = validarFuncionario(req.body);
    if (err) return res.status(400).json({ error: err });
    try {
        const novoFuncionario = req.body;
        const id = await criarFuncionario(novoFuncionario);
        const a = actor(req);
        registrarAuditoria('funcionario_criado', 'funcionario', id,
            novoFuncionario.nome, a.id, a.username);
        res.status(201).json({ id, ...novoFuncionario, biometrias: [] });
    } catch (error: any) {
        console.error('Erro ao criar funcionário:', error);
        const msg: string = error?.message ?? '';
        if (msg.includes('UNIQUE') && msg.includes('email'))
            return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
        if (msg.includes('UNIQUE') && msg.includes('telefone'))
            return res.status(409).json({ error: 'Este telefone já está cadastrado' });
        if (msg.includes('UNIQUE'))
            return res.status(409).json({ error: 'Dados duplicados: ' + msg });
        res.status(500).json({ error: 'Erro ao criar funcionário: ' + msg });
    }
});

app.put('/api/funcionarios/:id', soOperadorOuAdmin, async (req, res) => {
    const err = validarFuncionario(req.body);
    if (err) return res.status(400).json({ error: err });
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        await atualizarFuncionario(id, req.body);
        const a = actor(req);
        registrarAuditoria('funcionario_atualizado', 'funcionario', id,
            req.body.nome ?? null, a.id, a.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        res.status(500).json({ error: 'Erro ao atualizar funcionário' });
    }
});

app.delete('/api/funcionarios/:id', soOperadorOuAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        await deletarFuncionario(id);
        const a = actor(req);
        registrarAuditoria('funcionario_deletado', 'funcionario', id, null, a.id, a.username);
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

app.post('/api/epis', soOperadorOuAdmin, async (req, res) => {
    const err = validarEpi(req.body);
    if (err) return res.status(400).json({ error: err });
    try {
        const id = await criarEpi(req.body);
        const a = actor(req);
        registrarAuditoria('epi_criado', 'epi', id, req.body.nome, a.id, a.username);
        res.status(201).json({ id, ...req.body });
    } catch (error) {
        console.error('Erro ao criar EPI:', error);
        res.status(500).json({ error: 'Erro ao criar EPI' });
    }
});

app.put('/api/epis/:id', soOperadorOuAdmin, async (req, res) => {
    const err = validarEpi(req.body);
    if (err) return res.status(400).json({ error: err });
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        await atualizarEpi(id, req.body);
        const a = actor(req);
        registrarAuditoria('epi_atualizado', 'epi', id, req.body.nome ?? null, a.id, a.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar EPI:', error);
        res.status(500).json({ error: 'Erro ao atualizar EPI' });
    }
});

app.delete('/api/epis/:id', soOperadorOuAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        await deletarEpi(id);
        const a = actor(req);
        registrarAuditoria('epi_deletado', 'epi', id, null, a.id, a.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar EPI:', error);
        res.status(500).json({ error: 'Erro ao deletar EPI' });
    }
});

// ─── Cargos ───────────────────────────────────────────────────────────────────

app.get('/api/cargos', async (_req, res) => {
    try { res.json(await listarCargos()); }
    catch { res.status(500).json({ error: 'Erro ao buscar cargos' }); }
});
app.post('/api/cargos', soOperadorOuAdmin, async (req, res) => {
    if (!req.body.nome?.trim()) return res.status(400).json({ error: 'nome é obrigatório' });
    try { const id = await criarCargo(req.body.nome); res.status(201).json({ id, nome: req.body.nome }); }
    catch { res.status(500).json({ error: 'Erro ao criar cargo' }); }
});
app.put('/api/cargos/:id', soOperadorOuAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    if (!req.body.nome?.trim()) return res.status(400).json({ error: 'nome é obrigatório' });
    try { await atualizarCargo(id, req.body.nome); res.json({ success: true }); }
    catch { res.status(500).json({ error: 'Erro ao atualizar cargo' }); }
});
app.delete('/api/cargos/:id', soOperadorOuAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try { await deletarCargo(id); res.json({ success: true }); }
    catch { res.status(500).json({ error: 'Erro ao deletar cargo' }); }
});

// ─── Biometrias ───────────────────────────────────────────────────────────────

app.post('/api/biometrias', soOperadorOuAdmin, async (req, res) => {
    const err = validarBiometria(req.body);
    if (err) return res.status(400).json({ error: err });
    try {
        const id = await salvarBiometria(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (error) {
        console.error('Erro ao salvar biometria:', error);
        res.status(500).json({ error: 'Erro ao salvar biometria' });
    }
});

app.get('/api/biometrias/:id/imagem', soOperadorOuAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        const imagem = await buscarImagemBiometria(id);
        res.json({ imagem_base64: imagem });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar imagem' });
    }
});

app.patch('/api/biometrias/:id/descriptor', soOperadorOuAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        await atualizarDescriptorBiometria(id, req.body.descriptor_json);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar descriptor:', error);
        res.status(500).json({ error: 'Erro ao atualizar descriptor' });
    }
});

app.delete('/api/biometrias/:id', soOperadorOuAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        await deletarBiometria(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar biometria:', error);
        res.status(500).json({ error: 'Erro ao deletar biometria' });
    }
});

// ─── Usuários ─────────────────────────────────────────────────────────────────

app.get('/api/users', soAdmin, async (_req, res) => {
    try {
        const users = await listarUsuarios();
        res.json(users.map(({ senha: _s, ...u }) => u));
    } catch { res.status(500).json({ error: 'Erro ao buscar usuários' }); }
});

app.post('/api/users', soAdmin, async (req, res) => {
    const err = validarUsuarioPost(req.body);
    if (err) return res.status(400).json({ error: err });
    try {
        const id = await criarUsuario(req.body);
        const { senha: _s, ...semSenha } = req.body;
        const a = actor(req);
        registrarAuditoria('usuario_criado', 'usuario', id,
            `${req.body.username} (${req.body.role})`, a.id, a.username);
        res.status(201).json({ id, ...semSenha });
    } catch { res.status(500).json({ error: 'Erro ao criar usuário' }); }
});

app.put('/api/users/:id', soAdmin, async (req, res) => {
    const err = validarUsuarioPut(req.body);
    if (err) return res.status(400).json({ error: err });
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    try {
        await atualizarUsuario(id, req.body);
        const a = actor(req);
        registrarAuditoria('usuario_atualizado', 'usuario', id,
            req.body.username ?? null, a.id, a.username);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro ao atualizar usuário' }); }
});

app.delete('/api/users/:id', soAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido' });
    const requester = (req as any).usuario;
    if (requester.id === id)
        return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
    try {
        const users = await listarUsuarios();
        const target = users.find(u => u.id === id);
        if (target?.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1)
            return res.status(400).json({ error: 'Não é possível excluir o único administrador' });
        await deletarUsuario(id);
        const a = actor(req);
        registrarAuditoria('usuario_deletado', 'usuario', id, null, a.id, a.username);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Erro ao deletar usuário' }); }
});

// ─── Auditoria ────────────────────────────────────────────────────────────────

app.get('/api/audit-log', soAdmin, async (req, res) => {
    const limit  = Math.min(Math.max(1, parseInt(req.query.limit  as string) || 50), 500);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const acao    = (req.query.acao    as string) || null;
    const usuario = (req.query.usuario as string) || null;
    try {
        const [data, total] = await Promise.all([
            listarAuditLog({ acao, usuario, limit, offset }),
            contarAuditLog({ acao, usuario }),
        ]);
        res.json({ data, total });
    } catch { res.status(500).json({ error: 'Erro ao buscar log de auditoria' }); }
});