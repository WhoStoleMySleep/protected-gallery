import { NativeModules } from 'react-native'

const { SecureFlag } = NativeModules

export const applySecureFlag = (enabled: boolean) => {
  SecureFlag?.setEnabled(enabled)
}
