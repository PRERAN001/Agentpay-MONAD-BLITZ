export function createMarketplaceClient(blockchain) {
  return {

    // -----------------------------
    // READ
    // -----------------------------

    async getAgent(agentId) {
      return blockchain.getAgent(agentId);
    },

    async getOpenJobs() {
      return blockchain.getOpenJobs();
    },

    async getJob(jobId) {
      return blockchain.getJob(jobId);
    },

    async getReputation(agentId) {
      return blockchain.getReputation(agentId);
    },


    // -----------------------------
    // AGENT
    // -----------------------------

    async registerAgent({
      name,
      priceWei,
      metadataURI = ""
    }) {
      return blockchain.registerAgent({
        name,
        metadataURI,
        priceWei
      });
    },


    // -----------------------------
    // JOB ACTIONS
    // -----------------------------

    async createJob({
      agentId,
      description,
      rewardWei
    }) {
      return blockchain.createJob({
        agentId,
        description,
        reward: rewardWei
      });
    },

    async deposit(jobId, valueWei) {
      return blockchain.deposit(
        jobId,
        valueWei
      );
    },

    async acceptJob(jobId) {
      return blockchain.acceptJob(jobId);
    },

    async completeJob(jobId) {
      return blockchain.completeJob(jobId);
    },

    async release(jobId) {
      return blockchain.release(jobId);
    },


    // -----------------------------
    // HIRE ANOTHER AGENT
    // -----------------------------

    async hireAgent({
      agentId,
      description,
      rewardWei
    }) {

      console.log(
        `Looking up Agent #${agentId}...`
      );

      // 1. Get target agent
      const agent =
        await blockchain.getAgent(agentId);

      console.log(
        `Agent: ${agent.name}`
      );

      console.log(
        `Price: ${agent.price.toString()} wei`
      );

      console.log(
        `Reputation: ${agent.reputation.toString()}`
      );


      // 2. Make sure agent is active
      if (!agent.active) {
        throw new Error(
          "Cannot hire inactive agent."
        );
      }


     

      const reward =
        rewardWei ?? agent.price;


      
      console.log(
        "Creating job..."
      );

      const createTx =
        await blockchain.createJob({
          agentId,
          description,
          reward
        });

      const createReceipt =
        await createTx.wait();

      console.log(
        "Job creation confirmed:"
      );

      console.log(
        createReceipt.hash
      );


      

      const count =
        await blockchain.getJobCount();

      const jobId =
        Number(count);


      console.log(
        `Created Job #${jobId}`
      );


      console.log(
        `Depositing ${reward.toString()} wei...`
      );

      const depositTx =
        await blockchain.deposit(
          jobId,
          reward
        );

      const depositReceipt =
        await depositTx.wait();

      console.log(
        "Deposit confirmed:"
      );

      console.log(
        depositReceipt.hash
      );



      return {
        jobId,
        agentId,
        rewardWei: reward.toString(),
        createTransaction:
          createReceipt.hash,
        depositTransaction:
          depositReceipt.hash
      };
    }
  };
}

export default createMarketplaceClient;