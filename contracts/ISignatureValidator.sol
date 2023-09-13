pragma solidity ^0.5.0;

interface ISignatureValidator {
    function isValidSignature(address _signerAddress, bytes32 _hash, bytes calldata _data, bytes calldata _sig) external view returns (bool isValid);
}
