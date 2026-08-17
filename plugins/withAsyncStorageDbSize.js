const { withGradleProperties } = require('expo/config-plugins')

const PROP = 'AsyncStorage_db_size_in_MB'

/**
 * AsyncStorage на Android — это SQLite-база с лимитом 6 МБ по умолчанию.
 * При превышении любая запись падает с SQLITE_FULL (code 13), даже если
 * на устройстве свободны десятки гигабайт.
 *
 * Библиотека читает лимит как Gradle-property (android/config.gradle →
 * getDatabaseSize → rootProject.hasProperty), поэтому значение должно
 * попасть именно в android/gradle.properties, а не в ext {}.
 */
const withAsyncStorageDbSize = (config, { sizeInMB = 64 } = {}) =>
  withGradleProperties(config, cfg => {
    cfg.modResults = cfg.modResults.filter(
      item => !(item.type === 'property' && item.key === PROP),
    )
    cfg.modResults.push({ type: 'property', key: PROP, value: String(sizeInMB) })
    return cfg
  })

module.exports = withAsyncStorageDbSize
