export async function confirmLogout(logout) {
  if (typeof logout !== 'function') return false;
  if (!window.confirm('Are you sure you want to log out?')) {
    return false;
  }
  await logout();
  return true;
}
