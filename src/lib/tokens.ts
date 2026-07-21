import { sepolia, giwaSepolia } from "viem/chains";
import { erc20Abi, parseAbi } from "viem";

/**
 * Giwa 공식 튜토리얼용 test ERC-20 토큰.
 * L1 에서 `claimFaucet()` 로 무료 지급받고 L2 로 브릿징 가능.
 * https://docs.giwa.io/get-started/bridging/erc-20
 */
export const l1TestTokenAddress =
  "0x50B1eF6e0fe05a32F3E63F02f3c0151BD9004C7c" as const;
export const l2TestTokenAddress =
  "0xB11E5c9070a57C0c33Df102436C440a2c73a4c38" as const;

/**
 * L1 (Sepolia) 에 배포된 StandardBridge - viem 의 giwaSepolia chain config 에서 조회.
 * viem 은 L1 bridge 주소를 L1 chain id 로 indexing 함.
 */
export const l1StandardBridgeAddress =
  giwaSepolia.contracts.l1StandardBridge[sepolia.id].address;

/**
 * L2 (Giwa Sepolia) StandardBridge - OP Stack 표준 predeploy.
 * 모든 OP Stack 체인에서 동일 주소.
 */
export const l2StandardBridgeAddress =
  "0x4200000000000000000000000000000000000010" as const;

export const testTokenAbi = [
  ...erc20Abi,
  ...parseAbi(["function claimFaucet() external"]),
] as const;

export const l1StandardBridgeAbi = parseAbi([
  "function depositERC20To(address _l1Token, address _l2Token, address _to, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external",
]);

export const l2StandardBridgeAbi = parseAbi([
  "function withdrawTo(address _l2Token, address _to, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external",
]);
