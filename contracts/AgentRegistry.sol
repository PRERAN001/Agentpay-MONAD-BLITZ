// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

contract AgentRegistry {

    struct Agent {
        address owner;
        string name;
        string metadataURI;
        uint256 price;
        uint256 reputation;
        bool active;
    }

    uint256 public agentCount;

    mapping(uint256 => Agent) public agents;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        uint256 price
    );

    event AgentUpdated(
        uint256 indexed agentId,
        string name,
        uint256 price,
        bool active
    );

    function registerAgent(
        string calldata name,
        string calldata metadataURI,
        uint256 price
    ) external returns (uint256) {

        agentCount++;

        agents[agentCount] = Agent({
            owner: msg.sender,
            name: name,
            metadataURI: metadataURI,
            price: price,
            reputation: 0,
            active: true
        });

        emit AgentRegistered(
            agentCount,
            msg.sender,
            name,
            price
        );

        return agentCount;
    }

    function updateAgent(
        uint256 agentId,
        string calldata name,
        string calldata metadataURI,
        uint256 price,
        bool active
    ) external {

        require(
            agents[agentId].owner == msg.sender,
            "Not agent owner"
        );

        agents[agentId].name = name;
        agents[agentId].metadataURI = metadataURI;
        agents[agentId].price = price;
        agents[agentId].active = active;

        emit AgentUpdated(
            agentId,
            name,
            price,
            active
        );
    }

    function getAgent(
        uint256 agentId
    ) external view returns (Agent memory) {

        require(
            agentId > 0 && agentId <= agentCount,
            "Agent does not exist"
        );

        return agents[agentId];
    }
}