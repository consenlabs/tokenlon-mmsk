pragma solidity ^0.5.0;

import "./IERC20NonStandard.sol";

contract SafeToken {
    function doApprove(address token, address spender, uint256 amount) internal {
        bool result;

        IERC20NonStandard(token).approve(spender, amount);

        assembly {
            switch returndatasize()
                case 0 {                      // This is a non-standard ERC-20
                    result := not(0)          // set result to true
                }
                case 32 {                     // This is a complaint ERC-20
                    returndatacopy(0, 0, 32)
                    result := mload(0)        // Set `result = returndata` of external call
                }
                default {                     // This is an excessively non-compliant ERC-20, revert.
                    revert(0, 0)
                }
        }

        require(
            result,
            "APPROVE_FAILED"
        );
    }

    function doTransferFrom(address token, address from, address to, uint256 amount) internal {
        bool result;

        IERC20NonStandard(token).transferFrom(from, to, amount);

        assembly {
            switch returndatasize()
                case 0 {                      // This is a non-standard ERC-20
                    result := not(0)          // set result to true
                }
                case 32 {                     // This is a complaint ERC-20
                    returndatacopy(0, 0, 32)
                    result := mload(0)        // Set `result = returndata` of external call
                }
                default {                     // This is an excessively non-compliant ERC-20, revert.
                    revert(0, 0)
                }
        }

        require(
            result,
            "TRANSFER_FROM_FAILED"
        );
    }
}