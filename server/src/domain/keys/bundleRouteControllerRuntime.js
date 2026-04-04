function createStatementRunner(db, sql, label) {
  if (!db || typeof db.prepare !== 'function') {
    return (..._args) => {
      throw new Error(`${label} is unavailable`);
    };
  }

  const statement = db.prepare(sql);
  return (...args) => statement.run(...args);
}

function createRouteErrorHandler(logLabel, responseLabel, handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(logLabel, err);
      return res.status(500).json({ error: responseLabel });
    }
  };
}

function sendRouteResult(res, result) {
  if (result.ok) {
    return res.json(result.body);
  }

  return res.status(result.status).json({ error: result.error });
}

module.exports = {
  createRouteErrorHandler,
  createStatementRunner,
  sendRouteResult,
};
