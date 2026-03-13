// Massive.com (formerly Polygon.io) WebSocket and REST API integration

export interface Candle {
  time: number   // Unix seconds (for LightweightCharts)
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface XAEvent {
  ev: 'XA'
  sym: string
  o: number   // open
  h: number   // high
  l: number   // low
  c: number   // close
  v: number   // volume
  s: number   // start timestamp ms
  e: number   // end timestamp ms
}

export interface XQEvent {
  ev: 'XQ'
  sym: string
  bp: number  // bid price
  bs: number  // bid size
  ap: number  // ask price
  as: number  // ask size
  t: number   // timestamp
}

export type WSCallback = (event: Record<string, unknown>) => void

export class MassiveWebSocket {
  private apiKey: string
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnect = 10
  private destroyed = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // Per-symbol second buffers; bufferSize is set per timeframe
  bufferSize = 30
  private secondBuffers: Record<string, XAEvent[]> = {}
  private callbacks: Record<string, WSCallback> = {}

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  connect() {
    if (this.destroyed) return
    this.ws = new WebSocket('wss://socket.massive.com/crypto')

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.ws!.send(JSON.stringify({ action: 'auth', params: this.apiKey }))
    }

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        const events = Array.isArray(data) ? data : [data]
        events.forEach(ev => this.handleEvent(ev as Record<string, unknown>))
      } catch (e) {
        console.error('[Massive WS] parse error:', e)
      }
    }

    this.ws.onclose = () => {
      if (!this.destroyed) this.scheduleReconnect()
    }

    this.ws.onerror = (e) => console.error('[Massive WS] error:', e)
  }

  private authenticate() {
    this.subscribe([
      'XA.X:SOLUSD', 'XA.X:BTCUSD', 'XA.X:ETHUSD', 'XA.X:XRPUSD',
      'XQ.X:SOLUSD',
    ])
    if (this.callbacks['auth_success']) {
      this.callbacks['auth_success']({})
    }
  }

  private handleEvent(event: Record<string, unknown>) {
    const ev = event.ev as string
    if (ev === 'connected') { this.authenticate(); return }
    if (ev === 'auth_success') {
      console.log('[Massive WS] authenticated')
      if (this.callbacks['auth_success']) this.callbacks['auth_success'](event)
      return
    }
    if (ev === 'XA') {
      this.handleSecondAggregate(event as unknown as XAEvent)
    }
    if (ev === 'XQ') {
      const sym = event.sym as string
      if (this.callbacks['quote_' + sym]) this.callbacks['quote_' + sym](event)
    }
    if (this.callbacks[ev]) this.callbacks[ev](event)
  }

  private handleSecondAggregate(tick: XAEvent) {
    const sym = tick.sym
    if (!this.secondBuffers[sym]) this.secondBuffers[sym] = []
    const buf = this.secondBuffers[sym]
    buf.push(tick)

    // Emit live tick for price display
    if (this.callbacks['tick_' + sym]) {
      this.callbacks['tick_' + sym](tick as unknown as Record<string, unknown>)
    }

    // Build candle when buffer is full
    if (buf.length >= this.bufferSize) {
      const candle: Candle = {
        time: Math.floor(buf[0].s / 1000),
        open: buf[0].o,
        high: Math.max(...buf.map(t => t.h)),
        low: Math.min(...buf.map(t => t.l)),
        close: buf[buf.length - 1].c,
        volume: buf.reduce((sum, t) => sum + t.v, 0),
      }
      this.secondBuffers[sym] = []
      if (this.callbacks['candle_' + sym]) {
        this.callbacks['candle_' + sym](candle as unknown as Record<string, unknown>)
      }
    }
  }

  on(event: string, cb: WSCallback) { this.callbacks[event] = cb }
  off(event: string) { delete this.callbacks[event] }

  subscribe(channels: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', params: channels.join(',') }))
    }
  }

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

export interface IndicatorValue {
  timestamp: number
  value: number
}

export interface MACDValue {
  timestamp: number
  value: number
  signal: number
  histogram: number
}

export class MassiveREST {
  private apiKey: string
  private base = 'https://api.massive.com'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async getHistorical(
    symbol: string,
    multiplier: number,
    timespan: string,
    fromMs?: number,
    toMs?: number
  ): Promise<Candle[]> {
    const from = fromMs ?? Date.now() - 4 * 60 * 60 * 1000
    const to = toMs ?? Date.now()
    const fromDate = new Date(from).toISOString().split('T')[0]
    const toDate = new Date(to).toISOString().split('T')[0]
    const url = `${this.base}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=10000&apiKey=${this.apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    return (data.results || []).map((b: Record<string, number>) => ({
      time: Math.floor(b.t / 1000),
      open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
    }))
  }

  async getRSI(symbol: string, timespan = 'minute', window = 14): Promise<IndicatorValue[]> {
    const url = `${this.base}/v1/indicators/rsi/${symbol}?timespan=${timespan}&window=${window}&series_type=close&limit=200&order=asc&apiKey=${this.apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    return data.results?.values || []
  }

  async getEMA(symbol: string, window = 9, timespan = 'minute'): Promise<IndicatorValue[]> {
    const url = `${this.base}/v1/indicators/ema/${symbol}?timespan=${timespan}&window=${window}&series_type=close&limit=200&order=asc&apiKey=${this.apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    return data.results?.values || []
  }

  async getMACD(symbol: string, timespan = 'minute'): Promise<MACDValue[]> {
    const url = `${this.base}/v1/indicators/macd/${symbol}?timespan=${timespan}&short_window=12&long_window=26&signal_window=9&series_type=close&limit=200&order=asc&apiKey=${this.apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    return (data.results?.values || []).map((v: Record<string, number>) => ({
      timestamp: v.timestamp,
      value: v.value,
      signal: v.signal,
      histogram: v.histogram,
    }))
  }

  async getSMA(symbol: string, window = 50, timespan = 'minute'): Promise<IndicatorValue[]> {
    const url = `${this.base}/v1/indicators/sma/${symbol}?timespan=${timespan}&window=${window}&series_type=close&limit=200&order=asc&apiKey=${this.apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    return data.results?.values || []
  }
}

// ─── Client-side indicator calculations ───────────────────────────────────────

export function calcOBV(candles: Candle[]): { time: number; value: number; color: string }[] {
  const result: { time: number; value: number; color: string }[] = []
  let obv = 0
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      result.push({ time: candles[i].time, value: 0, color: '#22c55e' })
      continue
    }
    const prev = candles[i - 1]
    const cur = candles[i]
    if (cur.close > prev.close) obv += cur.volume
    else if (cur.close < prev.close) obv -= cur.volume
    const prevObv = result[i - 1].value
    result.push({
      time: cur.time,
      value: obv,
      color: obv >= prevObv ? '#22c55e' : '#ef4444',
    })
  }
  return result
}

export function calcStochastic(
  candles: Candle[],
  period = 14,
  smoothK = 3,
  smoothD = 3
): { time: number; k: number; d: number }[] {
  const kRaw: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { kRaw.push(50); continue }
    const slice = candles.slice(i - period + 1, i + 1)
    const highest = Math.max(...slice.map(c => c.high))
    const lowest = Math.min(...slice.map(c => c.low))
    const range = highest - lowest
    kRaw.push(range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100)
  }

  // Smooth %K
  const kSmoothed = smaArr(kRaw, smoothK)
  // %D = SMA of %K
  const dSmoothed = smaArr(kSmoothed, smoothD)

  return candles.map((c, i) => ({
    time: c.time,
    k: kSmoothed[i],
    d: dSmoothed[i],
  }))
}

function smaArr(arr: number[], period: number): number[] {
  return arr.map((_, i) => {
    if (i < period - 1) return arr[i]
    const slice = arr.slice(i - period + 1, i + 1)
    return slice.reduce((s, v) => s + v, 0) / period
  })
}

export function calcVWAP(candles: Candle[]): { time: number; value: number }[] {
  // Reset at midnight UTC
  let cumTPV = 0
  let cumVol = 0
  let lastDay = -1
  return candles.map(c => {
    const day = Math.floor(c.time / 86400)
    if (day !== lastDay) {
      cumTPV = 0
      cumVol = 0
      lastDay = day
    }
    const tp = (c.high + c.low + c.close) / 3
    cumTPV += tp * c.volume
    cumVol += c.volume
    return { time: c.time, value: cumVol > 0 ? cumTPV / cumVol : c.close }
  })
}
