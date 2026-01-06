/**
 * Node.js SQLite wrapper для worker'а
 * Используется только в batch-worker для избежания libsql ошибок
 * ⚠️ НИКОГДА не импортируй этот файл в Next.js API коде
 */

let _nodeDb: any = null;

interface NodeDbResult {
  rows?: any[];
}

export async function getNodeDb() {
  if (_nodeDb) return _nodeDb;

  // Динамический импорт sqlite3
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.DATABASE_URL || 'sqlite.db';

  // Убрать 'file:' префикс если есть
  const cleanPath = dbPath.replace(/^file:/, '');

  const dbInstance = new sqlite3.Database(cleanPath);

  // Обертка для выполнения SQL с promise-based API
  _nodeDb = {
    execute: (sql: string, params?: any[]): Promise<NodeDbResult> => {
      return new Promise((resolve, reject) => {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          // SELECT запрос
          dbInstance.all(sql, params || [], (err: any, rows: any[]) => {
            if (err) reject(err);
            else resolve({ rows });
          });
        } else {
          // INSERT/UPDATE/DELETE запрос
          dbInstance.run(sql, params || [], function(err: any) {
            if (err) reject(err);
            else resolve({ rows: [{ changes: this.changes }] });
          });
        }
      });
    },
    close: (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (dbInstance) {
          dbInstance.close((err: any) => {
            if (err) reject(err);
            else {
              _nodeDb = null;
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    },
  };

  return _nodeDb;
}
