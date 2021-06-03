"use strict";
exports.__esModule = true;
exports.V3_MIGRATOR_ADDRESSES = exports.SWAP_ROUTER_ADDRESSES = exports.NONFUNGIBLE_POSITION_MANAGER_ADDRESSES = exports.TICK_LENS_ADDRESSES = exports.QUOTER_ADDRESSES = exports.V3_CORE_FACTORY_ADDRESSES = void 0;
var sdk_core_1 = require("@uniswap/sdk-core");
var v3_sdk_1 = require("@uniswap/v3-sdk");
function constructSameAddressMap(address) {
    var _a;
    return _a = {},
        _a[sdk_core_1.ChainId.MAINNET] = address,
        _a[sdk_core_1.ChainId.ROPSTEN] = address,
        _a[sdk_core_1.ChainId.KOVAN] = address,
        _a[sdk_core_1.ChainId.RINKEBY] = address,
        _a[sdk_core_1.ChainId.GÖRLI] = address,
        _a;
}
exports.V3_CORE_FACTORY_ADDRESSES = constructSameAddressMap(v3_sdk_1.FACTORY_ADDRESS);
exports.QUOTER_ADDRESSES = constructSameAddressMap('0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6');
exports.TICK_LENS_ADDRESSES = constructSameAddressMap('0xbfd8137f7d1516D3ea5cA83523914859ec47F573');
exports.NONFUNGIBLE_POSITION_MANAGER_ADDRESSES = constructSameAddressMap('0xC36442b4a4522E871399CD717aBDD847Ab11FE88');
exports.SWAP_ROUTER_ADDRESSES = constructSameAddressMap('0xE592427A0AEce92De3Edee1F18E0157C05861564');
exports.V3_MIGRATOR_ADDRESSES = constructSameAddressMap('0xA5644E29708357803b5A882D272c41cC0dF92B34');
