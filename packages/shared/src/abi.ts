export const registryAbi = [
  "function register()",
  "function registered(address account) view returns (bool)",
  "function setConsent(bytes32 scope, bool granted)",
  "function consent(address account, bytes32 scope) view returns (bool)",
  "function attest(bytes32 contentHash, bytes32 recordType) returns (uint256)",
  "function getRecord(uint256 id) view returns (address subject, bytes32 contentHash, bytes32 recordType, uint64 timestamp)",
  "function recordCount() view returns (uint256)",
  "event Registered(address indexed subject)",
  "event ConsentSet(address indexed subject, bytes32 indexed scope, bool granted)",
  "event Attested(uint256 indexed id, address indexed subject, bytes32 indexed contentHash, bytes32 recordType)",
] as const;

export const assetAbi = [
  "function faucet()",
  "function claimed(address account) view returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event FaucetClaimed(address indexed account, uint256 amount)",
] as const;

export const vaultAbi = [
  "function asset() view returns (address)",
  "function balanceOf(address account) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
] as const;
