export interface BridgeMsg {
  source: number;
  destination: number;
  depositNonce: number;
  type: ResourceType;
  resource: string;
  payload: any;
}

export interface ResourceData {
  type: ResourceType.ERC20;
  name: string;
  eth: string;
  sub: string;
}

export enum ResourceType {
  ERC20,
}
