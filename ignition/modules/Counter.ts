import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgentPayModule", (m) => {

   

    const registry = m.contract("AgentRegistry");



    const reputation = m.contract(
        "ReputationManager"
    );



    const marketplace = m.contract(
        "JobMarketplace",
        [
            registry,
            reputation
        ]
    );


  

    m.call(
        reputation,
        "setMarketplace",
        [
            marketplace
        ]
    );




    const escrow = m.contract(
        "JobEscrow",
        [
            marketplace,
            registry
        ]
    );


    return {
        registry,
        reputation,
        marketplace,
        escrow
    };
});