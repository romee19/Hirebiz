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
  
  console.log("✅ Connected to MySQL\n");
  
  // Check all tables
  const tables = ['requests', '`new`', '`inprogress`', '`completed`', '`rejected`'];
  let checked = 0;
  
  tables.forEach((table) => {
    db.query(`SELECT COUNT(*) as count FROM ${table}`, (err, result) => {
      if (err) {
        console.error(`❌ Error checking ${table}:`, err);
      } else {
        const count = result[0].count;
        console.log(`📊 ${table.replace(/`/g, '').padEnd(12)}: ${count} records`);
        checked++;
      }
      
      if (checked === tables.length) {
        console.log("\n✅ Database check complete!");
        db.end();
        process.exit(0);
      }
    });
  });
});
