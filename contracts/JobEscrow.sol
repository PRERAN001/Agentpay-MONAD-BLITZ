// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IJobMarketplace {

    enum JobStatus {
        OPEN,
        ACCEPTED,
        COMPLETED
    }

    struct Job {
        uint256 jobId;
        address client;
        uint256 agentId;
        string description;
        uint256 reward;
        address agentWorker;
        JobStatus status;
    }

    function getJob(uint256 jobId)
        external
        view
        returns (Job memory);
}

interface IAgentRegistry {

    struct Agent {
        address owner;
        string name;
        string metadataURI;
        uint256 price;
        uint256 reputation;
        bool active;
    }

    function getAgent(uint256 agentId)
        external
        view
        returns (Agent memory);
}

contract JobEscrow {

    IJobMarketplace public marketplace;
    IAgentRegistry public registry;

    mapping(uint256 => uint256) public escrowBalance;

    event PaymentDeposited(
        uint256 indexed jobId,
        address indexed client,
        uint256 amount
    );

    event PaymentReleased(
        uint256 indexed jobId,
        address indexed agent,
        uint256 amount
    );

    constructor(
        address marketplaceAddress,
        address registryAddress
    ) {
        marketplace = IJobMarketplace(marketplaceAddress);
        registry = IAgentRegistry(registryAddress);
    }

    function deposit(uint256 jobId)
        external
        payable
    {
        IJobMarketplace.Job memory job =
            marketplace.getJob(jobId);

        require(
            job.jobId != 0,
            "Job does not exist"
        );

        require(
            job.client == msg.sender,
            "Not job client"
        );

        require(
            job.status == IJobMarketplace.JobStatus.OPEN,
            "Job not open"
        );

        require(
            msg.value == job.reward,
            "Incorrect payment"
        );

        escrowBalance[jobId] += msg.value;

        emit PaymentDeposited(
            jobId,
            msg.sender,
            msg.value
        );
    }

    function release(uint256 jobId)
        external
    {
        IJobMarketplace.Job memory job =
            marketplace.getJob(jobId);

        require(
            job.jobId != 0,
            "Job does not exist"
        );

        require(
            job.status == IJobMarketplace.JobStatus.COMPLETED,
            "Job not completed"
        );

        uint256 amount = escrowBalance[jobId];

        require(
            amount > 0,
            "No funds in escrow"
        );

        escrowBalance[jobId] = 0;

        IAgentRegistry.Agent memory agent =
            registry.getAgent(job.agentId);

        payable(agent.owner).transfer(amount);

        emit PaymentReleased(
            jobId,
            agent.owner,
            amount
        );
    }
}