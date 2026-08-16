// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

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

interface IReputationManager {
    function recordSuccess(uint256 agentId) external;
    function recordFailure(uint256 agentId) external;
}

contract JobMarketplace {

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

    IAgentRegistry public registry;
    IReputationManager public reputationManager;

    uint256 public jobCount;

    mapping(uint256 => Job) public jobs;

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        uint256 indexed agentId,
        string description,
        uint256 reward
    );

    event JobAccepted(
        uint256 indexed jobId,
        address indexed agent
    );

    event JobCompleted(
        uint256 indexed jobId
    );

    constructor(
        address registryAddress,
        address reputationManagerAddress
    ) {
        registry = IAgentRegistry(registryAddress);
        reputationManager =
            IReputationManager(reputationManagerAddress);
    }

    function createJob(
        uint256 agentId,
        string calldata description,
        uint256 reward
    ) external returns (uint256) {

        IAgentRegistry.Agent memory agent =
            registry.getAgent(agentId);

        require(
            agent.active,
            "Agent is not active"
        );

        jobCount++;

        jobs[jobCount] = Job({
            jobId: jobCount,
            client: msg.sender,
            agentId: agentId,
            description: description,
            reward: reward,
            agentWorker: address(0),
            status: JobStatus.OPEN
        });

        emit JobCreated(
            jobCount,
            msg.sender,
            agentId,
            description,
            reward
        );

        return jobCount;
    }

    function acceptJob(uint256 jobId) external {

        Job storage job = jobs[jobId];

        require(
            job.jobId != 0,
            "Job does not exist"
        );

        require(
            job.status == JobStatus.OPEN,
            "Job is not open"
        );

        IAgentRegistry.Agent memory agent =
            registry.getAgent(job.agentId);

        require(
            agent.owner == msg.sender,
            "Not agent owner"
        );

        job.agentWorker = msg.sender;
        job.status = JobStatus.ACCEPTED;

        emit JobAccepted(
            jobId,
            msg.sender
        );
    }

    function completeJob(uint256 jobId) external {

        Job storage job = jobs[jobId];

        require(
            job.jobId != 0,
            "Job does not exist"
        );

        require(
            job.status == JobStatus.ACCEPTED,
            "Job not accepted"
        );

        require(
            job.agentWorker == msg.sender,
            "Not assigned agent"
        );

        job.status = JobStatus.COMPLETED;

        // Award reputation for successful completion.
        reputationManager.recordSuccess(
            job.agentId
        );

        emit JobCompleted(
            jobId
        );
    }

    function getJob(uint256 jobId)
        external
        view
        returns (Job memory)
    {
        require(
            jobId > 0 && jobId <= jobCount,
            "Job does not exist"
        );

        return jobs[jobId];
    }
}