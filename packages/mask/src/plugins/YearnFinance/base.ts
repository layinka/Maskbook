import type { Plugin } from '@masknet/plugin-infra'
import { PLUGIN_ID, PLUGIN_ICON, PLUGIN_NAME, PLUGIN_DESCRIPTION } from './constants'

export const base: Plugin.Shared.Definition = {
    ID: PLUGIN_ID,
    icon: PLUGIN_ICON,
    name: { fallback: PLUGIN_NAME },
    description: { fallback: PLUGIN_DESCRIPTION },
    /* cspell:disable-next-line */
    publisher: { name: { fallback: 'Layinka' }, link: 'https://github.com/layinka' },
    enableRequirement: {
        architecture: { app: true, web: true },
        networks: { type: 'opt-out', networks: {} },
        target: 'stable',
    },
}
