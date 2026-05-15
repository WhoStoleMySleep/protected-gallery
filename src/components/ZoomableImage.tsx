import React, { useRef } from 'react'
import { Animated, PanResponder, View, Dimensions } from 'react-native'
import { Image } from 'expo-image'

const { width, height } = Dimensions.get('window')

interface Props {
  uri: string
  onScaleChange?: (scale: number) => void
}

export const ZoomableImage: React.FC<Props> = ({ uri, onScaleChange }) => {
  const scale = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current

  // Live values tracked via listeners
  const s = useRef(1)
  const tx = useRef(0)
  const ty = useRef(0)

  // Values at gesture start
  const baseScale = useRef(1)
  const baseTx = useRef(0)
  const baseTy = useRef(0)

  // Pinch tracking
  const initDist = useRef<number | null>(null)
  const initMidX = useRef(0)
  const initMidY = useRef(0)

  // Double-tap
  const lastTap = useRef(0)

  // Sync animated values → refs
  React.useEffect(() => {
    const ids = [
      (scale as any).addListener(({ value }: { value: number }) => { s.current = value; onScaleChange?.(value) }),
      (translateX as any).addListener(({ value }: { value: number }) => { tx.current = value }),
      (translateY as any).addListener(({ value }: { value: number }) => { ty.current = value }),
    ]
    return () => ids.forEach((id, i) => [scale, translateX, translateY][i].removeListener(id) as any)
  }, [onScaleChange])

  const maxTrans = (sc: number) => ({
    x: Math.max(0, (width * sc - width) / 2),
    y: Math.max(0, (height * sc - height) / 2),
  })

  const clampedTrans = (newTx: number, newTy: number, sc: number) => {
    const m = maxTrans(sc)
    return {
      x: Math.max(-m.x, Math.min(m.x, newTx)),
      y: Math.max(-m.y, Math.min(m.y, newTy)),
    }
  }

  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }),
    ]).start()
    s.current = 1; tx.current = 0; ty.current = 0
    onScaleChange?.(1)
  }

  const panResponder = useRef(PanResponder.create({
    // Claim immediately if zoomed (single finger) or always for 2 fingers
    onStartShouldSetPanResponder: (e) =>
      e.nativeEvent.touches.length === 2 || s.current > 1.05,
    onMoveShouldSetPanResponder: (e) =>
      e.nativeEvent.touches.length === 2 || s.current > 1.05,

    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches
      baseScale.current = s.current
      baseTx.current = tx.current
      baseTy.current = ty.current

      if (touches.length === 2) {
        const dx = touches[0].pageX - touches[1].pageX
        const dy = touches[0].pageY - touches[1].pageY
        initDist.current = Math.sqrt(dx * dx + dy * dy)
        initMidX.current = (touches[0].pageX + touches[1].pageX) / 2
        initMidY.current = (touches[0].pageY + touches[1].pageY) / 2
      } else {
        initDist.current = null
      }
    },

    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches

      if (touches.length >= 2 && initDist.current !== null) {
        // ── Pinch ──
        const dx = touches[0].pageX - touches[1].pageX
        const dy = touches[0].pageY - touches[1].pageY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const ratio = dist / initDist.current
        const newScale = Math.max(1, Math.min(6, baseScale.current * ratio))

        // Scale around pinch midpoint
        // tx2 = (midX - w/2) * (1 - newScale/baseScale) + baseTx * newScale/baseScale
        const scaleRatio = newScale / baseScale.current
        const newTx = (initMidX.current - width / 2) * (1 - scaleRatio) + baseTx.current * scaleRatio
        const newTy = (initMidY.current - height / 2) * (1 - scaleRatio) + baseTy.current * scaleRatio
        const clamped = clampedTrans(newTx, newTy, newScale)

        scale.setValue(newScale)
        translateX.setValue(clamped.x)
        translateY.setValue(clamped.y)
      } else if (touches.length === 1 && s.current > 1.05) {
        // ── Pan while zoomed ──
        const newTx = baseTx.current + g.dx
        const newTy = baseTy.current + g.dy
        const clamped = clampedTrans(newTx, newTy, s.current)
        translateX.setValue(clamped.x)
        translateY.setValue(clamped.y)
      }
    },

    onPanResponderRelease: (e) => {
      initDist.current = null
      if (s.current < 1.15) {
        resetZoom()
      } else {
        // Snap translate to clamped bounds
        const clamped = clampedTrans(tx.current, ty.current, s.current)
        if (Math.abs(clamped.x - tx.current) > 0.5 || Math.abs(clamped.y - ty.current) > 0.5) {
          Animated.parallel([
            Animated.spring(translateX, { toValue: clamped.x, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: clamped.y, useNativeDriver: true }),
          ]).start()
        }
      }
    },

    onPanResponderTerminate: () => {
      initDist.current = null
      if (s.current < 1.15) resetZoom()
    },
  })).current

  const handlePress = () => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      if (s.current > 1.1) {
        resetZoom()
      } else {
        Animated.spring(scale, { toValue: 2.5, useNativeDriver: true, tension: 120, friction: 8 }).start()
        onScaleChange?.(2.5)
      }
    }
    lastTap.current = now
  }

  return (
    <View
      style={{ width, height }}
      onStartShouldSetResponder={() => false}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={{ transform: [{ translateX }, { translateY }, { scale }] }}
        onTouchEnd={handlePress}
      >
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" />
      </Animated.View>
    </View>
  )
}
