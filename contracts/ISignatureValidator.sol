// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISignatureValidator {
    function isValidSignature(address _signerAddress, bytes32 _hash, bytes calldata _data, bytes calldata _sig) external view returns (bool isValid);
}
