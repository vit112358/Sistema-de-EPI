import express from 'express';
import cors from 'cors';
import {listarEntregas, criarEntrega, atualizarStatusEntrega, listarFuncionarios, criarFuncionario, atualizarFuncionario, deletarFuncionario, listarEpis, criarEpi, atualizarEpi, deletarEpi, salvarBiometria, deletarBiometria} from './crud.ts';

const app = express();
const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend rodando em http://localhost:${PORT} (e acessível na rede local)`);
});

// Middleware para permitir que o frontend converse com o backend
app.use(cors());
// Middleware para entender JSON no corpo das requisições (POST)
app.use(express.json());

// Rota para listar todas as entregas
app.get('/api/entregas', async (req, res) => {
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

// Rota para atualizar uma entrega existente (ex: Assinar ou Cancelar)
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

// Rotas Funcionários
app.get('/api/funcionarios', async (req, res) => {
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

// Rotas EPIs
app.get('/api/epis', async (req, res) => {
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

// Rotas Biometrias
app.post('/api/biometrias', async (req, res) => {
    try {
        const id = await salvarBiometria(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (error) {
        console.error('Erro ao salvar biometria:', error);
        res.status(500).json({ error: 'Erro ao salvar biometria' });
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