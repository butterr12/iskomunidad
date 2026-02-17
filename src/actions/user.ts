"use server";

export async function checkUsernameAvailable(
  username: string,
): Promise<boolean> {
  if (!username || username.length < 3 || username.length > 30) {
    return false;
  }

  const baseUrl =
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/auth/is-username-available`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.available === true;
}
