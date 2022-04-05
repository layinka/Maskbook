import { useMemo, useState } from 'react'
import { useAsync, useUpdateEffect } from 'react-use'
import { Typography, DialogContent } from '@mui/material'
import { isDashboardPage, EMPTY_LIST } from '@masknet/shared-base'
import { FolderTabPanel, FolderTabs } from '@masknet/theme'
import {
    createContract,
    ChainId,
    FungibleTokenDetailed,
    getChainIdFromNetworkType,
    useChainId,
    useWeb3,
    EthereumTokenType,
    useFungibleTokensDetailed,
    getAaveConstants,
    ZERO_ADDRESS,
} from '@masknet/web3-shared-evm'
import { useI18N } from '../../../utils'
import { InjectedDialog } from '@masknet/shared'
import { WalletStatusBox } from '../../../components/shared/WalletStatusBox'
import { AllProviderTradeContext } from '../../Trader/trader/useAllProviderTradeContext'
import { TargetChainIdContext } from '../../Trader/trader/useTargetChainIdContext'
import { NetworkTab } from '../../../components/shared/NetworkTab'
import { WalletRPC } from '../../Wallet/messages'
import { SavingsProtocol, TabType } from '../types'
import { useStyles } from './SavingsDialogStyles'
import { SavingsTable } from './SavingsTable'
import { SavingsForm } from './SavingsForm'
import type { AaveProtocolDataProvider } from '@masknet/web3-contracts/types/AaveProtocolDataProvider'
import AaveProtocolDataProviderABI from '@masknet/web3-contracts/abis/AaveProtocolDataProvider.json'
import { YearnProtocol } from '../protocols/YearnProtocol'
import type { AbiItem } from 'web3-utils'
import { flatten, compact, orderBy, sortedUniqBy } from 'lodash-unified'
import { VaultInterface, Yearn } from '@yfi/sdk'
import { LDO_PAIRS, YearnChains } from '../constants'
import { LidoProtocol } from '../protocols/LDOProtocol'
import { AAVEProtocol } from '../protocols/AAVEProtocol'


function splitToPair(a: FungibleTokenDetailed[] | undefined) {
    if (!a) {
        return []
    }
    return a.reduce(function (result: any, value, index, array) {
        if (index % 2 === 0) {
            result.push(array.slice(index, index + 2))
        }
        return result
    }, [])
}




function isValidYearnChain<YearnChains>(
    chainId: string | number | symbol
  ): chainId is keyof YearnChains {
    return chainId in YearnChains;
}

export interface SavingsDialogProps {
    open: boolean
    onClose?: () => void
}

export function SavingsDialog({ open, onClose }: SavingsDialogProps) {
    const { t } = useI18N()
    const isDashboard = isDashboardPage()
    const { classes } = useStyles({ isDashboard })

    const currentChainId = useChainId()
    const [chainId, setChainId] = useState<ChainId>(currentChainId)

    const web3 = useWeb3({ chainId })
    const [tab, setTab] = useState<TabType>(TabType.Deposit)
    const [selectedProtocol, setSelectedProtocol] = useState<SavingsProtocol | null>(null)

    const { value: chains = EMPTY_LIST } = useAsync(async () => {
        const networks = await WalletRPC.getSupportedNetworks()
        return networks.map((network) => getChainIdFromNetworkType(network))
    }, [])

    const { value: aaveTokens } = useAsync(async () => {
        if (chainId !== ChainId.Mainnet) {
            return []
        }

        const address = getAaveConstants(chainId).AAVE_PROTOCOL_DATA_PROVIDER_CONTRACT_ADDRESS || ZERO_ADDRESS

        const protocolDataContract = createContract<AaveProtocolDataProvider>(
            web3,
            address,
            AaveProtocolDataProviderABI as AbiItem[],
        )

        const tokens = await protocolDataContract?.methods.getAllReservesTokens().call()

        const aTokens = await protocolDataContract?.methods.getAllATokens().call()

        return tokens?.map((token) => {
            return [token[1], aTokens?.filter((f) => f[0].toUpperCase() === `a${token[0]}`.toUpperCase())[0][1]]
        })
    }, [web3, chainId])

    const { value: detailedAaveTokens } = useFungibleTokensDetailed(
        compact(flatten(aaveTokens ?? [])).map((m) => {
            return { address: m, type: EthereumTokenType.ERC20 }
        }) ?? [],
        chainId,
    )


    const { value: yfiTokens } = useAsync(async () => {
        if (!isValidYearnChain(chainId)) {
            return []
        }
        
        const yearn = new Yearn(chainId, {
            // @ts-ignore
            provider: web3.currentProvider
        });
        await yearn.ready;

        // @ts-ignore
        const vaultInterface = new VaultInterface(yearn, +chainId, yearn.context)

        const allvaults =  await vaultInterface.get()
        const currentVaults = sortedUniqBy( orderBy(allvaults, ['metadata.defaultDisplayToken', 'version'], ['asc', 'desc']) , m=>m.metadata.defaultDisplayToken);
				
        return currentVaults.map((v) =>{
            return [v.metadata.defaultDisplayToken, v.address];
        })
    }, [web3, chainId])

    

    const { value: detailedYFITokens } = useFungibleTokensDetailed(
        compact(flatten(yfiTokens ?? [])).map((m: string) => {
            return { address: m, type: EthereumTokenType.ERC20 }
        }) ?? [],
        chainId
    )



    const protocols = useMemo(
        () => [
            ...LDO_PAIRS.filter((x) => x[0].chainId === chainId).map((pair) => new LidoProtocol(pair)),
            ...splitToPair(detailedAaveTokens).map((pair: any) => new AAVEProtocol(pair)),
            ...splitToPair(detailedYFITokens).map((pair: any) => new YearnProtocol(pair)),
        ],
        [chainId, detailedAaveTokens, detailedYFITokens],
    )

    useUpdateEffect(() => {
        setChainId(currentChainId)
    }, [currentChainId])

    return (
        <TargetChainIdContext.Provider>
            <AllProviderTradeContext.Provider>
                <InjectedDialog
                    open={open}
                    title={t('plugin_savings')}
                    onClose={() => {
                        if (selectedProtocol === null) {
                            onClose?.()
                        } else {
                            setSelectedProtocol(null)
                        }
                    }}>
                    <DialogContent>
                        {!isDashboard ? (
                            <div className={classes.walletStatusBox}>
                                <WalletStatusBox />
                            </div>
                        ) : null}

                        {selectedProtocol ? (
                            <SavingsForm tab={tab} chainId={chainId} protocol={selectedProtocol} onClose={onClose} />
                        ) : (
                            <>
                                <div className={classes.abstractTabWrapper}>
                                    <NetworkTab
                                        chainId={chainId}
                                        setChainId={setChainId}
                                        classes={classes}
                                        chains={chains}
                                    />
                                </div>
                                <div className={classes.tableTabWrapper}>
                                    {protocols.length === 0 ? (
                                        <Typography variant="body2" textAlign="center">
                                            {t('plugin_no_protocol_available')}
                                        </Typography>
                                    ) : (
                                        <FolderTabs>
                                            <FolderTabPanel label="Deposit">
                                                <SavingsTable
                                                    chainId={chainId}
                                                    tab={TabType.Deposit}
                                                    protocols={protocols}
                                                    setTab={setTab}
                                                    setSelectedProtocol={setSelectedProtocol}
                                                />
                                            </FolderTabPanel>
                                            <FolderTabPanel label="Withdraw">
                                                <SavingsTable
                                                    chainId={chainId}
                                                    tab={TabType.Withdraw}
                                                    protocols={protocols.filter((x) => !x.balance.isZero())}
                                                    setTab={setTab}
                                                    setSelectedProtocol={setSelectedProtocol}
                                                />
                                            </FolderTabPanel>
                                        </FolderTabs>
                                    )}
                                </div>
                            </>
                        )}
                    </DialogContent>
                </InjectedDialog>
            </AllProviderTradeContext.Provider>
        </TargetChainIdContext.Provider>
    )
}
