import express from 'express';
import cors from 'cors';
import {listarEntregas, criarEntrega, atualizarStatusEntrega, listarFuncionarios, criarFuncionario, atualizarFuncionario, deletarFuncionario} from './crud.ts';

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
        res.status(500).json({ error: 'Erro ao buscar entregas' });
    }
});

app.post('/api/entregas', async (req, res) => {
    try {
        const novaEntrega = req.body;
        const id = await criarEntrega(novaEntrega);
        res.status(201).json({ id, ...novaEntrega });
    } catch (error) {
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
        res.status(500).json({ error: 'Erro ao atualizar entrega' });
    }
});

// Rotas Funcionários
app.get('/api/funcionarios', async (req, res) => {
    try {
        const funcionarios = await listarFuncionarios();
        res.json(funcionarios);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar funcionários' });
    }
});

app.post('/api/funcionarios', async (req, res) => {
    try {
        const novoFuncionario = req.body;
        const id = await criarFuncionario(novoFuncionario);
        res.status(201).json({ id, ...novoFuncionario, biometrias: [] });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar funcionário' });
    }
});

app.put('/api/funcionarios/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await atualizarFuncionario(id, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar funcionário' });
    }
});

app.delete('/api/funcionarios/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await deletarFuncionario(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar funcionário' });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});