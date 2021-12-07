pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./LibOrder.sol";
import "./LibBytes.sol";

contract LibDecoder {
    using LibBytes for bytes;

    function decodeFillOrder(bytes memory data) internal pure returns(LibOrder.Order memory order, uint256 takerFillAmount, bytes memory mmSignature) {
        require(
            data.length > 800,
            "LENGTH_LESS_800"
        );

        // compare method_id
        // 0x64a3bc15 is fillOrKillOrder's method id.
        require(
            data.readBytes4(0) == 0x64a3bc15,
            "WRONG_METHOD_ID"
        );
        
        bytes memory dataSlice;
        assembly {
            dataSlice := add(data, 4)
        }
        //return (order, takerFillAmount, data);
        return abi.decode(dataSlice, (LibOrder.Order, uint256, bytes));

    }

    function decodeMmSignatureWithoutSign(bytes memory signature) internal pure returns(address user, uint16 feeFactor) {
        require(
            signature.length == 87 || signature.length == 88,
            "LENGTH_87_REQUIRED"
        );

        user = signature.readAddress(65);
        feeFactor = uint16(signature.readBytes2(85));
        
        require(
            feeFactor < 10000,
            "FEE_FACTOR_MORE_THEN_10000"
        );

        return (user, feeFactor);
    }

    function decodeMmSignature(bytes memory signature) internal pure returns(uint8 v, bytes32 r, bytes32 s, address user, uint16 feeFactor) {
        (user, feeFactor) = decodeMmSignatureWithoutSign(signature);

        v = uint8(signature[0]);
        r = signature.readBytes32(1);
        s = signature.readBytes32(33);

        return (v, r, s, user, feeFactor);
    }

    function decodeUserSignatureWithoutSign(bytes memory signature) internal pure returns(address receiver) {
        require(
            signature.length == 85 || signature.length == 86,
            "LENGTH_85_REQUIRED"
        );
        receiver = signature.readAddress(65);

        return receiver;
    }

    function decodeUserSignature(bytes memory signature) internal pure returns(uint8 v, bytes32 r, bytes32 s, address receiver) {
        receiver = decodeUserSignatureWithoutSign(signature);

        v = uint8(signature[0]);
        r = signature.readBytes32(1);
        s = signature.readBytes32(33);

        return (v, r, s, receiver);
    }

    function decodeERC20Asset(bytes memory assetData) internal pure returns(address) {
        require(
            assetData.length == 36,
            "LENGTH_65_REQUIRED"
        );

        return assetData.readAddress(16);
    }
}