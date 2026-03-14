import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, ColorType, CrosshairMode, LineStyle,
} from 'lightweight-charts'
import type {
  IChartApi, ISeriesApi, IPriceLine, UTCTimestamp,
} from 'lightweight-charts'

const t = (n: number) => n as UTCTimestamp
import { Settings, Wifi, WifiOff, RefreshCw, Eye, EyeOff, X } from 'lucide-react'
import { MassiveREST, calcOBV, calcStochastic, calcVWAP } from '../lib/massive'
import type { Candle, IndicatorValue, MACDValue } from '../lib/massive'
import { BinanceWebSocket, BinanceREST } from '../lib/binance'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Timeframe = '30s' | '1m' | '5m' | '15m' | '1h'
export type CryptoSymbol = 'X:SOLUSD' | 'X:BTCUSD' | 'X:ETHUSD'

// Binance interval for historical seed + WS buffer size per timeframe
const TIMEFRAME_CONFIG: Record<Timeframe, { bufferSize: number; binanceInterval: string; massiveTimespan: string }> = {
  '30s': { bufferSize: 30,   binanceInterval: '1m',  massiveTimespan: 'minute' },
  '1m':  { bufferSize: 60,   binanceInterval: '1m',  massiveTimespan: 'minute' },
  '5m':  { bufferSize: 300,  binanceInterval: '5m',  massiveTimespan: 'minute' },
  '15m': { bufferSize: 900,  binanceInterval: '15m', massiveTimespan: 'minute' },
  '1h':  { bufferSize: 3600, binanceInterval: '1h',  massiveTimespan: 'hour'   },
}

const SYMBOLS: { label: string; value: CryptoSymbol }[] = [
  { label: 'SOL', value: 'X:SOLUSD' },
  { label: 'BTC', value: 'X:BTCUSD' },
  { label: 'ETH', value: 'X:ETHUSD' },
]

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
const FIB_COLORS = ['#ffffff', '#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#a855f7', '#ffffff']

// Dark chart theme
const CHART_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: '#030712' },
    textColor: '#6B7280',
  },
  grid: {
    vertLines: { color: '#111827' },
    horzLines: { color: '#111827' },
  },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#1F2937' },
  timeScale: { borderColor: '#1F2937', timeVisible: true, secondsVisible: true },
}

// ─── Confluence calculation ────────────────────────────────────────────────────

interface ConfluenceFactor {
  label: string
  score: number
  max: number
  detail: string
}

interface ConfluenceResult {
  score: number
  direction: 'LONG' | 'SHORT' | 'NEUTRAL'
  factors: ConfluenceFactor[]
}

function calcConfluence(
  candles: Candle[],
  rsi: IndicatorValue[],
  ema9: IndicatorValue[],
  ema21: IndicatorValue[],
  vwap: { time: number; value: number }[],
): ConfluenceResult {
  const factors: ConfluenceFactor[] = []
  let score = 0

  const last = candles[candles.length - 1]
  if (!last) return { score: 0, direction: 'NEUTRAL', factors: [] }

  // EMA alignment (+20)
  const e9 = ema9[ema9.length - 1]?.value
  const e9prev = ema9[ema9.length - 2]?.value
  const e21 = ema21[ema21.length - 1]?.value
  if (e9 && e21) {
    if (e9 > e21 && e9 > (e9prev ?? e9)) {
      score += 20
      factors.push({ label: 'EMA Alignment', score: 20, max: 20, detail: 'Bullish EMA9 > EMA21 & rising' })
    } else if (e9 < e21 && e9 < (e9prev ?? e9)) {
      factors.push({ label: 'EMA Alignment', score: 0, max: 20, detail: 'Bearish EMA9 < EMA21 & falling' })
    } else {
      score += 5
      factors.push({ label: 'EMA Alignment', score: 5, max: 20, detail: 'Mixed EMA signal' })
    }
  }

  // VWAP position (+15)
  const vwapLast = vwap[vwap.length - 1]?.value
  if (vwapLast) {
    if (last.close > vwapLast) {
      score += 15
      factors.push({ label: 'VWAP', score: 15, max: 15, detail: `Above VWAP ($${vwapLast.toFixed(2)})` })
    } else {
      factors.push({ label: 'VWAP', score: 0, max: 15, detail: `Below VWAP ($${vwapLast.toFixed(2)})` })
    }
  }

  // RSI sweet spot (+15)
  const rsiLast = rsi[rsi.length - 1]?.value
  if (rsiLast != null) {
    if (rsiLast >= 40 && rsiLast <= 60) {
      score += 15
      factors.push({ label: 'RSI', score: 15, max: 15, detail: `RSI ${rsiLast.toFixed(1)} — neutral zone` })
    } else if (rsiLast > 70) {
      factors.push({ label: 'RSI', score: 0, max: 15, detail: `RSI ${rsiLast.toFixed(1)} — overbought` })
    } else if (rsiLast < 30) {
      factors.push({ label: 'RSI', score: 0, max: 15, detail: `RSI ${rsiLast.toFixed(1)} — oversold` })
    } else {
      score += 7
      factors.push({ label: 'RSI', score: 7, max: 15, detail: `RSI ${rsiLast.toFixed(1)} — approaching zone` })
    }
  }

  // Volume surge (+20)
  const recent = candles.slice(-20)
  const vol20avg = recent.reduce((s, c) => s + c.volume, 0) / Math.max(recent.length, 1)
  const volRatio = vol20avg > 0 ? last.volume / vol20avg : 1
  if (volRatio > 1.5) {
    score += 20
    factors.push({ label: 'Volume', score: 20, max: 20, detail: `${volRatio.toFixed(1)}x avg volume surge` })
  } else if (volRatio > 1.1) {
    score += 10
    factors.push({ label: 'Volume', score: 10, max: 20, detail: `${volRatio.toFixed(1)}x avg volume elevated` })
  } else {
    factors.push({ label: 'Volume', score: 0, max: 20, detail: `${volRatio.toFixed(1)}x avg — low volume` })
  }

  // 3-candle momentum (+15)
  const last3 = candles.slice(-3)
  if (last3.length === 3 && last3.every(c => c.close > c.open)) {
    score += 15
    factors.push({ label: 'Momentum', score: 15, max: 15, detail: '3 consecutive bull candles' })
  } else if (last3.length === 3 && last3.every(c => c.close < c.open)) {
    factors.push({ label: 'Momentum', score: 0, max: 15, detail: '3 consecutive bear candles' })
  } else {
    score += 5
    factors.push({ label: 'Momentum', score: 5, max: 15, detail: 'Mixed candle pattern' })
  }

  // Wallet activity placeholder (+15) — wired to Supabase in future
  factors.push({ label: 'Smart Wallets', score: 0, max: 15, detail: 'No recent activity detected' })

  const direction: ConfluenceResult['direction'] =
    score >= 70 ? 'LONG' : score <= 25 ? 'SHORT' : 'NEUTRAL'

  return { score, direction, factors }
}

// ─── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({
  apiKey, onChange, onConnect, onClose, wsStatus,
}: {
  apiKey: string
  onChange: (v: string) => void
  onConnect: () => void
  onClose: () => void
  wsStatus: 'disconnected' | 'connecting' | 'connected'
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Chart Settings</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Massive.com API Key
              <span className="ml-2 text-gray-600 font-normal">(optional — for RSI/EMA/MACD overlays)</span>
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={apiKey}
                onChange={e => onChange(e.target.value)}
                placeholder="Enter Massive.com API key for indicators"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-1.5">
              Live price + candles stream from Binance (free, no key needed). Massive key adds RSI/EMA/MACD.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
            <span className="text-gray-400 text-sm">WebSocket Status</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                wsStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                'bg-gray-600'
              }`} />
              <span className={`text-sm font-medium capitalize ${
                wsStatus === 'connected' ? 'text-emerald-400' :
                wsStatus === 'connecting' ? 'text-yellow-400' :
                'text-gray-500'
              }`}>{wsStatus}</span>
            </div>
          </div>

          <button
            onClick={() => { onConnect(); onClose() }}
            className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-medium hover:bg-emerald-500/20 transition-colors"
          >
            {wsStatus === 'connected' ? '↺ Reconnect Binance Stream' : 'Connect Binance Stream'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Chart Component ──────────────────────────────────────────────────────

export function GeoffChart() {
  // UI state
  const [symbol, setSymbol] = useState<CryptoSymbol>('X:SOLUSD')
  const [timeframe, setTimeframe] = useState<Timeframe>('30s')
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})
  const [bid, setBid] = useState(0)
  const [ask, setAsk] = useState(0)
  const [confluence, setConfluence] = useState<ConfluenceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataNote, setDataNote] = useState<string | null>(null)
  const [showFib, setShowFib] = useState(true)
  const [showVolume, setShowVolume] = useState(true)

  // Chart container refs
  const mainRef = useRef<HTMLDivElement>(null)
  const rsiRef = useRef<HTMLDivElement>(null)
  const stochRef = useRef<HTMLDivElement>(null)
  const obvRef = useRef<HTMLDivElement>(null)
  const macdRef = useRef<HTMLDivElement>(null)

  // Chart instances (avoid re-init on re-render)
  const charts = useRef<{
    main: IChartApi | null
    rsi: IChartApi | null
    stoch: IChartApi | null
    obv: IChartApi | null
    macd: IChartApi | null
  }>({ main: null, rsi: null, stoch: null, obv: null, macd: null })

  // Series instances
  const series = useRef<{
    candle: ISeriesApi<'Candlestick'> | null
    ema9: ISeriesApi<'Line'> | null
    ema21: ISeriesApi<'Line'> | null
    ema50: ISeriesApi<'Line'> | null
    vwap: ISeriesApi<'Line'> | null
    volume: ISeriesApi<'Histogram'> | null
    rsi: ISeriesApi<'Line'> | null
    stochK: ISeriesApi<'Line'> | null
    stochD: ISeriesApi<'Line'> | null
    obv: ISeriesApi<'Histogram'> | null
    macdLine: ISeriesApi<'Line'> | null
    macdSignal: ISeriesApi<'Line'> | null
    macdHist: ISeriesApi<'Histogram'> | null
  }>({
    candle: null, ema9: null, ema21: null, ema50: null, vwap: null,
    volume: null, rsi: null, stochK: null, stochD: null, obv: null,
    macdLine: null, macdSignal: null, macdHist: null,
  })

  // Data and instances
  const candlesRef = useRef<Candle[]>([])
  const rsiDataRef = useRef<IndicatorValue[]>([])
  const ema9DataRef = useRef<IndicatorValue[]>([])
  const ema21DataRef = useRef<IndicatorValue[]>([])
  const macdDataRef = useRef<MACDValue[]>([])
  const fibLinesRef = useRef<IPriceLine[]>([])
  const wsRef = useRef<BinanceWebSocket | null>(null)
  const massiveRef = useRef<MassiveREST | null>(null)
  const binanceRestRef = useRef<BinanceREST>(new BinanceREST())

  // Track current symbol for WS callbacks (avoid stale closure)
  const symbolRef = useRef(symbol)
  symbolRef.current = symbol

  // ─── Chart initialization ─────────────────────────────────────────────────

  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !stochRef.current || !obvRef.current || !macdRef.current) return

    let isSyncing = false

    const makeChart = (el: HTMLDivElement, height: number, hideTimeScale = false) =>
      createChart(el, {
        ...CHART_THEME,
        width: el.clientWidth,
        height,
        timeScale: {
          ...CHART_THEME.timeScale,
          visible: !hideTimeScale,
        },
      })

    // Main chart
    const main = makeChart(mainRef.current, 340, true)
    charts.current.main = main
    series.current.candle = main.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#4ade80', wickDownColor: '#f87171',
    })
    series.current.ema9 = main.addLineSeries({ color: '#06b6d4', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    series.current.ema21 = main.addLineSeries({ color: '#a855f7', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    series.current.ema50 = main.addLineSeries({ color: '#f59e0b', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
    series.current.vwap = main.addLineSeries({ color: 'rgba(255,255,255,0.35)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false })
    series.current.volume = main.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: 'rgba(34,197,94,0.3)',
    })
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })

    // RSI chart
    const rsiChart = makeChart(rsiRef.current, 100, true)
    charts.current.rsi = rsiChart
    series.current.rsi = rsiChart.addLineSeries({ color: '#06b6d4', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
    series.current.rsi.createPriceLine({ price: 70, color: '#ef4444', lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'OB', axisLabelVisible: false })
    series.current.rsi.createPriceLine({ price: 30, color: '#22c55e', lineStyle: LineStyle.Dashed, lineWidth: 1, title: 'OS', axisLabelVisible: false })
    series.current.rsi.createPriceLine({ price: 50, color: 'rgba(255,255,255,0.15)', lineStyle: LineStyle.Solid, lineWidth: 1, title: '', axisLabelVisible: false })
    rsiChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })

    // Stochastic chart
    const stochChart = makeChart(stochRef.current, 100, true)
    charts.current.stoch = stochChart
    series.current.stochK = stochChart.addLineSeries({ color: '#06b6d4', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
    series.current.stochD = stochChart.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
    series.current.stochK.createPriceLine({ price: 80, color: '#ef4444', lineStyle: LineStyle.Dashed, lineWidth: 1, title: '', axisLabelVisible: false })
    series.current.stochK.createPriceLine({ price: 20, color: '#22c55e', lineStyle: LineStyle.Dashed, lineWidth: 1, title: '', axisLabelVisible: false })
    stochChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })

    // OBV chart
    const obvChart = makeChart(obvRef.current, 80, true)
    charts.current.obv = obvChart
    series.current.obv = obvChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false })

    // MACD chart (with time scale visible)
    const macdChart = makeChart(macdRef.current, 80, false)
    charts.current.macd = macdChart
    series.current.macdLine = macdChart.addLineSeries({ color: '#06b6d4', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
    series.current.macdSignal = macdChart.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
    series.current.macdHist = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false })

    // Sync time scales
    const allCharts = [main, rsiChart, stochChart, obvChart, macdChart]
    allCharts.forEach(chart => {
      chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (isSyncing || !range) return
        isSyncing = true
        allCharts.filter(c => c !== chart).forEach(c => c.timeScale().setVisibleLogicalRange(range))
        isSyncing = false
      })
    })

    // Fibonacci auto-update on visible range change
    main.timeScale().subscribeVisibleLogicalRangeChange(() => {
      updateFibonacci()
    })

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth })
      if (rsiRef.current) rsiChart.applyOptions({ width: rsiRef.current.clientWidth })
      if (stochRef.current) stochChart.applyOptions({ width: stochRef.current.clientWidth })
      if (obvRef.current) obvChart.applyOptions({ width: obvRef.current.clientWidth })
      if (macdRef.current) macdChart.applyOptions({ width: macdRef.current.clientWidth })
    })
    if (mainRef.current) ro.observe(mainRef.current)

    return () => {
      ro.disconnect()
      allCharts.forEach(c => c.remove())
      charts.current = { main: null, rsi: null, stoch: null, obv: null, macd: null }
      series.current = {
        candle: null, ema9: null, ema21: null, ema50: null, vwap: null,
        volume: null, rsi: null, stochK: null, stochD: null, obv: null,
        macdLine: null, macdSignal: null, macdHist: null,
      }
      fibLinesRef.current = []
    }
  }, []) // Init once

  // ─── Fibonacci update ───────────────────────────────────────────────────────

  const updateFibonacci = useCallback(() => {
    if (!charts.current.main || !series.current.candle || !showFib) return
    const candles = candlesRef.current
    if (candles.length < 2) return

    const logicalRange = charts.current.main.timeScale().getVisibleLogicalRange()
    if (!logicalRange) return

    const from = Math.max(0, Math.floor(logicalRange.from))
    const to = Math.min(candles.length - 1, Math.ceil(logicalRange.to))
    const visible = candles.slice(from, to + 1)
    if (visible.length < 2) return

    const high = Math.max(...visible.map(c => c.high))
    const low = Math.min(...visible.map(c => c.low))

    // Remove old fib lines
    fibLinesRef.current.forEach(l => { try { series.current.candle?.removePriceLine(l) } catch { /* */ } })
    fibLinesRef.current = []

    if (!showFib) return

    FIB_LEVELS.forEach((lvl, i) => {
      const price = high - (high - low) * lvl
      const line = series.current.candle!.createPriceLine({
        price,
        color: FIB_COLORS[i],
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: `${(lvl * 100).toFixed(1)}%`,
        axisLabelVisible: true,
      })
      fibLinesRef.current.push(line)
    })
  }, [showFib])

  // Update fib when showFib changes
  useEffect(() => {
    if (showFib) updateFibonacci()
    else {
      fibLinesRef.current.forEach(l => { try { series.current.candle?.removePriceLine(l) } catch { /* */ } })
      fibLinesRef.current = []
    }
  }, [showFib, updateFibonacci])

  // ─── Set all chart data from loaded candles ─────────────────────────────────

  const renderAllSeries = useCallback((
    candles: Candle[],
    rsiData: IndicatorValue[],
    ema9Data: IndicatorValue[],
    ema21Data: IndicatorValue[],
    ema50Data: IndicatorValue[],
    macdData: MACDValue[],
  ) => {
    const s = series.current
    if (!s.candle) return

    // Main candles
    s.candle.setData(candles.map(c => ({ ...c, time: t(c.time) })))

    // Volume
    if (s.volume) {
      s.volume.setData(candles.map(c => ({
        time: t(c.time),
        value: c.volume,
        color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
      })))
    }

    // EMAs from REST
    const toTs = (v: { timestamp: number; value: number }) => ({ time: t(Math.floor(v.timestamp / 1000)), value: v.value })
    if (s.ema9 && ema9Data.length > 0) s.ema9.setData(ema9Data.map(toTs))
    if (s.ema21 && ema21Data.length > 0) s.ema21.setData(ema21Data.map(toTs))
    if (s.ema50 && ema50Data.length > 0) s.ema50.setData(ema50Data.map(toTs))

    // VWAP (client-side)
    if (s.vwap) {
      const vwapData = calcVWAP(candles)
      s.vwap.setData(vwapData.map(v => ({ time: t(v.time), value: v.value })))
    }

    // RSI
    if (s.rsi && rsiData.length > 0) {
      s.rsi.setData(rsiData.map(toTs))
    }

    // Stochastic (client-side)
    const stoch = calcStochastic(candles)
    if (s.stochK) s.stochK.setData(stoch.map(v => ({ time: t(v.time), value: v.k })))
    if (s.stochD) s.stochD.setData(stoch.map(v => ({ time: t(v.time), value: v.d })))

    // OBV (client-side)
    if (s.obv) {
      const obvData = calcOBV(candles)
      s.obv.setData(obvData.map(v => ({ time: t(v.time), value: v.value, color: v.color })))
    }

    // MACD
    if (macdData.length > 0) {
      if (s.macdLine) s.macdLine.setData(macdData.map(v => ({ time: t(Math.floor(v.timestamp / 1000)), value: v.value })))
      if (s.macdSignal) s.macdSignal.setData(macdData.map(v => ({ time: t(Math.floor(v.timestamp / 1000)), value: v.signal })))
      if (s.macdHist) {
        s.macdHist.setData(macdData.map(v => ({
          time: t(Math.floor(v.timestamp / 1000)),
          value: v.histogram,
          color: v.histogram >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
        })))
      }
    }

    // Confluence
    const vwapData = calcVWAP(candles)
    const conf = calcConfluence(candles, rsiData, ema9Data, ema21Data, vwapData)
    setConfluence(conf)

    // Scroll to latest
    charts.current.main?.timeScale().scrollToRealTime()
    setTimeout(updateFibonacci, 100)
  }, [updateFibonacci])

  // ─── Load historical data ────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setDataNote(null)

    try {
      const binance = binanceRestRef.current
      const tf = TIMEFRAME_CONFIG[timeframe]
      const sym = symbol

      // Historical candles from Binance (free, real-time)
      const candles = await binance.getKlines(sym, tf.binanceInterval, 500)

      // Indicators from Massive REST (requires API key)
      let rsiData: IndicatorValue[] = []
      let ema9Data: IndicatorValue[] = []
      let ema21Data: IndicatorValue[] = []
      let ema50Data: IndicatorValue[] = []
      let macdData: MACDValue[] = []

      if (apiKey && massiveRef.current) {
        const massive = massiveRef.current
        try {
          ;[rsiData, ema9Data, ema21Data, ema50Data, macdData] = await Promise.all([
            massive.getRSI(sym, tf.massiveTimespan, 14),
            massive.getEMA(sym, 9, tf.massiveTimespan),
            massive.getEMA(sym, 21, tf.massiveTimespan),
            massive.getEMA(sym, 50, tf.massiveTimespan),
            massive.getMACD(sym, tf.massiveTimespan),
          ])
        } catch {
          setDataNote('Massive indicators unavailable — chart showing price/volume only')
        }
      } else {
        setDataNote('Enter Massive API key for RSI/EMA/MACD overlays. Chart loads live from Binance.')
      }

      candlesRef.current = candles
      rsiDataRef.current = rsiData
      ema9DataRef.current = ema9Data
      ema21DataRef.current = ema21Data
      macdDataRef.current = macdData

      renderAllSeries(candles, rsiData, ema9Data, ema21Data, ema50Data, macdData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [apiKey, symbol, timeframe, renderAllSeries])

  // Reload on symbol/timeframe change (Binance data doesn't need API key)
  useEffect(() => {
    loadData()
  }, [symbol, timeframe, loadData])

  // ─── WebSocket integration ────────────────────────────────────────────────

  // Initialize Massive REST when API key provided (for indicators only)
  useEffect(() => {
    if (apiKey) massiveRef.current = new MassiveREST(apiKey)
  }, [apiKey])

  const connectWS = useCallback(() => {
    // Cleanup previous WS
    wsRef.current?.destroy()
    wsRef.current = null
    setWsStatus('connecting')

    const ws = new BinanceWebSocket()
    ws.bufferSize = TIMEFRAME_CONFIG[timeframe].bufferSize
    wsRef.current = ws

    // Binance connects instantly — no auth needed
    ws.on('auth_success', () => {
      setWsStatus('connected')
      setError(null)
    })

    // Live price ticks for all symbols
    const symbols: CryptoSymbol[] = ['X:SOLUSD', 'X:BTCUSD', 'X:ETHUSD']
    symbols.forEach(sym => {
      ws.on('tick_' + sym, (event) => {
        const tick = event as { c: number }
        setLivePrices(prev => ({ ...prev, [sym]: tick.c }))
      })

      ws.on('candle_' + sym, (event) => {
        const candle = event as unknown as Candle
        if (sym !== symbolRef.current) return

        const candles = candlesRef.current
        if (candles.length > 0 && candles[candles.length - 1].time === candle.time) {
          candles[candles.length - 1] = candle
        } else {
          candles.push(candle)
          if (candles.length > 2000) candles.shift()
        }

        series.current.candle?.update({ ...candle, time: t(candle.time) })
        if (series.current.volume) {
          series.current.volume.update({
            time: t(candle.time),
            value: candle.volume,
            color: candle.close >= candle.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
          })
        }

        const vwapData = calcVWAP(candlesRef.current)
        if (series.current.vwap && vwapData.length > 0) {
          const vLast = vwapData[vwapData.length - 1]
          series.current.vwap.update({ time: t(vLast.time), value: vLast.value })
        }

        const obvData = calcOBV(candlesRef.current)
        if (series.current.obv && obvData.length > 0) {
          const oLast = obvData[obvData.length - 1]
          series.current.obv.update({ time: t(oLast.time), value: oLast.value, color: oLast.color })
        }

        const stoch = calcStochastic(candlesRef.current)
        if (stoch.length > 0) {
          const last = stoch[stoch.length - 1]
          series.current.stochK?.update({ time: t(last.time), value: last.k })
          series.current.stochD?.update({ time: t(last.time), value: last.d })
        }

        const vwap = calcVWAP(candlesRef.current)
        const conf = calcConfluence(candlesRef.current, rsiDataRef.current, ema9DataRef.current, ema21DataRef.current, vwap)
        setConfluence(conf)
        setLivePrices(prev => ({ ...prev, [sym]: candle.close }))
      })
    })

    ws.on('quote_X:SOLUSD', (event) => {
      const q = event as { bp: number; ap: number }
      setBid(q.bp || 0)
      setAsk(q.ap || 0)
    })

    ws.connect()
  }, [timeframe])

  // Auto-connect Binance WS on mount
  useEffect(() => {
    connectWS()
    return () => {
      wsRef.current?.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update WS buffer size when timeframe changes
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.bufferSize = TIMEFRAME_CONFIG[timeframe].bufferSize
    }
  }, [timeframe])

  // ─── Price display helpers ────────────────────────────────────────────────

  const displaySymbol = SYMBOLS.find(s => s.value === symbol)?.label ?? 'SOL'
  const livePrice = livePrices[symbol] ?? 0

  function fmtPrice(p: number, sym: CryptoSymbol) {
    if (!p) return '—'
    if (sym === 'X:BTCUSD') return `$${p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0 bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          onChange={setApiKey}
          onConnect={connectWS}
          onClose={() => setShowSettings(false)}
          wsStatus={wsStatus}
        />
      )}

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/50 flex-wrap">
        {/* Symbol selector */}
        <div className="flex gap-1">
          {SYMBOLS.map(s => (
            <button
              key={s.value}
              onClick={() => setSymbol(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                symbol === s.value
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Timeframe selector */}
        <div className="flex gap-1">
          {(['30s', '1m', '5m', '15m', '1h'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                timeframe === tf
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Live price */}
        <div className="flex items-center gap-3">
          <span className="text-white font-mono font-bold text-base">{fmtPrice(livePrice, symbol)}</span>
          {bid > 0 && (
            <span className="text-gray-500 text-xs font-mono">
              B: <span className="text-emerald-400">{fmtPrice(bid, symbol)}</span>
              {' · '}
              A: <span className="text-red-400">{fmtPrice(ask, symbol)}</span>
            </span>
          )}
        </div>

        {/* Other symbol prices */}
        <div className="flex gap-3 ml-auto">
          {SYMBOLS.filter(s => s.value !== symbol).map(s => (
            <span key={s.value} className="text-gray-500 text-xs font-mono">
              {s.label}: {fmtPrice(livePrices[s.value] ?? 0, s.value)}
            </span>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Toggles */}
        <button
          onClick={() => setShowFib(v => !v)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${showFib ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' : 'border-gray-700 text-gray-600'}`}
        >
          Fib
        </button>
        <button
          onClick={() => setShowVolume(v => !v)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${showVolume ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-gray-700 text-gray-600'}`}
        >
          Vol
        </button>

        {/* Refresh */}
        {apiKey && (
          <button
            onClick={loadData}
            disabled={loading}
            className="text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* WS status */}
        <div className="flex items-center gap-1.5">
          {wsStatus === 'connected' ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-600" />
          )}
          <div className={`w-1.5 h-1.5 rounded-full ${
            wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
            wsStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
            'bg-gray-700'
          }`} />
        </div>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* ── Data note banner ── */}
      {dataNote && !error && (
        <div className="px-4 py-1.5 bg-yellow-500/8 border-b border-yellow-500/20 text-yellow-500/80 text-xs">
          ⚠ {dataNote}
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* ── Chart layout — always renders, Binance data is free ── */}
      <div className="flex gap-0">
          {/* Left: 5 stacked panes */}
          <div className="flex-1 min-w-0">
            {/* Pane labels row */}
            <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900/30 border-b border-gray-800/50">
              <span className="text-gray-600 text-[10px] uppercase tracking-wider font-medium">
                {displaySymbol}/USD · {timeframe}
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-cyan-400">── EMA9</span>
                <span className="text-purple-400">── EMA21</span>
                <span className="text-amber-400">- - EMA50</span>
                <span className="text-white/40">· · VWAP</span>
              </div>
            </div>

            {/* Main candlestick pane */}
            <div ref={mainRef} className="w-full" />

            {/* RSI pane */}
            <div className="border-t border-gray-800/50">
              <div className="flex items-center gap-2 px-4 py-1 bg-gray-900/20">
                <span className="text-gray-600 text-[10px] uppercase tracking-wider">RSI 14</span>
                <span className="text-[10px] text-red-400/70">─ 70</span>
                <span className="text-[10px] text-emerald-400/70">─ 30</span>
              </div>
              <div ref={rsiRef} className="w-full" />
            </div>

            {/* Stochastic pane */}
            <div className="border-t border-gray-800/50">
              <div className="flex items-center gap-2 px-4 py-1 bg-gray-900/20">
                <span className="text-gray-600 text-[10px] uppercase tracking-wider">Stoch 14,3,3</span>
                <span className="text-cyan-400 text-[10px]">── %K</span>
                <span className="text-amber-400 text-[10px]">── %D</span>
              </div>
              <div ref={stochRef} className="w-full" />
            </div>

            {/* OBV pane */}
            <div className="border-t border-gray-800/50">
              <div className="px-4 py-1 bg-gray-900/20">
                <span className="text-gray-600 text-[10px] uppercase tracking-wider">OBV</span>
              </div>
              <div ref={obvRef} className="w-full" />
            </div>

            {/* MACD pane */}
            <div className="border-t border-gray-800/50">
              <div className="flex items-center gap-2 px-4 py-1 bg-gray-900/20">
                <span className="text-gray-600 text-[10px] uppercase tracking-wider">MACD 12,26,9</span>
                <span className="text-cyan-400 text-[10px]">── MACD</span>
                <span className="text-amber-400 text-[10px]">── Signal</span>
              </div>
              <div ref={macdRef} className="w-full" />
            </div>
          </div>

          {/* Right: Confluence panel */}
          <div className="w-52 border-l border-gray-800 bg-gray-900/30 flex flex-col">
            {/* Score header */}
            <div className="p-4 border-b border-gray-800">
              <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Confluence Score</div>
              {confluence ? (
                <>
                  {/* Score arc/bar */}
                  <div className="relative mb-3">
                    <div className="flex items-end justify-between mb-1">
                      <span className={`text-3xl font-bold font-mono ${
                        confluence.score >= 70 ? 'text-emerald-400' :
                        confluence.score >= 40 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>{confluence.score}</span>
                      <span className="text-gray-500 text-sm">/100</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          confluence.score >= 70 ? 'bg-emerald-500' :
                          confluence.score >= 40 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${confluence.score}%` }}
                      />
                    </div>
                  </div>

                  {/* Direction badge */}
                  <div className={`w-full py-2 rounded-lg text-center text-sm font-bold border ${
                    confluence.direction === 'LONG'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : confluence.direction === 'SHORT'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-gray-800 text-gray-400 border-gray-700'
                  }`}>
                    {confluence.direction === 'LONG' ? '▲ LONG' :
                     confluence.direction === 'SHORT' ? '▼ SHORT' : '— NEUTRAL'}
                  </div>
                </>
              ) : (
                <div className="text-gray-600 text-sm">No data</div>
              )}
            </div>

            {/* Factor breakdown */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {confluence?.factors.map((f, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-[10px]">{f.label}</span>
                    <span className={`text-[10px] font-mono font-bold ${
                      f.score >= f.max * 0.7 ? 'text-emerald-400' :
                      f.score >= f.max * 0.3 ? 'text-yellow-400' :
                      'text-gray-600'
                    }`}>{f.score}/{f.max}</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        f.score >= f.max * 0.7 ? 'bg-emerald-500' :
                        f.score >= f.max * 0.3 ? 'bg-yellow-500' :
                        'bg-gray-700'
                      }`}
                      style={{ width: `${(f.score / f.max) * 100}%` }}
                    />
                  </div>
                  <p className="text-gray-600 text-[9px] leading-tight">{f.detail}</p>
                </div>
              ))}
            </div>

            {/* Symbol mini-prices */}
            <div className="p-3 border-t border-gray-800 space-y-2">
              {SYMBOLS.map(s => (
                <div key={s.value} className="flex items-center justify-between">
                  <span className="text-gray-500 text-[10px]">{s.label}/USD</span>
                  <span className={`font-mono text-[10px] font-medium ${
                    livePrices[s.value] ? 'text-gray-300' : 'text-gray-700'
                  }`}>{fmtPrice(livePrices[s.value] ?? 0, s.value)}</span>
                </div>
              ))}
              <div className="text-center">
                <span className={`text-[9px] font-medium ${
                  wsStatus === 'connected' ? 'text-emerald-500' :
                  wsStatus === 'connecting' ? 'text-yellow-500' :
                  'text-gray-700'
                }`}>
                  {wsStatus === 'connected' ? '● LIVE' :
                   wsStatus === 'connecting' ? '◌ CONNECTING' :
                   '○ OFFLINE'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
