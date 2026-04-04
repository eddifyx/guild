export const BOARDS_DISABLED = true;
export const BOARDS_DISABLED_CODE = 'BOARDS_DISABLED';
export const BOARDS_DISABLED_REASON = 'Boards are temporarily disabled while we replace them.';

export function createBoardsDisabledError() {
  const error = new Error(BOARDS_DISABLED_REASON);
  error.code = BOARDS_DISABLED_CODE;
  return error;
}
