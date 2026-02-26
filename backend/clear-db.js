const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "hirebiz_db"
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection error:", err);
    process.exit(1);
  }
  
  console.log("✅ Connected to MySQL");
  
  // Clear all tables
  const tables = ['requests', '`new`', '`inprogress`', '`completed`', '`rejected`'];
  let cleared = 0;
  
  tables.forEach((table) => {
    db.query(`DELETE FROM ${table}`, (err) => {
      if (err) {
        console.error(`❌ Error clearing ${table}:`, err);
      } else {
        console.log(`✅ Cleared ${table}`);
        cleared++;
      }
      
      if (cleared === tables.length) {
        console.log("\n✅ All tables cleared!");
        db.end();
        process.exit(0);
      }
    });
  });
});
