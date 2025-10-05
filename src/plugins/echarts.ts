import { defineAsyncComponent } from 'vue'

let modulesRegistered = false

const registerEChartsModules = async () => {
  const { use } = await import('echarts/core')
  const { CanvasRenderer } = await import('echarts/renderers')
  const { LineChart, BarChart, GaugeChart } = await import('echarts/charts')
  const { GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent } = await import('echarts/components')

  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    GaugeChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent,
  ])

  modulesRegistered = true
}

export const VChart = defineAsyncComponent(async () => {
  if (!modulesRegistered) {
    await registerEChartsModules()
  }
  const { default: component } = await import('vue-echarts')
  return component
})
