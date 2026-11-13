import type { FastifyInstance } from "fastify";
import { JsonRpcProvider, type TransactionReceipt } from "ethers";
import { contentHash, consentScope, planRecordType } from "@fp/shared";
import { z } from "zod";
import { assertAttestation, assertSuccessfulCall, type TxReceipt } from "../chain/verify";
import { isDeployed, readDeployment } from "../deployment";
import { httpError } from "../http";
import { prisma } from "../prisma";
import { requireUser } from "./auth";
import { txHashSchema } from "../schemas";

function provider() {
  return new JsonRpcProvider(process.env.RPC_URL ?? "http://127.0.0.1:8545");
}

function asReceipt(receipt: TransactionReceipt): TxReceipt {
  return {
    status: receipt.status,
    from: receipt.from,
    to: receipt.to,
    blockNumber: receipt.blockNumber,
    logs: receipt.logs.map((log) => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
    })),
  };
}

async function readReceipt(txHash: string): Promise<TransactionReceipt> {
  const rpc = provider();
  let chainId = 0;
  try {
    const chainHex = (await rpc.send("eth_chainId", [])) as string;
    chainId = Number(BigInt(chainHex));
  } catch {
    throw httpError(503, "The local chain did not respond.");
  }
  const deployment = readDeployment();
  if (chainId !== deployment.chainId) {
    throw httpError(400, "RPC chain id does not match the deployment");
  }
  let receipt: TransactionReceipt | null;
  try {
    receipt = await rpc.getTransactionReceipt(txHash);
  } catch {
    throw httpError(503, "The local chain did not respond.");
  }
  if (!receipt) throw httpError(400, "Transaction is not mined yet");
  return receipt;
}

function requireContracts() {
  let deployment;
  try {
    deployment = readDeployment();
  } catch (error) {
    throw httpError(503, error instanceof Error ? error.message : "Deployment file is missing");
  }
  if (!isDeployed(deployment)) {
    throw httpError(503, "Deploy the local contracts before using chain features.");
  }
  return deployment;
}

export async function chainRoutes(app: FastifyInstance) {
  app.get("/chain/config", async () => {
    let deployment;
    try {
      deployment = readDeployment();
    } catch (error) {
      throw httpError(503, error instanceof Error ? error.message : "Deployment file is missing");
    }
    return {
      chainId: deployment.chainId,
      registry: deployment.registry,
      asset: deployment.asset,
      vault: deployment.vault,
      planRecordType: planRecordType(),
      consentScope: consentScope(),
      deployed: isDeployed(deployment),
    };
  });

  app.post("/snapshots/:id/prepare", async (request) => {
    const user = await requireUser(request);
    const deployment = requireContracts();
    const { id } = request.params as { id: string };
    const snapshot = await prisma.snapshot.findFirst({ where: { id, userId: user.id } });
    if (!snapshot) throw httpError(404, "Snapshot not found");
    const recomputed = contentHash(JSON.parse(snapshot.canonicalJson));
    if (recomputed.toLowerCase() !== snapshot.contentHash.toLowerCase()) {
      throw httpError(409, "Stored snapshot does not match its content hash");
    }
    return {
      snapshotId: snapshot.id,
      contentHash: snapshot.contentHash,
      recordType: planRecordType(),
      consentScope: consentScope(),
      contractAddress: deployment.registry,
      chainId: deployment.chainId,
      canonicalJson: snapshot.canonicalJson,
    };
  });

  app.post("/chain/confirm", async (request) => {
    const user = await requireUser(request);
    const deployment = requireContracts();
    const body = z.object({ snapshotId: z.string().min(1), txHash: txHashSchema }).parse(request.body);
    const snapshot = await prisma.snapshot.findFirst({ where: { id: body.snapshotId, userId: user.id } });
    if (!snapshot) throw httpError(404, "Snapshot not found");

    const receipt = await readReceipt(body.txHash);
    let recordId = "";
    try {
      recordId = assertAttestation(asReceipt(receipt), {
        registry: deployment.registry,
        subject: user.address,
        contentHash: snapshot.contentHash,
        recordType: planRecordType(),
      }).recordId;
    } catch (error) {
      throw httpError(400, error instanceof Error ? error.message : "Receipt check failed");
    }

    const saved = await prisma.chainRecord.upsert({
      where: { snapshotId: snapshot.id },
      update: {
        txHash: body.txHash,
        recordId,
        recordType: planRecordType(),
        subject: user.address,
        contentHash: snapshot.contentHash,
        status: "verified",
        blockNumber: String(receipt.blockNumber),
      },
      create: {
        snapshotId: snapshot.id,
        txHash: body.txHash,
        recordId,
        recordType: planRecordType(),
        subject: user.address,
        contentHash: snapshot.contentHash,
        status: "verified",
        blockNumber: String(receipt.blockNumber),
      },
    });

    return {
      verified: true,
      txHash: saved.txHash,
      recordId: saved.recordId,
      blockNumber: saved.blockNumber,
    };
  });

  app.get("/snapshots/:id/verification", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const snapshot = await prisma.snapshot.findFirst({
      where: { id, userId: user.id },
      include: { chainRecord: true },
    });
    if (!snapshot) throw httpError(404, "Snapshot not found");
    const recomputedHash = contentHash(JSON.parse(snapshot.canonicalJson));
    const hashMatchesStored = recomputedHash.toLowerCase() === snapshot.contentHash.toLowerCase();
    let chainRead = false;
    let liveMatch = false;
    let detail = snapshot.chainRecord
      ? "A receipt is saved. The local chain has not confirmed it on this request."
      : "This snapshot has no chain attestation yet.";

    if (snapshot.chainRecord && hashMatchesStored) {
      try {
        const deployment = requireContracts();
        const receipt = await readReceipt(snapshot.chainRecord.txHash);
        assertAttestation(asReceipt(receipt), {
          registry: deployment.registry,
          subject: user.address,
          contentHash: recomputedHash,
          recordType: planRecordType(),
        });
        chainRead = true;
        liveMatch = true;
        detail = "The local chain event matches this snapshot.";
      } catch (error) {
        chainRead = false;
        liveMatch = false;
        detail = error instanceof Error ? error.message : "The local chain could not be read.";
      }
    }

    return {
      snapshotId: snapshot.id,
      contentHash: snapshot.contentHash,
      recomputedHash,
      hashMatchesStored,
      onChain: snapshot.chainRecord
        ? {
            txHash: snapshot.chainRecord.txHash,
            recordId: snapshot.chainRecord.recordId,
            status: snapshot.chainRecord.status,
            blockNumber: snapshot.chainRecord.blockNumber,
          }
        : null,
      chainRead,
      verified: hashMatchesStored && liveMatch,
      detail,
    };
  });

  app.post("/chain/vault/confirm", async (request) => {
    const user = await requireUser(request);
    const deployment = requireContracts();
    const body = z
      .object({
        txHash: txHashSchema,
        action: z.enum(["faucet", "approve", "deposit", "withdraw"]),
      })
      .parse(request.body);
    const expectedTo = body.action === "deposit" || body.action === "withdraw" ? deployment.vault : deployment.asset;
    const receipt = await readReceipt(body.txHash);
    try {
      assertSuccessfulCall(asReceipt(receipt), { from: user.address, to: expectedTo });
    } catch (error) {
      throw httpError(400, error instanceof Error ? error.message : "Receipt check failed");
    }
    const saved = await prisma.vaultReceipt.upsert({
      where: { txHash: body.txHash },
      update: { action: body.action, blockNumber: String(receipt.blockNumber) },
      create: {
        userId: user.id,
        txHash: body.txHash,
        action: body.action,
        blockNumber: String(receipt.blockNumber),
      },
    });
    return { ok: true, txHash: saved.txHash, action: saved.action, blockNumber: saved.blockNumber };
  });

  app.get("/chain/vault/receipts", async (request) => {
    const user = await requireUser(request);
    const receipts = await prisma.vaultReceipt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return {
      receipts: receipts.map((receipt) => ({
        txHash: receipt.txHash,
        action: receipt.action,
        blockNumber: receipt.blockNumber,
        createdAt: receipt.createdAt.toISOString(),
      })),
    };
  });
}
