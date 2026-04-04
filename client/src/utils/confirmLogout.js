export async function confirmLogout(logout) {
  if (typeof logout !== 'function') return false;
  const confirmed = await requestLogoutConfirmation();
  if (!confirmed) {
    return false;
  }
  await logout();
  return true;
}

function requestLogoutConfirmation() {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const event = new CustomEvent('guild:confirm-logout', {
      detail: { resolve },
    });
    window.dispatchEvent(event);
  });
}
