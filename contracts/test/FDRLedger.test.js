const { expect } = require('chai')
const { ethers } = require('hardhat')

const DAY = 24 * 60 * 60
const AGENT = ethers.keccak256(ethers.toUtf8Bytes('AGENT_ROLE'))
const OFFICER = ethers.keccak256(ethers.toUtf8Bytes('OFFICER_ROLE'))
const ADMIN = ethers.ZeroHash
const FP = (text) => ethers.keccak256(ethers.toUtf8Bytes(text))
const APPROVAL = (text) => ethers.keccak256(ethers.toUtf8Bytes(text))

async function deploy() {
  const [admin, officer, agent, institution, bank, outsider] = await ethers.getSigners()
  const Contract = await ethers.getContractFactory('FDRLedger')
  const ledger = await Contract.deploy()
  await ledger.waitForDeployment()
  await ledger.grantRole(OFFICER, officer.address)
  await ledger.grantRole(AGENT, agent.address)
  await ledger.grantRole(ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE')), institution.address)
  return { ledger, admin, officer, agent, institution, bank, outsider }
}

async function register(ledger, institution, overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  const tx = await ledger
    .connect(institution)
    .registerFDR(
      overrides.fingerprint ?? FP('fdr-1'),
      overrides.fdNumber ?? 'HDFC123456789',
      overrides.amount ?? 2_500_000,
      overrides.institution ?? institution.address,
      overrides.bank ?? institution.address,
      overrides.issueDate ?? now - 10 * DAY,
      overrides.maturityDate ?? now - DAY,
    )
  const receipt = await tx.wait()
  const event = receipt.logs.map((log) => ledger.interface.parseLog(log)).find((log) => log?.name === 'FDRRegistered')
  return event.args.tokenId
}

describe('FDRLedger', function () {
  it('deploys with illustrative policy defaults and roles', async function () {
    const { ledger, admin, outsider } = await deploy()
    const policy = await ledger.policy()
    expect(policy.limit).to.equal(50_000_000n)
    expect(policy.voiceAt).to.equal(1_000_000n)
    expect(policy.isPaused).to.equal(false)
    expect(await ledger.hasRole(ADMIN, admin.address)).to.equal(true)
    expect(await ledger.hasRole(OFFICER, outsider.address)).to.equal(false)
  })

  it('registers a soulbound token owned by the institution', async function () {
    const { ledger, institution, outsider } = await deploy()
    const tokenId = await register(ledger, institution)
    expect(await ledger.ownerOf(tokenId)).to.equal(institution.address)
    expect(await ledger.balanceOf(institution.address)).to.equal(1n)
    expect(await ledger.verifyFingerprint(tokenId, FP('fdr-1'))).to.equal(true)
    expect(await ledger.verifyFingerprint(tokenId, FP('wrong'))).to.equal(false)

    await expect(ledger.connect(institution).transferFrom(institution.address, outsider.address, tokenId)).to.be.revertedWith(
      'soulbound: transfers disabled',
    )
    await expect(ledger.connect(institution).approve(outsider.address, tokenId)).to.be.revertedWith(
      'soulbound: approvals disabled',
    )
  })

  it('keeps the dual lock: neither key alone releases', async function () {
    const { ledger, institution, agent, officer } = await deploy()
    const tokenId = await register(ledger, institution)
    await ledger.connect(agent).approveByAgent(tokenId, FP('doc'), APPROVAL('ai'))
    await expect(ledger.connect(officer).release(tokenId)).to.be.revertedWith('officer key missing or invalid')
    await ledger.connect(officer).approveByOfficer(tokenId, APPROVAL('officer'))
    const record = await ledger.getFDR(tokenId)
    expect(record.agentApproved).to.equal(true)
    expect(record.officerApproved).to.equal(true)
    expect(record.released).to.equal(false)

    // Remove agent key path with a fresh token to prove the other direction.
    const second = await register(ledger, institution, { fingerprint: FP('fdr-2') })
    await ledger.connect(officer).approveByOfficer(second, APPROVAL('officer-2'))
    await expect(ledger.connect(officer).release(second)).to.be.revertedWith('AI key missing or invalid')
  })

  it('enforces policy rules before release', async function () {
    const { ledger, institution, agent, officer } = await deploy()
    const now = Math.floor(Date.now() / 1000)
    const tokenId = await register(ledger, institution, { maturityDate: now + 10 * DAY })
    await ledger.connect(agent).approveByAgent(tokenId, FP('doc'), APPROVAL('ai'))
    await ledger.connect(officer).approveByOfficer(tokenId, APPROVAL('officer'))
    await expect(ledger.release(tokenId)).to.be.revertedWith('release rules not satisfied')

    await ledger.connect(officer).setGrievance(tokenId, true)
    await expect(ledger.release(tokenId)).to.be.revertedWith('release rules not satisfied')
    await ledger.connect(officer).setGrievance(tokenId, false)

    await ledger.connect(officer).setRiskFlag(tokenId, true)
    await expect(ledger.release(tokenId)).to.be.revertedWith('release rules not satisfied')
    await ledger.connect(officer).setRiskFlag(tokenId, false)

    const over = await register(ledger, institution, { fingerprint: FP('over'), amount: 60_000_000 })
    await ledger.connect(agent).approveByAgent(over, FP('doc'), APPROVAL('ai-over'))
    await ledger.connect(officer).approveByOfficer(over, APPROVAL('officer-over'))
    await expect(ledger.release(over)).to.be.revertedWith('release rules not satisfied')
  })

  it('adds a voice challenge for high-value deposits', async function () {
    const { ledger, institution, agent, officer } = await deploy()
    const tokenId = await register(ledger, institution, { amount: 2_500_000 }) // ≥ ₹10 L
    await ledger.connect(agent).approveByAgent(tokenId, FP('doc'), APPROVAL('ai'))
    await ledger.connect(officer).approveByOfficer(tokenId, APPROVAL('officer'))
    await expect(ledger.release(tokenId)).to.be.revertedWith('high-value voice challenge incomplete')

    await ledger.connect(officer).attestVoice(tokenId, APPROVAL('voice'))
    await expect(ledger.release(tokenId)).to.emit(ledger, 'FDRReleased')
    const record = await ledger.getFDR(tokenId)
    expect(record.released).to.equal(true)
    expect(await ledger.totalReleased()).to.equal(1n)
    await expect(ledger.release(tokenId)).to.be.revertedWith('already released')
  })

  it('allows low-value deposits without the voice factor', async function () {
    const { ledger, institution, agent, officer } = await deploy()
    const tokenId = await register(ledger, institution, { amount: 500_000 })
    await ledger.connect(agent).approveByAgent(tokenId, FP('doc'), APPROVAL('ai'))
    await ledger.connect(officer).approveByOfficer(tokenId, APPROVAL('officer'))
    await expect(ledger.release(tokenId)).to.emit(ledger, 'FDRReleased')
  })

  it('requires two distinct officers for an emergency pause and resume', async function () {
    const { ledger, admin, institution, officer, agent } = await deploy()
    const tokenId = await register(ledger, institution, { amount: 500_000 })
    await ledger.connect(agent).approveByAgent(tokenId, FP('doc'), APPROVAL('ai'))
    await ledger.connect(officer).approveByOfficer(tokenId, APPROVAL('officer'))

    await ledger.connect(officer).confirmEmergencyPause()
    expect((await ledger.policy()).isPaused).to.equal(false)
    await ledger.connect(officer).confirmEmergencyPause() // same officer cannot count twice
    await ledger.connect(admin).confirmEmergencyPause()
    expect((await ledger.policy()).isPaused).to.equal(true)
    await expect(ledger.release(tokenId)).to.be.revertedWith('contract paused by officials')

    await ledger.connect(officer).confirmEmergencyResume()
    await ledger.connect(admin).confirmEmergencyResume()
    expect((await ledger.policy()).isPaused).to.equal(false)
    await expect(ledger.release(tokenId)).to.emit(ledger, 'FDRReleased')
  })

  it('rejects unauthorised role operations', async function () {
    const { ledger, outsider, institution } = await deploy()
    await expect(ledger.connect(outsider).grantRole(OFFICER, outsider.address)).to.be.revertedWith('access denied')
    await expect(ledger.connect(outsider).setPolicy(1, 1)).to.be.revertedWith('access denied')
    await expect(ledger.connect(outsider).setRiskFlag(1, true)).to.be.revertedWith('access denied')
    await expect(ledger.connect(outsider).registerFDR(FP('x'), 'X', 1, outsider.address, outsider.address, 1, 2)).to.be.revertedWith(
      'access denied',
    )
    await expect(ledger.connect(institution).setPolicy(1, 2)).to.be.revertedWith('access denied')
  })
})
