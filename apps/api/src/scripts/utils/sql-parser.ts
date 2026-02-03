/**
 * SQL Parser Utility
 * Parses INSERT statements from MySQL dump files
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ParsedRow {
  [key: string]: string | number | null;
}

/**
 * Parse a single INSERT statement and extract rows
 */
function parseInsertStatement(sql: string, columns: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];

  // Find VALUES section
  const valuesMatch = sql.match(/VALUES\s*\n?\s*(.+)/is);
  if (!valuesMatch) return rows;

  let valuesStr = valuesMatch[1];

  // Remove trailing semicolon
  valuesStr = valuesStr.replace(/;\s*$/, '');

  // Split by ),( pattern while respecting strings
  // Use a state machine approach
  const rowStrings: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }

    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (inString && char === stringChar) {
      // Check for doubled quote escape
      if (i + 1 < valuesStr.length && valuesStr[i + 1] === stringChar) {
        current += char + valuesStr[i + 1];
        i++;
        continue;
      }
      inString = false;
      current += char;
      continue;
    }

    if (!inString) {
      if (char === '(') {
        if (depth === 0) {
          // Start of a new row
          current = '';
        } else {
          current += char;
        }
        depth++;
        continue;
      }

      if (char === ')') {
        depth--;
        if (depth === 0) {
          // End of a row
          if (current.trim()) {
            rowStrings.push(current);
          }
          current = '';
        } else {
          current += char;
        }
        continue;
      }
    }

    if (depth > 0) {
      current += char;
    }
  }

  // Parse each row string
  for (const rowStr of rowStrings) {
    const rowValues = parseRowValues(rowStr);
    if (rowValues.length === columns.length) {
      const row: ParsedRow = {};
      columns.forEach((col, idx) => {
        row[col] = rowValues[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse values from a single row tuple
 */
function parseRowValues(rowStr: string): (string | number | null)[] {
  const values: (string | number | null)[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }

    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (inString && char === stringChar) {
      // Check for escaped quote (doubled)
      if (i + 1 < rowStr.length && rowStr[i + 1] === stringChar) {
        current += char;
        i++;
        continue;
      }
      inString = false;
      continue;
    }

    if (!inString && char === ',') {
      values.push(parseValue(current.trim()));
      current = '';
      continue;
    }

    current += char;
  }

  // Add last value
  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }

  return values;
}

/**
 * Parse a single value to appropriate type
 */
function parseValue(val: string): string | number | null {
  if (val === 'NULL' || val === 'null') {
    return null;
  }

  // Remove surrounding quotes if present
  if ((val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }

  // Unescape special characters
  val = val
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');

  // Try to parse as number
  if (/^-?\d+(\.\d+)?$/.test(val)) {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      return num;
    }
  }

  return val;
}

/**
 * Extract column names from INSERT statement
 */
function extractColumns(insertLine: string): string[] {
  const match = insertLine.match(/INSERT INTO `\w+`\s*\(([^)]+)\)/i);
  if (!match) return [];

  return match[1]
    .split(',')
    .map(col => col.trim().replace(/`/g, ''));
}

/**
 * Parse a SQL file and extract all INSERT data for a specific table
 */
export function parseTableFromSQL(sqlFilePath: string, tableName: string): ParsedRow[] {
  const content = fs.readFileSync(sqlFilePath, 'utf-8');
  const rows: ParsedRow[] = [];

  // Split by lines to find INSERT statements
  const lines = content.split('\n');
  let currentStatement = '';
  let inInsert = false;
  let columns: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line starts a new INSERT for our table
    const insertStart = new RegExp(`INSERT INTO \`${tableName}\``, 'i');
    if (insertStart.test(trimmedLine)) {
      inInsert = true;
      currentStatement = line;
      columns = extractColumns(line);

      // Check if statement ends on same line
      if (trimmedLine.endsWith(';')) {
        if (columns.length > 0) {
          const parsedRows = parseInsertStatement(currentStatement, columns);
          rows.push(...parsedRows);
        }
        inInsert = false;
        currentStatement = '';
        columns = [];
      }
      continue;
    }

    if (inInsert) {
      currentStatement += '\n' + line;

      // Check if statement ends (line ends with ;)
      if (trimmedLine.endsWith(';')) {
        // Parse this complete INSERT statement
        if (columns.length > 0) {
          const parsedRows = parseInsertStatement(currentStatement, columns);
          rows.push(...parsedRows);
        }
        inInsert = false;
        currentStatement = '';
        columns = [];
      }
    }
  }

  return rows;
}

/**
 * Get all table names from SQL file
 */
export function getTableNames(sqlFilePath: string): string[] {
  const content = fs.readFileSync(sqlFilePath, 'utf-8');
  const tableNames: Set<string> = new Set();

  const createRegex = /CREATE TABLE `(\w+)`/gi;
  let match;

  while ((match = createRegex.exec(content)) !== null) {
    tableNames.add(match[1]);
  }

  return Array.from(tableNames);
}

/**
 * Map SQL status to MongoDB status
 */
export function mapStatus(sqlStatus: string | null): string {
  if (!sqlStatus) return 'PENDING';

  const statusMap: { [key: string]: string } = {
    'Pending': 'PENDING',
    'Approved': 'APPROVED',
    'Reject': 'REJECTED',
    'Rejected': 'REJECTED',
    'Received for Review': 'PENDING',
    'Removed': 'REJECTED',
    'Processing': 'PENDING',
  };

  return statusMap[sqlStatus] || 'PENDING';
}

/**
 * Parse date string to Date object
 */
export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  return date;
}

// Export for testing
export { parseRowValues, parseValue, extractColumns };
