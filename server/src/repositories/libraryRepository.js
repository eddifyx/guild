function createLibraryRepository({ db }) {
  const insertAssetDump = db.prepare(
    `INSERT INTO asset_dumps (id, file_url, file_name, file_type, file_size, description, uploaded_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+5 days'))`
  );
  const getAllAssetDumps = db.prepare(`
    SELECT ad.*, u.username as uploader_name, u.avatar_color as uploader_color
    FROM asset_dumps ad JOIN users u ON ad.uploaded_by = u.id
    WHERE ad.expires_at > datetime('now')
    ORDER BY ad.created_at DESC
  `);
  const getAssetDumpById = db.prepare('SELECT * FROM asset_dumps WHERE id = ?');
  const deleteAssetDump = db.prepare('DELETE FROM asset_dumps WHERE id = ?');
  const getExpiredAssetDumps = db.prepare(
    `SELECT id, file_url FROM asset_dumps WHERE expires_at <= datetime('now')`
  );
  const deleteExpiredAssetDumps = db.prepare(
    `DELETE FROM asset_dumps WHERE expires_at <= datetime('now')`
  );

  const insertAddon = db.prepare(
    `INSERT INTO addons (id, file_url, file_name, file_type, file_size, description, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const getAllAddons = db.prepare(`
    SELECT a.*, u.username as uploader_name, u.avatar_color as uploader_color
    FROM addons a JOIN users u ON a.uploaded_by = u.id
    ORDER BY a.created_at DESC
  `);
  const getAddonById = db.prepare('SELECT * FROM addons WHERE id = ?');
  const deleteAddon = db.prepare('DELETE FROM addons WHERE id = ?');

  return {
    insertAssetDump,
    getAllAssetDumps,
    getAssetDumpById,
    deleteAssetDump,
    getExpiredAssetDumps,
    deleteExpiredAssetDumps,
    insertAddon,
    getAllAddons,
    getAddonById,
    deleteAddon,
  };
}

module.exports = {
  createLibraryRepository,
};
