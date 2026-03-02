// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");

// ✅ use your separate pool file (db.js)
// (put db.js in the SAME folder as server.js)
const pool = require("./db");

const app = express();

// ✅ CORS (allow all for dev). You can tighten later.
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-device-id"],
  })
);

app.use(express.json());

// ✅ Log device ID + request
app.use((req, res, next) => {
  const deviceId = req.headers["x-device-id"];
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (deviceId) console.log(`📱 Device: ${deviceId}`);
  next();
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
    // ✅ statuses
    await conn.query(`
      CREATE TABLE IF NOT EXISTS statuses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        status_name VARCHAR(50) UNIQUE NOT NULL,
        display_label VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ✅ requests
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

    // ✅ status tables (with request_id UNIQUE)
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

    // ✅ seed statuses
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

    /* =========================
       ✅ FLOORPLANS TABLE
       - room_id is unique per user
       - layout_json stores your floorplan JSON (cubicles/toolbox/etc)
    ========================= */
    await conn.query(`
      CREATE TABLE IF NOT EXISTS floorplans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        room_id VARCHAR(100) NOT NULL,
        layout_json LONGTEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_room (user_id, room_id),
        INDEX idx_user_id (user_id),
        INDEX idx_room_id (room_id)
      );
    `);

    console.log("✅ Tables ready (requests + floorplans)");
  } finally {
    conn.release();
  }
}

/* =========================
   HELPER: ensure mirror tables match requests
========================= */
async function syncStatusTablesForRequest(conn, requestId) {
  const [rows] = await conn.query("SELECT * FROM requests WHERE id = ?", [
    requestId,
  ]);
  if (rows.length === 0) throw new Error("REQUEST_NOT_FOUND");
  const reqRow = rows[0];

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
   REQUESTS API
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

    const [result] = await conn.query(
      "INSERT INTO requests (user_id, username, request_text, reason, status) VALUES (?, ?, ?, ?, 'new')",
      [userId || null, username, requestText, reason || null]
    );

    const requestId = result.insertId;

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

app.put("/api/it-requests/:id", async (req, res) => {
  const requestId = Number(req.params.id);
  const { status } = req.body;

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid status" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [exists] = await conn.query("SELECT id FROM requests WHERE id = ?", [
      requestId,
    ]);
    if (exists.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Not found" });
    }

    await conn.query("UPDATE requests SET status = ? WHERE id = ?", [
      status,
      requestId,
    ]);

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

app.post("/api/rebuild-status-tables", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query("TRUNCATE TABLE `new`");
    await conn.query("TRUNCATE TABLE `inprogress`");
    await conn.query("TRUNCATE TABLE `completed`");
    await conn.query("TRUNCATE TABLE `rejected`");

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
   ✅ FLOORPLAN API (REST)
   Typical endpoints:
   POST /floorplans/:roomId (save)
   GET  /floorplans/:roomId (load)
   GET  /floorplans?userId=... (list)
========================= */

// ✅ SAVE floorplan
app.post("/floorplans/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const { userId, layout } = req.body;

  if (!userId || !roomId || !layout) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: userId, roomId, layout",
    });
  }

  try {
    const layoutJson = JSON.stringify(layout);

    // Upsert: insert if not exists, else update + increment version
    await pool.query(
      `
      INSERT INTO floorplans (user_id, room_id, layout_json, version)
      VALUES (?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        layout_json = VALUES(layout_json),
        version = version + 1
      `,
      [String(userId), String(roomId), layoutJson]
    );

    const [rows] = await pool.query(
      "SELECT id, user_id, room_id, version, updated_at FROM floorplans WHERE user_id=? AND room_id=? LIMIT 1",
      [String(userId), String(roomId)]
    );

    res.json({ success: true, floorplan: rows[0] });
  } catch (e) {
    console.error("❌ Save floorplan error:", e);
    res.status(500).json({ success: false, error: "server_error" });
  }
});

// ✅ LOAD floorplan
app.get("/floorplans/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const userId = req.query.userId;

  if (!userId || !roomId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing query userId or param roomId" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT layout_json, version, updated_at FROM floorplans WHERE user_id=? AND room_id=? LIMIT 1",
      [String(userId), String(roomId)]
    );

    if (rows.length === 0) {
      return res.json({ success: true, floorplan: null });
    }

    const fp = rows[0];
    res.json({
      success: true,
      floorplan: {
        layout: JSON.parse(fp.layout_json),
        version: fp.version,
        updatedAt: fp.updated_at,
      },
    });
  } catch (e) {
    console.error("❌ Load floorplan error:", e);
    res.status(500).json({ success: false, error: "server_error" });
  }
});

// ✅ LIST floorplans (by user)
app.get("/floorplans", async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: "Missing userId" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT id, room_id, version, updated_at
      FROM floorplans
      WHERE user_id = ?
      ORDER BY updated_at DESC
      `,
      [String(userId)]
    );

    res.json({ success: true, floorplans: rows });
  } catch (e) {
    console.error("❌ List floorplans error:", e);
    res.status(500).json({ success: false, error: "server_error" });
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

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () =>
      console.log(`✅ API running at http://localhost:${PORT}`)
    );
  } catch (e) {
    console.error("❌ Failed to init:", e);
    process.exit(1);
  }
})();