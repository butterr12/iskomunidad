export interface NotificationPreferences {
  posts: boolean;
  events: boolean;
  gigs: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  posts: true,
  events: true,
  gigs: false,
};

export function areNotificationsEnabledForContentType(
  contentType: string,
  preferences: NotificationPreferences,
): boolean {
  switch (contentType) {
    case "post":
      return preferences.posts;
    case "event":
      return preferences.events;
    case "gig":
      return preferences.gigs;
    default:
      return true;
  }
}
