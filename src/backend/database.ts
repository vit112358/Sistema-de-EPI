import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

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

const INIT_CARGOS = `
  CREATE TABLE IF NOT EXISTS cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
  );
`;

const INIT_USUARIOS = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operador'
  );
`;

const INIT_LOGIN_ATTEMPTS = `
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    momento DATETIME DEFAULT CURRENT_TIMESTAMP
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
        db.run('PRAGMA foreign_keys=ON');
        db.run('PRAGMA journal_mode=WAL');

        db.run(INIT_LOGIN_ATTEMPTS, (err) => {
            if (err) console.error('Erro ao criar tabela login_attempts:', err.message);
            else db.run(`DELETE FROM login_attempts WHERE momento <= datetime('now', '-15 minutes')`);
        });

        db.run(INIT_USUARIOS, (err) => {
            if (err) { console.error('Erro ao criar tabela de usuarios:', err.message); return; }
            console.log('Tabela "usuarios" verificada/criada com sucesso.');
            // seed: garante que sempre exista ao menos um admin
            db.get(`SELECT COUNT(*) as total FROM usuarios`, [], (_e, row: any) => {
                if (row?.total === 0) {
                    bcrypt.hash('admin123', 10).then(hash => {
                        db.run(`INSERT INTO usuarios (nome, username, senha, role) VALUES (?, ?, ?, ?)`,
                            ['Administrador', 'admin', hash, 'admin']);
                    });
                }
            });
        });

        db.run(INIT_CARGOS, (err) => {
            if (err) console.error('Erro ao criar tabela de cargos:', err.message);
            else console.log('Tabela "cargos" verificada/criada com sucesso.');
        });

        db.run(INIT_BIOMETRIAS, (err) => {
            if (err) console.error('Erro ao criar tabela de biometrias:', err.message);
            else {
                console.log('Tabela "biometrias" verificada/criada com sucesso.');
                // migração: adiciona descriptor_json se ainda não existir
                db.all(`PRAGMA table_info(biometrias)`, [], (_e, cols: any[]) => {
                    if (!cols.some(c => c.name === 'descriptor_json')) {
                        db.run(`ALTER TABLE biometrias ADD COLUMN descriptor_json TEXT`);
                    }
                });
            }
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
                db.all(`PRAGMA table_info(funcionarios)`, [], (_e, cols: any[]) => {
                    const names = cols.map((c: any) => c.name);
                    if (!names.includes('email'))
                        db.run(`ALTER TABLE funcionarios ADD COLUMN email TEXT NOT NULL DEFAULT ''`);
                    if (!names.includes('telefone'))
                        db.run(`ALTER TABLE funcionarios ADD COLUMN telefone TEXT NOT NULL DEFAULT ''`);
                });
            }
        });

        // Cria a tabela de epis
        db.run(INIT_EPIS, (err) => {
            if (err) {
                console.error('Erro ao criar tabela de epis:', err.message);
            } else {
                console.log('Tabela "epis" verificada/criada com sucesso.');
                db.all(`PRAGMA table_info(epis)`, [], (_e, cols: any[]) => {
                    if (!cols.some(c => c.name === 'cas_json')) {
                        db.run(`ALTER TABLE epis ADD COLUMN cas_json TEXT`);
                    }
                });
            }
        });

        // Cria a tabela de itens da entrega
        db.run(INIT_ENTREGA_ITENS, (err) => {
            if (err) {
                console.error('Erro ao criar tabela de itens:', err.message);
            } else {
                console.log('Tabela "entrega_itens" verificada/criada com sucesso.');
                db.all(`PRAGMA table_info(entrega_itens)`, [], (_e, cols: any[]) => {
                    if (!cols.some(c => c.name === 'ca')) {
                        db.run(`ALTER TABLE entrega_itens ADD COLUMN ca TEXT`);
                    }
                });
            }
        });
    });
}

// Inicializa as tabelas assim que o arquivo é importado
inicializarBancoDeDados();

export default db;