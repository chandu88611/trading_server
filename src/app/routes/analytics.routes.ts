import { Router, Response } from "express";
import { requireAuth, AuthRequest, Roles } from "../../middleware/auth";
import AppDataSource from "../../db/data-source";

const router = Router();

// GET /admin/analytics/users/growth?period=30
// Returns daily new user registrations for the last N days
router.get(
  "/users/growth",
  requireAuth([Roles.ADMIN]),
  async (req: AuthRequest, res: Response) => {
    try {
      const days = Math.min(365, Math.max(7, Number(req.query.period ?? 30)));
      const rows = await AppDataSource.query(
        `SELECT
           DATE_TRUNC('day', created_at) AS day,
           COUNT(*) AS count
         FROM users
         WHERE created_at >= NOW() - INTERVAL '${days} days'
           AND deleted_at IS NULL
         GROUP BY 1
         ORDER BY 1 ASC`
      );
      const total = await AppDataSource.query(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`);
      res.json({
        data: rows.map((r: any) => ({
          date: r.day,
          count: Number(r.count),
        })),
        total: Number(total[0]?.count ?? 0),
        period: days,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "error" });
    }
  }
);

// GET /admin/analytics/revenue?period=12
// Returns monthly revenue (sum of paid invoice amounts) for last N months
router.get(
  "/revenue",
  requireAuth([Roles.ADMIN]),
  async (req: AuthRequest, res: Response) => {
    try {
      const months = Math.min(24, Math.max(1, Number(req.query.period ?? 12)));
      const rows = await AppDataSource.query(
        `SELECT
           DATE_TRUNC('month', created_at) AS month,
           SUM(amount_cents) AS total_cents,
           COUNT(*) AS count
         FROM subscription_invoices
         WHERE status = 'paid'
           AND created_at >= NOW() - INTERVAL '${months} months'
         GROUP BY 1
         ORDER BY 1 ASC`
      );
      const totalCents = await AppDataSource.query(
        `SELECT SUM(amount_cents) as total FROM subscription_invoices WHERE status = 'paid'`
      );
      res.json({
        data: rows.map((r: any) => ({
          month: r.month,
          totalCents: Number(r.total_cents ?? 0),
          count: Number(r.count ?? 0),
        })),
        totalCents: Number(totalCents[0]?.total ?? 0),
        period: months,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "error" });
    }
  }
);

// GET /admin/analytics/strategies?period=30
// Returns strategy trade counts by status for the last N days
router.get(
  "/strategies",
  requireAuth([Roles.ADMIN]),
  async (req: AuthRequest, res: Response) => {
    try {
      const days = Math.min(90, Math.max(1, Number(req.query.period ?? 30)));
      const byStatus = await AppDataSource.query(
        `SELECT status, COUNT(*) as count
         FROM admin_strategy_trades
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY status
         ORDER BY count DESC`
      );
      const daily = await AppDataSource.query(
        `SELECT
           DATE_TRUNC('day', created_at) AS day,
           COUNT(*) AS count
         FROM admin_strategy_trades
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY 1
         ORDER BY 1 ASC`
      );
      res.json({
        byStatus: byStatus.map((r: any) => ({ status: r.status, count: Number(r.count) })),
        daily: daily.map((r: any) => ({ date: r.day, count: Number(r.count) })),
        period: days,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "error" });
    }
  }
);

export default router;
