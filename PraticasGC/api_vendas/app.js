const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3001;

app.use(express.json());

// Conexão com o PostgreSQL.
// O hostname "postgres" é o nome do serviço no docker-compose.yaml
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://user:user123@postgres:5432/vendas'
});

// Cria a tabela se não existir, com algumas tentativas caso o banco ainda esteja subindo
async function initDb(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS produtos (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(255) NOT NULL,
          descricao TEXT,
          preco NUMERIC(10,2) NOT NULL,
          estoque INTEGER DEFAULT 0,
          categoria VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Tabela produtos garantida.');
      return;
    } catch (err) {
      console.log(`Tentativa ${i + 1} de conectar ao Postgres falhou. Aguardando...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Não foi possível conectar ao PostgreSQL.');
}

initDb().catch((err) => console.error(err));

// GET /itens -> lista todos os produtos
app.get('/itens', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM produtos ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /item/:id -> lista um produto específico pelo ID
app.get('/item/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM produtos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /item?id=... -> também lista um produto por query string
app.get('/item', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ erro: 'Informe o parâmetro ?id=' });
    }
    const result = await pool.query('SELECT * FROM produtos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /item -> cadastra um novo produto
app.post('/item', async (req, res) => {
  try {
    const { nome, descricao, preco, estoque, categoria } = req.body;
    const result = await pool.query(
      `INSERT INTO produtos (nome, descricao, preco, estoque, categoria)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nome, descricao, preco, estoque || 0, categoria]
    );
    res.status(201).json({ mensagem: 'Produto cadastrado', produto: result.rows[0] });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// DELETE /item/:id -> exclui um produto
app.delete('/item/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM produtos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json({ mensagem: 'Produto excluído', produto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});