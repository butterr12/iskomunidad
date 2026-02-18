import { createAuthClient } from "better-auth/react";
import { usernameClient, magicLinkClient, inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
  plugins: [
    usernameClient(),
    magicLinkClient(),
    inferAdditionalFields({
      user: {
        role: { type: "string", required: false },
        status: { type: "string", required: false },
      },
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  updateUser,
  changePassword,
  listAccounts,
} = authClient;
