const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * CHREMACOIN (CRMC) v3 — Test suite
 *
 * Coverage:
 *  - Metadata & initial supply
 *  - transfer / approve / transferFrom
 *  - pause / unpause
 *  - Supervisor role management (setSupervisor / removeSupervisor)
 *  - Permanent wallet lock (setLockedWalletEntity / removeLockedWalletEntity)
 *  - Time-locked balances (transferToLockedBalance, phased unlock 1→2→3)
 *  - setLockTime slot rules
 *  - burn / burnFrom (supervisor-only) + lock normalization after burn (CHC-01)
 *  - CHC-02: lock overwrite rejection
 *  - Edge cases: self-transfer, zero address, insufficient balance/allowance
 */

const DECIMALS = 8n;
const UNIT = 10n ** DECIMALS;
const INITIAL_SUPPLY = 50_000_000n * UNIT;

describe("CHREMACOIN (CRMC) v3", function () {
  async function deployFixture() {
    const [owner, supervisor, alice, bob, carol] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CHREMACOIN");
    const token = await Factory.deploy();
    await token.waitForDeployment();
    await token.setSupervisor(supervisor.address);
    return { token, owner, supervisor, alice, bob, carol };
  }

  // ---------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------
  describe("Metadata & deployment", function () {
    it("has correct name, symbol, decimals", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("CHREMACOIN");
      expect(await token.symbol()).to.equal("CRMC");
      expect(await token.decimals()).to.equal(8);
    });

    it("mints 50,000,000 CRMC to deployer", async function () {
      const { token, owner } = await loadFixture(deployFixture);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
      expect(await token.getOwner()).to.equal(owner.address);
    });
  });

  // ---------------------------------------------------------------
  // transfer
  // ---------------------------------------------------------------
  describe("transfer", function () {
    it("transfers tokens and emits Transfer", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      await expect(token.transfer(alice.address, 100n * UNIT))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, alice.address, 100n * UNIT);
      expect(await token.balanceOf(alice.address)).to.equal(100n * UNIT);
    });

    it("reverts on self transfer (CHC-05)", async function () {
      const { token, owner } = await loadFixture(deployFixture);
      await expect(token.transfer(owner.address, 1n)).to.be.revertedWith(
        "CRMC: self transfer not allowed"
      );
    });

    it("reverts on transfer to zero address", async function () {
      const { token } = await loadFixture(deployFixture);
      await expect(token.transfer(ethers.ZeroAddress, 1n)).to.be.revertedWith(
        "CRMC: transfer to the zero address"
      );
    });

    it("reverts when amount exceeds balance", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).transfer(bob.address, 1n)
      ).to.be.revertedWith("CRMC: transfer amount exceeds balance");
    });
  });

  // ---------------------------------------------------------------
  // approve / transferFrom
  // ---------------------------------------------------------------
  describe("approve / transferFrom", function () {
    it("sets allowance and transfers via transferFrom", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployFixture);
      await token.approve(alice.address, 50n * UNIT);
      expect(await token.allowance(owner.address, alice.address)).to.equal(50n * UNIT);

      await token.connect(alice).transferFrom(owner.address, bob.address, 30n * UNIT);
      expect(await token.balanceOf(bob.address)).to.equal(30n * UNIT);
      expect(await token.allowance(owner.address, alice.address)).to.equal(20n * UNIT);
    });

    it("reverts transferFrom exceeding allowance", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployFixture);
      await token.approve(alice.address, 10n);
      await expect(
        token.connect(alice).transferFrom(owner.address, bob.address, 11n)
      ).to.be.revertedWith("CRMC: transfer amount exceeds allowance");
    });

    it("reverts transferFrom when sender == recipient (CHC-05)", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      await token.approve(alice.address, 10n);
      await expect(
        token.connect(alice).transferFrom(owner.address, owner.address, 1n)
      ).to.be.revertedWith("CRMC: self transfer not allowed");
    });
  });

  // ---------------------------------------------------------------
  // pause / unpause
  // ---------------------------------------------------------------
  describe("pause / unpause", function () {
    it("only owner can pause and unpause", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await expect(token.connect(alice).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await token.pause();
      expect(await token.paused()).to.equal(true);
      await expect(token.connect(alice).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await token.unpause();
      expect(await token.paused()).to.equal(false);
    });

    it("blocks transfer, approve, transferFrom, burn while paused", async function () {
      const { token, owner, supervisor, alice } = await loadFixture(deployFixture);
      await token.transfer(alice.address, 10n * UNIT);
      await token.pause();
      await expect(token.transfer(alice.address, 1n)).to.be.revertedWith("Pausable: paused");
      await expect(token.approve(alice.address, 1n)).to.be.revertedWith("Pausable: paused");
      await expect(
        token.connect(alice).transferFrom(owner.address, alice.address, 1n)
      ).to.be.revertedWith("Pausable: paused");
      await expect(token.connect(supervisor).burn(1n)).to.be.revertedWith("Pausable: paused");
      await token.unpause();
      await expect(token.transfer(alice.address, 1n)).to.not.be.reverted;
    });
  });

  // ---------------------------------------------------------------
  // Supervisor role
  // ---------------------------------------------------------------
  describe("supervisor management", function () {
    it("owner can set and remove supervisor; events emitted", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await expect(token.setSupervisor(alice.address))
        .to.emit(token, "SupervisorSet")
        .withArgs(alice.address, true);
      expect(await token.isSupervisor(alice.address)).to.equal(true);

      await expect(token.removeSupervisor(alice.address))
        .to.emit(token, "SupervisorSet")
        .withArgs(alice.address, false);
      expect(await token.isSupervisor(alice.address)).to.equal(false);
    });

    it("non-owner cannot manage supervisors", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(token.connect(alice).setSupervisor(bob.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("rejects duplicate set / removing non-supervisor", async function () {
      const { token, supervisor, alice } = await loadFixture(deployFixture);
      await expect(token.setSupervisor(supervisor.address)).to.be.revertedWith(
        "CRMC: invalid or already supervisor"
      );
      await expect(token.removeSupervisor(alice.address)).to.be.revertedWith(
        "CRMC: not supervisor"
      );
    });
  });

  // ---------------------------------------------------------------
  // Permanent wallet lock
  // ---------------------------------------------------------------
  describe("wallet lock (permanent)", function () {
    it("supervisor can lock/unlock a wallet; locked wallet cannot send", async function () {
      const { token, supervisor, alice, bob } = await loadFixture(deployFixture);
      await token.transfer(alice.address, 10n * UNIT);

      await expect(token.connect(supervisor).setLockedWalletEntity(alice.address))
        .to.emit(token, "WalletLockSet")
        .withArgs(alice.address, true);
      expect(await token.isWalletLocked(alice.address)).to.equal(true);

      await expect(
        token.connect(alice).transfer(bob.address, 1n)
      ).to.be.revertedWith("CRMC: wallet is locked");

      await token.connect(supervisor).removeLockedWalletEntity(alice.address);
      await expect(token.connect(alice).transfer(bob.address, 1n)).to.not.be.reverted;
    });

    it("locked wallet can still RECEIVE tokens", async function () {
      const { token, supervisor, alice } = await loadFixture(deployFixture);
      await token.connect(supervisor).setLockedWalletEntity(alice.address);
      await expect(token.transfer(alice.address, 5n * UNIT)).to.not.be.reverted;
      expect(await token.balanceOf(alice.address)).to.equal(5n * UNIT);
    });

    it("non-supervisor cannot manage wallet locks", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).setLockedWalletEntity(bob.address)
      ).to.be.revertedWith("Supervisor: not authorized");
    });
  });

  // ---------------------------------------------------------------
  // Time-locked balances
  // ---------------------------------------------------------------
  describe("transferToLockedBalance & phased unlock", function () {
    async function lockFixture() {
      const base = await deployFixture();
      const { token, alice } = base;
      const now = await time.latest();
      const t1 = now + 1000;
      const t2 = now + 2000;
      const t3 = now + 3000;
      // 100 / 200 / 300 CRMC locked in three phases
      await token.transferToLockedBalance(
        alice.address,
        t1, 100n * UNIT,
        t2, 200n * UNIT,
        t3, 300n * UNIT
      );
      return { ...base, t1, t2, t3 };
    }

    it("transfers the locked total and records the schedule", async function () {
      const { token, alice, t1, t2, t3 } = await lockFixture();
      expect(await token.balanceOf(alice.address)).to.equal(600n * UNIT);
      expect(await token.hasActiveLock(alice.address)).to.equal(true);
      const info = await token.connect(alice).getLockedUserInfo(alice.address);
      expect(info[0]).to.equal(t1);
      expect(info[1]).to.equal(100n * UNIT);
      expect(info[2]).to.equal(t2);
      expect(info[3]).to.equal(200n * UNIT);
      expect(info[4]).to.equal(t3);
      expect(info[5]).to.equal(300n * UNIT);
    });

    it("blocks spending locked balance before first unlock", async function () {
      const { token, alice, bob } = await lockFixture();
      // everything is locked; even 1 unit should fail
      await expect(
        token.connect(alice).transfer(bob.address, 1n)
      ).to.be.revertedWith("CRMC: amount exceeds available unlocked balance");
    });

    it("allows spending free balance on top of locked balance", async function () {
      const { token, alice, bob } = await lockFixture();
      await token.transfer(alice.address, 50n * UNIT); // free tokens
      await expect(token.connect(alice).transfer(bob.address, 50n * UNIT)).to.not.be.reverted;
      await expect(
        token.connect(alice).transfer(bob.address, 1n)
      ).to.be.revertedWith("CRMC: amount exceeds available unlocked balance");
    });

    it("phase 1: after t1 only firstUnlockValue becomes spendable", async function () {
      const { token, alice, bob, t1 } = await lockFixture();
      await time.increaseTo(t1 + 1);
      // 100 available, 500 still locked
      await expect(
        token.connect(alice).transfer(bob.address, 101n * UNIT)
      ).to.be.revertedWith("CRMC: amount exceeds available unlocked balance");
      await expect(token.connect(alice).transfer(bob.address, 100n * UNIT))
        .to.emit(token, "Unlock");
    });

    it("phase 3: after t3 everything is spendable and lock record is deleted", async function () {
      const { token, alice, bob, t3 } = await lockFixture();
      await time.increaseTo(t3 + 1);
      await expect(token.connect(alice).transfer(bob.address, 600n * UNIT))
        .to.emit(token, "Unlock")
        .withArgs(alice.address, 3, 100n * UNIT, 200n * UNIT, 300n * UNIT);
      expect(await token.hasActiveLock(alice.address)).to.equal(false);
    });

    it("CHC-02: rejects overwriting an active lock", async function () {
      const { token, alice } = await lockFixture();
      const now = await time.latest();
      await expect(
        token.transferToLockedBalance(
          alice.address,
          now + 5000, 10n * UNIT,
          0, 0,
          0, 0
        )
      ).to.be.revertedWith("CRMC: recipient already has active lock");
    });

    it("validates schedule ordering (second > first, third > second)", async function () {
      const { token, bob } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        token.transferToLockedBalance(
          bob.address,
          now + 2000, 10n * UNIT,
          now + 1000, 10n * UNIT, // second before first → revert
          0, 0
        )
      ).to.be.revertedWith("CRMC: second unlock must be > first");
    });

    it("only supervisor/owner can create locks", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        token.connect(alice).transferToLockedBalance(bob.address, now + 1000, 1n, 0, 0, 0, 0)
      ).to.be.revertedWith("Supervisor: not authorized");
    });

    it("getLockedUserInfo is permissioned (self, owner, supervisor only)", async function () {
      const { token, alice, bob } = await lockFixture();
      await expect(
        token.connect(bob).getLockedUserInfo(alice.address)
      ).to.be.revertedWith("CRMC: not permitted");
      await expect(token.getLockedUserInfo(alice.address)).to.not.be.reverted; // owner
    });
  });

  // ---------------------------------------------------------------
  // setLockTime
  // ---------------------------------------------------------------
  describe("setLockTime", function () {
    it("supervisor can extend slot times within ordering constraints", async function () {
      const { token, supervisor, alice } = await loadFixture(deployFixture);
      const now = await time.latest();
      const t1 = now + 1000, t2 = now + 2000, t3 = now + 3000;
      await token.transferToLockedBalance(alice.address, t1, 10n * UNIT, t2, 10n * UNIT, t3, 10n * UNIT);

      // valid: move slot 1 forward but still before slot 2
      await token.connect(supervisor).setLockTime(alice.address, 1, t1 + 500);
      const info = await token.getLockedUserInfo(alice.address);
      expect(info[0]).to.equal(t1 + 500);

      // invalid params revert
      await expect(
        token.connect(supervisor).setLockTime(alice.address, 4, t1 + 500)
      ).to.be.revertedWith("CRMC: invalid params");
    });
  });

  // ---------------------------------------------------------------
  // burn / burnFrom
  // ---------------------------------------------------------------
  describe("burn / burnFrom (supervisor-only, CHC-04)", function () {
    it("supervisor can burn own tokens; totalSupply decreases", async function () {
      const { token, supervisor } = await loadFixture(deployFixture);
      await token.transfer(supervisor.address, 100n * UNIT);
      await expect(token.connect(supervisor).burn(40n * UNIT))
        .to.emit(token, "Burn")
        .withArgs(supervisor.address, 40n * UNIT);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY - 40n * UNIT);
      expect(await token.balanceOf(supervisor.address)).to.equal(60n * UNIT);
    });

    it("non-supervisor cannot burn", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await expect(token.connect(alice).burn(1n)).to.be.revertedWith(
        "Supervisor: not authorized"
      );
    });

    it("burnFrom requires allowance and supervisor role", async function () {
      const { token, owner, supervisor, alice } = await loadFixture(deployFixture);
      await token.transfer(alice.address, 100n * UNIT);
      await token.connect(alice).approve(supervisor.address, 30n * UNIT);

      // non-supervisor with allowance still blocked
      await token.connect(alice).approve(owner.address, 30n * UNIT);
      await expect(
        token.connect(supervisor).burnFrom(alice.address, 31n * UNIT)
      ).to.be.revertedWith("CRMC: burn amount exceeds allowance");

      await token.connect(supervisor).burnFrom(alice.address, 30n * UNIT);
      expect(await token.balanceOf(alice.address)).to.equal(70n * UNIT);
    });

    it("CHC-01: burn normalizes lock schedule so transfers are not bricked", async function () {
      const { token, supervisor, alice } = await loadFixture(deployFixture);
      const now = await time.latest();
      // lock 100 in one phase
      await token.transferToLockedBalance(alice.address, now + 1000, 100n * UNIT, 0, 0, 0, 0);
      // supervisor burns 50 from alice via allowance → lock must shrink to balance
      await token.connect(alice).approve(supervisor.address, 50n * UNIT);
      await token.connect(supervisor).burnFrom(alice.address, 50n * UNIT);

      const info = await token.getLockedUserInfo(alice.address);
      const totalLocked = info[1] + info[3] + info[5];
      expect(totalLocked).to.equal(await token.balanceOf(alice.address));
    });
  });

  // ---------------------------------------------------------------
  // Ownership
  // ---------------------------------------------------------------
  describe("ownership", function () {
    it("transfers ownership and rejects zero address", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      await expect(token.transferOwnership(ethers.ZeroAddress)).to.be.revertedWith(
        "Ownable: new owner is the zero address"
      );
      await expect(token.transferOwnership(alice.address))
        .to.emit(token, "OwnershipTransferred")
        .withArgs(owner.address, alice.address);
      expect(await token.getOwner()).to.equal(alice.address);
    });
  });
});
