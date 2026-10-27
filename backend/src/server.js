require('dotenv').config();

const app = require('./app');
const connectDatabase = require('./config/db');

const port = Number(process.env.PORT || 5000);

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be set before starting the server.');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port number.');
  }

  await connectDatabase(process.env.MONGODB_URI);
  console.log("DB Connected")

  app.listen(port, () => {
    console.log(`Server is running on ${`http://localhost:${port}`}`);
  });
}

startServer().catch((error) => {
  console.error(`Unable to start RepairTrace API: ${error.message}`);
  process.exit(1);
});
