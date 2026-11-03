// The public name shown on reviews and photos. Deliberately never derived from
// the email address, so emails aren't partly exposed to other users.
export function displayNameFrom(profile: {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  if (profile.username) return profile.username;
  if (profile.firstName) {
    // "Jane D." rather than a full surname
    const initial = profile.lastName ? ` ${profile.lastName.charAt(0)}.` : '';
    return `${profile.firstName}${initial}`;
  }
  return 'Traveler';
}
