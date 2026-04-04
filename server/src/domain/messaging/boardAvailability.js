const BOARDS_DISABLED = true;
const BOARDS_DISABLED_CODE = 'BOARDS_DISABLED';
const BOARDS_DISABLED_ERROR = 'Boards are temporarily disabled while we replace them.';

function getBoardsAvailabilityFailure() {
  if (!BOARDS_DISABLED) {
    return { ok: true };
  }

  return {
    ok: false,
    error: BOARDS_DISABLED_ERROR,
    code: BOARDS_DISABLED_CODE,
  };
}

function replyBoardsDisabled(res, statusCode = 503) {
  const failure = getBoardsAvailabilityFailure();
  return res.status(statusCode).json({
    error: failure.error,
    code: failure.code,
  });
}

module.exports = {
  BOARDS_DISABLED,
  BOARDS_DISABLED_CODE,
  BOARDS_DISABLED_ERROR,
  getBoardsAvailabilityFailure,
  replyBoardsDisabled,
};
