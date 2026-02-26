// server.js
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Log device ID
app.use((req, res, next) => {
  const deviceId = req.headers["x-device-id"];
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (deviceId) console.log(`📱 Device: ${deviceId}`);
  next();
});

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "hirebiz_db",
  waitForConnections: true,
  connectionLimit: 10,
});

const statusTableMap = {
  new: "`new`",
  inprogress: "`inprogress`",
  completed: "`completed`",
  rejected: "`rejected`",
};
const validStatuses = Object.keys(statusTableMap);

/* =========================
   INIT TABLES
========================= */
async function initializeTables() {
  const conn = await pool.getConnection();
  try {
    // statuses
    await conn.query(`
      CREATE TABLE IF NOT EXISTS statuses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        status_name VARCHAR(50) UNIQUE NOT NULL,
        display_label VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // requests
    await conn.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        username VARCHAR(255) NOT NULL,
        request_text LONGTEXT NOT NULL,
        reason LONGTEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (status) REFERENCES statuses(status_name),
        INDEX idx_status (status),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      );
    `);

    // status tables (with request_id UNIQUE)
    const makeStatusTable = (name) => `
      CREATE TABLE IF NOT EXISTS \`${name}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT UNIQUE,
        user_id INT,
        username VARCHAR(255) NOT NULL,
        request_text LONGTEXT NOT NULL,
        reason LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;

    await conn.query(makeStatusTable("new"));
    await conn.query(makeStatusTable("inprogress"));
    await conn.query(makeStatusTable("completed"));
    await conn.query(makeStatusTable("rejected"));

    // seed statuses
    const statuses = [
      ["new", "New"],
      ["inprogress", "In Progress"],
      ["completed", "Completed"],
      ["rejected", "Rejected"],
    ];
    for (const [statusName, label] of statuses) {
      await conn.query(
        "INSERT IGNORE INTO statuses (status_name, display_label) VALUES (?, ?)",
        [statusName, label]
      );
    }

    console.log("✅ Tables ready");
  } finally {
    conn.release();
  }
}

/* =========================
   HELPER: ensure mirror tables match requests
   - deletes from all status tables (even old rows with NULL request_id)
   - inserts into the correct one based on requests.status
========================= */
async function syncStatusTablesForRequest(conn, requestId) {
  // 1) load request
  const [rows] = await conn.query("SELECT * FROM requests WHERE id = ?", [
    requestId,
  ]);
  if (rows.length === 0) throw new Error("REQUEST_NOT_FOUND");
  const reqRow = rows[0];

  // 2) Strong delete from ALL status tables:
  //    - delete by request_id
  //    - delete by legacy id
  //    - delete by matching row content (fixes old rows where request_id is NULL)
  const del = async (table) => {
    await conn.query(
      `
      DELETE FROM ${table}
      WHERE request_id = ?
         OR id = ?
         OR (
              (user_id <=> ?)
              AND username = ?
              AND request_text = ?
            )
      `,
      [requestId, requestId, reqRow.user_id, reqRow.username, reqRow.request_text]
    );
  };

  await del("`new`");
  await del("`inprogress`");
  await del("`completed`");
  await del("`rejected`");

  // 3) Insert into correct status table based on requests.status
  const targetTable = statusTableMap[reqRow.status];
  if (!targetTable) throw new Error("INVALID_STATUS_IN_DB");

  await conn.query(
    `
    INSERT INTO ${targetTable}
      (request_id, user_id, username, request_text, reason)
    VALUES (?, ?, ?, ?, ?)
    `,
    [requestId, reqRow.user_id, reqRow.username, reqRow.request_text, reqRow.reason]
  );
}

/* =========================
   AUTH
========================= */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT id, username, role FROM users WHERE username=? AND password=? LIMIT 1",
      [username, password]
    );
    if (rows.length === 0) return res.json({ success: false });
    res.json({ success: true, user: rows[0] });
  } catch (e) {
    console.error("❌ Login error:", e);
    res.status(500).json({ success: false, error: "server_error" });
  }
});

/* =========================
   CREATE REQUEST
   - insert into requests
   - mirror into `new`
========================= */
app.post("/api/it-requests", async (req, res) => {
  const { userId, username, requestText, reason } = req.body;

  if (!username || !requestText) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: username, requestText",
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // insert into requests
    const [result] = await conn.query(
      "INSERT INTO requests (user_id, username, request_text, reason, status) VALUES (?, ?, ?, ?, 'new')",
      [userId || null, username, requestText, reason || null]
    );

    const requestId = result.insertId;

    // mirror to status table based on current status
    await syncStatusTablesForRequest(conn, requestId);

    await conn.commit();
    res.json({ success: true, requestId });
  } catch (e) {
    await conn.rollback();
    console.error("❌ Create request error:", e);
    res.status(500).json({ success: false });
  } finally {
    conn.release();
  }
});

/* =========================
   GET ALL REQUESTS (main table)
========================= */
app.get("/api/it-requests", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, user_id, username, request_text, reason, status, created_at, updated_at FROM requests ORDER BY created_at DESC"
    );
    res.json({ success: true, requests: rows });
  } catch (e) {
    console.error("❌ Get requests error:", e);
    res.status(500).json({ success: false });
  }
});

/* =========================
   GET BY STATUS (uses main table)
========================= */
app.get("/api/it-requests/status/:status", async (req, res) => {
  const { status } = req.params;
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid status" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM requests WHERE status = ? ORDER BY created_at DESC",
      [status]
    );
    res.json({ success: true, requests: rows });
  } catch (e) {
    console.error("❌ Get by status error:", e);
    res.status(500).json({ success: false });
  }
});

/* =========================
   UPDATE STATUS (MOVE)
   - update requests.status
   - then rebuild mirror row into correct status table
========================= */
app.put("/api/it-requests/:id", async (req, res) => {
  const requestId = Number(req.params.id);
  const { status } = req.body;

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid status" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // check exists
    const [exists] = await conn.query("SELECT id FROM requests WHERE id = ?", [
      requestId,
    ]);
    if (exists.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Not found" });
    }

    // 1) update main requests table FIRST
    await conn.query("UPDATE requests SET status = ? WHERE id = ?", [
      status,
      requestId,
    ]);

    // 2) sync mirror tables based on requests.status
    await syncStatusTablesForRequest(conn, requestId);

    await conn.commit();
    console.log(`✅ Request ${requestId} moved to ${status}`);
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    console.error("❌ Update status error:", e);
    res.status(500).json({ success: false });
  } finally {
    conn.release();
  }
});

/* =========================
   OPTIONAL: REBUILD ALL MIRRORS (repair endpoint)
   - clears 4 status tables
   - inserts from requests table based on status
========================= */
app.post("/api/rebuild-status-tables", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query("TRUNCATE TABLE `new`");
    await conn.query("TRUNCATE TABLE `inprogress`");
    await conn.query("TRUNCATE TABLE `completed`");
    await conn.query("TRUNCATE TABLE `rejected`");

    // insert-select per status
    for (const st of validStatuses) {
      const table = statusTableMap[st];
      await conn.query(
        `
        INSERT INTO ${table} (request_id, user_id, username, request_text, reason)
        SELECT id, user_id, username, request_text, reason
        FROM requests
        WHERE status = ?
        `,
        [st]
      );
    }

    await conn.commit();
    res.json({ success: true, message: "Rebuilt status tables from requests" });
  } catch (e) {
    await conn.rollback();
    console.error("❌ Rebuild error:", e);
    res.status(500).json({ success: false });
  } finally {
    conn.release();
  }
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path });
});

/* =========================
   START
========================= */
(async () => {
  try {
    await initializeTables();
    app.listen(3000, () => console.log("✅ API running at http://localhost:3000"));
  } catch (e) {
    console.error("❌ Failed to init:", e);
    process.exit(1);
  }
})();