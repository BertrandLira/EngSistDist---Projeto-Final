import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const logger = new Logger('ApplyStatsMigration');

/**
 * Executa `migrations/02-stats.sql` (idempotente) logo após `DataSource.initialize()`.
 * Corre em cada arranque da Nest / `docker compose up`, não no `docker build`.
 */
export async function applyStatsMigrationSql(
  dataSource: DataSource,
): Promise<void> {
  const file = join(process.cwd(), 'migrations', '02-stats.sql');
  let sql: string;
  try {
    sql = readFileSync(file, 'utf8');
  } catch {
    logger.warn(`Ficheiro não encontrado: ${file} — migração ignorada.`);
    return;
  }

  const withoutLineComments = sql.replace(/^--[^\n]*$/gm, '').trim();
  const statements = withoutLineComments
    .split(';')
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await dataSource.query(stmt);
  }

  logger.log(
    `02-stats.sql aplicado (${statements.length} instruções; bases antigas alinhadas com as entidades).`,
  );
}
