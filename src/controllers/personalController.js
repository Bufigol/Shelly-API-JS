

class PersonalController {
    async getPersonal(req, res) {
        try {
            const [rows] = await pool.query('SELECT * FROM personal');
            res.json(rows);
        } catch (error) {
            console.error('Error fetching personal:', error);
            res.status(500).send('Server Error');
        }
    }
}

module.exports = new PersonalController();