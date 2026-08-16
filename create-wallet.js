import { Wallet } from "ethers";

const wallet = Wallet.createRandom();

console.log(JSON.stringify({
  address: wallet.address,
  privateKey: wallet.privateKey,
}, null, 2));
