const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const { installSecurity, errorHandler } = require('./middleware/security');
const { getJwtSecret } = require('./security/config');
const authRoutes = require('./routes/authRoutes');
const restaurantesRoutes = require('./routes/restauranteRoutes'); 
const path = require('path');
const platosRoutes = require('./routes/platosRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');
const recomendacionesRoutes = require('./routes/recomendacionesRoutes');
const chatRoutes = require('./routes/chatRoutes');
const pool = require('./models/dbpostgre');


const app = express();
const port = process.env.PORT || 3000;

getJwtSecret();
installSecurity(app);
app.use(express.json({ limit: '32kb' }));


app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.get('/', (req, res) => {
  res.json({ name: 'Beloz API', status: 'ok' });
});

app.get('/salud', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ estado: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Database healthcheck failed.');
    res.status(503).json({ estado: 'error', db: 'error' });
  }
});

app.use('/api/auth', authRoutes); 
app.use('/api/restaurantes', restaurantesRoutes);
app.use('/api/platos', platosRoutes);
app.use('/api/payment', paymentRoutes); 
app.use('/api/pagos', paymentRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/recomendaciones', recomendacionesRoutes);
app.use('/api/chat', chatRoutes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));
}
module.exports = app;
