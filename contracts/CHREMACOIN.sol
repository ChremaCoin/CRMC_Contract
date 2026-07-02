// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CHREMACOIN (CRMC) - BEP-20 (v3)
 * @notice Addresses audit items:
 *  - CHC-04 Resolved in v2 (burnFrom supervisor-only)
 *  - CHC-05 Resolved in v2 (self transfer blocked in both functions)
 *  - CHC-01 Resolved in v2 (burn may disable transfer -> auto-normalize locks)
 *  - CHC-06 Acknowledged in v2 (refactor: compute vs side-effects)
 *  - CHC-02 Pending -> Resolved here (reject overwrite if any active lock fields are non-zero)
 *  - CHC-07 Pending -> Resolved here (deprecate PrintLog; introduce explicit, semantically clear events)
 *  - CHC-03 Centralization -> Recommend multisig/timelock ownership (off-chain config); contract exposes helpers
 */

interface IBEP20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function getOwner() external view returns (address);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Ownable {
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "Ownable: caller is not the owner"); _; }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

contract Pausable is Ownable {
    bool public paused;
    event Paused();
    event Unpaused();
    modifier whenNotPaused() { require(!paused, "Pausable: paused"); _; }
    modifier whenPaused() { require(paused, "Pausable: not paused"); _; }
    function pause() external onlyOwner whenNotPaused { paused = true; emit Paused(); }
    function unpause() external onlyOwner whenPaused { paused = false; emit Unpaused(); }
}

contract CHREMACOIN is IBEP20, Pausable {
    // Metadata
    string public constant name = "CHREMACOIN";
    string public constant symbol = "CRMC";
    uint8  public constant decimals = 8;
    uint256 public constant INITIAL_SUPPLY = 5000000000000000; // 50,000,000 CRMC (8 decimals)

    // Storage
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Roles & locks
    mapping(address => bool) private supervisorEntity;
    mapping(address => bool) private lockedWalletEntity; // permanent wallet lock

    struct LockedUserInfo {
        address lockedUserAddress;
        uint256 firstUnlockTime;
        uint256 secondUnlockTime;
        uint256 thirdUnlockTime;
        uint256 firstUnlockValue;
        uint256 secondUnlockValue;
        uint256 thirdUnlockValue;
    }
    mapping(address => LockedUserInfo) private lockedUserEntity;

    // ==== Events (explicit & unambiguous) ====
    event Unlock(
        address indexed lockedUser,
        uint256 lockPeriod,
        uint256 firstUnlockValue,
        uint256 secondUnlockValue,
        uint256 thirdUnlockValue
    );

    // Replaces ambiguous PrintLog
    event AvailableComputed(address indexed account, uint256 requested, bool allowed, uint256 availableAmount);
    event WalletLockSet(address indexed account, bool isLocked);
    event SupervisorSet(address indexed account, bool isSupervisor);

    // Backward-compat deprecated event (no longer emitted)
    event PrintLog(address indexed sender, string logName, uint256 value);

    // Modifiers
    modifier onlySupervisor() {
        require(msg.sender == owner || supervisorEntity[msg.sender], "Supervisor: not authorized");
        _;
    }

    constructor() {
        _totalSupply = INITIAL_SUPPLY;
        _balances[msg.sender] = INITIAL_SUPPLY;
        emit Transfer(address(0), msg.sender, INITIAL_SUPPLY);
    }

    // === BEP-20 view ===
    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view override returns (uint256) { return _balances[account]; }
    function allowance(address owner_, address spender) external view override returns (uint256) { return _allowances[owner_][spender]; }
    function getOwner() external view override returns (address) { return owner; }

    // Helper views for transparency (to aid centralization audit)
    function isSupervisor(address account) external view returns (bool) { return supervisorEntity[account]; }
    function isWalletLocked(address account) external view returns (bool) { return lockedWalletEntity[account]; }
    function hasActiveLock(address account) public view returns (bool) {
        LockedUserInfo storage info = lockedUserEntity[account];
        if (info.lockedUserAddress == address(0)) return false;
        return (info.firstUnlockTime != 0 || info.secondUnlockTime != 0 || info.thirdUnlockTime != 0
             || info.firstUnlockValue != 0 || info.secondUnlockValue != 0 || info.thirdUnlockValue != 0);
    }

    // === BEP-20 mutative ===
    function transfer(address recipient, uint256 amount) external override whenNotPaused returns (bool) {
        require(msg.sender != recipient, "CRMC: self transfer not allowed");
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override whenNotPaused returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override whenNotPaused returns (bool) {
        require(sender != recipient, "CRMC: self transfer not allowed");
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "CRMC: transfer amount exceeds allowance");
        _allowances[sender][msg.sender] = currentAllowance - amount;
        _transfer(sender, recipient, amount);
        emit Approval(sender, msg.sender, _allowances[sender][msg.sender]);
        return true;
    }

    // === Burn functions (supervisor-only policies retained) ===
    event Burn(address indexed burner, uint256 value);

    function burn(uint256 value) external onlySupervisor whenNotPaused {
        _burn(msg.sender, value);
    }

    function burnFrom(address from, uint256 value) external onlySupervisor whenNotPaused {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= value, "CRMC: burn amount exceeds allowance");
        _allowances[from][msg.sender] = currentAllowance - value;
        _burn(from, value);
        emit Approval(from, msg.sender, _allowances[from][msg.sender]);
    }

    // === Internal: transfer with lock checks ===
    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "CRMC: transfer to the zero address");
        require(!lockedWalletEntity[from], "CRMC: wallet is locked");
        require(_balances[from] >= value, "CRMC: transfer amount exceeds balance");

        (bool allowed, uint8 phase, uint256 availableEcho) = _computeAvailable(from, value);
        emit AvailableComputed(from, value, allowed, availableEcho);
        require(allowed, "CRMC: amount exceeds available unlocked balance");

        _balances[from] -= value;
        _balances[to] += value;
        emit Transfer(from, to, value);

        if (phase > 0) {
            _applyUnlockSideEffects(from, phase);
        }
    }

    function _burn(address account, uint256 value) internal {
        require(account != address(0), "CRMC: burn from the zero address");
        require(_balances[account] >= value, "CRMC: burn amount exceeds balance");
        _balances[account] -= value;
        _totalSupply -= value;
        emit Burn(account, value);
        emit Transfer(account, address(0), value);
        _normalizeLocksAfterBurn(account);
    }

    // Normalize lock values if total lock exceeds current balance after burn
    function _normalizeLocksAfterBurn(address account) internal {
        LockedUserInfo storage info = lockedUserEntity[account];
        if (info.lockedUserAddress == address(0)) return;
        uint256 totalLock = info.firstUnlockValue + info.secondUnlockValue + info.thirdUnlockValue;
        uint256 bal = _balances[account];
        if (totalLock <= bal) return;
        uint256 excess = totalLock - bal;
        if (info.thirdUnlockValue >= excess) { info.thirdUnlockValue -= excess; return; } else { excess -= info.thirdUnlockValue; info.thirdUnlockValue = 0; }
        if (info.secondUnlockValue >= excess) { info.secondUnlockValue -= excess; return; } else { excess -= info.secondUnlockValue; info.secondUnlockValue = 0; }
        if (info.firstUnlockValue > excess) { info.firstUnlockValue -= excess; } else { info.firstUnlockValue = 0; }
    }

    // === Supervisor & admin ===
    function setSupervisor(address account) external onlyOwner returns (bool) {
        require(account != address(0) && !supervisorEntity[account], "CRMC: invalid or already supervisor");
        supervisorEntity[account] = true;
        emit SupervisorSet(account, true);
        return true;
    }

    function removeSupervisor(address account) external onlyOwner returns (bool) {
        require(account != address(0) && supervisorEntity[account], "CRMC: not supervisor");
        supervisorEntity[account] = false;
        emit SupervisorSet(account, false);
        return true;
    }

    function setLockedWalletEntity(address account) external onlySupervisor returns (bool) {
        require(account != address(0) && !lockedWalletEntity[account], "CRMC: invalid or already locked");
        lockedWalletEntity[account] = true;
        emit WalletLockSet(account, true);
        return true;
    }

    function removeLockedWalletEntity(address account) external onlySupervisor returns (bool) {
        require(account != address(0) && lockedWalletEntity[account], "CRMC: wallet not locked");
        lockedWalletEntity[account] = false;
        emit WalletLockSet(account, false);
        return true;
    }

    // Lock schedule management
    function transferToLockedBalance(
        address to,
        uint256 firstUnlockTime,
        uint256 firstUnlockValue,
        uint256 secondUnlockTime,
        uint256 secondUnlockValue,
        uint256 thirdUnlockTime,
        uint256 thirdUnlockValue
    ) external onlySupervisor whenNotPaused returns (bool) {
        require(msg.sender != to, "CRMC: sender equals recipient");
        require(firstUnlockTime > block.timestamp && firstUnlockValue > 0, "CRMC: invalid first unlock");
        // CHC-02: reject overwrite if any active lock present (stronger than v2)
        require(!hasActiveLock(to), "CRMC: recipient already has active lock");

        uint256 totalLockSendCount = firstUnlockValue;
        if (secondUnlockTime > block.timestamp && secondUnlockValue > 0) {
            require(secondUnlockTime > firstUnlockTime, "CRMC: second unlock must be > first");
            totalLockSendCount += secondUnlockValue;
        }
        if (thirdUnlockTime > block.timestamp && thirdUnlockValue > 0) {
            require(secondUnlockTime > block.timestamp && secondUnlockValue > 0, "CRMC: invalid second unlock before third");
            require(thirdUnlockTime > secondUnlockTime, "CRMC: third unlock must be > second");
            totalLockSendCount += thirdUnlockValue;
        }

        _transfer(msg.sender, to, totalLockSendCount);

        LockedUserInfo storage info = lockedUserEntity[to];
        info.lockedUserAddress = to;
        info.firstUnlockTime = firstUnlockTime;
        info.firstUnlockValue = firstUnlockValue;
        if (secondUnlockTime > block.timestamp && secondUnlockValue > 0) {
            info.secondUnlockTime = secondUnlockTime;
            info.secondUnlockValue = secondUnlockValue;
        }
        if (thirdUnlockTime > block.timestamp && thirdUnlockValue > 0) {
            info.thirdUnlockTime = thirdUnlockTime;
            info.thirdUnlockValue = thirdUnlockValue;
        }
        return true;
    }

    function setLockTime(address account, uint256 slot, uint256 newUnlockTime) external onlySupervisor returns (bool) {
        require(account != address(0) && slot >= 1 && slot <= 3 && newUnlockTime > block.timestamp, "CRMC: invalid params");
        (uint256 t1, uint256 t2, uint256 t3) = _getLockedTimeUserInfo(account);
        if (slot == 1 && t1 != 0) {
            if (t2 == 0 || newUnlockTime < t2) { lockedUserEntity[account].firstUnlockTime = newUnlockTime; return true; }
        } else if (slot == 2 && t2 != 0) {
            if (newUnlockTime > t1 && (t3 == 0 || newUnlockTime < t3)) { lockedUserEntity[account].secondUnlockTime = newUnlockTime; return true; }
        } else if (slot == 3 && t3 != 0) {
            if (newUnlockTime > t2) { lockedUserEntity[account].thirdUnlockTime = newUnlockTime; return true; }
        }
        return false;
    }

    // === Views ===
    function getLockedUserInfo(address account) external view returns (
        uint256, uint256, uint256, uint256, uint256, uint256
    ) {
        require(msg.sender == account || msg.sender == owner || supervisorEntity[msg.sender], "CRMC: not permitted");
        return _getLockedUserInfo(account);
    }

    function _getLockedUserInfo(address account) internal view returns (
        uint256, uint256, uint256, uint256, uint256, uint256
    ) {
        LockedUserInfo storage info = lockedUserEntity[account];
        return (
            info.firstUnlockTime,
            info.firstUnlockValue,
            info.secondUnlockTime,
            info.secondUnlockValue,
            info.thirdUnlockTime,
            info.thirdUnlockValue
        );
    }

    function _getLockedTimeUserInfo(address account) internal view returns (uint256, uint256, uint256) {
        LockedUserInfo storage info = lockedUserEntity[account];
        return (info.firstUnlockTime, info.secondUnlockTime, info.thirdUnlockTime);
    }

    // === Lock computation (no side effects) ===
    function _computeAvailable(address from, uint256 sendAmount)
        internal
        view
        returns (bool allowed, uint8 phase, uint256 availableEcho)
    {
        LockedUserInfo storage info = lockedUserEntity[from];
        if (info.lockedUserAddress == address(0)) {
            return (true, 0, sendAmount);
        }
        uint256 fT = info.firstUnlockTime; uint256 fV = info.firstUnlockValue;
        uint256 sT = info.secondUnlockTime; uint256 sV = info.secondUnlockValue;
        uint256 tT = info.thirdUnlockTime;  uint256 tV = info.thirdUnlockValue;
        uint256 bal = _balances[from];

        if (block.timestamp < fT) {
            uint256 mustLock = fV + sV + tV;
            if (sendAmount <= (bal - mustLock)) return (true, 0, sendAmount);
            return (false, 0, 0);
        }
        if (fT <= block.timestamp && sT == 0) {
            if (sendAmount <= bal) return (true, 1, sendAmount);
            return (false, 1, 0);
        }
        if (fT <= block.timestamp && sT != 0 && block.timestamp < sT) {
            uint256 mustLock2 = sV + tV;
            if (sendAmount <= (bal - mustLock2)) return (true, 1, sendAmount);
            return (false, 1, 0);
        }
        if (sT != 0 && sT <= block.timestamp && tT == 0) {
            if (sendAmount <= bal) return (true, 2, sendAmount);
            return (false, 2, 0);
        }
        if (sT != 0 && sT <= block.timestamp && tT != 0 && block.timestamp < tT) {
            if (sendAmount <= (bal - tV)) return (true, 2, sendAmount);
            return (false, 2, 0);
        }
        if (tT != 0 && tT <= block.timestamp) {
            if (sendAmount <= bal) return (true, 3, sendAmount);
            return (false, 3, 0);
        }
        return (false, 0, 0);
    }

    function _applyUnlockSideEffects(address from, uint8 phase) internal {
        LockedUserInfo storage info = lockedUserEntity[from];
        if (info.lockedUserAddress == address(0)) return;
        uint256 fV = info.firstUnlockValue;
        uint256 sV = info.secondUnlockValue;
        uint256 tV = info.thirdUnlockValue;
        uint256 sT = info.secondUnlockTime;
        uint256 tT = info.thirdUnlockTime;

        if (phase == 1) {
            if (sT == 0) { delete lockedUserEntity[from]; emit Unlock(from, 1, fV, sV, tV); }
            else { info.firstUnlockValue = 0; emit Unlock(from, 1, fV, sV, tV); }
        } else if (phase == 2) {
            if (tT == 0) { delete lockedUserEntity[from]; emit Unlock(from, 2, fV, sV, tV); }
            else { info.firstUnlockValue = 0; info.secondUnlockValue = 0; emit Unlock(from, 2, fV, sV, tV); }
        } else if (phase == 3) {
            delete lockedUserEntity[from]; emit Unlock(from, 3, fV, sV, tV);
        }
    }
}
