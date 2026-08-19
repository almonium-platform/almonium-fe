const DEFAULT_AVATAR_PATH = /assets\/img\/avatars\/default\/(?!premium\/)(owl|fox|stag|whale|rabbit)\.png(?:[?#].*)?$/;

export function avatarLetter(username: string | null | undefined): string {
  return username?.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? '·';
}

export function isDefaultAvatar(avatarUrl: string | null | undefined): boolean {
  return !!avatarUrl && DEFAULT_AVATAR_PATH.test(avatarUrl);
}

export function avatarImageUrl(
  avatarUrl: string | null | undefined,
  premium: boolean,
): string | null {
  if (!avatarUrl || !premium || !isDefaultAvatar(avatarUrl)) {
    return avatarUrl ?? null;
  }

  return avatarUrl.replace('/assets/img/avatars/default/', '/assets/img/avatars/default/premium/');
}
