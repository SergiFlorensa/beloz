const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const restaurantesRoutes = require('./routes/restauranteRoutes'); // Asegúrate de importar las rutas correctas
const path = require('path');
const platosRoutes = require('./routes/platosRoutes');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());


app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Configuración de sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Configurar rutas
app.use('/api/auth', authRoutes); // Rutas de autenticación
app.use('/api/restaurantes', restaurantesRoutes);
app.use('/api/platos', platosRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Error interno del servidor');
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
