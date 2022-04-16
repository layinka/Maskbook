import { YearnChains } from './constants'
import type { ChainId, FungibleTokenDetailed } from '@masknet/web3-shared-evm'
import { chunk } from 'lodash-unified'
import { EMPTY_LIST } from '@masknet/shared-base'

export function splitToPair(
    details: FungibleTokenDetailed[] | undefined,
): [FungibleTokenDetailed, FungibleTokenDetailed][] {
    if (!details) {
        return EMPTY_LIST
    }
    return chunk(details, 2) as [FungibleTokenDetailed, FungibleTokenDetailed][]
}

export function isValidYearnChain(chainId: ChainId) {
    return Reflect.has(YearnChains, chainId)
}