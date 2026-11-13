// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Wallet registration, consent flags, and append-only content-hash attestations.
/// @dev The contract stores hashes and addresses. Household figures stay off chain.
contract PlatformRegistry is ReentrancyGuard {
    struct Record {
        address subject;
        bytes32 contentHash;
        bytes32 recordType;
        uint64 timestamp;
    }

    mapping(address => bool) public registered;
    mapping(address => mapping(bytes32 => bool)) public consent;
    Record[] private _records;

    event Registered(address indexed subject);
    event ConsentSet(address indexed subject, bytes32 indexed scope, bool granted);
    event Attested(
        uint256 indexed id,
        address indexed subject,
        bytes32 indexed contentHash,
        bytes32 recordType
    );

    error EmptyHash();
    error NotRegistered();

    modifier onlyRegistered() {
        if (!registered[msg.sender]) revert NotRegistered();
        _;
    }

    function register() external {
        if (registered[msg.sender]) return;
        registered[msg.sender] = true;
        emit Registered(msg.sender);
    }

    function setConsent(bytes32 scope, bool granted) external onlyRegistered nonReentrant {
        if (scope == bytes32(0)) revert EmptyHash();
        consent[msg.sender][scope] = granted;
        emit ConsentSet(msg.sender, scope, granted);
    }

    function attest(bytes32 contentHash, bytes32 recordType)
        external
        onlyRegistered
        nonReentrant
        returns (uint256 id)
    {
        if (contentHash == bytes32(0) || recordType == bytes32(0)) revert EmptyHash();
        id = _records.length;
        _records.push(
            Record({
                subject: msg.sender,
                contentHash: contentHash,
                recordType: recordType,
                timestamp: uint64(block.timestamp)
            })
        );
        emit Attested(id, msg.sender, contentHash, recordType);
    }

    function recordCount() external view returns (uint256) {
        return _records.length;
    }

    function getRecord(uint256 id) external view returns (Record memory) {
        return _records[id];
    }
}
