// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FDRLedger
 * @notice Soulbound ledger for AICTE security-deposit FDRs. A deposit is
 *         registered once, approved by two independent parties (an AI/bank
 *         agent and an AICTE officer), and can only be released when both
 *         approvals exist and the published policy rules pass.
 * @dev Prototype contract. Amounts are whole INR (no decimals). No funds are
 *      custodied or transferred by this contract; it records intent and
 *      evidence only. All seeded data in the prototype is illustrative.
 */
contract FDRLedger {
    /* ── Types ─────────────────────────────────────────────────────────────── */

    struct FDR {
        bytes32 fingerprint;
        string fdNumber;
        uint256 amount;
        address institution;
        address bank;
        uint64 issueDate;
        uint64 maturityDate;
        bool grievance;
        bool riskHold;
        bool agentApproved;
        bool officerApproved;
        bool voiceAttested;
        bool released;
        uint64 registeredAt;
        uint64 releasedAt;
        bytes32 docHash;
        bytes32 agentApprovalHash;
        bytes32 officerApprovalHash;
        bytes32 voiceHash;
    }

    /* ── Roles ─────────────────────────────────────────────────────────────── */

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant OFFICER_ROLE = keccak256("OFFICER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant INSTITUTION_ROLE = keccak256("INSTITUTION_ROLE");

    /* ── Storage ───────────────────────────────────────────────────────────── */

    string public constant name = "Samarth FDR Token";
    string public constant symbol = "SBDR";
    uint8 public constant decimals = 0;

    uint256 public constant PAUSE_THRESHOLD = 2;
    uint256 public preApprovalLimit;
    uint256 public voiceThreshold;

    bool public paused;
    uint256 public totalRegistered;
    uint256 public totalReleased;

    mapping(bytes32 => mapping(address => bool)) private roles;
    mapping(uint256 => FDR) private records;
    mapping(uint256 => address) private tokenOwner;
    mapping(address => uint256) private balance;
    mapping(address => bool) private pauseConfirmed;
    mapping(address => bool) private resumeConfirmed;
    uint256 private pauseConfirmations;
    uint256 private resumeConfirmations;

    uint256 private immutable deployedAt;

    /* ── Events ────────────────────────────────────────────────────────────── */

    event FDRRegistered(uint256 indexed tokenId, address indexed institution, bytes32 fingerprint, uint256 amount);
    event AgentApproved(uint256 indexed tokenId, address indexed agent, bytes32 docHash);
    event OfficerApproved(uint256 indexed tokenId, address indexed officer, bytes32 decisionHash);
    event VoiceAttested(uint256 indexed tokenId, address indexed officer, bytes32 voiceHash);
    event FDRReleased(uint256 indexed tokenId, address indexed institution, uint256 amount, uint256 at);
    event RiskFlagChanged(uint256 indexed tokenId, bool riskHold, address indexed actor);
    event GrievanceChanged(uint256 indexed tokenId, bool grievance, address indexed actor);
    event PolicyUpdated(uint256 preApprovalLimit, uint256 voiceThreshold);
    event EmergencyPauseChanged(bool paused, uint256 confirmations);
    event RoleGranted(bytes32 indexed role, address indexed account);
    event RoleRevoked(bytes32 indexed role, address indexed account);

    /* ── Modifiers ─────────────────────────────────────────────────────────── */

    modifier onlyRole(bytes32 role) {
        require(roles[role][msg.sender], "access denied");
        _;
    }

    modifier exists(uint256 tokenId) {
        require(tokenOwner[tokenId] != address(0), "unknown token");
        _;
    }

    modifier notReleased(uint256 tokenId) {
        require(!records[tokenId].released, "already released");
        _;
    }

    /* ── Construction & admin ──────────────────────────────────────────────── */

    constructor() {
        deployedAt = block.timestamp;
        // Demo genesis: deployer holds all three operational roles. Real
        // deployments should grant roles to separate wallets immediately.
        roles[DEFAULT_ADMIN_ROLE][msg.sender] = true;
        roles[OFFICER_ROLE][msg.sender] = true;
        roles[AGENT_ROLE][msg.sender] = true;
        roles[INSTITUTION_ROLE][msg.sender] = true;
        preApprovalLimit = 50_000_000; // ₹5 Cr, illustrative policy target
        voiceThreshold = 1_000_000; // ₹10 L, illustrative policy target
        emit RoleGranted(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "zero address");
        if (!roles[role][account]) {
            roles[role][account] = true;
            emit RoleGranted(role, account);
        }
    }

    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(role != DEFAULT_ADMIN_ROLE || account != msg.sender, "cannot revoke self");
        if (roles[role][account]) {
            roles[role][account] = false;
            emit RoleRevoked(role, account);
        }
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return roles[role][account];
    }

    function setPolicy(uint256 preApprovalLimit_, uint256 voiceThreshold_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(preApprovalLimit_ > 0 && voiceThreshold_ > 0, "invalid policy");
        require(preApprovalLimit_ >= voiceThreshold_, "limit below voice threshold");
        preApprovalLimit = preApprovalLimit_;
        voiceThreshold = voiceThreshold_;
        emit PolicyUpdated(preApprovalLimit_, voiceThreshold_);
    }

    /* ── Registration ──────────────────────────────────────────────────────── */

    function registerFDR(
        bytes32 fingerprint,
        string calldata fdNumber,
        uint256 amount,
        address institution,
        address bank,
        uint64 issueDate,
        uint64 maturityDate
    ) external onlyRole(INSTITUTION_ROLE) returns (uint256 tokenId) {
        require(fingerprint != bytes32(0), "fingerprint required");
        require(bytes(fdNumber).length > 0, "fd number required");
        require(amount > 0, "amount required");
        require(institution != address(0) && bank != address(0), "zero address");
        require(maturityDate >= issueDate, "invalid maturity");

        tokenId = ++totalRegistered;
        tokenOwner[tokenId] = institution;
        balance[institution] += 1;
        records[tokenId] = FDR({
            fingerprint: fingerprint,
            fdNumber: fdNumber,
            amount: amount,
            institution: institution,
            bank: bank,
            issueDate: issueDate,
            maturityDate: maturityDate,
            grievance: false,
            riskHold: false,
            agentApproved: false,
            officerApproved: false,
            voiceAttested: false,
            released: false,
            registeredAt: uint64(block.timestamp),
            releasedAt: 0,
            docHash: bytes32(0),
            agentApprovalHash: bytes32(0),
            officerApprovalHash: bytes32(0),
            voiceHash: bytes32(0)
        });
        emit FDRRegistered(tokenId, institution, fingerprint, amount);
    }

    /* ── Dual-lock approvals ───────────────────────────────────────────────── */

    function approveByAgent(uint256 tokenId, bytes32 docHash, bytes32 approvalHash)
        external
        onlyRole(AGENT_ROLE)
        exists(tokenId)
        notReleased(tokenId)
    {
        require(!records[tokenId].agentApproved, "agent already approved");
        require(approvalHash != bytes32(0), "AI key missing or invalid");
        records[tokenId].agentApproved = true;
        records[tokenId].docHash = docHash;
        records[tokenId].agentApprovalHash = approvalHash;
        emit AgentApproved(tokenId, msg.sender, docHash);
    }

    function approveByOfficer(uint256 tokenId, bytes32 decisionHash)
        external
        onlyRole(OFFICER_ROLE)
        exists(tokenId)
        notReleased(tokenId)
    {
        require(!records[tokenId].officerApproved, "officer already approved");
        require(decisionHash != bytes32(0), "officer key missing or invalid");
        records[tokenId].officerApproved = true;
        records[tokenId].officerApprovalHash = decisionHash;
        emit OfficerApproved(tokenId, msg.sender, decisionHash);
    }

    function attestVoice(uint256 tokenId, bytes32 voiceHash)
        external
        onlyRole(OFFICER_ROLE)
        exists(tokenId)
        notReleased(tokenId)
    {
        require(voiceHash != bytes32(0), "voice proof required");
        records[tokenId].voiceAttested = true;
        records[tokenId].voiceHash = voiceHash;
        emit VoiceAttested(tokenId, msg.sender, voiceHash);
    }

    function release(uint256 tokenId) external exists(tokenId) notReleased(tokenId) {
        require(!paused, "contract paused by officials");

        FDR storage record = records[tokenId];
        require(
            block.timestamp >= record.maturityDate && !record.grievance && !record.riskHold && record.amount <= preApprovalLimit,
            "release rules not satisfied"
        );
        require(record.agentApprovalHash != bytes32(0), "AI key missing or invalid");
        require(record.officerApprovalHash != bytes32(0), "officer key missing or invalid");
        require(record.agentApproved && record.officerApproved, "dual signature required");
        if (record.amount >= voiceThreshold) {
            require(record.voiceAttested, "high-value voice challenge incomplete");
        }

        record.released = true;
        record.releasedAt = uint64(block.timestamp);
        totalReleased += 1;
        emit FDRReleased(tokenId, record.institution, record.amount, record.releasedAt);
    }

    /* ── Risk workflow ─────────────────────────────────────────────────────── */

    function setRiskFlag(uint256 tokenId, bool on)
        external
        onlyRole(OFFICER_ROLE)
        exists(tokenId)
        notReleased(tokenId)
    {
        records[tokenId].riskHold = on;
        emit RiskFlagChanged(tokenId, on, msg.sender);
    }

    function setGrievance(uint256 tokenId, bool on)
        external
        onlyRole(OFFICER_ROLE)
        exists(tokenId)
        notReleased(tokenId)
    {
        records[tokenId].grievance = on;
        emit GrievanceChanged(tokenId, on, msg.sender);
    }

    /* ── Multi-official emergency pause ────────────────────────────────────── */

    function confirmEmergencyPause() external onlyRole(OFFICER_ROLE) {
        require(!paused, "already paused");
        if (!pauseConfirmed[msg.sender]) {
            pauseConfirmed[msg.sender] = true;
            pauseConfirmations += 1;
        }
        resumeConfirmed[msg.sender] = false;
        if (pauseConfirmations >= PAUSE_THRESHOLD) {
            paused = true;
            pauseConfirmations = 0;
            emit EmergencyPauseChanged(true, PAUSE_THRESHOLD);
        }
    }

    function confirmEmergencyResume() external onlyRole(OFFICER_ROLE) {
        require(paused, "not paused");
        if (!resumeConfirmed[msg.sender]) {
            resumeConfirmed[msg.sender] = true;
            resumeConfirmations += 1;
        }
        pauseConfirmed[msg.sender] = false;
        if (resumeConfirmations >= PAUSE_THRESHOLD) {
            paused = false;
            resumeConfirmations = 0;
            emit EmergencyPauseChanged(false, PAUSE_THRESHOLD);
        }
    }

    /* ── Views ─────────────────────────────────────────────────────────────── */

    function getFDR(uint256 tokenId) external view exists(tokenId) returns (FDR memory) {
        return records[tokenId];
    }

    function verifyFingerprint(uint256 tokenId, bytes32 candidate) external view exists(tokenId) returns (bool) {
        return records[tokenId].fingerprint == candidate;
    }

    function ownerOf(uint256 tokenId) external view exists(tokenId) returns (address) {
        return tokenOwner[tokenId];
    }

    function balanceOf(address account) external view returns (uint256) {
        return balance[account];
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd; // ERC165 / ERC721
    }

    function policy() external view returns (uint256 limit, uint256 voiceAt, bool isPaused, uint64 deployed) {
        return (preApprovalLimit, voiceThreshold, paused, uint64(deployedAt));
    }

    /* ── Soulbound enforcement ─────────────────────────────────────────────── */

    function transferFrom(address, address, uint256) public pure {
        revert("soulbound: transfers disabled");
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert("soulbound: transfers disabled");
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) public pure {
        revert("soulbound: transfers disabled");
    }

    function approve(address, uint256) public pure {
        revert("soulbound: approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure {
        revert("soulbound: approvals disabled");
    }
}
