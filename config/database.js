const fs = require('fs');
const path = require('path');

// Lee el archivo database.json
const dbConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'database.json'), 'utf8')
);

// Función para parsear la URL JDBC
function parseJdbcUrl(jdbcUrl) {
    const cleanUrl = jdbcUrl.replace('jdbc:', '');
    const matches = cleanUrl.match(/mysql:\/\/([^:]+):(\d+)\/(.+)/);
    
    if (!matches) {
        throw new Error('Invalid JDBC URL format');
    }

    return {
        host: matches[1],
        port: parseInt(matches[2]),
        database: matches[3]
    };
}

// Parsea la URL JDBC
const { host, port, database } = parseJdbcUrl(dbConfig.url);

// Exporta la configuración en el formato que espera mysql2
module.exports = {
    host,
    port,
    user: dbConfig.username,
    password: dbConfig.password,
    database,
    connectionLimit: dbConfig.pool.max_size,
    connectTimeout: dbConfig.pool.timeout * 1000
};