const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool for better performance under concurrent load (OEP-NF-001, OEP-NF-003)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20,       // supports 100 concurrent sessions with headroom
  queueLimit: 0,
  timezone: '+00:00',        // store all datetimes in UTC
});

// Test connectivity on startup
pool.getConnection()
  .then((conn) => {
    console.log('Database connected successfully');
    conn.release();
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;
