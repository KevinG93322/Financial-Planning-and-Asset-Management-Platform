# Financial Planning and Asset Management Platform

A local MVP that combines household financial planning with an EVM record layer. A signed-in user keeps income, balances, and goals in PostgreSQL, receives a personalized planning snapshot, and attests a hash of that snapshot from their wallet. A separate demo vault shows ERC-20 and ERC-4626 flows on a local Hardhat chain.

Plans are educational simulations based on the figures entered in the app. They are not financial, investment, tax, or legal advice. Demo tokens have no monetary value.

## What this MVP demonstrates

- Wallet sign-in. The user signs a one-time message. The API recovers the address and opens an HttpOnly session.
- Household records. Profile, accounts, and goals are stored off chain, with amounts kept as integer cents.
- Planning. The API computes net worth, savings rate, allocation, and goal gaps, then writes a structured plan. An OpenAI-compatible provider can draft the narrative. A rules engine produces the same JSON shape when no API key is configured.
- On-chain attestation. The wallet registers, grants a consent scope, and appends a content hash. The API reads the receipt and checks that the event matches the stored snapshot.
- Tokenized demo vault. A capped ERC-20 faucet feeds an ERC-4626 vault. Deposit and withdraw are signed in the browser and confirmed from receipts.
- A shared canonical hash. The API and the browser hash the same sorted JSON, so the wallet attests the payload the database stored.

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js, TypeScript, ethers v6 |
| API | Fastify, Prisma, Zod |
| Database | PostgreSQL |
| Contracts | Solidity 0.8.28, OpenZeppelin, Hardhat |
| Shared | Canonical JSON, keccak256, ABIs, sign-in message |

## Repository

```text
apps/web                 Next.js interface
apps/api                 Fastify API, Prisma schema, planning engine
packages/contracts       PlatformRegistry, DemoAsset, PlanningVault
packages/shared          Hash helper, ABIs, and shared constants
deployments/local.json   Addresses written by the deploy script
docs/architecture.md     Off-chain and on-chain boundary
```

| Contract | Role |
| --- | --- |
| `PlatformRegistry` | Self-registration, consent, and append-only content hashes |
| `DemoAsset` | Local ERC-20 with a one-time faucet |
| `PlanningVault` | ERC-4626 vault for the demo asset |

Household figures stay in PostgreSQL. The chain stores the wallet address, the consent flag, and the hash.

## Run locally

Requirements: Node.js 20 or newer, and npm. Docker is optional.

From the repository root:

```powershell
npm install
copy apps\api\.env.example apps\api\.env
```

Start PostgreSQL. The app expects host port **55432**, so it can run beside an existing PostgreSQL service on 5432.

```powershell
docker compose up -d
```

When Docker is not available:

```powershell
npm run db:start
```

Leave that process running, then apply the schema:

```powershell
npm run prisma:generate
npm run prisma:deploy
```

Start the chain, deploy, and launch the app in separate terminals:

```powershell
npm --workspace @fp/contracts run node
npm --workspace @fp/contracts run deploy
npm run dev:api
npm run dev:web
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

`deploy` writes `deployments/local.json`. Restarting the Hardhat node clears chain state, so run `deploy` again after a restart.

## Demo walkthrough

1. Choose **Sign in with Hardhat account**. This uses Hardhat's published local account #1 and signs only when the chain id is 31337 and the RPC host is loopback.
2. On **Household**, load the sample household.
3. On **Plan**, generate a plan, then record it on chain. The page reports when the chain event matches the stored snapshot.
4. On **Vault**, claim demo tokens and deposit into the vault. Shares and asset value are read from the contract.

MetaMask can be used instead. Add `http://127.0.0.1:8545`, chain id `31337`, and import one of the accounts printed by the Hardhat node. Those keys are public test keys for the local chain.

## Tests

```powershell
npm test
```

Contract tests cover registration, consent, rejected empty hashes, the faucet cap, and ERC-4626 deposit and withdraw accounting. API tests cover canonical hashing, household metrics, the rules planner, AI response parsing, and receipt checks.

## Optional AI narrative

Set `OPENAI_API_KEY` in `apps/api/.env`. The API calls an OpenAI-compatible chat endpoint and stores the plan source as `ai`. With no key, or if the provider fails, the rules engine writes the plan and the source is `rules`. Metrics are always computed in application code.

`OPENAI_BASE_URL` and `OPENAI_MODEL` override the provider endpoint and model.

## Further reading

The data boundary, verification flow, and contract responsibilities are described in [docs/architecture.md](docs/architecture.md).
