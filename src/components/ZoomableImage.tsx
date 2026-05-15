import React, { useRef } from 'react'
import { Animated, PanResponder, View, Dimensions } from 'react-native'
import { Image } from 'expo-image'

const { width, height } = Dimensions.get('window')

interface Props {
  uri: string
  onScaleChange?: (scale: number) => void
  onSingleTap?: () => void
}

export const ZoomableImage: React.FC<Props> = ({ uri, onScaleChange, onSingleTap }) => {
  const scale = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current

  // Current state — updated directly in move handler (not via listener, to avoid async lag)
  const s = useRef(1)
  const tx = useRef(0)
  const ty = useRef(0)

  // State snapshot at gesture start / pinch init
  const baseScale = useRef(1)
  const baseTx = useRef(0)
  const baseTy = useRef(0)
  const initDist = useRef<number | null>(null)
  const initMidX = useRef(0)
  const initMidY = useRef(0)

  const lastTap = useRef(0)
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const maxTrans = (sc: number) => ({
    x: Math.max(0, (width * sc - width) / 2),
    y: Math.max(0, (height * sc - height) / 2),
  })

  const clamp = (newTx: number, newTy: number, sc: number) => {
    const m = maxTrans(sc)
    return {
      x: Math.max(-m.x, Math.min(m.x, newTx)),
      y: Math.max(-m.y, Math.min(m.y, newTy)),
    }
  }

  const applyTransform = (newScale: number, newTx: number, newTy: number) => {
    s.current = newScale
    tx.current = newTx
    ty.current = newTy
    scale.setValue(newScale)
    translateX.setValue(newTx)
    translateY.setValue(newTy)
    onScaleChange?.(newScale)
  }

  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 130, friction: 9 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 130, friction: 9 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 130, friction: 9 }),
    ]).start()
    s.current = 1; tx.current = 0; ty.current = 0
    onScaleChange?.(1)
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) =>
      e.nativeEvent.touches.length === 2 || s.current > 1.05,
    onMoveShouldSetPanResponder: (e) =>
      e.nativeEvent.touches.length === 2 || s.current > 1.05,

    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches
      baseScale.current = s.current
      baseTx.current = tx.current
      baseTy.current = ty.current
      initDist.current = null

      if (touches.length === 1) {
        initMidX.current = touches[0].pageX
        initMidY.current = touches[0].pageY
      }
    },

    onPanResponderMove: (e) => {
      const touches = e.nativeEvent.touches

      if (touches.length >= 2) {
        if (initDist.current === null) {
          // Initialize pinch (first 2-finger move, or re-init after finger count change)
          const dx = touches[0].pageX - touches[1].pageX
          const dy = touches[0].pageY - touches[1].pageY
          initDist.current = Math.max(1, Math.sqrt(dx * dx + dy * dy))
          initMidX.current = (touches[0].pageX + touches[1].pageX) / 2
          initMidY.current = (touches[0].pageY + touches[1].pageY) / 2
          baseScale.current = s.current
          baseTx.current = tx.current
          baseTy.current = ty.current
          return
        }

        const dx = touches[0].pageX - touches[1].pageX
        const dy = touches[0].pageY - touches[1].pageY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const newScale = Math.max(1, Math.min(6, baseScale.current * dist / initDist.current))
        const ratio = newScale / baseScale.current

        // Scale around the initial pinch midpoint
        const newTx = (initMidX.current - width / 2) * (1 - ratio) + baseTx.current * ratio
        const newTy = (initMidY.current - height / 2) * (1 - ratio) + baseTy.current * ratio
        const c = clamp(newTx, newTy, newScale)

        applyTransform(newScale, c.x, c.y)

      } else if (touches.length === 1) {
        if (initDist.current !== null) {
          // Finger count just dropped 2→1: re-init pan from current state
          initDist.current = null
          baseTx.current = tx.current
          baseTy.current = ty.current
          initMidX.current = touches[0].pageX
          initMidY.current = touches[0].pageY
          return
        }
        if (s.current <= 1.05) return

        const newTx = baseTx.current + (touches[0].pageX - initMidX.current)
        const newTy = baseTy.current + (touches[0].pageY - initMidY.current)
        const c = clamp(newTx, newTy, s.current)
        tx.current = c.x; ty.current = c.y
        translateX.setValue(c.x)
        translateY.setValue(c.y)
      }
    },

    onPanResponderRelease: () => {
      const currentScale = s.current
      initDist.current = null

      if (currentScale < 1.15) {
        resetZoom()
      } else {
        // Snap translation into bounds if drifted
        const c = clamp(tx.current, ty.current, currentScale)
        if (Math.abs(c.x - tx.current) > 1 || Math.abs(c.y - ty.current) > 1) {
          tx.current = c.x; ty.current = c.y
          Animated.parallel([
            Animated.spring(translateX, { toValue: c.x, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: c.y, useNativeDriver: true }),
          ]).start()
        }
      }
    },

    // On terminate (system gesture steal) — keep zoom, just snap bounds
    onPanResponderTerminate: () => {
      initDist.current = null
      const c = clamp(tx.current, ty.current, s.current)
      tx.current = c.x; ty.current = c.y
      Animated.parallel([
        Animated.spring(translateX, { toValue: c.x, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: c.y, useNativeDriver: true }),
      ]).start()
    },
  })).current

  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null }
      if (s.current > 1.1) {
        resetZoom()
      } else {
        applyTransform(2.5, 0, 0)
        Animated.spring(scale, { toValue: 2.5, useNativeDriver: true, tension: 130, friction: 9 }).start()
      }
    } else {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current)
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null
        onSingleTap?.()
      }, 280)
    }
    lastTap.current = now
  }

  return (
    <View style={{ width, height }} {...panResponder.panHandlers} onTouchEnd={handleDoubleTap}>
      <Animated.View style={{ transform: [{ translateX }, { translateY }, { scale }] }}>
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" />
      </Animated.View>
    </View>
  )
}
