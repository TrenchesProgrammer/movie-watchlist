import jwt, { SignOptions } from "jsonwebtoken";
import { Response } from "express";
export const generateToken = (userId: string, res:Response): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }

  const payload = { id: userId };

  // Explicitly type the options to satisfy jsonwebtoken's strict types
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  };
  const token = jwt.sign(payload, secret, options);

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
  return token;
};