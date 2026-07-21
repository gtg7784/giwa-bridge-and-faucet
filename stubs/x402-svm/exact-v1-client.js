/**
 * Local stub for @coinbase/cdp-sdk @x402/* optional peer deps.
 * Coinbase 지갑을 사용하지 않으므로 실제 호출 경로가 없음.
 * 모든 named export 는 재귀적으로 proxy stub 이며, 실제 호출 시 throw.
 */
const stub = new Proxy(function () {}, {
  get: () => stub,
  construct: () => stub,
  apply: () => {
    throw new Error("@x402/* stub called: Coinbase CDP x402 not supported by this app.");
  },
});

export default stub;
// @x402/core, ./client, ./server
export const x402Client = stub;
export const x402ResourceServer = stub;
export const x402HTTPResourceServer = stub;
export const HTTPFacilitatorClient = stub;
// @x402/evm and subpaths
export const toClientEvmSigner = stub;
export const registerExactEvmScheme = stub;
export const ExactEvmScheme = stub;
export const ExactEvmSchemeV1 = stub;
export const UptoEvmScheme = stub;
export const BatchSettlementEvmScheme = stub;
// @x402/svm and subpaths
export const ExactSvmScheme = stub;
export const ExactSvmSchemeV1 = stub;
// @x402/extensions and subpaths
export const bazaarResourceServerExtension = stub;

