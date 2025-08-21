// Unit tests for color utilities
import { describe, it, expect } from 'vitest'
import {
  hexColorToInt,
} from '../../src/utils/color.js'

describe('Color Utilities', () => {
  describe('hexColorToInt', () => {
    it('should convert valid hex colors to integers', () => {
      expect(hexColorToInt('#FF0000')).toBe(0xFF0000)
      expect(hexColorToInt('#00FF00')).toBe(0x00FF00)
      expect(hexColorToInt('#0000FF')).toBe(0x0000FF)
      expect(hexColorToInt('#FFFFFF')).toBe(0xFFFFFF)
      expect(hexColorToInt('#000000')).toBe(0x000000)
    })

    it('should handle hex colors without hash', () => {
      expect(hexColorToInt('FF0000')).toBe(0xFF0000)
      expect(hexColorToInt('00FF00')).toBe(0x00FF00)
    })

    it('should handle 3-character hex colors', () => {
      expect(hexColorToInt('#F00')).toBe(0xFF0000)
      expect(hexColorToInt('#0F0')).toBe(0x00FF00)
      expect(hexColorToInt('#00F')).toBe(0x0000FF)
      expect(hexColorToInt('FFF')).toBe(0xFFFFFF)
    })

    it('should handle lowercase hex colors', () => {
      expect(hexColorToInt('#ff0000')).toBe(0xFF0000)
      expect(hexColorToInt('#abcdef')).toBe(0xABCDEF)
    })

    it('should return default color for invalid hex colors', () => {
      const defaultColor = 0x7289DA // Discord Blurple
      expect(hexColorToInt('#GGGGGG')).toBe(defaultColor)
      expect(hexColorToInt('#12345')).toBe(defaultColor)
      expect(hexColorToInt('#1234567')).toBe(defaultColor)
      expect(hexColorToInt('invalid')).toBe(defaultColor)
      expect(hexColorToInt('')).toBe(defaultColor)
      expect(hexColorToInt(null)).toBe(defaultColor)
      expect(hexColorToInt(undefined)).toBe(defaultColor)
    })

    it('should handle color names', () => {
      expect(hexColorToInt('red')).toBe(0xED4245)
      expect(hexColorToInt('green')).toBe(0x57F287)
      expect(hexColorToInt('blue')).toBe(0x3498DB)
      expect(hexColorToInt('blurple')).toBe(0x5865F2)
      expect(hexColorToInt('white')).toBe(0xFFFFFF)
      expect(hexColorToInt('black')).toBe(0x000000)
    })

    it('should handle case insensitive color names', () => {
      expect(hexColorToInt('RED')).toBe(0xED4245)
      expect(hexColorToInt('Green')).toBe(0x57F287)
      expect(hexColorToInt('BLUE')).toBe(0x3498DB)
    })

    it('should handle edge cases', () => {
      expect(hexColorToInt('   red   ')).toBe(0xED4245) // Whitespace
      expect(hexColorToInt('gray')).toBe(0x95A5A6) // Alias
      expect(hexColorToInt('grey')).toBe(0x95A5A6) // Original
    })

    it('should perform efficiently with many conversions', () => {
      const start = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        hexColorToInt('#FF0000')
        hexColorToInt('blue')
        hexColorToInt('invalid')
      }
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should complete quickly
    })
  })
})