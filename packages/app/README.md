# EthSub

A bridge between ethereum and substrate.



          ┌─────────────────┐                       ┌──────────────────┐                     ┌────────────────────┐
          │                 │      DespoitEvent     │                  │       Proposal      │                    │
          │                 ├──────────────────────►│                  ├─────────────────────┤                    │
          │    Ethereum     │                       │     Bridge       │                     │    Substrate       │
          │                 │◄──────────────────────┤                  │◄────────────────────┤                    │
          │                 │       Proposal        │                  │     TransferEvent   │                    │
          └─────────────────┘                       └──────────────────┘                     └────────────────────┘



## Specefication

### Definitions
#### Chain ID

Each chain has a unique 8-bit identifier. We presently define the following chain IDs (subject to change):

| ID | Chain |
| - | - |
| 0 | ETH |
| 1 | SUB |
| .. | .. |

#### Deposit Nonce

A nonce must be generated for every transfer to ensure uniqueness. All implementations must track a sequential nonce (unsigned 64-bit integer) for each possible destination chain. This is included as a standard parameter for each transfer. Order is not enforced.

#### Resource ID

In order to provide generality, we need some way to associate some action on a source chain to some action on a destination chain. This may express tokenX on chain A is equivalent to tokenY on chain B, or to simply associate that some action performed on chain A should result in some other action occurring on chain B. 

All resource IDs are considered to have a Home Chain. The only strict requirements for Resource IDs is that they must be 32 bytes in length and the least significant byte must contain a chain ID. 

Resource IDs are arbitrary, you can use anything you like. The resource ID should be the same on every chain for the same token.  
One convention is use 0x0...<contract-address><chain-id> to indicate where the token originates from. You would use a different resource ID from each token that is supported, or for any arbitrary action via the generic handler. The format is just a suggestion, and the chain ID included is in reference to the origin chain where the token was first created.

#### Transfer Flow

1. User initiates a transfer on the source chain.
2. Relayers observing the chain parse the parameters of the transfer and format them into a message.
3. The message is parsed and then proposed on the destination chain.
4. If the vote threshold is met, the proposal will be executed to finalize the transfer.

After the initiation, a user should not be required to make any additional interactions.

### Transfer Types
In a effort to balance the goals of allowing simple integration and proving generalized transfers, multiple transfer types are defined. Some or all of these may implemented for a chain.

|Event|Description|
|-----|-----------|
|FungibleTransfer| Transfer of fungible assets |
|NonFungibleTransfer| Transfer of non-fungible assets |
|GenericTransfer| Transfer of arbitrary data |


All transfers contain a source chain, destination chain, deposit nonce, resource ID and transfer-specific parameters.

#### Fungible
|Field|Type|Description|
|----|----|-----------|
| Amount | 256 bit uint | The total number of assets being transferred |
| Recipient | 32 bytes | The recipient address on the destination chain |

#### Non-Fungible
|Field|Type|Description|
|----|----|-----------|
| Token ID | 256 bit uint | The unique identifier for the NFT |
| Recipient | 32 bytes | The recipient address on the destination chain |
| Metadata | variable sized bytes | Any additional data associated to the NFT |

#### Generic
|Field|Type|Description|
|----|----|-----------|
| Metadata | variable sized bytes | An opaque payload to transmit |

*Note: Addresses are limited to 32bytes in size, but may be smaller. They must always be compatible with the destination chain.*

### Relayer Set
  
Each chain implementation must track a set of relayers, and allow updating of the set as necessary. A threshold should also be maintained to define how many relayers must vote for a proposed transfer before is can be executed. For this initial implementation, the relayer set may be controlled by a single party. Multi-signature wallets can be used to distribute risk, if available on the chain.
