export function resolveAvatarUploadFile(selectedFile, latestFileRef) {
  if (latestFileRef?.current) return latestFileRef.current;
  return selectedFile || null;
}

export function applyAvatarToApp(avatarUrl) {
  if (typeof window === 'undefined') return null;

  const normalizedAvatarUrl = avatarUrl ? String(avatarUrl).trim() : '';
  const cacheBustedAvatarUrl = normalizedAvatarUrl
    ? `${normalizedAvatarUrl}${normalizedAvatarUrl.includes('?') ? '&' : '?'}_=${Date.now()}`
    : null;

  if (cacheBustedAvatarUrl) {
    window.localStorage.setItem('userAvatar', cacheBustedAvatarUrl);
    window.localStorage.setItem('avatarUrl', cacheBustedAvatarUrl);
  } else {
    window.localStorage.removeItem('userAvatar');
    window.localStorage.removeItem('avatarUrl');
  }

  const currentUser = window.currentUser || {};
  window.currentUser = {
    ...currentUser,
    avatar_url: cacheBustedAvatarUrl,
    avatarUrl: cacheBustedAvatarUrl,
    image_url: cacheBustedAvatarUrl
  };

  window.dispatchEvent(new Event('avatar:updated'));
  window.dispatchEvent(new Event('profile:updated'));

  return cacheBustedAvatarUrl;
}

export function getStoredAvatarUrl() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('avatarUrl') || window.localStorage.getItem('userAvatar') || null;
}
