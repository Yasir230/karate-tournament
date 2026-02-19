import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5, // Limit connections for free tier
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Helper for single queries
export const query = async <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
    return pool.query<T>(text, params);
};

// Helper for transactions
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// Dummy initialize for compatibility with index.ts (migration is external)
export const initializeDatabase = () => {
    console.log('Database initialized (managed by migrate.ts)');
};

export default {
    query,
    withTransaction,
    pool, // Export pool for cases where direct access is needed
    initializeDatabase
};
