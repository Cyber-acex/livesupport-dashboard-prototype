export function extractInsertId(result) {
  if (result == null) return null;

  if (Array.isArray(result)) {
    return Number(result?.[0]?.id ?? result?.[0]?.insertId ?? null);
  }

  if (typeof result === 'object') {
    if (result.rows && Array.isArray(result.rows) && result.rows[0]?.id != null) {
      return Number(result.rows[0].id);
    }

    if (result.insertId != null) {
      return Number(result.insertId);
    }

    if (result.id != null) {
      return Number(result.id);
    }
  }

  return null;
}
