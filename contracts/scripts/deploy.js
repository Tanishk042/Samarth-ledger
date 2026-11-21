/* Deploy FDRLedger to Polygon Amoy. Usage: npm run deploy:amoy */
const fs = require('fs')
const path = require('path')
const hre = require('hardhat')

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const balance = await hre.ethers.provider.getBalance(deployer.address)
  console.log(`Deployer: ${deployer.address}`)
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} POL`)

  const Contract = await hre.ethers.getContractFactory('FDRLedger')
  const ledger = await Contract.deploy()
  await ledger.waitForDeployment()
  const address = await ledger.getAddress()
  const receipt = await ledger.deploymentTransaction().wait()

  const out = {
    network: 'polygon-amoy',
    chainId: 80002,
    address,
    deployer: deployer.address,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
    note: 'Prototype contract. Roles are held by the deployer until reassigned. No funds are custodied.',
  }
  const dir = path.join(__dirname, '..', 'deployments')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'amoy.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log(`\nFDRLedger deployed to ${address}`)
  console.log(`Set VITE_CONTRACT_ADDRESS=${address} in the frontend environment, then redeploy the web app.`)
  console.log(`Deployment record written to contracts/deployments/amoy.json`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
