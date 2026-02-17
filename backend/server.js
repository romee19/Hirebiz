const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());


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
  }
});

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

app.listen(3000, () => {
  console.log("✅ API running at http://localhost:3000");
});
