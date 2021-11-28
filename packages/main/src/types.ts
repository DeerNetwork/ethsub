export type BridgeMsg = BridgeMsgErc20;
export interface BridgeMsgBase {
  type: ResourceType;
  source: number;
  destination: number;
  nonce: number;
  resource: ResourceData;
  payload: any;
}

export interface BridgeMsgErc20 extends BridgeMsgBase {
  type: ResourceType.ERC20;
  payload: {
    amount: string;
    recipient: string;
  };
}
export interface BridgeMsgGeneric extends BridgeMsgBase {
  type: ResourceType.GENERIC;
  payload: {
    recipient: string;
    metadata: string;
  };
}

export interface ResourceData {
  type: ResourceType.ERC20;
  name: string;
  eth: ResourceChainData;
  sub: ResourceChainData;
}

export interface ResourceChainData {
  resourceId: string;
  decimals: number;
}

export enum ResourceType {
  ERC20 = "erc20",
  GENERIC = "generic",
}
