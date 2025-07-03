/*
 * The key used to store user query templates in local storage.
 */
const STORAGE_KEY = 'userQueryTemplates';

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

/*
 * The templates to use to resolve natural language queries.
 */
const defaultTemplates = [
    {
      // TODO(prashanth@): Make these match patterns more specific. Currently
      // this will catch both "show me huli data " and "show me huli data for
      // the last 30 days" under the same query.
      pattern: /show me (.+) data/i,
      label: 'Show me <sitename> data',
      extract: (match) => match[1],
      sqlTemplate: "SELECT * FROM ? WHERE <key> LIKE '%<value>%'"
    },
    {
      pattern: /create a timelapse of images in site (.+)/i,
      label: 'Create a timelapse of images in site <sitename>',
      extract: (match) => match[1],
      sqlTemplate: "SELECT * FROM ? WHERE <key> = '<value>' ORDER BY date"
    }
  ];

/**
 * Resolves a natural language query into a SQL query.
 *
 * @param {string} userQuery - The natural language query to resolve.
 * @param {Array} data - The data to search through.
 * @returns {string|null} The SQL query, or null if the query is not recognized.
 */
function resolveNaturalLanguageQuery(userQuery, data) {

  // First check if the query is a saved user query.
  const userTemplates = getUserQueries();
  const found = userTemplates.find(
    t => t.label.toLowerCase() === userQuery.toLowerCase()
  );
  if (found) {
    return found.sqlTemplate;
  }

  // If not, check if it's a default template.
  for (const { pattern, extract, sqlTemplate } of defaultTemplates) {
    const match = userQuery.match(pattern);
    if (match) {
      const value = extract(match);
      const key = findMatchingKey(data, value);

      if (key) {
        const sql = sqlTemplate.replace('<key>', key).replace('<value>', value);
        return sql;
      }
      return null;
    }
  }
  return null;
}

/**
 * Save a user query to local storage.
 *
 * This function appends to the list returned by getUserQueries.
 *
 * @param {Object} template - The template to save, eg:
 * {
 *   label: 'My Query',
 *   sqlTemplate: 'SELECT * FROM ? WHERE username = 'foo' ORDER BY date'
 * }
 */
function saveUserQuery(template) {
  const current = getUserQueries();
  current.push(template);
  console.log('QueryTemplateService: saveUserQuery: len(current): ', current.length);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

/**
 * Delete a user query from local storage.
 *
 * @param {string} label - The label of the query to delete.
 */
function deleteUserQuery(label) {
  const current = getUserQueries();
  const newCurrent = current.filter(template => template.label !== label);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newCurrent));
}

/**
 * Get all user queries from local storage.
 *
 * When there are no queies, return a list. The idea is that saveUserQuery
 * adds to this list and re-sets the STORAGE_KEY.
 *
 * @returns {Array} The user queries.
 */
function getUserQueries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

module.exports = {
  resolveNaturalLanguageQuery,
  saveUserQuery,
  deleteUserQuery,
  getUserQueries,
  defaultTemplates
};