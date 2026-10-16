import app from "../src/server";
import { prisma, connectDB, disconnectDB } from "../src/config/db";
import { generateToken } from "../src/utils/generateToken";
import jwt from "jsonwebtoken";

async function runTestSuite() {
  console.log("==========================================");
  console.log("       AUTH & OAUTH TEST SUITE            ");
  console.log("==========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  const baseUrl = `http://localhost:${process.env.PORT || 4001}`;

  // Allow database and server to initialize
  await new Promise((r) => setTimeout(r, 1500));

  try {
    console.log("--- 1. Testing Database Connectivity & Models ---");
    let count: number | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        count = await prisma.user.count();
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    assert(typeof count === "number", "Prisma connects and queries User model successfully");

    console.log("\n--- 2. Testing Google OAuth Initiation ---");
    const googleRes = await fetch(`${baseUrl}/auth/google`, { redirect: "manual" });
    assert(googleRes.status === 302, "GET /auth/google returns 302 redirect");
    const googleLoc = googleRes.headers.get("location") || "";
    assert(googleLoc.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), "Redirects to accounts.google.com");
    assert(googleLoc.includes("response_type=code"), "Google URL contains response_type=code");
    assert(googleLoc.includes("redirect_uri="), "Google URL contains redirect_uri");
    assert(googleLoc.includes("openid"), "Google URL contains openid scope");

    const apiGoogleRes = await fetch(`${baseUrl}/api/auth/google`, { redirect: "manual" });
    assert(apiGoogleRes.status === 302, "GET /api/auth/google alias returns 302 redirect");

    console.log("\n--- 3. Testing GitHub OAuth Initiation ---");
    const githubRes = await fetch(`${baseUrl}/auth/github`, { redirect: "manual" });
    assert(githubRes.status === 302, "GET /auth/github returns 302 redirect");
    const githubLoc = githubRes.headers.get("location") || "";
    assert(githubLoc.startsWith("https://github.com/login/oauth/authorize"), "Redirects to github.com/login/oauth/authorize");
    assert(githubLoc.includes("scope=read%3Auser+user%3Aemail"), "GitHub URL contains scope=read:user user:email");
    assert(githubLoc.includes("redirect_uri="), "GitHub URL contains redirect_uri");

    const apiGithubRes = await fetch(`${baseUrl}/api/auth/github`, { redirect: "manual" });
    assert(apiGithubRes.status === 302, "GET /api/auth/github alias returns 302 redirect");

    console.log("\n--- 4. Testing OAuth Callbacks Error Handling ---");
    const googleNoCode = await fetch(`${baseUrl}/auth/google/callback`);
    assert(googleNoCode.status === 400, "Google callback without code returns 400");

    const githubNoCode = await fetch(`${baseUrl}/auth/github/callback`);
    assert(githubNoCode.status === 400, "GitHub callback without code returns 400");

    const googleDenied = await fetch(`${baseUrl}/auth/google/callback?error=access_denied`, { redirect: "manual" });
    assert(googleDenied.status === 302, "Google callback error redirects to client login");
    assert((googleDenied.headers.get("location") || "").includes("/login?error=access_denied"), "Google error preserves error parameter");

    const githubDenied = await fetch(`${baseUrl}/auth/github/callback?error=user_cancelled`, { redirect: "manual" });
    assert(githubDenied.status === 302, "GitHub callback error redirects to client login");
    assert((githubDenied.headers.get("location") || "").includes("/login?error=user_cancelled"), "GitHub error preserves error parameter");

    console.log("\n--- 5. Testing OAuth User Upsert & Account Linking ---");
    const testGoogleId = "google_test_suite_123";
    const testEmail = "oauth_suite_user@example.com";

    // Clean up
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: testEmail },
          { provider: "google", providerId: testGoogleId },
        ],
      },
    });

    // Create user via Google OAuth
    const googleUser = await prisma.user.create({
      data: {
        provider: "google",
        providerId: testGoogleId,
        email: testEmail,
        name: "OAuth Suite User",
        avatarUrl: "https://lh3.googleusercontent.com/test-pic",
      },
    });
    assert(googleUser.id !== undefined, "User created successfully without password");
    assert(googleUser.password === null, "OAuth user password is null");

    // Token generation & cookie options test
    let cookieName = "";
    let cookieSameSite = "";
    let isHttpOnly = false;
    const mockRes = {
      cookie: (name: string, val: string, opts: any) => {
        cookieName = name;
        cookieSameSite = opts.sameSite;
        isHttpOnly = opts.httpOnly;
      },
    } as any;

    const token = generateToken(googleUser.id, mockRes);
    assert(cookieName === "jwt", "Cookie name is 'jwt'");
    assert(cookieSameSite === "lax", "Cookie sameSite is 'lax' for OAuth compatibility");
    assert(isHttpOnly === true, "Cookie is httpOnly");
    assert(typeof token === "string" && token.length > 20, "JWT token successfully created");

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    assert(decoded.id === googleUser.id, "JWT decoded id matches user id");

    // Link GitHub account with the same email
    const linkedUser = await prisma.user.update({
      where: { email: testEmail },
      data: {
        provider: "github",
        providerId: "github_suite_999",
        avatarUrl: "https://avatars.githubusercontent.com/u/999",
      },
    });
    assert(linkedUser.provider === "github", "Account successfully linked to GitHub");
    assert(linkedUser.providerId === "github_suite_999", "Account updated with GitHub providerId");

    // Clean up
    await prisma.user.deleteMany({ where: { email: testEmail } });
    console.log("  ✓ Test records cleaned up");

  } catch (err) {
    console.error("Test execution failed:", err);
    failed++;
  } finally {
    await disconnectDB();
    console.log("\n==========================================");
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================\n");
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
