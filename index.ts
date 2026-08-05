import { Buffer } from 'buffer'
;(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer
import 'react-native-get-random-values'
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
