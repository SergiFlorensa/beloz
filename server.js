const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const restaurantesRoutes = require('./routes/restauranteRoutes'); 
const path = require('path');
const platosRoutes = require('./routes/platosRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');


dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());


app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use('/api/auth', authRoutes); 
app.use('/api/restaurantes', restaurantesRoutes);
app.use('/api/platos', platosRoutes);
app.use('/api/payment', paymentRoutes); 
app.use('/api/pedidos', pedidosRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Error interno del servidor');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
