const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database table
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sweep_data (
        id SERIAL PRIMARY KEY,
        current_index INTEGER NOT NULL,
        current_date TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if there's any data, if not insert default
    const result = await client.query('SELECT COUNT(*) FROM sweep_data');
    if (result.rows[0].count === '0') {
      await client.query(
        'INSERT INTO sweep_data (current_index, current_date) VALUES ($1, $2)',
        [0, '1 January 2024']
      );
    }
    
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

initDB();

// API Routes

// Get current sweep data
app.get('/api/sweep-data', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_index, current_date FROM sweep_data ORDER BY id DESC LIMIT 1'
    );
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ current_index: 0, current_date: '1 January 2024' });
    }
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update sweep data
app.post('/api/sweep-data', async (req, res) => {
  const { current_index, current_date } = req.body;
  
  if (current_index === undefined || !current_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO sweep_data (current_index, current_date) VALUES ($1, $2) RETURNING *',
      [current_index, current_date]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
