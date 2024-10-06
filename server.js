const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
//const usersRoutes = require('./routes/usersRoutes');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

// Configuración de sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Configurar rutas
app.use('/api/auth', authRoutes); // Rutas de autenticación
//app.use('/api/users', usersRoutes); // Rutas de usuario

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Error interno del servidor');
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
