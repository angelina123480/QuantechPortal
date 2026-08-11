require('dotenv').config();
const createApp = require('./src/app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`QuanTech Enterprise Support Portal running at http://localhost:${PORT}`);
});
