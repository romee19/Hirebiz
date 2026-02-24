const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Log device ID from every incoming request
app.use((req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (deviceId) {
    console.log(`📱 Device: ${deviceId}`);
  }
  next();
});


const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",       
  database: "hirebiz_db"
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection error:", err);
  } else {
    console.log("✅ MySQL connected!");
    initializeTables();
  }
});

// Initialize database tables
function initializeTables() {
  // Drop old tables first if they exist
  const dropTables = [
    "DROP TABLE IF EXISTS `new`",
    "DROP TABLE IF EXISTS `inprogress`",
    "DROP TABLE IF EXISTS `completed`",
    "DROP TABLE IF EXISTS `rejected`"
  ];

  dropTables.forEach(dropSql => {
    db.query(dropSql, (err) => {
      if (err) console.error("Error dropping table:", err);
      else console.log("✅ Old table dropped");
    });
  });

  // Table for NEW requests
  const createNewTable = `
    CREATE TABLE IF NOT EXISTS \`new\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      username VARCHAR(255) NOT NULL,
      request_text LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  
  // Table for IN-PROGRESS requests
  const createInProgressTable = `
    CREATE TABLE IF NOT EXISTS \`inprogress\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      username VARCHAR(255) NOT NULL,
      request_text LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  
  // Table for COMPLETED requests
  const createCompletedTable = `
    CREATE TABLE IF NOT EXISTS \`completed\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      username VARCHAR(255) NOT NULL,
      request_text LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  
  // Table for REJECTED requests
  const createRejectedTable = `
    CREATE TABLE IF NOT EXISTS \`rejected\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      username VARCHAR(255) NOT NULL,
      request_text LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  
  // Create all tables
  db.query(createNewTable, (err) => {
    if (err) console.error("❌ Error creating new requests table:", err);
    else console.log("✅ New requests table ready");
  });
  
  db.query(createInProgressTable, (err) => {
    if (err) console.error("❌ Error creating in-progress requests table:", err);
    else console.log("✅ In-progress requests table ready");
  });
  
  db.query(createCompletedTable, (err) => {
    if (err) console.error("❌ Error creating completed requests table:", err);
    else console.log("✅ Completed requests table ready");
  });
  
  db.query(createRejectedTable, (err) => {
    if (err) console.error("❌ Error creating rejected requests table:", err);
    else console.log("✅ Rejected requests table ready");
  });
}

// ✅ LOGIN API (returns role)
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const sql = "SELECT id, username, role FROM users WHERE username=? AND password=? LIMIT 1";
  db.query(sql, [username, password], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: "server_error" });

    if (result.length > 0) {
      console.log("✅ Login success - user:", result[0].username, "role:", JSON.stringify(result[0].role));
      return res.json({
        success: true,
        user: result[0]
      });
    } else {
      return res.json({ success: false });
    }
  });
});

// Test route
app.post("/test", (req, res) => {
  console.log("TEST ENDPOINT HIT");
  res.json({ success: true, message: "test works" });
});

// Simple API test
app.post("/api-test", (req, res) => {
  console.log("API TEST ENDPOINT HIT");
  res.json({ success: true, message: "api test works" });
});

// ✅ CREATE NEW IT REQUEST - Always goes to 'new' table
app.post("/api/it-requests", (req, res) => {
  const { userId, username, requestText } = req.body;

  if (!username || !requestText) {
    return res.status(400).json({ success: false, error: "Missing required fields: username and requestText" });
  }

  const sql = "INSERT INTO `new` (user_id, username, request_text) VALUES (?, ?, ?)";
  db.query(sql, [userId, username, requestText], (err, result) => {
    if (err) {
      console.error("❌ Error creating IT request:", err);
      return res.status(500).json({ success: false, error: "server_error" });
    }
    
    console.log("✅ IT Request created - ID:", result.insertId, "by:", username);
    res.json({
      success: true,
      requestId: result.insertId,
      message: "Request created successfully"
    });
  });
});

// ✅ GET ALL IT REQUESTS - Union queries from all tables
app.get("/api/it-requests", (req, res) => {
  const newSql = "SELECT id, username, request_text, 'new' as status, created_at, updated_at FROM `new`";
  const inProgressSql = "SELECT id, username, request_text, 'inprogress' as status, created_at, updated_at FROM `inprogress`";
  const completedSql = "SELECT id, username, request_text, 'completed' as status, created_at, updated_at FROM `completed`";
  const rejectedSql = "SELECT id, username, request_text, 'rejected' as status, created_at, updated_at FROM `rejected`";
  
  const unionSql = `(${newSql}) UNION (${inProgressSql}) UNION (${completedSql}) UNION (${rejectedSql}) ORDER BY created_at DESC`;
  
  db.query(unionSql, (err, result) => {
    if (err) {
      console.error("❌ Error fetching IT requests:", err);
      return res.status(500).json({ success: false, error: "server_error" });
    }
    
    res.json({
      success: true,
      requests: result
    });
  });
});

// ✅ UPDATE IT REQUEST STATUS - Move from one table to another
app.put("/api/it-requests/:id", (req, res) => {
  const { id } = req.params;
  const { status, fromStatus } = req.body;

  if (!status || !fromStatus) {
    return res.status(400).json({ success: false, error: "Status and fromStatus are required" });
  }

  const statusTableMap = {
    'new': '`new`',
    'inprogress': '`inprogress`',
    'completed': '`completed`',
    'rejected': '`rejected`'
  };

  const fromTable = statusTableMap[fromStatus];
  const toTable = statusTableMap[status];

  if (!fromTable || !toTable) {
    return res.status(400).json({ success: false, error: "Invalid status" });
  }

  // First, get the request from the old table
  const selectSql = `SELECT user_id, username, request_text FROM ${fromTable} WHERE id = ?`;
  db.query(selectSql, [id], (err, result) => {
    if (err || result.length === 0) {
      console.error("❌ Error fetching request:", err);
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    const { user_id, username, request_text } = result[0];

    // Insert into new table
    const insertSql = `INSERT INTO ${toTable} (id, user_id, username, request_text) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`;
    db.query(insertSql, [id, user_id, username, request_text], (err) => {
      if (err) {
        console.error("❌ Error inserting into new table:", err);
        return res.status(500).json({ success: false, error: "server_error" });
      }

      // Delete from old table
      const deleteSql = `DELETE FROM ${fromTable} WHERE id = ?`;
      db.query(deleteSql, [id], (err) => {
        if (err) {
          console.error("❌ Error deleting from old table:", err);
          return res.status(500).json({ success: false, error: "server_error" });
        }

        console.log("✅ IT Request moved - ID:", id, "from:", fromStatus, "to:", status);
        res.json({ success: true, message: "Request updated successfully" });
      });
    });
  });
});

// Catch-all 404 handler
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.path} not found`);
  res.status(404).json({ error: "Route not found", path: req.path, method: req.method });
});

app.listen(3000, () => {
  console.log("✅ API running at http://localhost:3000");
});
