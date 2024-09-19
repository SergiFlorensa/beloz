const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path'); // Importa path para servir archivos estáticos

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());

// Configurar el servidor para servir archivos estáticos
app.use('/images', express.static(path.join(__dirname, 'public/images')));

require('dotenv').config();



const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Asegura la conexión
  },
});


app.use(session({
  secret: '4f8a0e7f3e7cbbd2e7c9eeb1d5c6cfe85b3d1d0f9e7f3b4c08e9d13f7c66d084',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Cambia a `true` en producción con HTTPS
}));

// Registro de usuario
app.post('/register', async (req, res) => {
  const { name, surname, email, password } = req.body;
  try {
    // Verificar si el usuario ya existe
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar nuevo usuario
    const result = await pool.query(
      'INSERT INTO users (name, surname, email, password) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, surname, email, hashedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Inicio de sesión
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Request body:', req.body); // Log del cuerpo de la solicitud
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User found:', user); // Log del usuario encontrado

      // Verificar contraseña
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign({ id: user.id }, 'your_secret_key', { expiresIn: '1h' });
        res.status(200).json({
          token,
          name: user.name,
          surname: user.surname,
          email: user.email
        });
      } else {
        res.status(400).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(400).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});



app.put('/update-email', async (req, res) => {
  const { userId, newEmail } = req.body;
  try {
    // Actualiza el correo electrónico en la base de datos
    const result = await pool.query('UPDATE users SET email = $1 WHERE id = $2 RETURNING *', [newEmail, userId]);

    if (result.rows.length > 0) {
      res.status(200).json({ message: 'Email updated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});








// Cerrar sesión
app.post('/logout', (req, res) => {
  // Para JWT, no necesitas hacer nada en el servidor para cerrar sesión
  res.status(200).json({ message: 'Logged out' });
});

// Ruta protegida de ejemplo
app.get('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, 'your_jwt_secret', (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });

    // Aquí puedes obtener el perfil del usuario usando `decoded.id`
    res.json({ message: 'Profile data', user: decoded });
  });
});

// Crear un nuevo pedido
app.post('/orders', async (req, res) => {
  const { user_id, restaurant_id, total_amount, order_status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO orders (user_id, restaurant_id, total_amount, order_status) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, restaurant_id, total_amount, order_status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Obtener los pedidos de un usuario
app.get('/orders/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM orders WHERE user_id = $1', [user_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Obtener los ítems de menú de un restaurante
app.get('/menu_items/:restaurant_id', async (req, res) => {
  const { restaurant_id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM menu_items WHERE restaurant_id = $1', [restaurant_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Crear un nuevo ítem en un pedido
app.post('/order_items', async (req, res) => {
  const { order_id, menu_item_id, quantity, price } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [order_id, menu_item_id, quantity, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Obtener los ítems de un pedido
app.get('/order_items/:order_id', async (req, res) => {
  const { order_id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Obtener los restaurantes filtrados por país
app.get('/restaurants', async (req, res) => {
  const country = req.query.country;

  let query = 'SELECT * FROM restaurants';
  let params = [];

  if (country) {
    query += ' WHERE country = $1';
    params.push(country);
  }

  try {
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


app.get('/popular_brands', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.popular_brands');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving data from database');
  }
});

app.get('/platos', async (req, res) => {
  const { popular_brand_id } = req.query;

  try {
    const result = await pool.query(
      'SELECT * FROM platos WHERE popular_brand_id = $1',
      [popular_brand_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching platos:', error);
    res.status(500).send('Error fetching platos');
  }
});

// Obtener los restaurantes filtrados por tipo de comida
app.get('/restaurants/filter', async (req, res) => {
  const types = req.query.types.split(',').map(type => type.trim());

  // Genera una lista de condiciones SQL para cada tipo de comida
  const conditions = types.map((type, index) => `type_of_food ILIKE $${index + 1}`).join(' OR ');
  const values = types.map(type => `%${type}%`);

  try {
    // Prepara la consulta SQL
    const query = `SELECT * FROM restaurants WHERE ${conditions}`;
    
    // Ejecuta la consulta con los parámetros dinámicos
    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// Obtener los restaurantes filtrados por nivel de precio
app.get('/restaurants/filter_by_price', async (req, res) => {
  const { priceLevel } = req.query;

  // Validación del parámetro priceLevel
  if (!priceLevel) {
    return res.status(400).json({ error: 'Price level is required' });
  }

  try {
    // Realiza la consulta a la base de datos usando `pool`
    const result = await pool.query(
      'SELECT * FROM restaurants WHERE price_level = $1',
      [priceLevel]
    );

    // Verifica si se encontraron resultados
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No restaurants found for the given price level' });
    }

    // Envía la respuesta con los restaurantes encontrados
    res.json(result.rows);
  } catch (err) {
    // Manejo de errores de la base de datos
    console.error('Database query failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});






app.get('/restaurants/search', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM restaurants 
       WHERE type_of_food ILIKE $1 
          OR name ILIKE $2`,
      [`%${query}%`, `%${query}%`]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No restaurants found' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});









app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
