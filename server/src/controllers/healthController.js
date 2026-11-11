import { getDatabaseState } from '../config/db.js';

export function getHealth(req, res) {
  res.json({
    status: 'ok',
    database: getDatabaseState(),
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
