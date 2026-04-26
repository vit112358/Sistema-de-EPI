import db from './database.ts';

export interface EntregaItem {
    epi_id: number;
    nome: string;
    img: string;
    qtd: number;
}

export interface Entrega {
    id?: number;
    funcionario_id: number;
    funcionario: string;
    status: string;
    tipo_assinatura?: string | null;
    confianca?: number | null;
    data: string;
    itens: EntregaItem[];
}

// CREATE
export function criarEntrega(entrega: Entrega): Promise<number> {
    return new Promise((resolve, reject) => {
        const sqlEntrega = `INSERT INTO entregas (funcionario_id, funcionario, status, tipo_assinatura, confianca, data) VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(sqlEntrega, [
            entrega.funcionario_id,
            entrega.funcionario,
            entrega.status,
            entrega.tipo_assinatura,
            entrega.confianca,
            entrega.data
        ], function (err) {
            if (err) return reject(err);

            const entregaId = this.lastID;

            if (entrega.itens && entrega.itens.length > 0) {
                const stmt = db.prepare(`INSERT INTO entrega_itens (entrega_id, epi_id, nome, img, qtd) VALUES (?, ?, ?, ?, ?)`);
                entrega.itens.forEach(item => {
                    stmt.run(entregaId, item.epi_id, item.nome, item.img, item.qtd);
                });
                stmt.finalize();
            }

            resolve(entregaId);
        });
    });
}

// READ (Listar todas com seus itens)
export function listarEntregas(): Promise<Entrega[]> {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM entregas ORDER BY id DESC`;
        db.all(sql, [], (err, entregasRows: any[]) => {
            if (err) return reject(err);

            const sqlItens = `SELECT * FROM entrega_itens`;
            db.all(sqlItens, [], (errItens, itensRows: any[]) => {
                if (errItens) return reject(errItens);

                // Agrupa os itens dentro das entregas
                const entregasCompletas = entregasRows.map(entrega => ({
                    ...entrega,
                    itens: itensRows.filter(item => item.entrega_id === entrega.id)
                }));

                resolve(entregasCompletas);
            });
        });
    });
}

// UPDATE (Atualizar status e assinatura)
export function atualizarStatusEntrega(id: number, dados: Partial<Entrega>): Promise<void> {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE entregas SET status = ?, tipo_assinatura = ?, confianca = ? WHERE id = ?`;
        db.run(sql, [dados.status, dados.tipo_assinatura, dados.confianca, id], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

// DELETE
export function deletarEntrega(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM entregas WHERE id = ?`;
        db.run(sql, [id], function (err) {
            if (err) reject(err);
            else resolve();
        });

        const sql2 = `DELETE FROM entrega_itens WHERE entrega_id = ?`;
        db.run(sql2, [id], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

export interface Funcionario {
    id?: number;
    nome: string;
    matricula: string;
    setor: string;
    cargo: string;
    email: string;
    telefone: string;
    data_admissao?: string;
    biometrias?: any[];
}

// CREATE Funcionario
export function criarFuncionario(funcionario: Funcionario): Promise<number> {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO funcionarios (nome, matricula, setor, cargo, email, telefone) VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(sql, [
            funcionario.nome,
            funcionario.matricula,
            funcionario.setor,
            funcionario.cargo,
            funcionario.email,
            funcionario.telefone
        ], function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
        });
    });
}

// READ Funcionarios
export function listarFuncionarios(): Promise<Funcionario[]> {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM funcionarios ORDER BY id DESC`;
        db.all(sql, [], (err, rows: any[]) => {
            if (err) return reject(err);

            const sqlBios = `SELECT * FROM biometrias`;
            db.all(sqlBios, [], (errBios, biosRows: any[]) => {
                if (errBios) return reject(errBios);

                const funcCompletos = rows.map(f => ({
                    ...f,
                    admissao: f.data_admissao,
                    biometrias: biosRows.filter(b => b.funcionario_id === f.id)
                }));

                resolve(funcCompletos);
            });
        });
    });
}

// UPDATE Funcionario
export function atualizarFuncionario(id: number, dados: Partial<Funcionario>): Promise<void> {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE funcionarios SET nome = ?, matricula = ?, setor = ?, cargo = ?, email = ?, telefone = ? WHERE id = ?`;
        db.run(sql, [
            dados.nome,
            dados.matricula,
            dados.setor,
            dados.cargo,
            dados.email,
            dados.telefone,
            id
        ], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

// DELETE Funcionario
export function deletarFuncionario(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM funcionarios WHERE id = ?`;
        db.run(sql, [id], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

export interface Epi {
    id?: number;
    nome: string;
    ca?: string;
    categoria?: string;
    estoque: number;
    minimo: number;
    validade?: string;
    img?: string;
    periodicidade?: number;
    descricao?: string;
    norma?: string;
    fabricante?: string;
}

// CREATE EPI
export function criarEpi(epi: Epi): Promise<number> {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO epis (nome, ca, categoria, estoque, minimo, validade, img, periodicidade, descricao, norma, fabricante) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [
            epi.nome, epi.ca, epi.categoria, epi.estoque, epi.minimo,
            epi.validade, epi.img, epi.periodicidade, epi.descricao, epi.norma, epi.fabricante
        ], function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
        });
    });
}

// READ EPIs
export function listarEpis(): Promise<Epi[]> {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM epis ORDER BY id DESC`;
        db.all(sql, [], (err, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// UPDATE EPI
export function atualizarEpi(id: number, dados: Partial<Epi>): Promise<void> {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE epis SET nome = ?, ca = ?, categoria = ?, estoque = ?, minimo = ?, validade = ?, img = ?, periodicidade = ?, descricao = ?, norma = ?, fabricante = ? WHERE id = ?`;
        db.run(sql, [
            dados.nome, dados.ca, dados.categoria, dados.estoque, dados.minimo,
            dados.validade, dados.img, dados.periodicidade, dados.descricao, dados.norma, dados.fabricante,
            id
        ], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

// DELETE EPI
export function deletarEpi(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM epis WHERE id = ?`;
        db.run(sql, [id], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

export interface Biometria {
    id?: number;
    funcionario_id: number;
    tipo: string;
    data: string;
    qualidade: number;
    imagem_base64?: string | null;
}

// CREATE Biometria
export function salvarBiometria(b: Biometria): Promise<number> {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO biometrias (funcionario_id, tipo, data, qualidade, imagem_base64) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [b.funcionario_id, b.tipo, b.data, b.qualidade, b.imagem_base64 ?? null], function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
        });
    });
}

// DELETE Biometria
export function deletarBiometria(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM biometrias WHERE id = ?`;
        db.run(sql, [id], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}