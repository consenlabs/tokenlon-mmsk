pragma solidity ^0.5.0;

import "./LibDecoder.sol";
import "./SafeToken.sol";
import "hardhat/console.sol";

contract MarketMakerProxy is
    LibDecoder,
    SafeToken
{
    uint256 constant MAX_UINT = 2**256 - 1;
    address public SIGNER;
    constructor (address signer) public {
        SIGNER = signer;
    }

    function() external payable {}

    function setAllowance(address[] memory token_addrs, address spender) public {
        for (uint i = 0; i < token_addrs.length; i++) {
            address token = token_addrs[i];
            doApprove(token, spender, MAX_UINT);
            doApprove(token, address(this), MAX_UINT);
        }
    }

    function recoverSignerFromSignature(uint8 v, bytes32 r, bytes32 s, bytes32 hash) public pure returns(address) {
        address signer = ecrecover(hash, v, r, s);
        return signer;
    }

    function isValidSignature(bytes32 orderHash, bytes memory signature) public view returns (bytes32) {
        address recovered = ecrecoverAddress(orderHash, signature);
        console.logBytes32(orderHash);
        console.log(recovered);
        console.log(SIGNER);
        require(
            SIGNER == recovered,
            "INVALID_SIGNATURE"
        );
        return keccak256("isValidWalletSignature(bytes32,address,bytes)");
    }

    function ecrecoverAddress(bytes32 orderHash, bytes memory signature) public pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s, address user, uint16 feeFactor) = decodeMmSignature(signature);

        return ecrecover(
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n54",
                    orderHash,
                    user,
                    feeFactor
                )),
            v, r, s
        );
    }
}
