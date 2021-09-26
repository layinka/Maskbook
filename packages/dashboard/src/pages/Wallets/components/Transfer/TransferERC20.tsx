import { MaskTextField } from '@masknet/theme'
import { Box, Button, IconButton, Stack, Typography } from '@material-ui/core'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
    EthereumTokenType,
    formatWeiToEther,
    FungibleTokenDetailed,
    isGreaterThan,
    isZero,
    pow10,
    TransactionStateType,
    useFungibleTokenBalance,
    useGasLimit,
    useGasPrice,
    useNativeTokenDetailed,
    useTokenTransferCallback,
    GasOption,
    isEIP1559Supported,
    useChainId,
} from '@masknet/web3-shared'
import BigNumber from 'bignumber.js'
import { TokenAmountPanel, useRemoteControlledDialog } from '@masknet/shared'
import TuneIcon from '@material-ui/icons/Tune'
import { WalletMessages } from '@masknet/plugin-wallet'
import { EthereumAddress } from 'wallet.ts'
import { SelectTokenDialog } from '../SelectTokenDialog'
import { useDashboardI18N } from '../../../../locales'
import { useNativeTokenPrice } from './useNativeTokenPrice'

interface TransferERC20Props {
    token: FungibleTokenDetailed
}

const GAS_LIMIT = 30000
export const TransferERC20 = memo<TransferERC20Props>(({ token }) => {
    const t = useDashboardI18N()
    const [amount, setAmount] = useState('')
    const [address, setAddress] = useState('')
    const [memo, setMemo] = useState('')
    const [selectedToken, setToken] = useState<FungibleTokenDetailed>(token)
    const [isOpenSelectTokenDialog, openSelectTokenDialog] = useState(false)
    const [gasOption, setGasOption] = useState<GasOption>(GasOption.Medium)
    const chainId = useChainId()
    const is1559Supported = isEIP1559Supported(chainId)

    // gas price
    const { value: defaultGasPrice = '0' } = useGasPrice()
    const [customGasPrice, setCustomGasPrice] = useState<BigNumber.Value>(0)
    const gasPrice = customGasPrice || defaultGasPrice

    // balance
    const { value: tokenBalance = '0', retry: tokenBalanceRetry } = useFungibleTokenBalance(
        selectedToken?.type ?? EthereumTokenType.Native,
        selectedToken?.address ?? '',
    )
    const nativeToken = useNativeTokenDetailed()
    const nativeTokenPrice = useNativeTokenPrice()
    const isNativeToken = selectedToken.type === EthereumTokenType.Native

    // transfer amount
    const transferAmount = new BigNumber(amount || '0').multipliedBy(pow10(selectedToken.decimals)).toFixed()
    const erc20GasLimit = useGasLimit(selectedToken.type, selectedToken.address, transferAmount, address)
    const [gasLimit, setGasLimit] = useState<string | number>(0)
    const [maxFee, setMaxFee] = useState<string | null>(null)
    useEffect(() => {
        setGasLimit(isNativeToken ? GAS_LIMIT : erc20GasLimit.value?.toFixed() ?? 0)
    }, [isNativeToken, erc20GasLimit.value])
    const gasFee = useMemo(() => {
        const price = is1559Supported && maxFee ? new BigNumber(maxFee) : gasPrice
        return new BigNumber(gasLimit).multipliedBy(price)
    }, [gasLimit, gasPrice, maxFee, is1559Supported])
    const maxAmount = useMemo(() => {
        let amount_ = new BigNumber(tokenBalance || '0')
        amount_ = selectedToken.type === EthereumTokenType.Native ? amount_.minus(gasFee) : amount_
        return amount_.toFixed()
    }, [tokenBalance, gasPrice, selectedToken?.type, amount])

    const [transferState, transferCallback, resetTransferCallback] = useTokenTransferCallback(
        selectedToken.type,
        selectedToken.address,
    )

    const { setDialog: setGasSettingDialog } = useRemoteControlledDialog(WalletMessages.events.gasSettingDialogUpdated)
    const openGasSettingDialog = useCallback(() => {
        setGasSettingDialog({
            open: true,
            gasLimit,
            gasOption,
        })
    }, [gasLimit, gasOption])

    useEffect(() => {
        return WalletMessages.events.gasSettingDialogUpdated.on((evt) => {
            if (evt.open) return
            if (evt.gasPrice) setCustomGasPrice(evt.gasPrice)
            if (evt.gasOption) setGasOption(evt.gasOption)
            if (evt.gasLimit) setGasLimit(evt.gasLimit)
            if (evt.maxFee) setMaxFee(evt.maxFee)
        })
    }, [])
    const onTransfer = useCallback(async () => {
        await transferCallback(transferAmount, address, undefined, memo)
    }, [transferAmount, address, memo, selectedToken.decimals, transferCallback])

    //#region validation
    const validationMessage = useMemo(() => {
        if (!transferAmount || isZero(transferAmount)) return t.wallets_transfer_error_amount_absence()
        if (isGreaterThan(new BigNumber(amount).multipliedBy(pow10(selectedToken.decimals)).toFixed(), maxAmount))
            return t.wallets_transfer_error_insufficient_balance({ symbol: selectedToken.symbol ?? '' })
        if (!address) return t.wallets_transfer_error_address_absence()
        if (!EthereumAddress.isValid(address)) return t.wallets_transfer_error_invalid_address()
        return ''
    }, [transferAmount, maxAmount, address, tokenBalance, selectedToken, amount])
    //#endregion

    useEffect(() => {
        if (transferState.type === TransactionStateType.FAILED || transferState.type === TransactionStateType.HASH) {
            setMemo('')
            setAddress('')
            setAmount('')
            resetTransferCallback()
        }
    }, [transferState])

    return (
        <Stack direction="row" justifyContent="center" mt={4}>
            <Stack maxWidth={640} minWidth={500}>
                <Box>
                    <MaskTextField
                        required
                        value={address}
                        onChange={(e) => setAddress(e.currentTarget.value)}
                        label={t.wallets_transfer_to_address()}
                    />
                </Box>
                <Box mt={2}>
                    <TokenAmountPanel
                        amount={amount}
                        maxAmount={maxAmount}
                        balance={tokenBalance}
                        label={t.wallets_transfer_amount()}
                        token={selectedToken}
                        onAmountChange={setAmount}
                        SelectTokenChip={{
                            loading: false,
                            ChipProps: {
                                onClick: () => openSelectTokenDialog(true),
                            },
                        }}
                    />
                </Box>
                <Box display="flex" flexDirection="row" justifyContent="space-between" alignItems="center" mt="16px">
                    <Typography fontSize="12px" fontWeight="bold">
                        {t.gas_fee()}
                    </Typography>
                    <Box display="flex" flexDirection="row" alignItems="center">
                        <Typography fontSize="14px">
                            {t.transfer_cost({
                                gasFee: formatWeiToEther(gasFee).toFixed(6),
                                symbol: nativeToken.value?.symbol ?? '',
                                usd: formatWeiToEther(gasFee).multipliedBy(nativeTokenPrice).toFixed(2),
                            })}
                        </Typography>
                        <IconButton size="small" onClick={openGasSettingDialog}>
                            <TuneIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>
                {isNativeToken ? (
                    <Box mt={2}>
                        <MaskTextField
                            value={memo}
                            placeholder={t.wallets_transfer_memo_placeholder()}
                            onChange={(e) => setMemo(e.currentTarget.value)}
                            label={t.wallets_transfer_memo()}
                        />
                    </Box>
                ) : null}
                <Box mt={4} display="flex" flexDirection="row" justifyContent="center">
                    <Button
                        sx={{ width: 240 }}
                        disabled={
                            !!validationMessage || transferState.type === TransactionStateType.WAIT_FOR_CONFIRMING
                        }
                        onClick={onTransfer}>
                        {validationMessage || t.wallets_transfer_send()}
                    </Button>
                </Box>
            </Stack>
            {isOpenSelectTokenDialog && (
                <SelectTokenDialog
                    onSelect={(token) => {
                        setToken(token!)
                        openSelectTokenDialog(false)
                    }}
                    open={isOpenSelectTokenDialog}
                    onClose={() => openSelectTokenDialog(false)}
                />
            )}
        </Stack>
    )
})
