// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

contract ReputationManager {

    struct Reputation {
        uint256 score;
        uint256 completedJobs;
        uint256 failedJobs;
    }

    // Agent ID => reputation information
    mapping(uint256 => Reputation) public reputations;

    // Address of the JobMarketplace allowed to update reputation
    address public marketplace;

    // Person who deployed this contract
    address public owner;

    event MarketplaceUpdated(
        address indexed marketplace
    );

    event ReputationUpdated(
        uint256 indexed agentId,
        uint256 newScore,
        uint256 completedJobs,
        uint256 failedJobs
    );

    constructor() {
        owner = msg.sender;
    }

    // --------------------------------------------------
    // MODIFIERS
    // --------------------------------------------------

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only owner"
        );
        _;
    }

    modifier onlyMarketplace() {
        require(
            msg.sender == marketplace,
            "Only marketplace"
        );
        _;
    }

    // --------------------------------------------------
    // SET MARKETPLACE
    // --------------------------------------------------

    function setMarketplace(
        address marketplaceAddress
    )
        external
        onlyOwner
    {
        require(
            marketplaceAddress != address(0),
            "Invalid marketplace"
        );

        marketplace = marketplaceAddress;

        emit MarketplaceUpdated(
            marketplaceAddress
        );
    }

    // --------------------------------------------------
    // RECORD SUCCESS
    // --------------------------------------------------

    function recordSuccess(
        uint256 agentId
    )
        external
        onlyMarketplace
    {
        Reputation storage reputation =
            reputations[agentId];

        reputation.score += 10;
        reputation.completedJobs++;

        emit ReputationUpdated(
            agentId,
            reputation.score,
            reputation.completedJobs,
            reputation.failedJobs
        );
    }

    // --------------------------------------------------
    // RECORD FAILURE
    // --------------------------------------------------

    function recordFailure(
        uint256 agentId
    )
        external
        onlyMarketplace
    {
        Reputation storage reputation =
            reputations[agentId];

        if (reputation.score >= 5) {
            reputation.score -= 5;
        } else {
            reputation.score = 0;
        }

        reputation.failedJobs++;

        emit ReputationUpdated(
            agentId,
            reputation.score,
            reputation.completedJobs,
            reputation.failedJobs
        );
    }

    // --------------------------------------------------
    // GET REPUTATION
    // --------------------------------------------------

    function getReputation(
        uint256 agentId
    )
        external
        view
        returns (
            uint256 score,
            uint256 completedJobs,
            uint256 failedJobs
        )
    {
        Reputation memory reputation =
            reputations[agentId];

        return (
            reputation.score,
            reputation.completedJobs,
            reputation.failedJobs
        );
    }
}