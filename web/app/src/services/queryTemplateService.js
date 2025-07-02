

/*
 * Find the key in the data that contains a similar value for the given value.
 *
 * @param {Array} data - The data to search through.
 * @param {string} value - The value to search for.
 * @returns {string|null} The key that contains a similar value, or null if no
 *   matching key is found.
*/
function findMatchingKey(data, value) {
  const sample = data.slice(0, 10);

  for (const row of sample) {
    for (const key in row) {
      const cell = row[key];
      if (
        typeof cell === 'string' && cell.toLowerCase().includes(
          value.toLowerCase()
        )
      ) {
        return key;
      }
    }
  }
  return null;
}

/**
 * Resolves a natural language query into a SQL query.
 *
 * @param {string} userQuery - The natural language query to resolve.
 * @param {Array} data - The data to search through.
 * @returns {string|null} The SQL query, or null if the query is not recognized.
 */
function resolveNaturalLanguageQuery(userQuery, data) {
  const templates = [
    {
      pattern: /show me (.+) data/i,
      extract: (match) => match[1],
      sqlTemplate: "SELECT * FROM ? WHERE <key> LIKE '%<value>%'"
    },
    {
      pattern: /create a timelapse of images in site (.+)/i,
      extract: (match) => match[1],
      sqlTemplate: "SELECT * FROM ? WHERE <key> = '<value>' ORDER BY date"
    }
  ];

  for (const { pattern, extract, sqlTemplate } of templates) {
    const match = userQuery.match(pattern);
    if (match) {
      const value = extract(match);
      const key = findMatchingKey(data, value);

      if (key) {
        return sqlTemplate.replace('<key>', key).replace('<value>', value);
      } else {
        console.log(`No matching key found for ${value}`);
        return null;
      }
    }
  }

  // Not a recognized query
  return null;
}


module.exports = {
  resolveNaturalLanguageQuery
};