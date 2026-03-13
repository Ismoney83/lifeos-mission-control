// Binance.US public WebSocket + REST for live crypto market data
// Uses binance.us (CORS-enabled, US-accessible, no auth for public data)

import type { Candle } from './massive'

// ─── Symbol mapping ────────────────────────────────────────────────────────────

// Binance.US uses USD pairs (SOLUSD, not SOLUSDT)
export const MASSIVE_TO_BINANCE: Record<string, string> = {
  'X:SOLUSD': 'SOLUSD',
  'X:BTCUSD': 'BTCUSD',
  'X:ETHUSD': 'ETHUSD',
}

export const BINANCE_TO_MASSIVE: Record<string, string> = {
  'SOLUSD': 'X:SOLUSD',
  'BTCUSD': 'X:BTCUSD',
  'ETHUSD': 'X:ETHUSD',
}

export type WSCallback = (event: Record<string, unknown>) => void

// ─── Binance REST ──────────────────────────────────────────────────────────────

export class BinanceREST {
  private base = 'https://api.binance.us'

  // Returns historical candles for any interval
  // intervals: '1s','1m','3m','5m','15m','30m','1h','4h','1d'
  async getKlines(
    massiveSymbol: string,
    interval: string,
    limit = 500,
  ): Promise<Candle[]> {
    const sym = MASSIVE_TO_BINANCE[massiveSymbol]
    if (!sym) return []
    const url = `${this.base}/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`
    const res = await fetch(url)
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((bar: unknown[]) => ({
      time: Math.floor((bar[0] as number) / 1000),  // open time → unix seconds
      open: parseFloat(bar[1] as string),
      high: parseFloat(bar[2] as string),
      low: parseFloat(bar[3] as string),
      close: parseFloat(bar[4] as string),
      volume: parseFloat(bar[5] as string),
    }))
  }

  // Current price for a symbol
  async getPrice(massiveSymbol: string): Promise<number> {
    const sym = MASSIVE_TO_BINANCE[massiveSymbol]
    if (!sym) return 0
    const res = await fetch(`${this.base}/api/v3/ticker/price?symbol=${sym}`)
    const data = await res.json()
    return parseFloat(data.price || '0')
  }
}

// ─── Binance WebSocket ─────────────────────────────────────────────────────────

export class BinanceWebSocket {
  private ws: WebSocket | null = null
  private destroyed = false
  private reconnectAttempts = 0
  private maxReconnect = 10
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // Buffer 1-second closed klines → N-second candles
  bufferSize = 30
  private secondBuffers: Record<string, Record<string, unknown>[]> = {}
  private callbacks: Record<string, WSCallback> = {}

  connect() {
    if (this.destroyed) return

    // Binance.US combined stream: 1s klines for SOL/BTC/ETH + SOL book ticker
    // Uses USD pairs (SOLUSD not SOLUSDT) and binance.us domain (CORS + US accessible)
    const streams = [
      'solusd@kline_1s',
      'btcusd@kline_1s',
      'ethusd@kline_1s',
      'solusd@bookTicker',
    ].join('/')

    this.ws = new WebSocket(`wss://stream.binance.us:9443/stream?streams=${streams}`)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      console.log('[Binance WS] connected')
      if (this.callbacks['auth_success']) this.callbacks['auth_success']({})
    }

    this.ws.onmessage = (msg) => {
      try {
        const wrapper = JSON.parse(msg.data) as { stream: string; data: Record<string, unknown> }
        this.handleStream(wrapper.stream, wrapper.data)
      } catch (e) {
        console.error('[Binance WS] parse error:', e)
      }
    }

    this.ws.onclose = () => {
      console.log('[Binance WS] closed — reconnecting')
      if (!this.destroyed) this.scheduleReconnect()
    }

    this.ws.onerror = (e) => console.error('[Binance WS] error:', e)
  }

  private handleStream(stream: string, data: Record<string, unknown>) {
    if (stream.includes('@kline')) {
      this.handleKline(data)
    } else if (stream.includes('@bookTicker')) {
      // data: { s: 'SOLUSDT', b: bid, a: ask }
      const massiveSym = BINANCE_TO_MASSIVE[(data.s as string)] ?? ''
      if (massiveSym && this.callbacks['quote_' + massiveSym]) {
        this.callbacks['quote_' + massiveSym]({
          bp: parseFloat(data.b as string),
          ap: parseFloat(data.a as string),
        })
      }
    }
  }

  private handleKline(data: Record<string, unknown>) {
    const k = data.k as Record<string, unknown>
    const binanceSym = k.s as string
    const massiveSym = BINANCE_TO_MASSIVE[binanceSym]
    if (!massiveSym) return

    const tick = {
      o: parseFloat(k.o as string),
      h: parseFloat(k.h as string),
      l: parseFloat(k.l as string),
      c: parseFloat(k.c as string),
      v: parseFloat(k.v as string),
      s: k.t as number,   // open time ms
      closed: k.x as boolean,
    }

    // Always emit live price tick
    if (this.callbacks['tick_' + massiveSym]) {
      this.callbacks['tick_' + massiveSym]({ c: tick.c })
    }

    // Only buffer closed 1s klines
    if (!tick.closed) return

    if (!this.secondBuffers[massiveSym]) this.secondBuffers[massiveSym] = []
    const buf = this.secondBuffers[massiveSym]
    buf.push(tick as unknown as Record<string, unknown>)

    if (buf.length >= this.bufferSize) {
      const ticks = buf as unknown as typeof tick[]
      const candle: Candle = {
        time: Math.floor(ticks[0].s / 1000),
        open: ticks[0].o,
        high: Math.max(...ticks.map(t => t.h)),
        low: Math.min(...ticks.map(t => t.l)),
        close: ticks[ticks.length - 1].c,
        volume: ticks.reduce((sum, t) => sum + t.v, 0),
      }
      this.secondBuffers[massiveSym] = []
      if (this.callbacks['candle_' + massiveSym]) {
        this.callbacks['candle_' + massiveSym](candle as unknown as Record<string, unknown>)
      }
    }
  }

  on(event: string, cb: WSCallback) { this.callbacks[event] = cb }
  off(event: string) { delete this.callbacks[event] }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect || this.destroyed) return
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  destroy() {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.callbacks = {}
  }

  get readyState() { return this.ws?.readyState }
}
