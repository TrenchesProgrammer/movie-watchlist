import express, { Request, Response } from "express";
import { register, login, logout } from "../controllers/authController";
import { prisma } from "../config/db";
import { generateToken } from "../utils/generateToken";

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id?: number | string;
  login?: string;
  name?: string | null;
  avatar_url?: string;
  email?: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
}

const router = express.Router();

// ==================== LOCAL AUTH ====================
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// ==================== GOOGLE OAUTH ====================

router.get("/google", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !redirectUri) {
    res.status(500).json({ error: "Google OAuth credentials are not properly configured" });
    return;
  }

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

router.get("/google/callback", async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string | undefined;
  const errorParam = req.query.error as string | undefined;
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  if (errorParam) {
    console.error("Google OAuth callback returned error:", errorParam);
    res.redirect(`${clientUrl}/login?error=${encodeURIComponent(errorParam)}`);
    return;
  }

  if (!code) {
    res.status(400).json({ error: "Authorization code not provided" });
    return;
  }

  try {
    // 1. Exchange code for Google access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL as string,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Google token exchange error:", tokenData);
      res.redirect(
        `${clientUrl}/login?error=${encodeURIComponent(
          tokenData.error_description || "Failed to fetch Google access token"
        )}`
      );
      return;
    }

    // 2. Fetch Google user profile
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = (await userRes.json()) as GoogleUserInfo;

    if (!userRes.ok || !googleUser.id) {
      console.error("Google profile fetch error:", googleUser);
      res.redirect(`${clientUrl}/login?error=Failed to fetch Google user profile`);
      return;
    }

    const googleId = String(googleUser.id);
    const email = googleUser.email;
    const name = googleUser.name;
    const avatarUrl = googleUser.picture;

    // 3. Find existing user by provider and providerId
    let user = await prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider: "google",
          providerId: googleId,
        },
      },
    });

    // If not found by provider ID, check if user exists with the same email
    if (!user && email) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        // Link Google provider to existing account
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            provider: "google",
            providerId: googleId,
            avatarUrl: existingByEmail.avatarUrl || avatarUrl,
            name: existingByEmail.name || name,
          },
        });
      }
    }

    // If still not found, create new user
    if (!user) {
      user = await prisma.user.create({
        data: {
          provider: "google",
          providerId: googleId,
          email,
          name,
          avatarUrl,
        },
      });
    } else {
      // Refresh profile data if updated
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: avatarUrl || user.avatarUrl,
          name: name || user.name,
        },
      });
    }

    // 4. Set JWT cookie and generate token
    const token = generateToken(user.id, res);

    // 5. Redirect to frontend with token and userId
    res.redirect(`${clientUrl}/dashboard?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(user.id)}`);
  } catch (error) {
    console.error("Google OAuth Error:", error);
    res.redirect(`${clientUrl}/login?error=Internal server error during Google OAuth`);
  }
});

// ==================== GITHUB OAUTH ====================

router.get("/github", (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;

  if (!clientId || !redirectUri) {
    res.status(500).json({ error: "GitHub OAuth credentials are not properly configured" });
    return;
  }

  const rootUrl = "https://github.com/login/oauth/authorize";
  const options = {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

router.get("/github/callback", async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string | undefined;
  const errorParam = req.query.error as string | undefined;
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  if (errorParam) {
    console.error("GitHub OAuth callback returned error:", errorParam);
    res.redirect(`${clientUrl}/login?error=${encodeURIComponent(errorParam)}`);
    return;
  }

  if (!code) {
    res.status(400).json({ error: "Authorization code not provided" });
    return;
  }

  try {
    // 1. Exchange code for GitHub access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
      }),
    });

    const tokenData = (await tokenRes.json()) as GitHubTokenResponse;
    const accessToken = tokenData.access_token;

    if (!tokenRes.ok || !accessToken) {
      console.error("GitHub token exchange error:", tokenData);
      res.redirect(
        `${clientUrl}/login?error=${encodeURIComponent(
          tokenData.error_description || "Failed to fetch GitHub access token"
        )}`
      );
      return;
    }

    // 2. Fetch GitHub user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Movie-Watchlist-App",
        Accept: "application/vnd.github.v3+json",
      },
    });
    const githubUser = (await userRes.json()) as GitHubUser;

    if (!userRes.ok || !githubUser.id) {
      console.error("GitHub profile fetch error:", githubUser);
      res.redirect(`${clientUrl}/login?error=Failed to fetch GitHub user profile`);
      return;
    }

    // 3. Fetch GitHub primary/verified email (if scope 'user:email' returns private emails)
    let email = githubUser.email;
    if (!email) {
      try {
        const emailRes = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "Movie-Watchlist-App",
            Accept: "application/vnd.github.v3+json",
          },
        });
        const emails = (await emailRes.json()) as GitHubEmail[];

        if (Array.isArray(emails)) {
          const primaryEmail =
            emails.find((e) => e.primary && e.verified) ||
            emails.find((e) => e.verified) ||
            emails[0];
          if (primaryEmail) {
            email = primaryEmail.email;
          }
        }
      } catch (emailErr) {
        console.error("Error fetching GitHub emails:", emailErr);
      }
    }

    if (!email) {
      email = `${githubUser.id}+${githubUser.login}@users.noreply.github.com`;
    }

    const githubId = String(githubUser.id);
    const name = githubUser.name || githubUser.login;
    const avatarUrl = githubUser.avatar_url;

    // 4. Find existing user by provider and providerId
    let user = await prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider: "github",
          providerId: githubId,
        },
      },
    });

    // If not found by provider ID, check if user exists with the same email
    if (!user && email) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            provider: "github",
            providerId: githubId,
            avatarUrl: existingByEmail.avatarUrl || avatarUrl,
            name: existingByEmail.name || name,
          },
        });
      }
    }

    // If still not found, create new user
    if (!user) {
      user = await prisma.user.create({
        data: {
          provider: "github",
          providerId: githubId,
          email,
          name,
          avatarUrl,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: avatarUrl || user.avatarUrl,
          name: name || user.name,
        },
      });
    }

    // 5. Set JWT cookie and generate token
    const token = generateToken(user.id, res);

    // 6. Redirect to frontend with token and userId
    res.redirect(`${clientUrl}/dashboard?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(user.id)}`);
  } catch (error) {
    console.error("GitHub OAuth Error:", error);
    res.redirect(`${clientUrl}/login?error=Internal server error during GitHub OAuth`);
  }
});

export default router;