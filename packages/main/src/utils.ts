export interface BridgeMsg {
  source: number;
  destination: number;
  depositNonce: number;
  type: string;
  resource: string;
  payload: any;
}

export async function sleep(timeMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeMs);
  });
}
