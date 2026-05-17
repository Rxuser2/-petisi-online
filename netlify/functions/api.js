import { getDatabase } from '@netlify/database';

const db = getDatabase();

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    try {
        // GET /api/count
        if (pathname === '/api/count' && req.method === 'GET') {
            const result = await db.sql`SELECT COUNT(*) as count FROM signatures`;
            return Response.json({ count: parseInt(result.rows[0].count, 10) }, { headers });
        }

        // GET /api/signatures — list all, or fetch single by ?key=
        if (pathname === '/api/signatures' && req.method === 'GET') {
            const key = url.searchParams.get('key');
            if (key) {
                const result = await db.sql`
                    SELECT key, name, role, reason, timestamp
                    FROM signatures
                    WHERE key = ${key}
                    LIMIT 1
                `;
                if (result.rows.length === 0) {
                    return Response.json(null, { status: 404, headers });
                }
                const row = result.rows[0];
                row.timestamp = Number(row.timestamp);
                return Response.json(row, { headers });
            }
            const result = await db.sql`
                SELECT key, name, role, reason, timestamp
                FROM signatures
                ORDER BY timestamp DESC
            `;
            const rows = result.rows.map(r => ({ ...r, timestamp: Number(r.timestamp) }));
            return Response.json(rows, { headers });
        }

        // POST /api/signatures — create new signature
        if (pathname === '/api/signatures' && req.method === 'POST') {
            const body = await req.json();
            const { key, name, role, reason, timestamp } = body;

            if (!key || !name || !role || !timestamp) {
                return Response.json({ error: 'Missing required fields' }, { status: 400, headers });
            }

            // Validate input lengths
            if (name.length < 3 || name.length > 60) {
                return Response.json({ error: 'Invalid name length' }, { status: 400, headers });
            }

            await db.sql`
                INSERT INTO signatures (key, name, role, reason, timestamp)
                VALUES (${key}, ${name}, ${role}, ${reason || ''}, ${timestamp})
                ON CONFLICT (key) DO NOTHING
            `;
            return Response.json({ success: true, key }, { status: 201, headers });
        }

        // DELETE /api/signatures — delete by key in request body
        if (pathname === '/api/signatures' && req.method === 'DELETE') {
            const body = await req.json();
            const { key } = body;

            if (!key) {
                return Response.json({ error: 'Missing key' }, { status: 400, headers });
            }

            await db.sql`DELETE FROM signatures WHERE key = ${key}`;
            return Response.json({ success: true }, { headers });
        }

        return Response.json({ error: 'Not found' }, { status: 404, headers });
    } catch (err) {
        console.error('API error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500, headers });
    }
};

export const config = {
    path: '/api/*',
};
