//controllers/smsController.js
const databaseService = require("../services/database-service");
const { ValidationError } = require("../utils/errors");

class SmsController {
  async fetchSMSdata(req, res) {
    try {
      const [rows] = await pool.query("SELECT * FROM sms_data");
      res.json(rows);
    } catch (error) {
      console.error("Error fetching SMS data:", error);
      res.status(500).json({ error: "Error fetching SMS data" });
    }
  }
}

module.exports = new SmsController();