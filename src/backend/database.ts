import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Recriando __filename e __dirname para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Habilita mensagens de erro detalhadas do sqlite3
sqlite3.verbose();

// Define o caminho onde o arquivo do banco de dados será salvo
const dbPath = path.resolve(__dirname, 'bd_epi.sqlite');

// Cria ou conecta ao banco de dados SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
    } else {
        console.log('Conectado com sucesso ao banco de dados SQLite.');
    }
});

// Inicialização das tabelas
const INIT_BIOMETRIAS = `
  CREATE TABLE IF NOT EXISTS biometrias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    funcionario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    data TEXT NOT NULL,
    qualidade REAL,
    imagem_base64 TEXT,
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE CASCADE
  );
`;

const INIT_ENTREGAS = `
  
    CREATE TABLE IF NOT EXISTS entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    funcionario_id INTEGER,
    funcionario TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente_assinatura',
    tipo_assinatura TEXT,
    confianca REAL,
    data TEXT,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const INIT_ENTREGA_ITENS = `
  CREATE TABLE IF NOT EXISTS entrega_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entrega_id INTEGER NOT NULL,
    epi_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    img TEXT,
    qtd INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (entrega_id) REFERENCES entregas(id) ON DELETE CASCADE
  );
`;

const INIT_FUNCIONARIOS = `
  CREATE TABLE IF NOT EXISTS funcionarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    matricula TEXT NOT NULL,
    setor TEXT NOT NULL,
    cargo TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT UNIQUE NOT NULL,
    data_admissao DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const INIT_EPIS = `
  CREATE TABLE IF NOT EXISTS epis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    ca TEXT,
    categoria TEXT,
    estoque INTEGER NOT NULL DEFAULT 0,
    minimo INTEGER NOT NULL DEFAULT 0,
    validade TEXT,
    img TEXT,
    periodicidade INTEGER,
    descricao TEXT,
    norma TEXT,
    fabricante TEXT
  );
`;

// Função para inicializar o banco de dados
export function inicializarBancoDeDados() {
    db.serialize(() => {
        db.run(INIT_BIOMETRIAS, (err) => {
            if (err) console.error('Erro ao criar tabela de biometrias:', err.message);
            else console.log('Tabela "biometrias" verificada/criada com sucesso.');
        });

        // Cria a tabela de entregas
        db.run(INIT_ENTREGAS, (err) => {
            if (err) {
                console.error('Erro ao criar tabela de entregas:', err.message);
            } else {
                console.log('Tabela "entregas" verificada/criada com sucesso.');
            }
        });

        // Cria a tabela de funcionarios
        db.run(INIT_FUNCIONARIOS, (err) => {
            if (err) {
                console.error('Erro ao criar tabela de funcionarios:', err.message);
            } else {
                console.log('Tabela "funcionarios" verificada/criada com sucesso.');
            }
        });

        // Cria a tabela de epis
        db.run(INIT_EPIS, (err) => {
            if (err) {
                console.error('Erro ao criar tabela de epis:', err.message);
            } else {
                console.log('Tabela "epis" verificada/criada com sucesso.');
            }
        });

        // Cria a tabela de itens da entrega
        db.run(INIT_ENTREGA_ITENS, (err) => {
            if (err) {
                console.error('Erro ao criar tabela de itens:', err.message);
            } else {
                console.log('Tabela "entrega_itens" verificada/criada com sucesso.');
            }
        });
    });
}

// Inicializa as tabelas assim que o arquivo é importado
inicializarBancoDeDados();

export default db;