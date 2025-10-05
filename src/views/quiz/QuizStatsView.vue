<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeading from '@/components/ui/PageHeading.vue'
import { useQuizState } from '@/quiz/state'
import { useAdminStore } from '@/stores/admin'
import { VChart } from '@/plugins/echarts'

const { t } = useI18n()
const quiz = useQuizState()
const admin = useAdminStore()

const formatPercent = (value: number) => {
  const sanitized = Number.isFinite(value) ? value : 0
  const hasFraction = Math.abs(sanitized % 1) > 0
  return sanitized.toLocaleString(undefined, {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 1,
  })
}

const byCategory = computed(() => quiz.statsByCategory())

const byStack = computed(() => quiz.statsByStack())

type StackedDatum = { name: string, correct: number, wrong: number, subtitle?: string }

const categoryStackedData = computed<StackedDatum[]>(() => byCategory.value.map((c) => ({
  name: c.name,
  correct: c.correct,
  wrong: Math.max(0, c.total - c.correct),
})))

const stackStackedData = computed<StackedDatum[]>(() => byStack.value.map((s) => ({
  name: s.name,
  correct: s.correct,
  wrong: Math.max(0, s.total - s.correct),
  subtitle: s.catName,
})))

const stackedMode = ref<'category' | 'stack'>('category')

const activeStackedData = computed(() => stackedMode.value === 'category' ? categoryStackedData.value : stackStackedData.value)

const stackedChartTitle = computed(() => stackedMode.value === 'category' ? t('quiz.stats.byCategory') : t('quiz.stats.byStack'))

const stackedChartOptions = computed(() => {
  const data = activeStackedData.value
  const names = data.map(d => d.name)
  const correctSeries = data.map(d => d.correct)
  const wrongSeries = data.map(d => d.wrong)
  return {
    legend: { bottom: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      appendToBody: false,
      backgroundColor: 'var(--color-card)',
      borderColor: 'var(--brand-accent)',
      borderWidth: 1,
      padding: [8, 12],
      extraCssText: 'max-width: min(280px, 85vw); white-space: normal; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22); border-radius: 12px;',
      textStyle: {
        color: 'var(--foreground)',
      },
      formatter: (items: Array<{ axisValueLabel: string, marker: string, seriesName: string, value: number | string, name?: string, axisValue?: string | number, dataIndex?: number }>) => {
        if (!Array.isArray(items) || !items.length) return ''
        const first = items[0]
        const meta = typeof first.dataIndex === 'number' ? data[first.dataIndex] : undefined
        const titleText = meta?.name ?? first.axisValueLabel
        const subtitle = meta?.subtitle ? `<span class="quiz-tooltip__subtitle">${meta.subtitle}</span>` : ''
        const header = `<div class="quiz-tooltip__header"><span class="quiz-tooltip__title">${titleText}</span>${subtitle}</div>`
        const rows = items
          .map((item) => `<div class="quiz-tooltip__row">
            ${item.marker}
            <span class="quiz-tooltip__label">${item.seriesName}</span>
            <span class="quiz-tooltip__value">${item.value}</span>
          </div>`)
          .join('')
        const total = meta ? `<div class="quiz-tooltip__total">
            <span class="quiz-tooltip__total-icon" data-icon="tabler:sum"></span>
            <span>${meta.correct + meta.wrong}</span>
          </div>` : ''
        return `<div class="quiz-tooltip">${header}${rows}${total}</div>`
      },
    },
    grid: { left: 24, right: 16, bottom: 48, top: 32, containLabel: true },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        formatter: (val: string) => (val.length > 18 ? `${val.slice(0, 15)}…` : val),
      },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: t('quiz.stats.correct'),
        type: 'bar',
        stack: 'totals',
        emphasis: { focus: 'series' },
        itemStyle: { color: '#16a34a' },
        data: correctSeries,
      },
      {
        name: t('quiz.stats.wrong'),
        type: 'bar',
        stack: 'totals',
        emphasis: { focus: 'series' },
        itemStyle: { color: '#dc2626' },
        data: wrongSeries,
      },
    ],
  }
})

const overallStats = computed(() => {
  if (!quiz.results.length) {
    return { runs: 0, correct: 0, wrong: 0, total: 0, percent: 0 }
  }
  let runs = 0
  let correct = 0
  let total = 0
  for (const r of quiz.results) {
    runs += 1
    const runTotal = typeof r.total === 'number'
      ? r.total
      : (Array.isArray(r.answers) ? r.answers.length : 0)
    total += runTotal
    correct += typeof r.correct === 'number' ? r.correct : 0
  }
  const wrong = Math.max(0, total - correct)
  const percent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0
  return { runs, correct, wrong, total, percent }
})

const overallPercentText = computed(() => formatPercent(overallStats.value.percent))

const gaugeOptions = computed(() => {
  const stats = overallStats.value
  const value = Math.min(100, Math.max(0, stats.percent))
  const progressGradient = {
    type: 'linear',
    x: 0,
    y: 1,
    x2: 1,
    y2: 0,
    colorStops: [
      { offset: 0, color: '#22c55e' },
      { offset: 1, color: '#14b8a6' },
    ],
    global: false,
  } as const
  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (params: { value: number }) => `${formatPercent(params.value)}%`,
    },
    series: [
      {
        name: 'overall-performance',
        type: 'gauge',
        min: 0,
        max: 100,
        startAngle: 225,
        endAngle: -45,
        clockwise: true,
        radius: '100%',
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 18,
            color: [[1, 'rgba(148, 163, 184, 0.25)']],
            cap: 'round',
          },
        },
        pointer: {
          length: '60%',
          width: 6,
          itemStyle: {
            color: 'var(--foreground)',
          },
        },
        progress: {
          show: true,
          width: 18,
          itemStyle: {
            color: progressGradient,
          },
        },
        axisTick: { show: false },
        splitLine: {
          length: 15,
          lineStyle: {
            width: 2,
            color: '#94a3b8',
          },
        },
        axisLabel: {
          distance: 25,
          color: '#94a3b8',
          fontSize: 14,
          formatter: (val: number) => `${val}%`,
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 24,
          itemStyle: {
            borderWidth: 8,
            borderColor: 'var(--color-card)',
            color: '#22c55e',
          },
        },
        detail: {
          valueAnimation: true,
          fontSize: 32,
          fontWeight: 600,
          color: 'var(--foreground)',
          offsetCenter: [0, '70%'],
          formatter: (val: number) => `${formatPercent(val)}%`,
        },
        data: [
          {
            value,
          },
        ],
      },
    ],
  }
})

const gaugeStatEntries = computed(() => {
  const stats = overallStats.value
  return [
    { key: 'correct', label: t('quiz.stats.correct'), value: stats.correct.toLocaleString() },
    { key: 'wrong', label: t('quiz.stats.wrong'), value: stats.wrong.toLocaleString() },
    { key: 'total', label: t('quiz.stats.totalQuestions'), value: stats.total.toLocaleString() },
    { key: 'runs', label: t('quiz.stats.runs'), value: stats.runs.toLocaleString() },
  ]
})

function onClearHistory() {
  if (!confirm(t('quiz.stats.clearHistoryConfirm'))) return
  const success = quiz.clearResults()
  if (!success) {
    window.alert(t('quiz.stats.clearHistoryAuthFailed'))
  }
}


// Filter-States
const selectedCategory = ref<string>('all')
const selectedStack = ref<string>('all')

const categoriesOptions = computed(() => [{ id: 'all', name: t('quiz.all') }, ...quiz.categories.map(c => ({ id: c.id, name: quiz.localize(c.name) }))])
const stacksOptions = computed(() => {
  const stacks = selectedCategory.value === 'all'
    ? quiz.stacks
    : quiz.stacks.filter(s => s.categoryId === selectedCategory.value)
  return [{ id: 'all', name: t('quiz.all') }, ...stacks.map(s => ({ id: s.id, name: quiz.localize(s.name) }))]
})

watch(selectedCategory, (val) => {
  // wenn Kategorie geändert, Stack ggf. zurücksetzen, wenn nicht passend
  if (val !== 'all') {
    const st = quiz.stacks.find(s => s.id === selectedStack.value)
    if (!st || st.categoryId !== val) selectedStack.value = 'all'
  }
})

// Zeitreihen-Daten aus Ergebnissen: x=timestamp, y=correct/total in Prozent
const timeSeries = computed(() => {
  const rows = quiz.results
    .filter(r => selectedCategory.value === 'all' || r.categoryId === selectedCategory.value)
    .filter(r => selectedStack.value === 'all' || r.stackId === selectedStack.value)
    .map(r => ({ t: r.timestamp, v: r.total ? Math.round((r.correct / r.total) * 100) : 0 }))
    .sort((a, b) => a.t - b.t)
  return rows
})

const chartOptions = computed(() => ({
  title: { text: t('quiz.stats.title') },
  tooltip: {
    trigger: 'axis',
    confine: true,
    appendToBody: false,
    valueFormatter: (v: number) => `${v}%`,
    backgroundColor: 'var(--color-card)',
    borderColor: 'var(--brand-accent)',
    borderWidth: 1,
    padding: [8, 12],
    extraCssText: 'max-width: min(260px, 80vw); white-space: normal; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22); border-radius: 12px;',
    textStyle: {
      color: 'var(--foreground)',
    },
    position: (pos: [number, number], _params: unknown, _dom: HTMLElement, _rect: unknown, size: { viewSize: [number, number], contentSize: [number, number] }) => {
      const padding = 12
      const [x, y] = pos
      const [viewWidth, viewHeight] = size.viewSize
      const [contentWidth, contentHeight] = size.contentSize
      const maxLeft = viewWidth - contentWidth - padding
      const maxTop = viewHeight - contentHeight - padding
      let left = Math.min(Math.max(x, padding), maxLeft)
      let top = Math.min(Math.max(y, padding), maxTop)
      if (maxLeft < padding) {
        left = Math.max(0, (viewWidth - contentWidth) / 2)
      }
      if (maxTop < padding) {
        top = Math.max(0, (viewHeight - contentHeight) / 2)
      }
      return [left, top]
    },
  },
  grid: { left: 24, right: 16, bottom: 48, top: 40, containLabel: true },
  xAxis: {
    type: 'time',
    axisLabel: {
      formatter: (val: number) => new Date(val).toLocaleDateString(),
      //margin: 12,
    },
  },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  dataZoom: [
    { type: 'inside' },
    { type: 'slider', height: 20, bottom: 16 },
  ],
  series: [
    {
      name: t('quiz.runner.result'),
      type: 'line',
      smooth: true,
      showSymbol: true,
      symbolSize: 6,
      areaStyle: { opacity: 0.1 },
      data: timeSeries.value.map(p => [p.t, p.v]),
    },
  ],
}))
</script>

<template>
  <section class="app-page">
    <PageHeading :parent="t('quiz.title')" :parent-to="{ name: 'quiz-home' }" :title="t('quiz.tabs.stats')"
      :title-to="{ name: 'quiz-stats' }" :description="t('quiz.stats.subtitle')">
      <template v-if="admin.isAdmin" #actions>
        <button class="btn" type="button" @click="onClearHistory">{{ t('quiz.stats.clearHistory') }}</button>
      </template>
    </PageHeading>

    <div class="grid gap-4">
      <!-- Chart: Gesamt-Erfolgsquote Gauge -->
      <div class="panel overflow-hidden">
        <h2 class="font-medium mb-2">{{ t('quiz.stats.overall') }}</h2>
        <div v-if="overallStats.total" class="quiz-gauge">
          <div class="quiz-gauge__chart">
            <VChart class="chart-box__canvas" autoresize :option="gaugeOptions" />
          </div>
          <div class="quiz-gauge__percent">{{ overallPercentText }}%</div>
          <div class="quiz-gauge__stats">
            <div v-for="item in gaugeStatEntries" :key="item.key" class="quiz-gauge__stat">
              <span class="quiz-gauge__label">{{ item.label }}</span>
              <span class="quiz-gauge__value">{{ item.value }}</span>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">{{ t('quiz.stats.noData') }}</p>
      </div>

      <!-- Chart: Zeitreihe Erfolg (%) -->
      <div class="panel overflow-hidden">
        <div class="stats-filter mb-4">
          <label class="stats-filter__item">
            <span class="stats-filter__label">{{ t('quiz.filterByCategory') }}</span>
            <select v-model="selectedCategory" class="input stats-filter__select">
              <option v-for="c in categoriesOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="stats-filter__item">
            <span class="stats-filter__label">{{ t('quiz.filterByStack') }}</span>
            <select v-model="selectedStack" class="input stats-filter__select">
              <option v-for="s in stacksOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
        </div>
        <div class="chart-box">
          <VChart class="chart-box__canvas" autoresize :option="chartOptions" />
        </div>
        <p v-if="!timeSeries.length" class="text-sm text-muted-foreground mt-2">{{ t('quiz.stats.noData') }}</p>
      </div>

      <!-- Chart: Gestapelte Balken mit Umschalter -->
      <div class="panel overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 class="font-medium">{{ stackedChartTitle }} · {{ t('quiz.stats.correct') }}/{{ t('quiz.stats.wrong') }}
          </h2>
          <div class="flex items-center gap-2">
            <button class="btn" type="button" :class="{ primary: stackedMode === 'category' }"
              :aria-pressed="stackedMode === 'category'" @click="stackedMode = 'category'">
              {{ t('quiz.stats.byCategory') }}
            </button>
            <button class="btn" type="button" :class="{ primary: stackedMode === 'stack' }"
              :aria-pressed="stackedMode === 'stack'" @click="stackedMode = 'stack'">
              {{ t('quiz.stats.byStack') }}
            </button>
          </div>
        </div>
        <div class="chart-box chart-box--tall">
          <VChart :key="stackedMode" class="chart-box__canvas" autoresize :option="stackedChartOptions" />
        </div>
        <p v-if="!activeStackedData.length" class="text-sm text-muted-foreground mt-2">{{ t('quiz.stats.noData') }}</p>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="panel">
          <h2 class="quiz-panel__heading">{{ t('quiz.stats.byCategory') }}</h2>
          <div v-if="!byCategory.length" class="text-sm text-muted-foreground">{{ t('quiz.stats.noData') }}</div>
          <ul class="space-y-2">
            <li v-for="c in byCategory" :key="c.id" class="flex items-center justify-between gap-3">
              <div>
                <div class="font-medium">{{ c.name }}</div>
                <div class="text-xs text-muted-foreground">{{ c.runs }} {{ t('quiz.stats.runs') }} · {{ c.correct }}/{{
                  c.total }}</div>
              </div>
              <div class="text-sm font-medium">{{ Math.round(c.avg * 100) }}%</div>
            </li>
          </ul>
        </div>

        <div class="panel">
          <h2 class="quiz-panel__heading">{{ t('quiz.stats.byStack') }}</h2>
          <div v-if="!byStack.length" class="text-sm text-muted-foreground">{{ t('quiz.stats.noData') }}</div>
          <ul class="space-y-2">
            <li v-for="s in byStack" :key="s.id" class="flex items-center justify-between gap-3">
              <div>
                <div class="font-medium">{{ s.name }}</div>
                <div class="text-xs text-muted-foreground">{{ s.catName }} · {{ s.runs }} {{ t('quiz.stats.runs') }} ·
                  {{ s.correct }}/{{
                    s.total }}</div>
              </div>
              <div class="text-sm font-medium">{{ Math.round(s.avg * 100) }}%</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
