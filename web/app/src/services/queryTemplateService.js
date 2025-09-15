
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
      sqlTemplate: "SELECT * FROM ? WHERE <key> LIKE '%<value>%'",
      placeholders: ['sitename']
    },
    {
      pattern: /create a timelapse of images in site (.+)/i,
      label: 'Create a timelapse of images in site <sitename>',
      extract: (match) => match[1],
      sqlTemplate: "SELECT * FROM ? WHERE <key> = '<value>' ORDER BY date",
      placeholders: ['sitename']
    }
  ];

// Global state for modal management
let modalState = {
  show: false,
  placeholderName: null,
  data: null,
  template: null,
  resolveCallback: null
};

// Hardcoded fuzzy matching patterns for placeholders
const placeholderPatterns = {
  sitename: [
    'site', 'siteid', 'site_id', 'site-id', 'site_name', 'site-name',
    'name', 'sitename', 'siteName', 'location', 'loc'
  ]
};

/**
 * Find keys that match a placeholder using fuzzy matching
 *
 * Currently this function just uses the placeholderPatterns object to find
 * matching keys.
 *
 * @param {Array} data - The data to search through
 * @param {string} placeholderName - The placeholder name (e.g., 'sitename')
 * @returns {Array} Array of matching keys
 */
function findFuzzyMatchingKeys(data, placeholderName) {
  if (!data || data.length === 0) return [];

  const patterns = placeholderPatterns[placeholderName];
  if (!patterns) return [];

  const allKeys = new Set();
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      allKeys.add(key);
    });
  });

  // Filter keys that match our patterns (case insensitive)
  const matching = Array.from(allKeys).filter(key => {
    const lowerKey = key.toLowerCase();
    return patterns.some(pattern =>
      lowerKey.includes(pattern.toLowerCase()) ||
      pattern.toLowerCase().includes(lowerKey)
    );
  });

  return matching.sort();
}

/**
 * Get unique values for a given key
 *
 * @param {Array} data - The data to search through
 * @param {string} key - The key to get values for
 * @returns {Array} Array of unique values
 */
function getUniqueValuesForKey(data, key) {
  if (!data || !key) return [];

  const values = new Set();
  data.forEach(row => {
    const value = row[key];
    if (value !== null && value !== undefined) {
      values.add(String(value));
    }
  });

  return Array.from(values).sort();
}

/**
 * Check if a template contains placeholders
 *
 * @param {Object} template - The template object
 * @returns {boolean} True if template has placeholders
 */
function hasPlaceholders(template) {
  return template.placeholders && template.placeholders.length > 0;
}

/**
 * Trigger the modal for placeholder resolution
 *
 * @param {string} placeholderName - The placeholder name
 * @param {Array} data - The data to search through
 * @param {Object} template - The template object
 * @returns {Promise} Promise that resolves with the SQL query
 */
function triggerPlaceholderModal(placeholderName, data, template) {
  return new Promise((resolve, reject) => {
    // Find matching keys
    const matchingKeys = findFuzzyMatchingKeys(data, placeholderName);

    if (matchingKeys.length === 0) {
      reject(new Error(`No matching keys found for placeholder: ${placeholderName}`));
      return;
    }

    // If only one key matches, skip key selection and go to value selection
    if (matchingKeys.length === 1) {
      const key = matchingKeys[0];
      const values = getUniqueValuesForKey(data, key);

      if (values.length === 0) {
        reject(new Error(`No values found for key: ${key}`));
        return;
      }

      // If only one value, auto-select it
      if (values.length === 1) {
        const sql = template.sqlTemplate
          .replace('<key>', key)
          .replace('<value>', values[0])
          .replace(new RegExp(`<${placeholderName}>`, 'g'), values[0]);
        resolve(sql);
        return;
      }

      // Set up modal state for value selection only
      modalState = {
        show: true,
        placeholderName,
        data,
        template: { ...template, selectedKey: key },
        resolveCallback: resolve
      };

      // Dispatch custom event to show modal
      window.dispatchEvent(new CustomEvent('show-query-template-modal', {
        detail: modalState
      }));
    } else {
      // Multiple keys - show key selection modal
      modalState = {
        show: true,
        placeholderName,
        data,
        template,
        resolveCallback: resolve
      };

      // Dispatch custom event to show modal
      window.dispatchEvent(new CustomEvent('show-query-template-modal', {
        detail: modalState
      }));
    }
  });
}

/**
 * Resolve a placeholder with selected key and value
 *
 * @param {string} key - The selected key
 * @param {string} value - The selected value
 * @param {Object} template - The template object
 * @param {string} placeholderName - The placeholder name
 * @returns {string} The resolved SQL query
 */
function resolvePlaceholder(key, value, template, placeholderName) {
  let sql = template.sqlTemplate;
  sql = sql.replace('<key>', key);
  sql = sql.replace('<value>', value);
  sql = sql.replace(new RegExp(`<${placeholderName}>`, 'g'), value);
  return sql;
}

/**
 * Get current modal state (for Vue component)
 *
 * @returns {Object} Current modal state
 */
function getModalState() {
  return modalState;
}

/**
 * Handle modal resolution
 *
 * @param {string} key - The selected key
 * @param {string} value - The selected value
 */
function handleModalResolved(key, value) {
  if (modalState.resolveCallback) {
    const sql = resolvePlaceholder(key, value, modalState.template, modalState.placeholderName);
    modalState.resolveCallback(sql);
  }
  modalState.show = false;
}

/**
 * Handle modal close
 */
function handleModalClose() {
  if (modalState.resolveCallback) {
    modalState.resolveCallback(null);
  }
  modalState.show = false;
}

/**
 * DEPRECATED: Resolves a natural language query into a SQL query.
 *
 * This function is deprecated and will be removed in the future.
 * Use resolveNaturalLanguageQueryAsync instead.
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
 * Resolves a natural language query with modal support for placeholders.
 * This is the new async version that can trigger modals.
 *
 * @param {string} userQuery - The natural language query to resolve.
 * @param {Array} data - The data to search through.
 * @returns {Promise<string|null>} Promise that resolves to SQL query or null.
 */
async function resolveNaturalLanguageQueryAsync(userQuery, data) {
  // First check if the query is a saved user query.
  const userTemplates = getUserQueries();
  const found = userTemplates.find(
    t => t.label.toLowerCase() === userQuery.toLowerCase()
  );
  if (found) {
    return found.sqlTemplate;
  }

  // If not, check if it's a default template.
  for (const template of defaultTemplates) {
    const match = userQuery.match(template.pattern);
    if (match) {
      // Check if template has placeholders
      if (hasPlaceholders(template)) {
        try {
          return await triggerPlaceholderModal(template.placeholders[0], data, template);
        } catch (error) {
          console.error('Error resolving placeholder:', error);
          return null;
        }
      } else {
        // Original logic for templates without placeholders
        const value = template.extract(match);
        const key = findMatchingKey(data, value);

        if (key) {
          const sql = template.sqlTemplate.replace('<key>', key).replace('<value>', value);
          return sql;
        }
        return null;
      }
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
  resolveNaturalLanguageQueryAsync,
  getModalState,
  handleModalResolved,
  handleModalClose,
  findFuzzyMatchingKeys,
  getUniqueValuesForKey,
  saveUserQuery,
  deleteUserQuery,
  getUserQueries,
  defaultTemplates
};