export async function createAgentWallet({ privateKey, provider } = {}) {
  if (!privateKey) {
    throw new Error("Private key is required to create a wallet signer.");
  }

  const { Wallet } = await import("ethers");
  const wallet = new Wallet(privateKey, provider || null);

  return {
    wallet,
    address: wallet.address,
    async getBalance() {
      if (!provider) {
        throw new Error("A provider is required before checking a wallet balance.");
      }
      return provider.getBalance(wallet.address);
    },
  };
}

export default createAgentWallet;
