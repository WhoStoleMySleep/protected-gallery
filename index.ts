import { Buffer } from 'buffer'
global.Buffer = Buffer
import 'react-native-get-random-values'
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
