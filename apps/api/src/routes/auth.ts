import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAddress, verifyMessage } from "ethers";
import { buildLoginMessage } from "@fp/shared";
import { z } from "zod";
import { httpError } from "../http";
import { prisma } from "../prisma";

const WEEK_SECONDS = 7 * 24 * 60 * 60;

function parseAddress(value: string): string {
  try {
    return getAddress(value);
  } catch {
    throw httpError(400, "Enter a valid wallet address");
  }
}

function sessionToken(request: FastifyRequest): string | undefined {
  const cookies = (request as FastifyRequest & { cookies?: Record<string, string | undefined> }).cookies;
  return cookies?.fp_session;
}

function setSessionCookie(reply: FastifyReply, token: string) {
  const withCookie = reply as FastifyReply & {
    setCookie: (name: string, value: string, options: Record<string, unknown>) => void;
  };
  withCookie.setCookie("fp_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WEEK_SECONDS,
  });
}

export async function requireUser(request: FastifyRequest) {
  const token = sessionToken(request);
  if (!token) throw httpError(401, "Sign in required");
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw httpError(401, "Sign in required");
  }
  return session.user;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/nonce", async (request) => {
    const body = z.object({ address: z.string().min(1) }).parse(request.body);
    const address = parseAddress(body.address);
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date().toISOString();
    const message = buildLoginMessage(address, nonce, issuedAt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.authNonce.updateMany({ where: { address, used: false }, data: { used: true } });
    await prisma.authNonce.create({ data: { address, nonce, message, expiresAt } });
    return { message, nonce, expiresAt: expiresAt.toISOString() };
  });

  app.post("/auth/verify", async (request, reply) => {
    const body = z
      .object({
        address: z.string().min(1),
        message: z.string().min(1),
        signature: z.string().min(1),
      })
      .parse(request.body);
    const address = parseAddress(body.address);
    let recovered = "";
    try {
      recovered = verifyMessage(body.message, body.signature);
    } catch {
      throw httpError(401, "Signature could not be verified");
    }
    if (getAddress(recovered) !== address) {
      throw httpError(401, "Signature does not match the address");
    }

    const pending = await prisma.authNonce.findFirst({
      where: { address, message: body.message, used: false, expiresAt: { gt: new Date() } },
    });
    if (!pending) throw httpError(401, "Sign-in challenge expired");

    await prisma.authNonce.update({ where: { id: pending.id }, data: { used: true } });
    const user = await prisma.user.upsert({
      where: { address },
      update: {},
      create: { address },
    });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + WEEK_SECONDS * 1000) },
    });
    setSessionCookie(reply, token);
    return { user: { id: user.id, address: user.address } };
  });

  app.get("/auth/me", async (request) => {
    const user = await requireUser(request);
    return { user: { id: user.id, address: user.address } };
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = sessionToken(request);
    if (token) await prisma.session.deleteMany({ where: { token } });
    const withCookie = reply as FastifyReply & {
      clearCookie: (name: string, options: Record<string, unknown>) => void;
    };
    withCookie.clearCookie("fp_session", { path: "/" });
    return { ok: true };
  });
}
