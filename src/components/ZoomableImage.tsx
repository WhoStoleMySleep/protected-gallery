import React, { useRef, useEffect } from 'react'
import { Animated, PanResponder, TouchableOpacity, Dimensions } from 'react-native'
import { Image } from 'expo-image'

const { width, height } = Dimensions.get('window')

interface Props {
  uri: string
  onScaleChange?: (scale: number) => void
}

export const ZoomableImage: React.FC<Props> = ({ uri, onScaleChange }) => {
  const scale = useRef(new Animated.Value(1)).current
  const currentScale = useRef(1)
  const lastScale = useRef(1)
  const initialDist = useRef<number | null>(null)
  const lastTap = useRef(0)

  useEffect(() => {
    const id = (scale as any).addListener(({ value }: { value: number }) => {
      currentScale.current = value
      onScaleChange?.(value)
    })
    return () => (scale as any).removeListener(id)
  }, [onScaleChange])

  const resetZoom = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }).start()
    lastScale.current = 1
    currentScale.current = 1
    onScaleChange?.(1)
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
    onPanResponderGrant: (e) => {
      if (e.nativeEvent.touches.length !== 2) return
      const [t1, t2] = e.nativeEvent.touches
      const dx = t1.pageX - t2.pageX
      const dy = t1.pageY - t2.pageY
      initialDist.current = Math.sqrt(dx * dx + dy * dy)
      lastScale.current = currentScale.current
    },
    onPanResponderMove: (e) => {
      if (e.nativeEvent.touches.length !== 2 || initialDist.current === null) return
      const [t1, t2] = e.nativeEvent.touches
      const dx = t1.pageX - t2.pageX
      const dy = t1.pageY - t2.pageY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const newScale = Math.max(1, Math.min(5, lastScale.current * dist / initialDist.current))
      scale.setValue(newScale)
    },
    onPanResponderRelease: () => {
      initialDist.current = null
      if (currentScale.current < 1.15) {
        resetZoom()
      } else {
        lastScale.current = currentScale.current
      }
    },
    onPanResponderTerminate: () => {
      initialDist.current = null
      if (currentScale.current < 1.15) resetZoom()
    },
  })).current

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      if (currentScale.current > 1.1) {
        resetZoom()
      } else {
        Animated.spring(scale, { toValue: 2.5, useNativeDriver: true, tension: 120, friction: 8 }).start()
        lastScale.current = 2.5
        onScaleChange?.(2.5)
      }
    }
    lastTap.current = now
  }

  return (
    <TouchableOpacity activeOpacity={1} onPress={handleTap} {...panResponder.panHandlers}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit="contain"
        />
      </Animated.View>
    </TouchableOpacity>
  )
}
