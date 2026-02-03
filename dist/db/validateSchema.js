"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = validateSchema;
async function tableExists(ds, tableName) {
    // Try a few variants via to_regclass — returns null when not present
    const candidates = [
        tableName,
        `public.${tableName}`,
        tableName.toLowerCase(),
        `public.${tableName.toLowerCase()}`,
    ];
    for (const name of candidates) {
        try {
            const res = await ds.query("SELECT to_regclass($1) as r", [name]);
            if (res && res[0] && res[0].r)
                return true;
        }
        catch (err) {
            // ignore and try next
        }
    }
    // Fallback: check information_schema (safer for weird quoting)
    try {
        const q = `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) as exists`;
        const r = await ds.query(q, [tableName.toLowerCase()]);
        if (r && r[0] && (r[0].exists === true || r[0].exists === "t"))
            return true;
    }
    catch (err) {
        // ignore
    }
    return false;
}
async function validateSchema(ds, options) {
    const missing = [];
    const tables = options?.requiredTables ?? ds.entityMetadatas.map((m) => m.tableName);
    for (const t of tables) {
        const ok = await tableExists(ds, t);
        if (!ok)
            missing.push(t);
    }
    if (missing.length) {
        throw new Error(`Database schema validation failed — missing tables: ${missing.join(", ")}`);
    }
}
exports.default = validateSchema;
